import React from 'react'

export default function LivePulse({ color = '#0ea5e9', size = 12, label = null }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0.75,
            animation: 'radar-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite',
          }}
        />
        <span
          style={{
            position: 'relative',
            width: Math.max(4, size * 0.5),
            height: Math.max(4, size * 0.5),
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      </span>
      {label && (
        <span className="data-mono" style={{ color: 'var(--text-1)' }}>
          {label}
        </span>
      )}
      <style>{`
        @keyframes radar-ping {
          75%, 100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          span { animation: none !important; }
        }
      `}</style>
    </span>
  )
}
