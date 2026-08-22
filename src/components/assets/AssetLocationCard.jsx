import React from 'react'
import { MapPin, Building2, User } from 'lucide-react'

export default function AssetLocationCard({ location, assigneeLabel, assigneeType }) {
  if (!location) return null

  const { siteName, precision, lat, lng } = location.data || {}

  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: 'var(--clay-shadow-sm)',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapPin size={18} color="var(--cyan)" />
          <h3 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--text-0)', letterSpacing: '0.04em' }}>Location & Assignment</h3>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px' }}>
        {/* Site Details */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
           <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--cyan-dim)', color: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
             <Building2 size={20} />
           </div>
           <div>
             <span style={{ color: 'var(--text-3)', textTransform: 'uppercase' }}>Current Site</span>
             <div style={{ color: 'var(--text-1)' }}>{siteName || 'Not Assigned'}</div>
             <div style={{ color: precision === 'EXACT LOCATION' ? 'var(--green)' : 'var(--amber)', marginTop: 4 }}>
               {precision}
             </div>
           </div>
        </div>

        {/* Coordinates */}
        {(lat && lng) && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={20} />
            </div>
            <div>
              <span style={{ color: 'var(--text-3)', textTransform: 'uppercase' }}>Coordinates</span>
              <div className="font-mono" style={{ color: 'var(--text-1)', marginTop: 4 }}>
                {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
              </div>
            </div>
          </div>
        )}

        {/* Assignee */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
           <div style={{ width: 40, height: 40, borderRadius: 10, background: assigneeType === 'user' ? 'var(--accent-glow)' : 'var(--green-dim)', color: assigneeType === 'user' ? 'var(--accent)' : 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
             <User size={20} />
           </div>
           <div>
             <span style={{ color: 'var(--text-3)', textTransform: 'uppercase' }}>Assigned To</span>
             <div style={{ color: 'var(--text-1)' }}>{assigneeLabel || 'Unassigned'}</div>
             <div style={{ color: 'var(--text-3)', marginTop: 2, textTransform: 'capitalize' }}>
               {assigneeType || 'No Assignment'}
             </div>
           </div>
        </div>
      </div>
    </div>
  )
}
