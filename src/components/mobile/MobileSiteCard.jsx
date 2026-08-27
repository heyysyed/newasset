import React from 'react'
import { MapPin, MoreVertical, Package, Wrench, AlertTriangle, ChevronRight, Eye } from 'lucide-react'

export default function MobileSiteCard({ site, analytics, onViewSite, onMoreClick }) {
  const isActive = site.is_active !== false
  const totalAssets = analytics?.total || 0
  const openTickets = analytics?.openTickets || 0
  const totalValue = analytics?.totalValue || 0

  return (
    <div 
      onClick={() => onViewSite(site)}
      className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm active:border-accent transition-colors flex flex-col gap-3 relative"
    >
      {/* Top: Site Name & Status */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-body text-text-0 leading-tight m-0">{site.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-caption text-text-2 bg-bg-2 px-1.5 py-0.5 rounded">
              {site.site_code || 'SITE'}
            </span>
            <span className={`inline-flex items-center gap-1 text-caption  ${isActive ? 'text-green' : 'text-text-3'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green' : 'bg-text-3'}`} />
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoreClick(site)
          }}
          className="p-1.5 text-text-3 hover:text-text-0 hover:bg-bg-2 rounded-lg transition-colors -mr-1"
          aria-label="More actions"
        >
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Location */}
      {site.location && (
        <div className="flex items-center gap-1.5 text-caption text-text-2">
          <MapPin size={13} className="text-accent shrink-0" />
          <span className="truncate">{site.location}</span>
        </div>
      )}

      {/* 3 Metric Badges: Assets | Maintenance | Issues */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-border-light text-center">
        <div className="p-2 bg-bg-0 rounded-lg">
          <span className="text-[10px] uppercase text-text-3 block">Assets</span>
          <span className="text-small text-text-0 font-mono block mt-0.5">{totalAssets}</span>
        </div>
        <div className="p-2 bg-bg-0 rounded-lg">
          <span className="text-[10px] uppercase text-text-3 block">Maint.</span>
          <span className="text-small text-text-0 font-mono block mt-0.5">{analytics?.maintenanceCount || 0}</span>
        </div>
        <div className={`p-2 rounded-lg ${openTickets > 0 ? 'bg-danger-subtle text-danger' : 'bg-bg-0 text-text-0'}`}>
          <span className="text-[10px] uppercase block opacity-70">Issues</span>
          <span className="text-small font-mono block mt-0.5">{openTickets}</span>
        </div>
      </div>

      {/* View Site Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onViewSite(site)
        }}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-caption text-text-0 active:bg-bg-3 transition-colors"
      >
        <Eye size={14} className="text-accent" />
        <span>View Site Details</span>
      </button>
    </div>
  )
}


