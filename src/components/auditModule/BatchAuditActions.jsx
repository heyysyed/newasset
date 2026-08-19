import React, { useState } from 'react'
import { Zap, CheckCheck, Loader2 } from 'lucide-react'

export default function BatchAuditActions({ unverifiedItems, onBatchVerify }) {
  const [loading, setLoading] = useState(false)

  if (!unverifiedItems || unverifiedItems.length === 0) return null

  const handleBatchClick = async () => {
    if (!window.confirm(`Mark all ${unverifiedItems.length} remaining items as Operational & Verified?`)) return
    setLoading(true)
    try {
      await onBatchVerify(unverifiedItems)
    } catch (err) {
      alert('Batch audit error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      marginBottom: 14, padding: '10px 14px', borderRadius: 10,
      background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(34,197,94,0.08))',
      border: '1px solid rgba(14,165,233,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-0)', fontFamily: 'DM Sans' }}>
          Batch Fast Audit ({unverifiedItems.length} pending items remaining)
        </span>
      </div>

      <button
        onClick={handleBatchClick}
        disabled={loading}
        className="btn-primary"
        style={{
          padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, borderRadius: 8,
          background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none',
          display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
        }}
      >
        {loading ? <Loader2 size={14} className="spin" /> : <CheckCheck size={14} />}
        Mark All Remaining ({unverifiedItems.length}) as Operational
      </button>
    </div>
  )
}
