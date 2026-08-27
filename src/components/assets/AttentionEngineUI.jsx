import React from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AttentionEngineUI({ attentionItems = [] }) {
  if (!attentionItems || attentionItems.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16,
        padding: '16px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--green)'
      }}>
        <CheckCircle2 size={18} />
        <span >No immediate attention required. Asset is operating normally.</span>
      </div>
    )
  }

  // Helper to map severity to UI
  const getSeverityUI = (severity) => {
    switch(severity) {
      case 'CRITICAL': return { icon: AlertTriangle, color: 'var(--red)', bg: 'var(--status-danger-soft)' }
      case 'HIGH': return { icon: AlertTriangle, color: 'var(--amber)', bg: 'var(--status-warning-soft)' }
      default: return { icon: AlertCircle, color: 'var(--cyan)', bg: 'rgba(6, 182, 212, 0.1)' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {attentionItems.map((item, idx) => {
        const ui = getSeverityUI(item.severity)
        const Icon = ui.icon
        return (
          <div key={idx} style={{
            background: ui.bg, border: `1px solid ${ui.color}`, borderRadius: 12,
            padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{
              width: 4, position: 'absolute', left: 0, top: 0, bottom: 0, background: ui.color
            }} />
            
            <Icon size={20} color={ui.color} style={{ marginTop: 2 }} />
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: 'var(--text-1)' }}>
                {item.title}
              </span>
              <span style={{ color: 'var(--text-2)' }}>
                {item.explanation}
              </span>
            </div>

            {item.actionLabel && (
              <button style={{
                background: ui.color, color: '#fff', border: 'none', borderRadius: 8,
                padding: '6px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                {item.actionLabel} <ChevronRight size={14} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
// Note: CheckCircle2 is used but not imported above, let's fix that.


