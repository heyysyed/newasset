import React, { useState, useEffect } from 'react'
import { X, Save, ClipboardCheck, User, ShieldCheck, Upload, FileImage, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import VerificationBlock from './VerificationBlock'

function genRef() {
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `SBC-INS-${date}-${rand}`
}

export default function ChecklistEntry({ template, assets, allSites, initialAssetId, onSave, onClose }) {
  const { profile } = useAuth()

  const [assetId,  setAssetId]  = useState(initialAssetId || '')
  const [site,     setSite]     = useState('')

  useEffect(() => {
    const a = assets.find(a => a.id === assetId)
    if (a?.site) setSite(a.site)
  }, [assetId, assets])

  useEffect(() => {
    if (initialAssetId) setAssetId(initialAssetId)
  }, [initialAssetId])

  const [results, setResults] = useState(
    template.items.map(item => ({ description: item.description, section: item.section, status: 'OK', remark: '' }))
  )
  const [notes,           setNotes]           = useState('')
  const [inspectorVerif,  setInspectorVerif]  = useState(null)   // { signature, verifiedName, verifiedAt }
  const [inchargeVerif,   setInchargeVerif]   = useState(null)   // { signature, verifiedName, designation, verifiedAt }
  const [physicalFile,    setPhysicalFile]    = useState(null)
  const [physicalPreview, setPhysicalPreview] = useState(null)
  const [loading,         setLoading]         = useState(false)

  const updateResult = (idx, field, val) => {
    const n = [...results]; n[idx][field] = val; setResults(n)
  }

  function handlePhysicalFile(e) {
    const file = e.target.files[0]; if (!file) return
    setPhysicalFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setPhysicalPreview(ev.target.result)
      reader.readAsDataURL(file)
    } else { setPhysicalPreview('pdf') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!assetId)         return alert('Please select an asset.')
    if (!inspectorVerif)  return alert('Inspector verification is incomplete.\nPlease draw your signature, type your full name, and tick the certification checkbox.')

    setLoading(true)
    try {
      // Upload physical copy if attached
      let physical_upload_url = null
      if (physicalFile) {
        const ext  = physicalFile.name.split('.').pop()
        const path = `submissions/temp_${Date.now()}/physical.${ext}`
        const { error: upErr } = await supabase.storage.from('checklist-uploads').upload(path, physicalFile)
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
          physical_upload_url = publicUrl
        }
      }

      const ref = genRef()

      const payload = {
        template_id:               template.id,
        asset_id:                  assetId,
        site,
        performed_by:              profile?.id,
        status:                    results.some(r => r.status === 'NOT OK') ? 'fail' : 'pass',
        results,
        notes,
        // Inspector
        inspector_verified_name:   inspectorVerif.verifiedName,
        inspector_selfie_url:      inspectorVerif.selfieUrl   || null,
        // Incharge (optional)
        incharge_verified_name:    inchargeVerif?.verifiedName || null,
        incharge_designation:      inchargeVerif?.designation  || null,
        incharge_selfie_url:       inchargeVerif?.selfieUrl   || null,
        // Ref
        verification_ref:          ref,
        ...(physical_upload_url && { physical_upload_url }),
      }

      const { error } = await supabase.from('checklist_submissions').insert([payload])
      if (error) throw error
      onSave()
    } catch (err) {
      console.error(err)
      alert('Error submitting checklist: ' + err.message)
    } finally { setLoading(false) }
  }

  const failCount = results.filter(r => r.status === 'NOT OK').length

  return (
    <div className="modal-bg">
      <div className="modal" style={{ maxWidth: 920, height: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="card-header" style={{ background: 'var(--bg-3)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0, color: 'var(--text-0)' }}>
                {template.name.toUpperCase()}
              </h2>
              <span style={{ color: 'var(--text-3)', }}>Operational Inspection</span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div>
              <label className="lbl">Select Asset <span style={{ color: 'var(--red)' }}>*</span></label>
              <select className="sel" value={assetId} onChange={e => setAssetId(e.target.value)} required>
                <option value="">Select Asset…</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_code})</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Asset Code</label>
              <div className="inp" style={{ background: 'var(--bg-3)', display: 'flex', alignItems: 'center', color: assetId ? 'var(--accent)' : 'var(--text-3)' }}>
                {assetId ? (assets.find(a => a.id === assetId)?.asset_code || '-') : 'Select asset first'}
              </div>
            </div>
            <div>
              <label className="lbl">Site Name</label>
              <select className="sel" value={site} onChange={e => setSite(e.target.value)}>
                <option value="">Select Site…</option>
                {allSites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Performed By</label>
              <div className="inp" style={{ background: 'var(--bg-3)', display: 'flex', alignItems: 'center', color: 'var(--accent)', }}>
                {profile?.full_name || 'System User'}
              </div>
            </div>
          </div>

          {/* Checklist items */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {failCount > 0 && (
              <div style={{ padding: '8px 14px', background: 'var(--status-danger-soft)', borderBottom: '1px solid var(--status-danger-soft)', color: 'var(--red)', }}>
                ⚠ {failCount} item{failCount > 1 ? 's' : ''} marked as FAIL - add remarks below
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Inspection Point</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((res, idx) => (
                    <tr key={idx} style={{ background: res.status === 'NOT OK' ? 'var(--status-danger-soft)' : undefined }}>
                      <td>
                        {res.section && (
                          <div style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                            {res.section}
                          </div>
                        )}
                        <div style={{ color: 'var(--text-1)', }}>{res.description}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button"
                            onClick={() => updateResult(idx, 'status', 'OK')}
                            className={res.status === 'OK' ? 'btn-primary' : 'btn-ghost'}
                            style={{ padding: '4px 10px', }}>
                            ✓ OK
                          </button>
                          <button type="button"
                            onClick={() => updateResult(idx, 'status', 'NOT OK')}
                            className={res.status === 'NOT OK' ? 'btn-danger' : 'btn-ghost'}
                            style={{ padding: '4px 10px', }}>
                            ✗ FAIL
                          </button>
                        </div>
                      </td>
                      <td>
                        <input className="inp"
                          style={{ background: 'transparent', border: 'none', padding: 0, }}
                          placeholder="…" value={res.remark}
                          onChange={e => updateResult(idx, 'remark', e.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="lbl">General Notes / Observations</label>
            <textarea className="inp"
              style={{ height: 72, resize: 'none', }}
              placeholder="Any additional comments…" value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>

          {/* ── Verification blocks ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>

            {/* Inspector */}
            <div className="card" style={{ padding: 16, border: `1.5px solid ${inspectorVerif ? 'var(--green)' : 'var(--border)'}`, transition: 'border-color 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ padding: 6, borderRadius: 8, background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                  <User size={14} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-0)' }}>
                    Inspector Sign-Off <span style={{ color: 'var(--red)' }}>*</span>
                  </div>
                  <div style={{ color: 'var(--text-3)', }}>Required for submission</div>
                </div>
              </div>
              <VerificationBlock profileName={profile?.full_name} userId={profile?.id} onChange={setInspectorVerif} />
            </div>

            {/* Incharge */}
            <div className="card" style={{ padding: 16, border: `1.5px solid ${inchargeVerif ? 'var(--green)' : 'var(--border)'}`, transition: 'border-color 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ padding: 6, borderRadius: 8, background: 'rgba(0,185,107,0.12)', color: 'var(--green)' }}>
                  <ShieldCheck size={14} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-0)' }}>
                    Site Incharge Approval
                  </div>
                  <div style={{ color: 'var(--text-3)', }}>Optional but recommended</div>
                </div>
              </div>
              <VerificationBlock profileName={null} userId={null} onChange={setInchargeVerif} />
            </div>
          </div>

          {/* Physical upload */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <FileImage size={14} style={{ color: 'var(--cyan)' }}/>
              <span className="lbl" style={{ margin: 0 }}>Attach Physical Checklist (optional)</span>
            </div>
            {physicalPreview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {physicalPreview === 'pdf'
                  ? <div style={{ padding: '8px 14px', background: 'var(--bg-3)', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-1)', }}>
                      📄 {physicalFile?.name}
                    </div>
                  : <img src={physicalPreview} alt="Preview" style={{ maxHeight: 110, maxWidth: 180, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'cover' }} />
                }
                <button type="button" onClick={() => { setPhysicalFile(null); setPhysicalPreview(null) }}
                  className="btn-ghost" style={{ padding: '5px 10px', color: 'var(--red)' }}>
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            ) : (
              <label className="btn-ghost" style={{ cursor: 'pointer', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px dashed var(--border)', borderRadius: 8 }}>
                <Upload size={13} /> Choose image or PDF to attach
                <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handlePhysicalFile} />
              </label>
            )}
          </div>

          {/* Submit bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 4 }}>
            <div style={{ color: 'var(--text-3)', }}>
              {inspectorVerif
                ? <span style={{ color: 'var(--green)', }}>✓ Inspector verified · Ref will be generated on save</span>
                : <span style={{ color: 'var(--amber)' }}>⚠ Complete inspector verification to submit</span>
              }
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={onClose} className="btn-ghost">Discard</button>
              <button type="submit" className="btn-primary" disabled={loading || !inspectorVerif} style={{ padding: '10px 22px', opacity: !inspectorVerif ? 0.5 : 1 }}>
                <Save size={15} /> {loading ? 'Submitting…' : 'Complete & Save'}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  )
}
