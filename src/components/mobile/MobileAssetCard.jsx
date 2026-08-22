import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Tag, MoreVertical, CheckCircle2, AlertTriangle,
  Wrench, ShieldCheck, ArrowRight, Eye, Layers
} from 'lucide-react'
import { formatCurrency, calculateBookValue } from '../../lib/depreciation'

const STATUS_CONFIG = {
  Active: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
    icon: CheckCircle2,
    label: 'Active'
  },
  'Under Repair': {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    icon: Wrench,
    label: 'Under Repair'
  },
  Inactive: {
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    icon: AlertTriangle,
    label: 'Inactive'
  },
  Disposed: {
    bg: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]',
    dot: 'bg-slate-400',
    icon: AlertTriangle,
    label: 'Disposed'
  },
  'On Hire': {
    bg: 'bg-blue-50 text-blue-800 border-blue-200',
    dot: 'bg-[var(--accent)]',
    icon: Layers,
    label: 'On Hire'
  }
}

export default function MobileAssetCard({ asset, onMoreClick }) {
  const navigate = useNavigate()
  const cfg = STATUS_CONFIG[asset.status] || STATUS_CONFIG.Active
  const StatusIcon = cfg.icon

  const conditionText = asset.condition || 'Good'
  const conditionColor = ['Poor', 'Critical', 'Non-Functional'].includes(conditionText)
    ? 'text-danger'
    : ['Fair', 'Damaged', 'Needs Repair'].includes(conditionText)
    ? 'text-amber'
    : 'text-green'

  return (
    <div 
      onClick={() => navigate(`/assets/${asset.id}`)}
      className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm active:border-accent transition-colors relative flex flex-col gap-3"
    >
      {/* Top row: Status Badge & More ⋮ */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]  border ${cfg.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoreClick(asset)
          }}
          className="p-1.5 text-text-3 hover:text-text-0 hover:bg-bg-2 rounded-lg transition-colors -mr-1"
          aria-label="More actions"
        >
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Asset Name & Code */}
      <div>
        <h3 className="text-[15px] text-text-0 leading-snug m-0 line-clamp-2">
          {asset.asset_name || 'Unnamed Asset'}
        </h3>
        <div className="font-mono text-caption text-text-2 tracking-wider mt-0.5">
          {asset.asset_code || 'NO-CODE'}
        </div>
      </div>

      {/* Location & Category */}
      <div className="grid grid-cols-2 gap-2 text-caption text-text-2 py-1.5 border-y border-border-light">
        <div className="flex items-center gap-1.5 truncate">
          <MapPin size={14} className="text-accent shrink-0" />
          <span className="truncate">{asset.site || 'No Site'}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Tag size={13} className="text-text-3 shrink-0" />
          <span className="truncate">{asset.category || 'General'}</span>
        </div>
      </div>

      {/* Health & Valuation Strip */}
      <div className="flex items-center justify-between text-caption pt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-3 uppercase">Condition:</span>
          <span className={` ${conditionColor}`}>{conditionText}</span>
        </div>
        <div className="font-mono text-text-0">
          {formatCurrency(calculateBookValue(asset))}
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/assets/${asset.id}`)
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-caption text-text-0 active:bg-bg-3 transition-colors"
        >
          <Eye size={14} className="text-accent" />
          <span>View Asset Details</span>
        </button>
      </div>
    </div>
  )
}
