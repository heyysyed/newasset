import { X } from 'lucide-react'

export default function ModalShell({ onClose, children, accent, wide }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(26,34,64,0.35)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(10px, 3vw, 20px)',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: wide ? 750 : 520,
          maxHeight: '92vh',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          padding: 'clamp(18px, 4vw, 28px) clamp(16px, 4vw, 28px) clamp(16px, 3vw, 24px)',
          animation: 'fadeUp 0.2s ease-out',
          ...(accent ? { borderTop: `3px solid ${accent}` } : {}),
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 12, background: 'var(--bg-3)',
            border: '1.5px solid var(--border)', borderRadius: 10,
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-3)', transition: 'all 0.15s',
          }}
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  )
}


