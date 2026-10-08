import React from 'react'

export function SkeletonCard({ count = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skel2-${i}`}
          style={{
            padding: 20,
            borderRadius: 14,
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="skeleton-pulse" style={{ width: 38, height: 38, borderRadius: 10 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="skeleton-pulse" style={{ height: 16, width: '60%', borderRadius: 4 }} />
              <div className="skeleton-pulse" style={{ height: 12, width: '40%', borderRadius: 4 }} />
            </div>
          </div>
          <div className="skeleton-pulse" style={{ height: 12, width: '90%', borderRadius: 4 }} />
          <div className="skeleton-pulse" style={{ height: 12, width: '75%', borderRadius: 4 }} />
        </div>
      ))}
      <style>{`
        .skeleton-pulse {
          background: linear-gradient(90deg, var(--bg-3) 25%, var(--border) 50%, var(--bg-3) 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite;
        }
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-2)' }}>
      <div style={{ display: 'flex', gap: 16, padding: '14px 20px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)' }}>
        {Array.from({ length: cols }).map((_, c) => (
          <div key={c} className="skeleton-pulse" style={{ height: 14, flex: 1, borderRadius: 4 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ display: 'flex', gap: 16, padding: '16px 20px', borderBottom: r === rows - 1 ? 'none' : '1px solid var(--border)' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="skeleton-pulse" style={{ height: 14, flex: 1, borderRadius: 4 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SkeletonLoader({ type = 'card', count = 3, rows = 5, cols = 5 }) {
  if (type === 'table') return <SkeletonTable rows={rows} cols={cols} />
  return <SkeletonCard count={count} />
}


