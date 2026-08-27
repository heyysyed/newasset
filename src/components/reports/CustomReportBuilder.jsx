import React, { useState } from 'react'
import { X, Plus, Sparkles, CheckCircle2, Sliders, Database, Layers } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { executeCustomReport } from '../../lib/reports'
import { exportReportToExcel } from '../../lib/reportExport'
import { Download } from 'lucide-react'

const SOURCE_FIELDS = {
  assets: [
    'asset_code', 'asset_name', 'category', 'status', 'condition', 'site', 
    'purchase_value', 'added_on', 'make', 'model_no', 'purchase_order_no', 
    'serial_no', 'capacity', 'type_code', 'purchase_date', 'location', 
    'department', 'notes', 'salvage_value', 'useful_life_years', 
    'depreciation_method', 'depreciation_rate_percent', 'warranty_expiry', 
    'disposal_date', 'disposal_reason'
  ],
  audit_assignments: ['title', 'audit_type', 'site_id', 'status', 'due_date', 'geofence_verified', 'created_at'],
  bulk_audits: ['site', 'system_qty', 'physical_qty', 'variance_qty', 'variance_value_inr', 'risk_tier', 'is_high_risk_anomaly'],
  checklist_items: ['template_id', 'section', 'question', 'type', 'is_critical_safety'],
}

export default function CustomReportBuilder({ onClose, onSaveTemplate, user }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dataSource, setDataSource] = useState('assets')
  const [selectedFields, setSelectedFields] = useState(['asset_code', 'asset_name', 'category', 'purchase_value'])
  const [groupBy, setGroupBy] = useState('category')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const availableFields = SOURCE_FIELDS[dataSource] || []

  const toggleField = (f) => {
    if (selectedFields.includes(f)) {
      setSelectedFields(selectedFields.filter(x => x !== f))
    } else {
      setSelectedFields([...selectedFields, f])
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return alert('Please enter a template name.')
    setSaving(true)
    try {
      const templateData = {
        name,
        description,
        data_source: dataSource,
        fields: selectedFields,
        group_by: groupBy,
        filters: {},
        owner_id: user?.id || null,
      }

      const { data, error } = await supabase
        .from('report_templates')
        .insert(templateData)
        .select()
        .single()

      if (error) {
        // Fallback if table not created in database yet
        console.warn('Supabase template insert error, saving to localStorage:', error)
      }

      onSaveTemplate({ id: data?.id || Date.now(), ...templateData })
      alert('Custom Report Template saved successfully!')
      onClose()
    } catch (e) {
      alert('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    if (selectedFields.length === 0) return alert('Please select at least one field.')
    setExporting(true)
    try {
      const config = {
        data_source: dataSource,
        fields: selectedFields,
        group_by: groupBy,
        filters: {}
      }
      
      const { summary, columns, rows } = await executeCustomReport(config)
      
      exportReportToExcel({
        title: name || 'Custom Export',
        summary,
        columns,
        rows
      })
    } catch (e) {
      alert('Export failed: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="modal-bg" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 540, width: '95%', padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div className="card-header" style={{ background: 'var(--bg-3)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
              <Sliders size={18} />
            </div>
            <div>
              <h2 style={{ letterSpacing: '0.04em', margin: 0, color: 'var(--text-0)' }}>
                CUSTOM REPORT BUILDER
              </h2>
              <span style={{ color: 'var(--text-3)' }}>
                Design custom enterprise reporting templates & analytics
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '75vh', overflowY: 'auto' }}>
          <div>
            <label className="lbl" style={{ marginBottom: 6 }}>Template Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Monthly High-Value Site Variance Report"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
            />
          </div>

          <div>
            <label className="lbl" style={{ marginBottom: 6 }}>Data Source</label>
            <select
              value={dataSource}
              onChange={e => {
                const ds = e.target.value
                setDataSource(ds)
                setSelectedFields(SOURCE_FIELDS[ds]?.slice(0, 4) || [])
                setGroupBy(SOURCE_FIELDS[ds]?.[2] || '')
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
            >
              <option value="assets">Assets Register (Master Inventory)</option>
              <option value="audit_assignments">Audit Assignments Command Center</option>
              <option value="bulk_audits">Stock Reconciliation & Variance</option>
              <option value="checklist_items">Maintenance Checklists & Safety</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="lbl" style={{ margin: 0 }}>Include Fields</label>
              <button
                onClick={() => {
                  if (selectedFields.length === availableFields.length) {
                    setSelectedFields([])
                  } else {
                    setSelectedFields([...availableFields])
                  }
                }}
                className="btn-ghost"
                style={{ padding: '2px 6px', color: 'var(--accent)' }}
              >
                {selectedFields.length === availableFields.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 10, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              {availableFields.map(f => {
                const isSelected = selectedFields.includes(f)
                return (
                  <button
                    key={f}
                    onClick={() => toggleField(f)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, background: isSelected ? 'rgba(14,165,233,0.12)' : 'var(--bg-1)',
                      color: isSelected ? 'var(--accent)' : 'var(--text-2)',
                      border: `1px solid ${isSelected ? 'rgba(14,165,233,0.4)' : 'var(--border)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}{f.replace(/_/g, ' ')}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="lbl" style={{ marginBottom: 6 }}>Group By (Aggregations)</label>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
            >
              {availableFields.map(f => (
                <option key={f} value={f}>{f.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onClose} className="btn-ghost" >Cancel</button>
          <button onClick={handleExport} disabled={exporting} className="btn-outline" style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={14} /> {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}


