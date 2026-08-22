import React from 'react'
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function InventoryHealthCard({ current, reorder, unit }) {
  const stock = Number(current || 0)
  const min = Number(reorder || 0)
  
  // Calculate health percentage (0 to 100)
  // We'll consider "100%" to be 3x the reorder level as a baseline for "full"
  const maxSafe = min * 3 || 100
  const percentage = Math.min((stock / maxSafe) * 100, 100)
  
  // Determine Status
  let status = { label: 'HEALTHY', color: 'var(--green)', icon: CheckCircle2 }
  if (stock === 0) {
    status = { label: 'OUT OF STOCK', color: 'var(--red)', icon: AlertCircle }
  } else if (stock <= min) {
    status = { label: 'CRITICAL', color: 'var(--red)', icon: AlertCircle }
  } else if (stock <= min * 1.5) {
    status = { label: 'REORDER', color: 'var(--orange)', icon: AlertTriangle }
  }

  return (
    <div style={{ padding: '4px 0', minWidth: 140 }}>
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: 6, 
        color: status.color, textTransform: 'uppercase', 
        letterSpacing: '1px', marginBottom: 6 
      }}>
        <status.icon size={12} />
        {status.label}
      </div>
      
      {/* Progress Bar Container */}
      <div style={{ width: '100%', height: 6, background: 'var(--bg-3)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ 
          width: `${percentage}%`, height: '100%', 
          background: status.color, borderRadius: 10,
          transition: 'width 0.5s ease-out' 
        }} />
      </div>
      
      <div style={{ 
        marginTop: 6, display: 'flex', 
        justifyContent: 'space-between', 
        color: 'var(--text-3)',
        }}>
        <span>{stock} {unit}</span>
        <span>Min: {min}</span>
      </div>
    </div>
  )
}
