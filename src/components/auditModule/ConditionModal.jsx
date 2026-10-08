import React, { useState } from 'react'
import { X, CheckCircle2, AlertTriangle, Wrench, XCircle, HelpCircle, MapPin, Loader2 } from 'lucide-react'

const CONDITIONS = [
  { value: 'operational',    label: 'Operational',    icon: CheckCircle2, color: 'var(--green)',  bg: 'rgba(34,197,94,0.1)' },
  { value: 'damaged',        label: 'Damaged',        icon: AlertTriangle, color: 'var(--amber)',  bg: 'var(--status-warning-soft)' },
  { value: 'needs_repair',   label: 'Needs Repair',   icon: Wrench,       color: 'var(--accent)', bg: 'rgba(14,165,233,0.1)' },
  { value: 'non_functional', label: 'Non-Functional', icon: XCircle,      color: 'var(--red)',    bg: 'var(--status-danger-soft)' },
  { value: 'missing',        label: 'Missing',        icon: HelpCircle,   color: 'var(--text-3)', bg: 'var(--bg-3)' },
]

export default function ConditionModal({ asset, onSubmit, onClose }) {
  const [condition, setCondition] = useState('')
  const [notes, setNotes] = useState('')
  const [gettingLocation, setGettingLocation] = useState(false)
  const [gpsError, setGpsError] = useState('')

  const handleSelectConditionAndSubmit = (selectedCond) => {
    setCondition(selectedCond)
    setGettingLocation(true)
    setGpsError('')

    if (!navigator.geolocation) {
      setGettingLocation(false)
      onSubmit({ condition: selectedCond, conditionNotes: notes, latitude: asset?.latitude || 0, longitude: asset?.longitude || 0 })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGettingLocation(false)
        onSubmit({
          condition: selectedCond,
          conditionNotes: notes,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
      },
      (err) => {
        setGettingLocation(false)
        onSubmit({
          condition: selectedCond,
          conditionNotes: notes + ' (GPS location unavailable)',
          latitude: asset?.latitude || 0,
          longitude: asset?.longitude || 0,
        })
      },
      { enableHighAccuracy: false, timeout: 5000 }
    )
  }

  const handleSubmit = () => {
    if (!condition) return alert('Please select a condition.')
    handleSelectConditionAndSubmit(condition)
  }

  return (
    <div className="modal-bg" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: '90vh', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="card-header" style={{ background: 'var(--bg-3)', shrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0 }}>UPDATE CONDITION</h2>
              <span style={{ color: 'var(--text-3)', }}>
                {asset?.asset_code} - {asset?.asset_name}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Condition selection */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label className="lbl" style={{ margin: 0, }}>Physical Condition *</label>
            <span style={{ color: 'var(--accent)', }}>⚡ Tap any condition to instant submit</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {CONDITIONS.map(c => {
              const Icon = c.icon
              const active = condition === c.value
              return (
                <button key={c.value} onClick={() => handleSelectConditionAndSubmit(c.value)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12,
                  border: `2px solid ${active ? c.color : 'var(--border)'}`,
                  background: active ? c.bg : 'var(--bg-1)',
                  color: active ? c.color : 'var(--text-1)',
                  cursor: 'pointer', transition: 'all 0.2s', boxShadow: active ? `0 4px 12px ${c.bg}` : '0 2px 4px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ padding: 6, borderRadius: '50%', background: active ? c.color : 'var(--bg-3)', color: active ? 'white' : 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} strokeWidth={2.5} />
                  </div>
                  {c.label}
                  <span style={{ marginLeft: 'auto', color: c.color, background: `${c.color}15`, padding: '2px 8px', borderRadius: 10, }}>1-Tap Submit</span>
                </button>
              )
            })}
          </div>

          {/* Notes */}
          <label className="lbl" style={{ marginBottom: 10, }}>Notes (optional)</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Add any observations about this asset..."
            rows={2}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, border: '2px solid var(--border)',
              background: 'var(--bg-1)', resize: 'vertical', color: 'var(--text-0)', outline: 'none', transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />

          {/* GPS info */}
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(to right, rgba(14,165,233,0.08), rgba(14,165,233,0.03))',
            border: '1px solid rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <MapPin size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-1)', }}>
              GPS location will be automatically logged upon submission.
            </span>
          </div>

          {gpsError && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
              <p style={{ color: 'var(--red)', margin: 0 }}>{gpsError}</p>
            </div>
          )}
        </div>

        {/* ALWAYS VISIBLE STICKY FOOTER */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)',
          display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, flexShrink: 0
        }}>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '12px', borderRadius: 10, }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!condition || gettingLocation} className="btn-primary" style={{ padding: '12px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {gettingLocation ? <><Loader2 size={16} className="spin" /> Verifying GPS...</> : <><CheckCircle2 size={16} /> Submit & Verify</>}
          </button>
        </div>
      </div>
    </div>
  )
}


