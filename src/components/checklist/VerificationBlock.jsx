import React, { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react'
import SelfieCapture from './SelfieCapture'

/**
 * VerificationBlock - legal-grade sign-off for checklist submissions.
 *
 * Inspector mode (profileName set):
 *   - Typed full name must match profile name exactly
 *   - Certification checkbox
 *   - Selfie for biometric identity proof
 *
 * Incharge mode (profileName null):
 *   - Same but name/designation are free text
 *
 * onChange(data | null) - null until name + checkbox are complete.
 * data = { verifiedName, designation, verifiedAt, selfieUrl }
 */
export default function VerificationBlock({ profileName, userId, onChange }) {
  const [name,        setName]        = useState('')
  const [designation, setDesignation] = useState('')
  const [certified,   setCertified]   = useState(false)
  const [selfieUrl,   setSelfieUrl]   = useState(null)

  const isInspector = Boolean(profileName)
  const nameOk = isInspector
    ? name.trim().toLowerCase() === profileName.trim().toLowerCase()
    : name.trim().length >= 2
  const allDone = nameOk && certified

  // Notify parent whenever verification state changes
  useEffect(() => {
    onChange(allDone ? {
      verifiedName: name.trim(),
      designation:  designation.trim(),
      verifiedAt:   new Date().toISOString(),
      selfieUrl:    selfieUrl || null,
    } : null)
  }, [allDone, name, designation, selfieUrl]) // eslint-disable-line

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Name / Designation ───────────────────────────────────────────── */}
      {isInspector ? (
        <div>
          <label className="lbl" style={{ marginBottom: 4 }}>
            Type your full name to confirm <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input className="inp" placeholder={profileName} value={name}
              onChange={e => setName(e.target.value)}
              style={{ paddingRight: 34,
                borderColor: name ? (nameOk ? 'var(--green)' : 'var(--red)') : undefined }}
            />
            {name && (
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                {nameOk ? <CheckCircle2 size={14} style={{ color: 'var(--green)' }}/> : <AlertCircle size={14} style={{ color: 'var(--red)' }}/>}
              </span>
            )}
          </div>
          {name && !nameOk && (
            <p style={{ color: 'var(--red)', marginTop: 3 }}>
              Must match your profile name: <strong>{profileName}</strong>
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 10 }}>
          <div>
            <label className="lbl">Full Name <span style={{ color: 'var(--red)' }}>*</span></label>
            <input className="inp" placeholder="Incharge full name" value={name}
              onChange={e => setName(e.target.value)}
               />
          </div>
          <div>
            <label className="lbl">Designation</label>
            <input className="inp" placeholder="e.g. Site Manager" value={designation}
              onChange={e => setDesignation(e.target.value)}
               />
          </div>
        </div>
      )}

      {/* ── Certification checkbox ───────────────────────────────────────── */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={certified} onChange={e => setCertified(e.target.checked)}
          style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)', width: 14, height: 14 }} />
        <span style={{ color: 'var(--text-1)', }}>
          {isInspector
            ? 'I certify that I have personally conducted this inspection and all information provided is accurate and complete.'
            : 'I confirm that I have reviewed and approved this inspection report.'}
        </span>
      </label>

      {/* ── Selfie verification ──────────────────────────────────────────── */}
      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
        <div style={{ color: 'var(--text-3)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em', }}>
          📷 Identity Selfie
        </div>
        <SelfieCapture
          userId={isInspector ? userId : null}
          onCapture={url => setSelfieUrl(url)}
          onClear={() => setSelfieUrl(null)}
        />
      </div>

      {/* ── Verified badge ───────────────────────────────────────────────── */}
      {allDone && (
        <div style={{ padding: '8px 12px', background: 'rgba(0,185,107,0.08)', borderRadius: 10, border: '1px solid rgba(0,185,107,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {selfieUrl ? (
            <img src={selfieUrl} alt="selfie"
              style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--green)', flexShrink: 0 }} />
          ) : (
            <ShieldCheck size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
          )}
          <div>
            <div style={{ color: 'var(--green)' }}>
              Verified - {name.trim()}{designation ? ` · ${designation}` : ''}
              {selfieUrl && <span style={{ marginLeft: 6, background: 'var(--green)', color: '#fff', padding: '1px 6px', borderRadius: 10 }}>+ Selfie</span>}
            </div>
            <div style={{ color: 'var(--text-3)', marginTop: 1 }}>
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
