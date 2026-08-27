import React, { useState, useRef } from 'react'
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

/**
 * Parses an Excel file to create maintenance checklists.
 * Expected Excel format:
 *   Column A: Checklist Name
 *   Column B: Category (asset category to link)
 *   Column C: Frequency (daily/weekly/monthly)
 *   Column D+: Checklist item questions (one per column, or one per row)
 *
 * Alternatively, simpler format:
 *   Row 1 header: name, category, frequency, then item columns (item_1, item_2, ...)
 *   Each row = one checklist
 *
 * Or vertical format per sheet:
 *   Row 1: Checklist Name
 *   Row 2: Category
 *   Row 3: Frequency
 *   Row 4+: Checklist items (one per row)
 */
export default function ChecklistImportModal({ onImport, onClose }) {
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError('')
    setParsed([])

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const results = []

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          if (!rows.length) continue

          // Detect format by header row
          const header = rows[0].map(h => String(h).toLowerCase().trim().replace(/\s+/g, '_'))

          // Find column indexes
          const nameIdx = ['checklist_name', 'name'].map(k => header.indexOf(k)).find(i => i >= 0) ?? -1
          const catIdx = header.indexOf('category')
          const freqIdx = header.indexOf('frequency')
          const sectionIdx = header.indexOf('section')
          const itemIdx = ['inspection_item', 'checklist_item', 'item'].map(k => header.indexOf(k)).find(i => i >= 0) ?? -1

          if (nameIdx >= 0 && itemIdx >= 0) {
            // Vertical format: one row per item, grouped by checklist_name
            const grouped = {}
            for (let r = 1; r < rows.length; r++) {
              const row = rows[r]
              const clName = String(row[nameIdx] || '').trim()
              const itemText = String(row[itemIdx] || '').trim()
              if (!clName || !itemText) continue

              if (!grouped[clName]) {
                grouped[clName] = {
                  name: clName,
                  category: catIdx >= 0 ? String(row[catIdx] || '').trim() : '',
                  frequency: freqIdx >= 0 ? String(row[freqIdx] || 'monthly').trim().toLowerCase() : 'monthly',
                  items: [],
                }
              }
              grouped[clName].items.push({
                id: `item_${r}`,
                section: sectionIdx >= 0 ? String(row[sectionIdx] || '').trim() : '',
                question: itemText,
                type: 'pass_fail_na',
              })
            }

            for (const cl of Object.values(grouped)) {
              cl.frequency = ['daily', 'weekly', 'monthly'].includes(cl.frequency) ? cl.frequency : 'monthly'
              results.push(cl)
            }
          } else if (nameIdx >= 0) {
            // Horizontal format: name | category | frequency | item_1 | item_2 | ...
            for (let r = 1; r < rows.length; r++) {
              const row = rows[r]
              if (!row[nameIdx]) continue
              const items = []
              for (let c = 0; c < header.length; c++) {
                if (c === nameIdx || c === catIdx || c === freqIdx || c === sectionIdx) continue
                if (row[c] && String(row[c]).trim()) {
                  items.push({
                    id: `item_${r}_${c}`,
                    question: String(row[c]).trim(),
                    type: 'pass_fail_na',
                  })
                }
              }
              results.push({
                name: String(row[nameIdx]).trim(),
                category: catIdx >= 0 ? String(row[catIdx] || '').trim() : '',
                frequency: freqIdx >= 0 ? String(row[freqIdx] || 'monthly').trim().toLowerCase() : 'monthly',
                items,
              })
            }
          }
        }

        if (results.length === 0) {
          setError('No valid checklists found. Please check the file format.')
        } else {
          setParsed(results)
        }
      } catch (err) {
        setError('Failed to parse Excel file: ' + err.message)
      }
    }
    reader.readAsBinaryString(f)
  }

  const handleImport = async () => {
    if (!parsed.length) return
    setImporting(true)
    try {
      await onImport(parsed)
      onClose()
    } catch (err) {
      setError('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['checklist_name', 'category', 'frequency', 'section', 'inspection_item'],
      ['Monthly Tower Crane Safety Audit', 'Tower Crane', 'monthly', 'Structural Components', 'Verify torque values on all mast joint bolts/nuts'],
      ['Monthly Tower Crane Safety Audit', 'Tower Crane', 'monthly', 'Structural Components', 'Inspect mast framework for metal fatigue or cracks'],
      ['Monthly Tower Crane Safety Audit', 'Tower Crane', 'monthly', 'Structural Components', 'Confirm fall protection netting is securely rigged'],
      ['Monthly Tower Crane Safety Audit', 'Tower Crane', 'monthly', 'Slewing Assembly', 'Inspect tower peak for structural integrity'],
      ['Monthly Tower Crane Safety Audit', 'Tower Crane', 'monthly', 'Slewing Assembly', 'Verify torque on slewing ring / turntable bolts'],
      ['Monthly Tower Crane Safety Audit', 'Tower Crane', 'monthly', 'Slewing Assembly', 'Test slewing brake efficiency and limit switches'],
      ['Monthly Tower Crane Safety Audit', 'Tower Crane', 'monthly', 'Safety & Operations', 'Validate Safe Load Indicator (SLI) calibration'],
      ['Monthly Tower Crane Safety Audit', 'Tower Crane', 'monthly', 'Safety & Operations', 'Record current wind speed'],
      ['Bar Bending Machine Monthly', 'Bar Bending Machine', 'monthly', 'Mechanical', 'Check motor condition and noise levels'],
      ['Bar Bending Machine Monthly', 'Bar Bending Machine', 'monthly', 'Mechanical', 'Inspect bending disc and pins for wear'],
      ['Bar Bending Machine Monthly', 'Bar Bending Machine', 'monthly', 'Safety', 'Verify emergency stop works correctly'],
      ['Bar Bending Machine Monthly', 'Bar Bending Machine', 'monthly', 'Electrical', 'Inspect electrical panel and connections'],
    ])
    ws['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 12 }, { wch: 24 }, { wch: 55 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Checklists')
    XLSX.writeFile(wb, 'maintenance_checklist_template.xlsx')
  }

  const FREQ_COLORS = {
    daily: { bg: 'var(--status-danger-soft)', color: 'var(--red)' },
    weekly: { bg: 'var(--status-warning-soft)', color: 'var(--amber)' },
    monthly: { bg: 'rgba(14,165,233,0.1)', color: 'var(--accent)' },
  }

  return (
    <div className="modal-bg" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 600, padding: 0, overflow: 'hidden', maxHeight: '85vh' }}>
        {/* Header */}
        <div className="card-header" style={{ background: 'var(--bg-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'rgba(34,197,94,0.1)', borderRadius: 10, color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0 }}>IMPORT CHECKLISTS</h2>
              <span style={{ color: 'var(--text-3)', }}>Upload Excel with maintenance checklists</span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(85vh - 140px)' }}>
          {/* Download template */}
          <button onClick={downloadTemplate} className="btn-ghost" style={{
            width: '100%', padding: '10px 14px', marginBottom: 14, border: '1px dashed var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Download size={14} style={{ color: 'var(--accent)' }} /> Download Excel Template
          </button>

          {/* File input */}
          <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost" style={{
            width: '100%', padding: '24px', marginBottom: 14, border: '2px dashed var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, color: 'var(--text-2)',
          }}>
            <Upload size={24} style={{ color: 'var(--accent)' }} />
            {file ? file.name : 'Click to select Excel file'}
          </button>

          {error && (
            <div style={{ padding: 10, borderRadius: 8, background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-soft)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} style={{ color: 'var(--red)' }} />
              <span style={{ color: 'var(--red)', }}>{error}</span>
            </div>
          )}

          {/* Preview parsed checklists */}
          {parsed.length > 0 && (
            <div>
              <label className="lbl" style={{ marginBottom: 8 }}>{parsed.length} Checklist(s) Found</label>
              {parsed.map((cl, i) => {
                const fc = FREQ_COLORS[cl.frequency] || FREQ_COLORS.monthly
                return (
                  <div key={i} style={{
                    padding: 12, borderRadius: 10, border: '1px solid var(--border)',
                    background: 'var(--bg-2)', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span >{cl.name}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10,
                        textTransform: 'uppercase',
                        background: fc.bg, color: fc.color,
                      }}>{cl.frequency}</span>
                    </div>
                    {cl.category && (
                      <span style={{ color: 'var(--text-3)', }}>Category: {cl.category}</span>
                    )}
                    {(() => {
                      const sections = [...new Set(cl.items.map(it => it.section).filter(Boolean))]
                      return sections.length > 0 ? (
                        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {sections.map((sec, si) => (
                            <span key={si} style={{
                              padding: '2px 7px', borderRadius: 6,
                              background: 'var(--bg-3)', color: 'var(--text-3)', }}>{sec} ({cl.items.filter(it => it.section === sec).length})</span>
                          ))}
                        </div>
                      ) : null
                    })()}
                    <div style={{ marginTop: 6, color: 'var(--text-2)', }}>
                      {cl.items.length} inspection items · Pass / Fail / N/A format
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} className="btn-ghost" >Cancel</button>
          <button onClick={handleImport} disabled={!parsed.length || importing} className="btn-primary" >
            {importing ? 'Importing...' : <><CheckCircle2 size={13} /> Import {parsed.length} Checklist(s)</>}
          </button>
        </div>
      </div>
    </div>
  )
}


