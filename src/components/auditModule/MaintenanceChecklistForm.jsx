import React, { useState, useEffect, useMemo } from 'react'
import { X, CheckCircle2, MapPin, Loader2, FileText, XCircle, MinusCircle } from 'lucide-react'

const RESPONSE_BTNS = [
  { value: 'pass', label: 'Pass', color: 'var(--green)', bg: 'rgba(34,197,94,0.1)' },
  { value: 'fail', label: 'Fail', color: 'var(--red)',   bg: 'var(--status-danger-soft)' },
  { value: 'na',   label: 'N/A',  color: 'var(--text-3)', bg: 'var(--bg-3)' },
]

export default function MaintenanceChecklistForm({ checklist, asset, siteInfo, onSubmit, onClose }) {
  const [results, setResults] = useState([])
  const [notes, setNotes] = useState('')
  const [preparedName, setPreparedName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [gpsError, setGpsError] = useState('')

  useEffect(() => {
    if (checklist?.items) {
      setResults(checklist.items.map(item => ({
        id: item.id,
        section: item.section || '',
        question: item.question,
        type: item.type || 'pass_fail_na',
        answer: '',
        remarks: '',
      })))
    }
  }, [checklist])

  const updateResult = (idx, field, value) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  // Group items by section
  const sections = useMemo(() => {
    const groups = []
    const seen = new Set()
    for (const item of results) {
      const sec = item.section || 'General'
      if (!seen.has(sec)) {
        seen.add(sec)
        groups.push(sec)
      }
    }
    return groups
  }, [results])

  // Progress stats
  const answered = results.filter(r => r.answer).length
  const total = results.length
  const failCount = results.filter(r => r.answer === 'fail').length

  const handleSubmit = () => {
    if (!preparedName.trim()) return alert('Please enter your name.')

    const unanswered = results.filter(r => !r.answer).length
    if (unanswered > 0 && !window.confirm(`${unanswered} item(s) have no response. Submit anyway?`)) return

    setSubmitting(true)
    setGpsError('')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSubmitting(false)
        onSubmit({
          results,
          notes,
          preparedSignature: null,
          preparedName: preparedName.trim(),
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
      },
      () => {
        setSubmitting(false)
        setGpsError('Could not get GPS location. Please enable location services.')
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  if (!checklist) return null

  return (
    <div className="modal-bg" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 700, padding: 0, overflow: 'hidden', maxHeight: '92vh' }}>
        {/* Header */}
        <div className="card-header" style={{ background: 'var(--bg-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30', flexShrink: 0 }}>
              <FileText size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {checklist.name}
              </h2>
              <span style={{ color: 'var(--text-3)', }}>
                {asset?.asset_code} - {asset?.asset_name}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6, flexShrink: 0 }}><X size={16} /></button>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '8px 20px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--text-3)' }}>
            <span>{answered} / {total} answered</span>
            <span style={{ display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--green)' }}>{results.filter(r => r.answer === 'pass').length} Pass</span>
              <span style={{ color: 'var(--red)' }}>{failCount} Fail</span>
              <span>{results.filter(r => r.answer === 'na').length} N/A</span>
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-3)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, transition: 'width 0.3s',
              background: failCount > 0 ? 'var(--red)' : answered === total ? 'var(--green)' : 'var(--accent)',
              width: `${total > 0 ? (answered / total) * 100 : 0}%`,
            }} />
          </div>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(92vh - 230px)' }}>
          {/* Sections with items */}
          {sections.map((sectionName, si) => {
            const sectionItems = results.map((r, idx) => ({ ...r, _idx: idx })).filter(r => (r.section || 'General') === sectionName)
            return (
              <div key={si} style={{ marginBottom: 20 }}>
                {/* Section header */}
                <div style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 8,
                  background: 'linear-gradient(135deg, rgba(43,127,255,0.08) 0%, rgba(43,127,255,0.03) 100%)',
                  border: '1px solid rgba(43,127,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {sectionName}
                  </span>
                  <span style={{ color: 'var(--text-3)' }}>
                    {sectionItems.filter(r => r.answer).length}/{sectionItems.length}
                  </span>
                </div>

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sectionItems.map((item, ii) => {
                    const ansColor = item.answer === 'pass' ? 'rgba(34,197,94,0.05)' : item.answer === 'fail' ? 'var(--status-danger-soft)' : 'var(--bg-2)'
                    const borderColor = item.answer === 'pass' ? 'rgba(34,197,94,0.25)' : item.answer === 'fail' ? 'var(--status-danger-soft)' : 'var(--border)'
                    return (
                      <div key={item.id} style={{
                        padding: '10px 12px', borderRadius: 8,
                        border: `1px solid ${borderColor}`,
                        background: ansColor, transition: 'all 0.2s',
                      }}>
                        {/* Question row */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: 5, background: 'var(--bg-3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-3)', flexShrink: 0, marginTop: 1,
                          }}>
                            {ii + 1}
                          </span>
                          <p style={{ color: 'var(--text-1)', margin: 0, flex: 1, }}>
                            {item.question}
                          </p>
                        </div>

                        {/* Pass / Fail / N/A + Remarks */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 28 }}>
                          {RESPONSE_BTNS.map(btn => {
                            const active = item.answer === btn.value
                            return (
                              <button key={btn.value} onClick={() => updateResult(item._idx, 'answer', active ? '' : btn.value)}
                                style={{
                                  padding: '4px 12px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.03em',
                                  border: `1.5px solid ${active ? btn.color : 'var(--border)'}`,
                                  background: active ? btn.bg : 'transparent',
                                  color: active ? btn.color : 'var(--text-3)',
                                  cursor: 'pointer', transition: 'all 0.15s',
                                }}>
                                {btn.label}
                              </button>
                            )
                          })}
                          {item.answer !== 'fail' && (
                            <input
                              type="text"
                              value={item.remarks || ''}
                              onChange={e => updateResult(item._idx, 'remarks', e.target.value)}
                              placeholder="Remarks / Actions required..."
                              style={{
                                flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-1)',
                                color: 'var(--text-1)', minWidth: 0,
                              }}
                            />
                          )}
                        </div>

                        {/* CONDITIONAL DEFECT SUB-FIELDS (MANDATORY ON FAIL) */}
                        {item.answer === 'fail' && (
                          <div style={{
                            marginTop: 10, marginLeft: 28, padding: 10, borderRadius: 8,
                            background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-soft)',
                            display: 'flex', flexDirection: 'column', gap: 8
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <label className="lbl" style={{ marginBottom: 2 }}>Defect Category *</label>
                                <select 
                                  value={item.defect_category || 'Mechanical'} 
                                  onChange={e => updateResult(item._idx, 'defect_category', e.target.value)}
                                  className="sel" style={{ height: 28 }}
                                >
                                  <option value="Mechanical">Mechanical</option>
                                  <option value="Electrical">Electrical</option>
                                  <option value="Structural">Structural</option>
                                  <option value="Hydraulic">Hydraulic</option>
                                  <option value="Safety">Safety Critical</option>
                                </select>
                              </div>
                              <div>
                                <label className="lbl" style={{ marginBottom: 2 }}>Severity Level *</label>
                                <select 
                                  value={item.severity || 'Medium'} 
                                  onChange={e => updateResult(item._idx, 'severity', e.target.value)}
                                  className="sel" style={{ height: 28 }}
                                >
                                  <option value="Low">Low</option>
                                  <option value="Medium">Medium</option>
                                  <option value="High">High Risk</option>
                                  <option value="Critical">Critical Breakdown</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="lbl" style={{ marginBottom: 2 }}>Defect Details & Photo Proof URL *</label>
                              <input 
                                type="text"
                                placeholder="Describe defect & paste photo proof link..."
                                value={item.remarks || ''}
                                onChange={e => updateResult(item._idx, 'remarks', e.target.value)}
                                className="inp" style={{ height: 28 }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Additional Notes */}
          <label className="lbl">Additional Notes</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any additional observations..."
            rows={2}
            style={{
              width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-2)', resize: 'vertical', marginBottom: 16, color: 'var(--text-1)',
            }}
          />

          {/* Prepared By */}
          <label className="lbl">Prepared By (Your Name)</label>
          <input
            type="text" value={preparedName}
            onChange={e => setPreparedName(e.target.value)}
            placeholder="Full name..."
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-2)', marginBottom: 16, color: 'var(--text-1)',
            }}
          />

          {/* GPS info */}
          <div style={{
            marginTop: 14, padding: 10, borderRadius: 8, background: 'rgba(14,165,233,0.06)',
            border: '1px solid rgba(14,165,233,0.15)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <MapPin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-2)', }}>
              GPS coordinates and date will be captured on submit.
            </span>
          </div>

          {gpsError && (
            <p style={{ color: 'var(--red)', marginTop: 8 }}>{gpsError}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} className="btn-ghost" >Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary" >
            {submitting ? <><Loader2 size={13} className="spin" /> Submitting...</> : <><CheckCircle2 size={13} /> Submit Checklist</>}
          </button>
        </div>
      </div>
    </div>
  )
}


