import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, ArrowRight, MoreVertical, Layers, Printer, QrCode, MapPin, Loader2 } from 'lucide-react'

export default function AssetHeader({ asset, asset360, onTransfer, onDownloadQR, onPrintTag, onUpdateGPS, updatingGPS, canEdit }) {
  const navigate = useNavigate()

  // Status Badge Logic
  const STATUS_BADGE = {
    Active: 'badge-active', Inactive: 'badge-inactive',
    'Under Repair': 'badge-repair', Disposed: 'badge-disposed', 'On Hire': 'badge-onhire'
  }
  
  const statusClass = STATUS_BADGE[asset?.status] || 'badge-inactive'

  // Health and Risk logic
  const healthScore = asset360?.health?.data?.score || 0
  const riskLevel = asset360?.risk?.data?.level || 'UNKNOWN'
  
  const healthColor = healthScore > 75 ? 'var(--green)' : healthScore > 40 ? 'var(--amber)' : 'var(--red)'
  const riskColor = riskLevel === 'LOW' ? 'var(--green)' : riskLevel === 'MEDIUM' ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{
      background: 'var(--bg-1)',
      borderBottom: '1px solid var(--border)',
      padding: '16px 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--clay-shadow-sm)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }}>
      {/* Left: Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/assets')} className="btn-ghost btn-icon">
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ margin: 0, color: 'var(--text-0)' }}>
              {asset?.asset_name}
            </h1>
            <span className={`badge ${statusClass}`}>{asset?.status}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-2)' }}>
            <span className="font-mono" style={{ background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 6, }}>
              {asset?.asset_code}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Layers size={14} /> {asset?.category || 'Uncategorized'}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Pulse / Intelligence Summary (Desktop) */}
      <div className="mobile-hide" style={{ display: 'flex', gap: 24, padding: '0 24px', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
           <span style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em' }}>Health</span>
           <span className="font-mono" style={{ color: healthColor }}>{healthScore}/100</span>
         </div>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
           <span style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em' }}>Risk</span>
           <span className="font-mono" style={{ color: riskColor }}>{riskLevel}</span>
         </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {canEdit && (
          <button onClick={onUpdateGPS} disabled={updatingGPS} className="btn-ghost btn-sm mobile-hide" style={{ minWidth: 105, justifyContent: 'center' }}>
            {updatingGPS ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />} 
            {updatingGPS ? 'Locating...' : 'Update GPS'}
          </button>
        )}
        <Link to={`/assets/${asset?.id}/edit`} className="btn-ghost btn-sm mobile-hide" style={{ textDecoration: 'none' }}>
          <Edit2 size={14} /> Edit
        </Link>
        <button onClick={onTransfer} className="btn-ghost btn-sm mobile-hide">
          <ArrowRight size={14} /> Transfer
        </button>
        <button onClick={onDownloadQR} className="btn-ghost btn-sm mobile-hide">
          <QrCode size={14} /> QR
        </button>
        <button onClick={onPrintTag} className="btn-ghost btn-sm mobile-hide">
          <Printer size={14} /> Tag
        </button>
        
        {/* Mobile menu button (we use a simple style toggle here for now) */}
        <button className="btn-ghost btn-icon desktop-hide" style={{ display: 'none' }}>
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  )
}


