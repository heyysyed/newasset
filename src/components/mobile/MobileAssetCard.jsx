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
      className="group relative bg-bg-0/90 backdrop-blur-xl border border-border/60 rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)] active:scale-[0.98] transition-all duration-300 flex flex-col gap-4 overflow-hidden"
    >
      {/* Decorative background glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none transition-colors" />

      {/* Top row: Status Badge & More ⋮ */}
      <div className="flex items-center justify-between relative z-10">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide border shadow-sm ${cfg.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
          {cfg.label}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoreClick(asset)
          }}
          className="p-1.5 text-text-3 hover:text-text-0 bg-bg-2/50 hover:bg-bg-3 rounded-full transition-colors backdrop-blur-sm -mr-1"
          aria-label="More actions"
        >
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Asset Name & Code */}
      <div className="relative z-10 pl-0.5">
        <h3 className="text-[17px] font-bold text-text-0 leading-tight m-0 line-clamp-2 tracking-tight">
          {asset.asset_name || 'Unnamed Asset'}
        </h3>
        <div className="font-mono text-[12px] font-bold text-accent tracking-[0.15em] mt-1.5 uppercase">
          {asset.asset_code || 'NO-CODE'}
        </div>
      </div>

      {/* Location & Category Cards */}
      <div className="grid grid-cols-2 gap-2 mt-1 relative z-10">
        <div className="flex items-center gap-2 p-2.5 bg-bg-1 rounded-xl border border-border/50 shadow-sm">
          <div className="p-1.5 bg-bg-0 rounded-lg shadow-sm border border-border/30">
            <MapPin size={14} className="text-accent" />
          </div>
          <span className="text-[12px] font-semibold text-text-2 truncate">{asset.site || 'No Site'}</span>
        </div>
        <div className="flex items-center gap-2 p-2.5 bg-bg-1 rounded-xl border border-border/50 shadow-sm">
          <div className="p-1.5 bg-bg-0 rounded-lg shadow-sm border border-border/30">
            <Tag size={14} className="text-text-3" />
          </div>
          <span className="text-[12px] font-semibold text-text-2 truncate">{asset.category || 'General'}</span>
        </div>
      </div>

      {/* Health & Valuation Strip */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50 relative z-10 mt-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-text-3 uppercase tracking-widest mb-1">Condition</span>
          <span className={`text-[13px] font-bold ${conditionColor}`}>{conditionText}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-text-3 uppercase tracking-widest mb-1">Value</span>
          <span className="font-mono text-[15px] font-bold text-text-0">
            {formatCurrency(calculateBookValue(asset))}
          </span>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="pt-1 relative z-10">
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/assets/${asset.id}`)
          }}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-bg-1 to-bg-2 hover:from-bg-2 hover:to-bg-3 border border-border shadow-sm rounded-xl text-[13px] font-bold text-text-0 active:scale-[0.98] transition-all duration-200"
        >
          <Eye size={16} className="text-accent" />
          <span>View Full Details</span>
          <ArrowRight size={14} className="text-text-3 ml-auto opacity-50" />
        </button>
      </div>
    </div>
  )
}


