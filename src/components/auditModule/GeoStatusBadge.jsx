import React from 'react'
import { MapPin } from 'lucide-react'
import LivePulse from '../ui/LivePulse'

export default function GeoStatusBadge({ verified, latitude, longitude }) {
  if (!latitude || !longitude) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-3)', color: 'var(--text-3)',
      }}>
        <MapPin size={10} /> No GPS
      </span>
    )
  }

  const badgeColor = verified ? 'var(--green)' : 'var(--amber)'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 10, background: verified ? 'rgba(34,197,94,0.1)' : 'var(--status-warning-soft)',
      color: badgeColor, border: `1px solid ${verified ? 'rgba(34,197,94,0.25)' : 'var(--status-warning-soft)'}`,
    }}>
      <LivePulse color={verified ? '#22c55e' : 'var(--status-warning)'} size={8} />
      {verified ? 'GEOFENCE VERIFIED (ON-SITE)' : 'GEOFENCE WARNING (OFF-SITE)'}
    </span>
  )
}


