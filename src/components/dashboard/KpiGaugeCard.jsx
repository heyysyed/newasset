import React from 'react'
import { CheckCircle2, Target, AlertTriangle } from 'lucide-react'

export default function KpiGaugeCard({ title, value = 0, target = 95, unit = "%", icon: Icon = Target }) {
  const numVal = Math.min(100, Math.max(0, Number(value || 0)))
  
  // Color Band Thresholds: Red <80%, Amber 80-95%, Green >95%
  let bandColor = '#ef4444'
  let bandBg = 'rgba(239,68,68,0.1)'
  let statusText = 'Needs Attention'

  if (numVal >= 95) {
    bandColor = '#059669'
    bandBg = 'rgba(5,150,105,0.1)'
    statusText = 'Target Met'
  } else if (numVal >= 80) {
    bandColor = '#d97706'
    bandBg = 'rgba(217,119,6,0.1)'
    statusText = 'On Track'
  }

  // Radial calculation (semi-circle offset)
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (numVal / 100) * circumference

  return (
    <div className="card" style={{ padding: '16px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Icon size={14} color={bandColor} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'Oswald', color: '#0f172a', lineHeight: 1 }}>
            {numVal.toFixed(1)}{unit}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Target: {target}{unit}</span>
        </div>

        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: bandColor, background: bandBg, padding: '2px 8px', borderRadius: 12, border: `1px solid ${bandColor}30` }}>
            {statusText}
          </span>
        </div>
      </div>

      {/* SVG Radial Gauge */}
      <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={radius} stroke="#e2e8f0" strokeWidth="9" fill="transparent" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={bandColor}
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <span style={{ position: 'absolute', fontFamily: 'Oswald', fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
          {Math.round(numVal)}%
        </span>
      </div>
    </div>
  )
}
