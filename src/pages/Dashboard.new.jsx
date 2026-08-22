import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Package, Activity, MapPin, Wrench, TrendingUp, ArrowRight, RefreshCw,
  Ticket, Calendar, ClipboardCheck, AlertTriangle, IndianRupee,
  Plus, Shield, Boxes, ChevronRight, User, Upload, Clock, CheckCircle2, Tag
} from 'lucide-react'
import { supabase, fetchStats, fetchExpiringDocuments } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calculateBookValue, formatCurrency } from '../lib/depreciation'

// Power BI Command Center Sub-Components
const FinancialWaterfallChart = React.lazy(() => import('../components/dashboard/FinancialWaterfallChart'))
const BreakdownDecomposition = React.lazy(() => import('../components/dashboard/BreakdownDecomposition'))
const KpiGaugeCard = React.lazy(() => import('../components/dashboard/KpiGaugeCard'))
const RealtimeTickerTile = React.lazy(() => import('../components/dashboard/RealtimeTickerTile'))
const SiteValuationMatrix = React.lazy(() => import('../components/dashboard/SiteValuationMatrix'))
const AssetRiskRadar = React.lazy(() => import('../components/dashboard/AssetRiskRadar'))
const MonthlyMaintenanceTrend = React.lazy(() => import('../components/dashboard/MonthlyMaintenanceTrend'))
const InventoryParetoChart = React.lazy(() => import('../components/dashboard/InventoryParetoChart'))
const UserActivityAnalytics = React.lazy(() => import('../components/dashboard/UserActivityAnalytics'))

const STATUS_COLOR = {
  Active:         { color: 'var(--green)',  hex: '#00b96b' },
  Inactive:       { color: 'var(--text-2)', hex: '#6b7db3' },
  'Under Repair': { color: 'var(--amber)',  hex: 'var(--status-warning)' },
  Disposed:       { color: 'var(--red)',    hex: 'var(--status-danger)' },
  'On Hire':      { color: 'var(--cyan)',   hex: '#06b6d4' },
}
const STATUS_BADGE_CLS = {
  Active: 'badge-active', Inactive: 'badge-inactive',
  'Under Repair': 'badge-repair', Disposed: 'badge-disposed', 'On Hire': 'badge-onhire'
}
const CAT_COLORS = ['#4f7eff', '#34d399', 'var(--status-warning)', 'var(--status-danger)', 'var(--status-special)', '#06b6d4', '#ec4899', '#f97316']

function StatCard({ icon: Icon, label, value, color, sub, delay = 0, progress }) {

  return (
    <div className="flex flex-col gap-6 pb-10 max-w-[1600px] mx-auto w-full animate-fade-up">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title text-text-0 mb-1">
            {greeting}, {profile?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-small text-text-2">
            Overview of your active projects, sites, and critical operations.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {can('add') && (
            <Link to="/assets/new" className="no-underline">
              <Button size="sm" icon={Plus}>New Asset</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-bg-1 p-3 rounded-lg border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <div className="relative min-w-[160px] flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 w-4 h-4 pointer-events-none" />
            <select 
              value={selectedSite} 
              onChange={e => setSelectedSite(e.target.value)} 
              className="sel !pl-9 !text-caption !min-h-[34px] !py-1.5" 
            >
              <option value="">All Sites & Projects</option>
              {sitesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="relative min-w-[160px] flex-1">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 w-4 h-4 pointer-events-none" />
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)} 
              className="sel !pl-9 !text-caption !min-h-[34px] !py-1.5"
            >
              <option value="">All Asset Categories</option>
              {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
          <button onClick={load} className="text-text-2 hover:text-text-0 transition-colors" title="Refresh">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <div className="flex bg-bg-2 p-1 rounded-md border border-border">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'year', label: 'YTD' },
              { id: '90', label: '90D' },
              { id: '30', label: '30D' }
            ].map(t => (
              <button 
                key={t.id} 
                onClick={() => setTimeframe(t.id)} 
                className="px-3 py-1 text-caption text-body-medium rounded transition-all"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-danger-subtle border border-danger/20 text-danger text-small px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-body-medium">
            <AlertTriangle size={16} /> {error}
          </div>
          <Button variant="danger" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {/* Operational Overview */}
      <section className="flex flex-col gap-3">
        <h2 className="text-small text-text-0 uppercase tracking-wider">Operational Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-small text-body-medium text-text-2">Total Assets</span>
              <Package size={16} className="text-text-3" />
            </div>
            <div className="text-page-title text-text-0">{filteredAssets.length}</div>
          </div>
          <div className="card p-5 border-l-4 border-l-success">
            <div className="flex items-center justify-between mb-4">
              <span className="text-small text-body-medium text-text-2">Active</span>
              <Activity size={16} className="text-success" />
            </div>
            <div className="text-page-title text-text-0">{activeCount}</div>
          </div>
          <div className="card p-5 border-l-4 border-l-warning">
            <div className="flex items-center justify-between mb-4">
              <span className="text-small text-body-medium text-text-2">Under Repair</span>
              <Wrench size={16} className="text-warning" />
            </div>
            <div className="text-page-title text-text-0">{repairCount}</div>
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-small text-body-medium text-text-2">Total Sites</span>
              <MapPin size={16} className="text-text-3" />
            </div>
            <div className="text-page-title text-text-0">{sitesCount}</div>
          </div>
        </div>
      </section>

      {/* Attention Required */}
      <section className="flex flex-col gap-3 mt-4">
        <h2 className="text-small text-text-0 uppercase tracking-wider">Attention Required</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Overdue Maintenance */}
          <div className="card flex flex-col h-[300px]">
            <div className="px-5 py-3 border-b border-border flex justify-between items-center bg-bg-0 rounded-t-lg">
              <span className="text-small text-body-medium text-text-1 flex items-center gap-2">
                <AlertTriangle size={14} className="text-danger" /> Overdue Maintenance
              </span>
              <span className="bg-danger-subtle text-danger-text text-caption px-2 py-0.5 rounded-full text-body-medium">{overdueSchedules.length}</span>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              {overdueSchedules.length > 0 ? (
                <ul className="m-0 p-0 list-none divide-y divide-border">
                  {overdueSchedules.slice(0, 5).map(s => (
                    <li key={s.id} className="p-3 hover:bg-bg-0 transition-colors">
                      <div className="text-small text-body-medium text-text-0">{s.title}</div>
                      <div className="text-caption text-text-2 mt-1">{s.assets?.asset_name} • {new Date(s.next_due).toLocaleDateString()}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-3 gap-2">
                  <CheckCircle2 size={24} className="text-success/50" />
                  <span className="text-small">All schedules on track</span>
                </div>
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="card flex flex-col h-[300px]">
            <div className="px-5 py-3 border-b border-border flex justify-between items-center bg-bg-0 rounded-t-lg">
              <span className="text-small text-body-medium text-text-1 flex items-center gap-2">
                <Boxes size={14} className="text-warning" /> Low Inventory
              </span>
              <span className="bg-warning-subtle text-warning-text text-caption px-2 py-0.5 rounded-full text-body-medium">{filteredLowStockItems.length}</span>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              {filteredLowStockItems.length > 0 ? (
                <ul className="m-0 p-0 list-none divide-y divide-border">
                  {filteredLowStockItems.slice(0, 5).map(i => (
                    <li key={i.id} className="p-3 hover:bg-bg-0 transition-colors flex justify-between items-center">
                      <div>
                        <div className="text-small text-body-medium text-text-0">{i.item_name}</div>
                        <div className="text-caption text-text-2 mt-1">Min: {i.min_stock} {i.unit}</div>
                      </div>
                      <span className="text-danger text-small">{i.current_stock} {i.unit}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-3 gap-2">
                  <CheckCircle2 size={24} className="text-success/50" />
                  <span className="text-small">Stock levels healthy</span>
                </div>
              )}
            </div>
          </div>

          {/* SLA Breaches */}
          <div className="card flex flex-col h-[300px]">
            <div className="px-5 py-3 border-b border-border flex justify-between items-center bg-bg-0 rounded-t-lg">
              <span className="text-small text-body-medium text-text-1 flex items-center gap-2">
                <Clock size={14} className="text-danger" /> SLA Breaches
              </span>
              <span className="bg-danger-subtle text-danger-text text-caption px-2 py-0.5 rounded-full text-body-medium">{slaBreached.length}</span>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              {slaBreached.length > 0 ? (
                <ul className="m-0 p-0 list-none divide-y divide-border">
                  {slaBreached.slice(0, 5).map(t => (
                    <li key={t.id} className="p-3 hover:bg-bg-0 transition-colors">
                      <div className="text-small text-body-medium text-text-0">{t.ticket_no} - {t.title}</div>
                      <div className="text-caption text-danger mt-1">Due: {new Date(t.sla_due_at).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-3 gap-2">
                  <CheckCircle2 size={24} className="text-success/50" />
                  <span className="text-small">No breached tickets</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Asset List Preview */}
      <section className="flex flex-col gap-3 mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-small text-text-0 uppercase tracking-wider">Recent Assets</h2>
          <Link to="/assets" className="text-small text-accent hover:underline text-body-medium flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tbl min-w-full">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th className="hidden sm:table-cell">Category</th>
                  <th className="hidden sm:table-cell">Site</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecentlyAdded.map(a => (
                  <tr key={a.id} onClick={() => navigate('/assets/' + a.id)} className="cursor-pointer group">
                    <td className="font-mono text-caption text-text-2 group-hover:text-accent transition-colors">{a.asset_code}</td>
                    <td className="text-body-medium text-text-0">{a.asset_name || '-'}</td>
                    <td className="hidden sm:table-cell text-text-2 text-small">{a.category || '-'}</td>
                    <td className="hidden sm:table-cell text-text-2 text-small">{a.site || '-'}</td>
                    <td><span className="badge">{a.status}</span></td>
                  </tr>
                ))}
                {filteredRecentlyAdded.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-text-3 text-small">No assets found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  )
}
