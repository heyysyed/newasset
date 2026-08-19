import React, { useState } from 'react'
import { X, CheckCircle2, XCircle, FileText, Download, Loader2, MapPin, Clock, User } from 'lucide-react'
import SignaturePad from '../checklist/SignaturePad'
import generateAuditPDF from './generateAuditPDF'
import companyLogo from '../../assets/logo.png'

const STATUS_CONFIG = {
  pending_checker: { label: 'Pending Checker', color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)' },
  pending_hod:     { label: 'Pending HOD',     color: 'var(--accent)', bg: 'rgba(14,165,233,0.1)' },
  approved:        { label: 'Approved',         color: 'var(--green)', bg: 'rgba(34,197,94,0.1)' },
  rejected:        { label: 'Rejected',         color: 'var(--red)', bg: 'rgba(239,68,68,0.1)' },
}

export default function ApprovalModal({ submission, role, userId, onApprove, onReject, onClose }) {
  const [signature, setSignature] = useState(null)
  const [approverName, setApproverName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const sc = STATUS_CONFIG[submission?.approval_status] || STATUS_CONFIG.pending_checker

  const canApprove = (role === 'checker' && submission?.approval_status === 'pending_checker') ||
    (role === 'hod' && submission?.approval_status === 'pending_hod')

  const handleApprove = async () => {
    if (!approverName.trim()) return alert('Please enter your name.')
    if (!signature) return alert('Please add your signature.')
    setLoading(true)
    try {
      await onApprove(submission.id, signature, approverName.trim(), notes)
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!notes.trim()) return alert('Please provide rejection notes.')
    setLoading(true)
    try {
      await onReject(submission.id, notes, role)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    setPdfLoading(true)
    try {
      const doc = await generateAuditPDF(submission, companyLogo)
      doc.save(`maintenance-audit-${submission.id.slice(0, 8)}.pdf`)
    } catch (err) {
      alert('PDF generation failed: ' + err.message)
    } finally {
      setPdfLoading(false)
    }
  }

  if (!submission) return null

  // SLA Calculation (12h Checker, 24h HOD)
  const slaHours = submission.approval_status === 'pending_checker' ? 12 : 24
  const createdTime = new Date(submission.created_at || Date.now()).getTime()
  const hoursElapsed = (Date.now() - createdTime) / (3600 * 1000)
  const hoursLeft = Math.max(0, Math.round(slaHours - hoursElapsed))
  const isSlaBreached = hoursElapsed > slaHours

  const results = submission.results || []

  return (
    <div className="modal-bg" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 620, padding: 0, overflow: 'hidden', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="card-header" style={{ background: 'var(--bg-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: sc.bg, borderRadius: 10, color: sc.color, border: `1px solid ${sc.color}30` }}>
              <FileText size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 className="font-display" style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.04em', margin: 0 }}>
                  AUDIT REVIEW
                </h2>
                <span style={{
                  fontSize: '0.62rem', padding: '2px 8px', borderRadius: 8, fontWeight: 700,
                  background: isSlaBreached ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                  color: isSlaBreached ? '#dc2626' : '#059669', border: `1px solid ${isSlaBreached ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`
                }}>
                  {isSlaBreached ? '🚨 SLA Breached' : `⏰ SLA: ${hoursLeft}h remaining`}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>
                {submission.checklist?.name || 'Maintenance Audit'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: '0.65rem', padding: '3px 10px', borderRadius: 10,
              fontFamily: 'DM Sans', fontWeight: 600, textTransform: 'uppercase',
              background: sc.bg, color: sc.color,
            }}>{sc.label}</span>
            <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
          </div>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(90vh - 160px)' }}>
          {/* Meta info */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16,
            padding: 12, borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={12} style={{ color: 'var(--text-3)' }} />
              <span style={{ fontSize: '0.72rem', fontFamily: 'DM Sans', color: 'var(--text-2)' }}>
                Asset: <strong>{submission.asset?.asset_code}</strong> — {submission.asset?.asset_name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={12} style={{ color: 'var(--text-3)' }} />
              <span style={{ fontSize: '0.72rem', fontFamily: 'DM Sans', color: 'var(--text-2)' }}>
                {new Date(submission.submitted_at).toLocaleDateString('en-GB')} {new Date(submission.submitted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={12} style={{ color: 'var(--text-3)' }} />
              <span style={{ fontSize: '0.72rem', fontFamily: 'DM Sans', color: 'var(--text-2)' }}>
                Prepared by: <strong>{submission.prepared_name || submission.preparer?.full_name}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={12} style={{ color: 'var(--text-3)' }} />
              <span style={{ fontSize: '0.72rem', fontFamily: 'DM Sans', color: 'var(--text-2)' }}>
                {submission.submission_latitude && submission.submission_longitude
                  ? `${Number(submission.submission_latitude).toFixed(5)}, ${Number(submission.submission_longitude).toFixed(5)}`
                  : 'No GPS data'}
              </span>
            </div>
          </div>

          {/* Checklist results grouped by section */}
          <label className="lbl" style={{ marginBottom: 8 }}>
            Inspection Results ({results.length} items —
            <span style={{ color: 'var(--green)', marginLeft: 4 }}>{results.filter(r => r.answer === 'pass').length} Pass</span>,
            <span style={{ color: 'var(--red)', marginLeft: 4 }}>{results.filter(r => r.answer === 'fail').length} Fail</span>,
            <span style={{ marginLeft: 4 }}>{results.filter(r => r.answer === 'na').length} N/A</span>)
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {(() => {
              const sections = []
              const seen = new Set()
              for (const item of results) {
                const sec = item.section || 'General'
                if (!seen.has(sec)) { seen.add(sec); sections.push(sec) }
              }
              let num = 0
              return sections.map((sec, si) => (
                <div key={si}>
                  <div style={{
                    padding: '5px 10px', borderRadius: 6, marginBottom: 4, marginTop: si > 0 ? 6 : 0,
                    background: 'rgba(43,127,255,0.06)', border: '1px solid rgba(43,127,255,0.12)',
                  }}>
                    <span style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '0.7rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {sec}
                    </span>
                  </div>
                  {results.filter(r => (r.section || 'General') === sec).map((item, idx) => {
                    num++
                    const ansColor = item.answer === 'pass' ? 'var(--green)' : item.answer === 'fail' ? 'var(--red)' : 'var(--text-3)'
                    const ansLabel = item.answer === 'pass' ? 'PASS' : item.answer === 'fail' ? 'FAIL' : item.answer === 'na' ? 'N/A' : '—'
                    return (
                      <div key={item.id || num} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px', borderRadius: 6,
                        background: 'var(--bg-2)', border: '1px solid var(--border)', marginBottom: 2,
                      }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, background: 'var(--bg-3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.6rem', fontFamily: 'Oswald', fontWeight: 600, color: 'var(--text-3)', flexShrink: 0, marginTop: 1,
                        }}>{num}</span>
                        <span style={{ flex: 1, fontSize: '0.72rem', fontFamily: 'DM Sans', color: 'var(--text-1)', lineHeight: 1.4 }}>
                          {item.question}
                          {item.remarks && (
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-3)', fontStyle: 'italic', marginTop: 2 }}>
                              Remarks: {item.remarks}
                            </span>
                          )}
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontFamily: 'DM Sans', fontWeight: 700, flexShrink: 0,
                          padding: '2px 8px', borderRadius: 6, color: ansColor,
                          background: item.answer === 'pass' ? 'rgba(34,197,94,0.1)' : item.answer === 'fail' ? 'rgba(239,68,68,0.1)' : 'var(--bg-3)',
                        }}>
                          {ansLabel}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))
            })()}
          </div>

          {/* Notes */}
          {submission.notes && (
            <div style={{ marginBottom: 16 }}>
              <label className="lbl">Notes</label>
              <p style={{ fontSize: '0.78rem', fontFamily: 'DM Sans', color: 'var(--text-2)', padding: 10, borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                {submission.notes}
              </p>
            </div>
          )}

          {/* Existing signatures display */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { title: 'Prepared By', name: submission.prepared_name, sig: submission.prepared_signature, date: submission.prepared_at },
              { title: 'Checked By', name: submission.checker_name, sig: submission.checker_signature, date: submission.checked_at },
              { title: 'HOD', name: submission.hod_name, sig: submission.hod_signature, date: submission.approved_at },
            ].map((block, i) => (
              <div key={i} style={{
                padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', textAlign: 'center',
              }}>
                <p style={{ fontSize: '0.65rem', fontFamily: 'Oswald', fontWeight: 600, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase' }}>
                  {block.title}
                </p>
                {block.sig ? (
                  <img src={block.sig} alt={block.title} style={{ height: 36, maxWidth: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
                    Pending
                  </div>
                )}
                <p style={{ fontSize: '0.68rem', fontFamily: 'DM Sans', color: 'var(--text-2)', marginTop: 4 }}>
                  {block.name || '—'}
                </p>
                {block.date && (
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>
                    {new Date(block.date).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Checker/HOD notes display */}
          {submission.checker_notes && (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.15)' }}>
              <span style={{ fontSize: '0.68rem', fontFamily: 'Oswald', fontWeight: 600, color: 'var(--accent)' }}>CHECKER NOTES: </span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'DM Sans', color: 'var(--text-2)' }}>{submission.checker_notes}</span>
            </div>
          )}
          {submission.hod_notes && (
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <span style={{ fontSize: '0.68rem', fontFamily: 'Oswald', fontWeight: 600, color: 'var(--green)' }}>HOD NOTES: </span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'DM Sans', color: 'var(--text-2)' }}>{submission.hod_notes}</span>
            </div>
          )}

          {/* Approval form (only if user can approve) */}
          {canApprove && (
            <div style={{
              padding: 16, borderRadius: 12, border: '2px solid var(--accent)',
              background: 'rgba(14,165,233,0.04)', marginBottom: 8,
            }}>
              <h3 style={{ fontFamily: 'Oswald', fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, color: 'var(--accent)' }}>
                {role === 'checker' ? 'CHECKER VERIFICATION' : 'HOD FINAL APPROVAL'}
              </h3>

              <label className="lbl">Your Name</label>
              <input
                type="text" value={approverName} onChange={e => setApproverName(e.target.value)}
                placeholder="Full name..."
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-1)', fontFamily: 'DM Sans', fontSize: '0.82rem', marginBottom: 12, color: 'var(--text-1)',
                }}
              />

              <label className="lbl">Notes (required for rejection)</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Review notes..."
                rows={2}
                style={{
                  width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-1)', fontFamily: 'DM Sans', fontSize: '0.82rem',
                  resize: 'vertical', marginBottom: 12, color: 'var(--text-1)',
                }}
              />

              <SignaturePad label="Your Signature" onSave={setSignature} />

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={handleReject} disabled={loading} className="btn-ghost" style={{
                  fontSize: '0.78rem', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)',
                }}>
                  <XCircle size={13} /> Reject
                </button>
                <button onClick={handleApprove} disabled={loading} className="btn-primary" style={{ fontSize: '0.78rem', flex: 1 }}>
                  {loading ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />}
                  {role === 'checker' ? ' Approve & Send to HOD' : ' Final Approve'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)',
          display: 'flex', gap: 8, justifyContent: 'space-between',
        }}>
          <button onClick={handleDownloadPDF} disabled={pdfLoading} className="btn-ghost" style={{ fontSize: '0.78rem' }}>
            {pdfLoading ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
            {' '}Download PDF
          </button>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: '0.82rem' }}>Close</button>
        </div>
      </div>
    </div>
  )
}
