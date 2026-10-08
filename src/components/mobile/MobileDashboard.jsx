import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Package, Wrench, ScanLine, Plus, AlertTriangle, CheckCircle2,
  MapPin, IndianRupee, ArrowRight, Clock, ShieldAlert, Boxes,
  TrendingUp, RefreshCw, Layers, FileSpreadsheet, ChevronRight,
  ClipboardCheck, Tag, FileText, Send, Eye, ShieldCheck, AlertCircle,
  Archive, Building2, User
} from 'lucide-react'
import { formatCurrency } from '../../lib/depreciation'

export default function MobileDashboard({
  stats,
  assets = [],
  tickets = [],
  schedules = [],
  lowStockItems = [],
  expiringDocs = [],
  recentActivity = [],
  loading,
  refreshing,
  onRefresh,
  user
}) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-4 animate-pulse pb-28">
        <div className="h-20 bg-bg-1 border border-border rounded-xl" />
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={`skel3-${i}`} className="h-16 bg-bg-1 border border-border rounded-xl" />
          ))}
        </div>
        <div className="h-28 bg-bg-1 border border-border rounded-xl" />
        <div className="h-44 bg-bg-1 border border-border rounded-xl" />
        <div className="h-56 bg-bg-1 border border-border rounded-xl" />
      </div>
    )
  }

  // 1. Calculations & Metrics
  const totalAssets = assets.length
  const activeAssets = assets.filter(a => a.status === 'Active').length
  const underRepairAssets = assets.filter(a => a.status === 'Under Repair').length
  const inactiveAssets = assets.filter(a => a.status === 'Inactive').length
  const onHireAssets = assets.filter(a => a.status === 'On Hire').length
  const disposedAssets = assets.filter(a => a.status === 'Disposed').length

  const fleetHealthPct = totalAssets > 0 ? ((activeAssets / totalAssets) * 100).toFixed(1) : '100'

  // Attention Triage
  const criticalTickets = tickets.filter(t => t.priority?.toLowerCase() === 'critical' && t.status !== 'Resolved' && t.status !== 'Closed')
  const overdueSchedules = schedules.filter(s => s.next_due && new Date(s.next_due) < new Date())
  const dueTodaySchedules = schedules.filter(s => {
    if (!s.next_due) return false
    return new Date(s.next_due).toDateString() === new Date().toDateString()
  })
  const lowStockCount = lowStockItems.filter(i => Number(i.current_stock || 0) <= Number(i.reorder_level || 10)).length
  const outOfStockCount = lowStockItems.filter(i => Number(i.current_stock || 0) === 0).length
  const openInspectionsCount = expiringDocs?.length || 0

  const totalAttentionCount = criticalTickets.length + overdueSchedules.length + dueTodaySchedules.length + lowStockCount + outOfStockCount

  // Top Sites Map
  const siteMap = {}
  assets.forEach(a => {
    const s = a.site || 'Unassigned Site'
    if (!siteMap[s]) siteMap[s] = { name: s, count: 0, active: 0, maintenance: 0 }
    siteMap[s].count++
    if (a.status === 'Active') siteMap[s].active++
    if (a.status === 'Under Repair') siteMap[s].maintenance++
  })
  const siteList = Object.values(siteMap).sort((a, b) => b.count - a.count).slice(0, 5)

  // Recent 5 Assets
  const recentAssets = assets.slice(0, 5)

  return (
    <div className="flex flex-col gap-5 pb-28">

      {/* ── 1. PRIMARY QUICK ACTIONS (Scrollable 2-Row Grid) ── */}
      <div className="bg-bg-1 border border-border rounded-xl p-3 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          <Link
            to="/assets/new"
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-bg-0 hover:bg-bg-2 border border-border text-center active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-accent text-white flex items-center justify-center mb-1 shadow-sm">
              <Plus size={18} />
            </div>
            <span className="text-[11px] text-text-0 truncate w-full">New Asset</span>
          </Link>

          <Link
            to="/scan"
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-bg-0 hover:bg-bg-2 border border-border text-center active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-1 border border-accent/20">
              <ScanLine size={18} />
            </div>
            <span className="text-[11px] text-text-0 truncate w-full">Scan QR</span>
          </Link>

          <Link
            to="/maintenance"
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-bg-0 hover:bg-bg-2 border border-border text-center active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-amber/10 text-amber flex items-center justify-center mb-1 border border-amber/20">
              <Wrench size={18} />
            </div>
            <span className="text-[11px] text-text-0 truncate w-full">Tickets</span>
          </Link>

          <Link
            to="/inventory"
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-bg-0 hover:bg-bg-2 border border-border text-center active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-green/10 text-green flex items-center justify-center mb-1 border border-green/20">
              <Boxes size={18} />
            </div>
            <span className="text-[11px] text-text-0 truncate w-full">Stock</span>
          </Link>

          <Link
            to="/audit"
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-bg-0 hover:bg-bg-2 border border-border text-center active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-[var(--status-special)] flex items-center justify-center mb-1 border border-purple-500/20">
              <ClipboardCheck size={18} />
            </div>
            <span className="text-[11px] text-text-0 truncate w-full">Inspect</span>
          </Link>

          <Link
            to="/import"
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-bg-0 hover:bg-bg-2 border border-border text-center active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-[var(--accent)] flex items-center justify-center mb-1 border border-blue-500/20">
              <FileSpreadsheet size={18} />
            </div>
            <span className="text-[11px] text-text-0 truncate w-full">Import</span>
          </Link>

          <Link
            to="/stickers"
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-bg-0 hover:bg-bg-2 border border-border text-center active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-[var(--status-info)] flex items-center justify-center mb-1 border border-cyan-500/20">
              <Tag size={18} />
            </div>
            <span className="text-[11px] text-text-0 truncate w-full">QR Tags</span>
          </Link>

          <Link
            to="/reports"
            className="flex flex-col items-center justify-center p-2 rounded-lg bg-bg-0 hover:bg-bg-2 border border-border text-center active:scale-95 transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-500/10 text-[var(--text-secondary)] flex items-center justify-center mb-1 border border-slate-500/20">
              <FileText size={18} />
            </div>
            <span className="text-[11px] text-text-0 truncate w-full">Reports</span>
          </Link>
        </div>
      </div>

      {/* ── 2. FLEET OVERVIEW METRIC STRIP ── */}
      <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Package size={16} className="text-accent" />
            <h3 className="text-caption text-text-3 uppercase tracking-wider m-0">Fleet Overview</h3>
          </div>
          <span className="font-mono text-caption text-green bg-green/10 px-2 py-0.5 rounded-full border border-green/20">
            {fleetHealthPct}% Health
          </span>
        </div>

        {/* 4 Compact Stat Columns */}
        <div className="grid grid-cols-4 gap-2 text-center py-2 border-y border-border-light">
          <div className="p-2 bg-bg-0 rounded-lg">
            <span className="text-[10px] uppercase text-text-3 block">Total</span>
            <span className="text-section-title font-mono text-text-0 block mt-0.5">{totalAssets}</span>
          </div>

          <div className="p-2 bg-bg-0 rounded-lg">
            <span className="text-[10px] uppercase text-green block">Active</span>
            <span className="text-section-title font-mono text-green block mt-0.5">{activeAssets}</span>
          </div>

          <div className="p-2 bg-bg-0 rounded-lg">
            <span className="text-[10px] uppercase text-amber block">Maint.</span>
            <span className="text-section-title font-mono text-amber block mt-0.5">{underRepairAssets}</span>
          </div>

          <div className="p-2 bg-bg-0 rounded-lg">
            <span className="text-[10px] uppercase text-text-3 block">Inactive</span>
            <span className="text-section-title font-mono text-text-3 block mt-0.5">{inactiveAssets}</span>
          </div>
        </div>

        {/* Total Valuation Row */}
        <div className="flex items-center justify-between pt-3 text-caption">
          <span className="text-text-3">Total Fleet Book Value:</span>
          <span className="font-mono text-text-0 text-small">
            {formatCurrency(stats?.totalValue || 0)}
          </span>
        </div>
      </div>

      {/* ── 3. ATTENTION REQUIRED (Triage Center) ── */}
      <div className="bg-bg-1 border-l-4 border-l-danger border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={16} className="text-danger" />
            <h3 className="text-caption text-text-0 uppercase tracking-wider m-0">Attention Required</h3>
          </div>
          <span className="text-caption text-danger bg-danger-subtle px-2 py-0.5 rounded-full border border-danger/20">
            {totalAttentionCount} Urgent
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {criticalTickets.length > 0 && (
            <Link
              to="/maintenance"
              className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-caption text-rose-900 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                <span>{criticalTickets.length} Critical Maintenance Ticket{criticalTickets.length > 1 ? 's' : ''}</span>
              </div>
              <ChevronRight size={14} className="text-rose-700" />
            </Link>
          )}

          {overdueSchedules.length > 0 && (
            <Link
              to="/maintenance"
              className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-caption text-amber-900 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber" />
                <span>{overdueSchedules.length} Overdue Scheduled Service{overdueSchedules.length > 1 ? 's' : ''}</span>
              </div>
              <ChevronRight size={14} className="text-amber-700" />
            </Link>
          )}

          {dueTodaySchedules.length > 0 && (
            <Link
              to="/maintenance"
              className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-caption text-blue-900 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span>{dueTodaySchedules.length} Service Due Today</span>
              </div>
              <ChevronRight size={14} className="text-blue-700" />
            </Link>
          )}

          {lowStockCount > 0 && (
            <Link
              to="/inventory"
              className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-caption text-amber-900 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2">
                <Boxes size={14} className="text-amber" />
                <span>{lowStockCount} Inventory Item{lowStockCount > 1 ? 's' : ''} Below Reorder Level</span>
              </div>
              <ChevronRight size={14} className="text-amber-700" />
            </Link>
          )}

          {totalAttentionCount === 0 && (
            <div className="flex items-center gap-2 text-caption text-green py-1">
              <CheckCircle2 size={16} />
              <span>All operations, tickets, and stock levels are healthy!</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. MAINTENANCE PRIORITY SNAPSHOT ── */}
      <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Wrench size={16} className="text-amber" />
            <h3 className="text-caption text-text-3 uppercase tracking-wider m-0">Priority Maintenance</h3>
          </div>
          <Link to="/maintenance" className="text-caption text-accent flex items-center gap-1">
            <span>View All ({tickets.length})</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {tickets.length === 0 ? (
          <p className="text-caption text-text-3 m-0 py-2">No maintenance tickets in queue.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {tickets.slice(0, 3).map(ticket => (
              <div 
                key={ticket.id}
                onClick={() => navigate('/maintenance')}
                className="py-2.5 flex items-center justify-between active:bg-bg-2 transition-colors cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-caption text-text-0 truncate">{ticket.title}</div>
                  <div className="text-[11px] text-text-3 font-mono mt-0.5">
                    {ticket.ticket_no} • {ticket.assets?.asset_name || 'Equipment'}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px]  border ${
                    ticket.priority?.toLowerCase() === 'critical'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {ticket.priority || 'Normal'}
                  </span>
                  <ChevronRight size={14} className="text-text-3" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. INVENTORY STOCK HEALTH SNAPSHOT ── */}
      <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Boxes size={16} className="text-accent" />
            <h3 className="text-caption text-text-3 uppercase tracking-wider m-0">Critical Inventory</h3>
          </div>
          <Link to="/inventory" className="text-caption text-accent flex items-center gap-1">
            <span>All Stock</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {lowStockItems.length === 0 ? (
          <p className="text-caption text-text-3 m-0 py-2">All inventory levels sufficient.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {lowStockItems.slice(0, 3).map(item => (
              <div 
                key={item.id}
                onClick={() => navigate('/inventory')}
                className="py-2.5 flex items-center justify-between active:bg-bg-2 transition-colors cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-caption text-text-0 truncate">{item.item_name}</div>
                  <div className="text-[11px] text-text-3 font-mono mt-0.5">
                    Location: {item.location || 'Main Yard'}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono text-caption text-danger block">
                    {item.current_stock || 0} {item.unit || 'nos'}
                  </span>
                  <span className="text-[10px] text-text-3 block">Min: {item.reorder_level || 10}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. ACTIVE SITES OVERVIEW ── */}
      <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-accent" />
            <h3 className="text-caption text-text-3 uppercase tracking-wider m-0">Active Project Sites</h3>
          </div>
          <Link to="/sites" className="text-caption text-accent flex items-center gap-1">
            <span>View All ({siteList.length})</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {siteList.map(site => (
            <div 
              key={site.name}
              onClick={() => navigate(`/assets?site=${encodeURIComponent(site.name)}`)}
              className="py-2.5 flex items-center justify-between active:bg-bg-2 transition-colors cursor-pointer"
            >
              <div className="min-w-0 pr-3">
                <div className="text-caption text-text-0 truncate">{site.name}</div>
                <div className="text-[11px] text-text-3 mt-0.5">
                  {site.active} operational • {site.maintenance > 0 ? `${site.maintenance} in repair` : '0 issues'}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="font-mono text-caption bg-bg-0 border border-border px-2 py-1 rounded-md text-text-0">
                  {site.count} assets
                </span>
                <ChevronRight size={14} className="text-text-3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 7. RECENTLY REGISTERED ASSETS ── */}
      <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Tag size={16} className="text-accent" />
            <h3 className="text-caption text-text-3 uppercase tracking-wider m-0">Recent Assets</h3>
          </div>
          <Link to="/assets" className="text-caption text-accent flex items-center gap-1">
            <span>Asset Register</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {recentAssets.map(asset => (
            <div 
              key={asset.id}
              onClick={() => navigate(`/assets/${asset.id}`)}
              className="py-2 flex items-center justify-between active:bg-bg-2 transition-colors cursor-pointer"
            >
              <div className="min-w-0 pr-2">
                <div className="text-caption text-text-0 truncate">{asset.asset_name}</div>
                <div className="text-[11px] text-text-3 font-mono">
                  {asset.asset_code} • {asset.site || 'No Site'}
                </div>
              </div>
              <span className="font-mono text-caption text-text-0 shrink-0">
                {formatCurrency(asset.purchase_value || 0)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 8. RECENT FIELD ACTIVITY LOG ── */}
      {recentActivity?.length > 0 && (
        <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Clock size={16} className="text-text-3" />
            <h3 className="text-caption text-text-3 uppercase tracking-wider m-0">Recent Activity Timeline</h3>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {recentActivity.slice(0, 4).map(item => (
              <div key={item.id} className="py-2 flex flex-col gap-0.5 text-caption">
                <div className="flex items-center justify-between">
                  <span className="text-text-0 capitalize">
                    {item.action || 'Asset Modified'}
                  </span>
                  <span className="text-[10px] text-text-3 font-mono">
                    {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="text-text-2 truncate">
                  {item.assets?.asset_name || 'Asset Record'} {item.profiles?.full_name ? `by ${item.profiles.full_name}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 9. REPORT SHORTCUTS ── */}
      <div className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm">
        <h3 className="text-caption text-text-3 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <FileText size={16} className="text-accent" />
          <span>Operational Reports</span>
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <Link to="/reports" className="p-2.5 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-caption text-text-0 flex items-center justify-between">
            <span>Executive KPI</span>
            <ChevronRight size={14} className="text-text-3" />
          </Link>
          <Link to="/reports" className="p-2.5 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-caption text-text-0 flex items-center justify-between">
            <span>Fleet Valuation</span>
            <ChevronRight size={14} className="text-text-3" />
          </Link>
          <Link to="/reports" className="p-2.5 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-caption text-text-0 flex items-center justify-between">
            <span>Maintenance Log</span>
            <ChevronRight size={14} className="text-text-3" />
          </Link>
          <Link to="/reports" className="p-2.5 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-caption text-text-0 flex items-center justify-between">
            <span>Site Breakdown</span>
            <ChevronRight size={14} className="text-text-3" />
          </Link>
        </div>
      </div>

      {/* ── 10. REFRESH TRIGGER ── */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-caption text-text-2 hover:text-text-0 bg-bg-1 border border-border px-5 py-2.5 rounded-full active:scale-95 transition-all shadow-sm"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin text-accent' : ''} />
          <span>{refreshing ? 'Refreshing Data...' : 'Refresh Field Data'}</span>
        </button>
      </div>

    </div>
  )
}


