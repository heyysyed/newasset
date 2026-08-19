import React from 'react'

export default function SkeletonLoader() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="skeleton" style={{ height: 40, width: 200, borderRadius: 8 }}></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        <div className="skeleton" style={{ height: 120, borderRadius: 16 }}></div>
        <div className="skeleton" style={{ height: 120, borderRadius: 16 }}></div>
        <div className="skeleton" style={{ height: 120, borderRadius: 16 }}></div>
      </div>
      <div className="skeleton" style={{ height: 400, borderRadius: 16, width: '100%' }}></div>
    </div>
  )
}
