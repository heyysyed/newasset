import React, { useRef } from 'react'
import { X, Printer, CheckCircle2, AlertCircle, User, ShieldCheck, Upload, FileImage } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function ChecklistDetailModal({ submission, onClose, onUploaded }) {
  const printRef = useRef(null)

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `submissions/${submission.id}/physical.${ext}`
    const { error: upErr } = await supabase.storage
      .from('checklist-uploads')
      .upload(path, file, { upsert: true })
    if (upErr) { alert('Upload failed: ' + upErr.message); return }
    const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('checklist_submissions')
      .update({ physical_upload_url: publicUrl })
      .eq('id', submission.id)
    if (dbErr) { alert('Save failed: ' + dbErr.message); return }
    if (onUploaded) onUploaded(publicUrl)
  }

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=900,height=700')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Checklist – ${submission.template?.name || 'Inspection'}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-size:11px;color:#1a2240;background:#fff;padding:24px}
        .print-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2b7fff;padding-bottom:14px;margin-bottom:18px}
        .print-title{font-size:18px;font-weight:700;letter-spacing:0.04em;color:#1a2240}
        .print-sub{font-size:10px;color:#6b7db3;margin-top:3px}
        .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
        .meta-box{border:1px solid #d0d9f0;border-radius:6px;padding:8px 12px;background:#f4f7ff}
        .meta-label{font-size:9px;font-weight:700;color:#6b7db3;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px}
        .meta-value{font-size:11px;font-weight:600;color:#1a2240}
        .section-title{font-size:9px;font-weight:700;color:#2b7fff;text-transform:uppercase;letter-spacing:0.1em;background:#eef2fb;padding:5px 10px;margin-top:0}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th{background:#1a2240;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:6px 10px;text-align:left}
        td{padding:5px 10px;border-bottom:1px solid #e4e9f5;vertical-align:top;font-size:10px}
        tr:nth-child(even) td{background:#f8f9ff}
        .ok{color:#059669;font-weight:700}
        .fail{color:var(--status-danger);font-weight:700}
        .sig-row{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px}
        .sig-box{border:1px solid #d0d9f0;border-radius:6px;padding:10px}
        .sig-label{font-size:9px;font-weight:700;color:#6b7db3;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}
        .selfie-thumb{width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid #059669;flex-shrink:0}
        .sig-person{display:flex;align-items:center;gap:10px}
        .status-pass{background:#d1fae5;color:#065f46;font-weight:700;padding:3px 10px;border-radius:20px;font-size:10px}
        .status-fail{background:#fee2e2;color:#991b1b;font-weight:700;padding:3px 10px;border-radius:20px;font-size:10px}
        .footer{margin-top:20px;border-top:1px solid #e4e9f5;padding-top:10px;font-size:9px;color:#6b7db3;display:flex;justify-content:space-between}
        @media print{body{padding:12px}}
      </style>
    </head><body>${content}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const results = submission.results || []
  const passCount = results.filter(r => r.status === 'OK').length
  const failCount = results.filter(r => r.status !== 'OK').length

  // Group by section
  const sections = {}
  results.forEach(r => {
    const s = r.section || 'General'
    if (!sections[s]) sections[s] = []
    sections[s].push(r)
  })

  const dateStr = new Date(submission.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = new Date(submission.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const verRef  = submission.verification_ref || '-'

  return (
    <div className="modal-bg" style={{ zIndex: 2100 }}>
      <div className="modal" style={{ maxWidth: 860, height: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="card-header" style={{ background: 'var(--bg-3)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0, color: 'var(--text-0)' }}>
                {(submission.template?.name || 'INSPECTION').toUpperCase()}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ color: 'var(--text-3)' }}>{dateStr} · {timeStr}</span>
                {submission.verification_ref && (
                  <span style={{ color: 'var(--accent)', background: 'var(--accent-glow)', padding: '1px 7px', borderRadius: 20, border: '1px solid var(--accent)30' }}>
                    {submission.verification_ref}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} className="btn-ghost" style={{ padding: '7px 14px' }}>
              <Printer size={14} /> Download PDF
            </button>
            <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg-1)' }}>

          {/* Printable area */}
          <div ref={printRef}>
            {/* Print Header */}
            <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--accent)', paddingBottom: 14, marginBottom: 16 }}>
              <div>
                <div className="print-title font-display" style={{ letterSpacing: '0.04em', color: 'var(--text-0)' }}>
                  {submission.template?.name || 'Inspection Report'}
                </div>
                <div className="print-sub" style={{ color: 'var(--text-3)', marginTop: 2 }}>
                  Operational Safety Inspection · Strongbuilt
                </div>
              </div>
              <span className={submission.status === 'pass' ? 'badge badge-active' : 'badge badge-disposed'}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {submission.status === 'pass' ? <CheckCircle2 size={11}/> : <AlertCircle size={11}/>}
                {submission.status === 'pass' ? 'PASS' : 'FAIL'}
              </span>
            </div>

            {/* Meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Asset', value: submission.asset?.asset_name || '-' },
                { label: 'Asset Code', value: submission.asset?.asset_code || '-' },
                { label: 'Site / Location', value: submission.site || '-' },
                { label: 'Inspector', value: submission.inspector_verified_name || submission.inspector?.full_name || 'System' },
                { label: 'Date', value: dateStr },
                { label: 'Result', value: `${passCount} Pass · ${failCount} Fail` },
                { label: 'Verification Ref', value: verRef },
              ].map(m => (
                <div key={m.label} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', background: 'var(--bg-3)' }}>
                  <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{m.label}</div>
                  <div style={{ color: 'var(--text-0)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Checklist items grouped by section */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <table className="tbl" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Section</th>
                    <th>Description</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} style={{ background: r.status !== 'OK' ? 'var(--status-danger-soft)' : undefined }}>
                      <td style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.section || '-'}</td>
                      <td style={{ color: 'var(--text-1)' }}>{r.description}</td>
                      <td style={{ textAlign: 'center' }}>
                        {r.status === 'OK'
                          ? <span style={{ color: 'var(--green)', }}>✓ OK</span>
                          : <span style={{ color: 'var(--red)', }}>✗ FAIL</span>
                        }
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{r.remark || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            {submission.notes && (
              <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>General Notes</div>
                <p style={{ color: 'var(--text-1)', margin: 0, }}>{submission.notes}</p>
              </div>
            )}

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <User size={13} style={{ color: 'var(--accent)' }}/>
                  <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Checked By (Inspector)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {submission.inspector_selfie_url && (
                    <img src={submission.inspector_selfie_url} alt="Inspector selfie"
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--green)', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ color: 'var(--text-0)' }}>
                      {submission.inspector_verified_name || submission.inspector?.full_name || '-'}
                    </div>
                    <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      Inspector
                      {submission.inspector_selfie_url && <span style={{ background: 'var(--green)', color: '#fff', padding: '1px 5px', borderRadius: 8, }}>+ Selfie</span>}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <ShieldCheck size={13} style={{ color: 'var(--green)' }}/>
                  <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Site Incharge (Approval)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {submission.incharge_selfie_url && (
                    <img src={submission.incharge_selfie_url} alt="Incharge selfie"
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--green)', flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ color: 'var(--text-0)' }}>
                      {submission.incharge_verified_name || '-'}
                    </div>
                    <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {submission.incharge_designation || 'Site Incharge'}
                      {submission.incharge_selfie_url && <span style={{ background: 'var(--green)', color: '#fff', padding: '1px 5px', borderRadius: 8, }}>+ Selfie</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Physical upload */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <FileImage size={14} style={{ color: 'var(--cyan)' }}/>
                <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Physical Checklist Document</span>
              </div>
              {submission.physical_upload_url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {submission.physical_upload_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                    <img src={submission.physical_upload_url} alt="Physical checklist" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                  ) : (
                    <a href={submission.physical_upload_url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ textDecoration: 'none' }}>
                      <FileImage size={13} /> View Uploaded Document
                    </a>
                  )}
                </div>
              ) : (
                <label className="btn-ghost" style={{ cursor: 'pointer', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Upload size={13} /> Upload Physical Copy (JPG / PNG / PDF)
                  <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleUpload} />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


