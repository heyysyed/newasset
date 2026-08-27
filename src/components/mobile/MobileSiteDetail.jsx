import React, { useMemo } from 'react'
import {
  MapPin, Package, Activity, AlertTriangle, IndianRupee, Wrench, X, ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { buildSite360 } from '../../lib/intelligence/siteIntelligence'
import { formatCurrency } from '../../lib/depreciation'
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet'

export default function MobileSiteDetail({ site, siteAssets, siteTickets, can, onClose, navigate }) {
  const intel = useMemo(() => {
    return buildSite360(site, siteAssets, siteTickets, { hasFinancialAccess: can('view_financials') })
  }, [site, siteAssets, siteTickets, can])

  if (!intel || !site) return null

  const getConfidenceBadge = (level) => {
    const colors = {
      HIGH: 'bg-green-dim text-green',
      MEDIUM: 'bg-amber-dim text-amber',
      LIMITED: 'bg-red-dim text-red'
    }
    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded  uppercase ${colors[level] || colors.LIMITED}`}>
        {level}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg-0 flex flex-col animate-slide-in-right overflow-hidden">
      {/* 1. Header */}
      <div className="sticky top-0 z-10 bg-bg-1 border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-1.5 -ml-1 text-text-1 hover:bg-bg-2 rounded-lg transition-colors active:bg-bg-3"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-small text-text-0 leading-tight">{site.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${site.is_active ? 'bg-green' : 'bg-red'}`} />
              <span className="text-[10px] text-text-2 uppercase tracking-wide">
                {site.is_active ? 'Active Site' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4">
        
        {/* 3. Site Health */}
        <div className="bg-bg-1 rounded-xl p-4 border border-border shadow-sm flex justify-between items-center">
          <div>
            <h3 className="text-caption text-text-3 uppercase">Portfolio Health</h3>
            <div className={`text-section-title  mt-1 ${intel.maintenance.data.openTickets > 0 ? 'text-amber' : 'text-green'}`}>
              {intel.maintenance.data.openTickets > 0 ? 'NEEDS ATTENTION' : 'GOOD'}
            </div>
          </div>
          <Activity size={28} className={intel.maintenance.data.openTickets > 0 ? 'text-amber opacity-20' : 'text-green opacity-20'} />
        </div>

        {/* 4. Today's Attention */}
        {intel.attention.length > 0 && (
          <div className="bg-amber-dim rounded-xl p-4 border border-amber/30">
            <h3 className="text-caption text-amber uppercase flex items-center gap-1.5 mb-3">
              <AlertTriangle size={14} /> Today's Attention
            </h3>
            <div className="space-y-2">
              {intel.attention.map((att, i) => (
                <div key={i} className="bg-bg-0 p-2.5 rounded-lg border border-amber/10 flex flex-col gap-1">
                  <div className="text-[11px] text-text-0">{att.title}</div>
                  <div className="text-[10px] text-text-2">{att.explanation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Asset Portfolio */}
        <div className="bg-bg-1 rounded-xl p-4 border border-border shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-caption text-text-3 uppercase flex items-center gap-1.5">
              <Package size={14} className="text-cyan" /> Asset Portfolio
            </h3>
            {getConfidenceBadge(intel.portfolio.confidence)}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-3 bg-bg-2 rounded-lg text-center">
              <div className="text-[10px] text-text-3 uppercase">Total Assets</div>
              <div className="text-section-title text-text-0">{intel.portfolio.data.totalAssets}</div>
            </div>
            <div className="p-3 bg-green-dim rounded-lg text-center border border-green/10">
              <div className="text-[10px] text-green uppercase">Active</div>
              <div className="text-section-title text-green">{intel.portfolio.data.activeAssets}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-bg-2 p-2 rounded-md text-center">
              <div className="text-caption text-amber">{intel.portfolio.data.underMaintenance}</div>
              <div className="text-[9px] uppercase text-text-3">Repair</div>
            </div>
            <div className="bg-bg-2 p-2 rounded-md text-center">
              <div className="text-caption text-red">{intel.portfolio.data.downAssets}</div>
              <div className="text-[9px] uppercase text-text-3">Down</div>
            </div>
            <div className="bg-bg-2 p-2 rounded-md text-center">
              <div className="text-caption text-text-2">{intel.portfolio.data.idleAssets}</div>
              <div className="text-[9px] uppercase text-text-3">Idle</div>
            </div>
          </div>
        </div>

        {/* 6. Maintenance */}
        <div className="bg-bg-1 rounded-xl p-4 border border-border shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-caption text-text-3 uppercase flex items-center gap-1.5">
              <Wrench size={14} className="text-orange" /> Maintenance
            </h3>
            {getConfidenceBadge(intel.maintenance.confidence)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-bg-2 rounded-lg">
              <div className="text-[10px] text-text-3 uppercase mb-1">Open Tickets</div>
              <div className={`text-body  ${intel.maintenance.data.openTickets > 0 ? 'text-amber' : 'text-green'}`}>
                {intel.maintenance.data.openTickets}
              </div>
            </div>
            <div className="p-3 bg-bg-2 rounded-lg">
              <div className="text-[10px] text-text-3 uppercase mb-1">Overdue PMs</div>
              <div className={`text-body  ${intel.maintenance.data.overduePMs > 0 ? 'text-red' : 'text-green'}`}>
                {intel.maintenance.data.overduePMs}
              </div>
            </div>
          </div>
        </div>

        {/* 7. Financial Exposure */}
        <div className="bg-bg-1 rounded-xl p-4 border border-border shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-caption text-text-3 uppercase flex items-center gap-1.5">
              <IndianRupee size={14} className="text-green" /> Capital Exposure
            </h3>
            {getConfidenceBadge(intel.financial.confidence)}
          </div>
          
          {intel.financial.status === 'INSUFFICIENT_DATA' ? (
            <div className="text-caption text-amber italic bg-amber-dim p-3 rounded-lg">
              {intel.financial.methodology}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-end border-b border-border pb-2">
                <span className="text-caption text-text-2">Current Book Value</span>
                <span className="text-small font-mono text-accent">{formatCurrency(intel.financial.data.totalNBV)}</span>
              </div>
              <div className="flex justify-between items-end border-b border-border pb-2">
                <span className="text-caption text-text-2">At-Risk Capital</span>
                <span className="text-small font-mono text-red">{formatCurrency(intel.financial.data.atRiskCapital)}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-caption text-text-2">Idle Capital Proxy</span>
                <span className="text-small font-mono text-amber">{formatCurrency(intel.financial.data.idleCapitalProxy)}</span>
              </div>
            </div>
          )}
        </div>

        {/* 8. Location / Map */}
        <div className="bg-bg-1 rounded-xl p-4 border border-border shadow-sm">
          <h3 className="text-caption text-text-3 uppercase flex items-center gap-1.5 mb-3">
            <MapPin size={14} className="text-cyan" /> Location & Geofence
          </h3>
          
          <div className="text-caption text-text-1 mb-3 bg-bg-2 p-2.5 rounded-lg border border-border">
            {site.address || 'No address provided'}
          </div>

          {(site.latitude && site.longitude) ? (
            <div className="h-40 rounded-lg overflow-hidden border border-border relative z-0">
              <MapContainer 
                center={[Number(site.latitude), Number(site.longitude)]} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }} 
                zoomControl={false} 
                dragging={false} 
                scrollWheelZoom={false}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                <Marker position={[Number(site.latitude), Number(site.longitude)]} />
                <Circle 
                  center={[Number(site.latitude), Number(site.longitude)]} 
                  radius={Number(site.radius_meters) || 200} 
                  pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }} 
                />
              </MapContainer>
            </div>
          ) : (
            <div className="h-20 rounded-lg border border-dashed border-border flex items-center justify-center text-caption text-text-3">
              No GPS coordinates configured.
            </div>
          )}
        </div>

        {/* 11. Recommendations */}
        {intel.recommendations.length > 0 && (
          <div className="bg-accent-glow rounded-xl p-4 border border-accent/20">
            <h3 className="text-caption text-accent uppercase mb-2">Recommendations</h3>
            <ul className="text-[11px] text-text-0 space-y-1.5 pl-4 list-disc marker:text-accent/50">
              {intel.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

      </div>

      {/* 12. Actions (Sticky) */}
      <div className="absolute bottom-0 left-0 right-0 bg-bg-1 border-t border-border p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => {
            onClose();
            navigate(`/assets?site=${encodeURIComponent(site.name)}`);
          }} 
          className="w-full bg-accent text-white py-3.5 rounded-xl text-small flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          View Assets Inventory <ArrowRight size={16} />
        </button>
      </div>

    </div>
  )
}


