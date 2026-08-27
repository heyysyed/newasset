import React from 'react'

export default function EmptyState({ icon: Icon, title, message, actionLabel, onAction }) {
  return (
    <div style={{
      padding: '60px 20px',
      textAlign: 'center',
      background: 'var(--bg-2)',
      borderRadius: 16,
      border: '1.5px dashed var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-3)'
    }}>
      {Icon && (
        <div style={{
          width: 64, height: 64,
          borderRadius: '50%',
          background: 'var(--bg-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          boxShadow: 'inset 2px 2px 6px rgba(255,255,255,0.7), inset -2px -2px 6px var(--accent-soft)'
        }}>
          <Icon size={32} color="var(--text-2)" />
        </div>
      )}
      <h3 style={{
        margin: '0 0 8px 0',
        color: 'var(--text-1)',
        }}>
        {title}
      </h3>
      <p style={{
        margin: '0 0 24px 0',
        maxWidth: 320,
        }}>
        {message}
      </p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary" style={{ padding: '8px 20px' }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}


