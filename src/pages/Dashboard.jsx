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
  'Under Repair': { color: 'var(--amber)',  hex: '#f59e0b' },
  Disposed:       { color: 'var(--red)',    hex: '#ef4444' },
  'On Hire':      { color: 'var(--cyan)',   hex: '#06b6d4' },
}
const STATUS_BADGE_CLS = {
  Active: 'badge-active', Inactive: 'badge-inactive',
  'Under Repair': 'badge-repair', Disposed: 'badge-disposed', 'On Hire': 'badge-onhire'
}
const CAT_COLORS = ['#4f7eff', '#34d399', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

function StatCard({ icon: Icon, label, value, color, sub, delay = 0, progress }) {
  return (
    <div 
      className="card animate-fade-up relative overflow-hidden" 
      style={{ 
        animationDelay: `${delay}ms`,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: 120,
      }}
    >
      <div style={{ position: 'absolute', right: -20, top: -20, opacity: 0.03, transform: 'rotate(-10deg)', pointerEvents: 'none' }}>
        <Icon size={120} style={{ color }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} />
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-2)', fontFamily: 'DM Sans', fontWeight: 600 }}>{label}</span>
        </div>
        {sub && <span style={{ fontSize: '0.65rem', color: color, fontWeight: 700, fontFamily: 'DM Sans', background: `${color}12`, padding: '4px 10px', borderRadius: 20 }}>{sub}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'Oswald', color: 'var(--text-0)', lineHeight: 1 }}>{value}</div>
      </div>
      {progress != null && (
        <div style={{ marginTop: 16, height: 4, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(2, Math.min(100, progress))}%`, background: color, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ 
      background: 'rgba(26, 34, 64, 0.85)', 
      backdropFilter: 'blur(8px)', 
      border: '1px solid rgba(255,255,255,0.1)', 
      borderRadius: 10, 
      padding: '8px 12px', 
      fontFamily: 'DM Sans', 
      fontSize: '0.82rem', 
      color: 'white',
      boxShadow: 'var(--clay-shadow-sm)'
    }}>
      <p style={{ margin: 0, fontWeight: 500 }}>
        {payload[0].name}: <strong style={{ color: 'var(--accent-light)', fontFamily: 'DM Mono' }}>{payload[0].value}</strong>
      </p>
    </div>
  )
}

const CurrencyTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ 
      background: 'rgba(26, 34, 64, 0.85)', 
      backdropFilter: 'blur(8px)', 
      border: '1px solid rgba(255,255,255,0.1)', 
      borderRadius: 10, 
      padding: '8px 12px', 
      fontFamily: 'DM Sans', 
      fontSize: '0.82rem', 
      color: 'white',
      boxShadow: 'var(--clay-shadow-sm)'
    }}>
      <p style={{ margin: 0, fontWeight: 500 }}>
        {payload[0].payload?.name}: <strong style={{ color: 'var(--accent-light)', fontFamily: 'DM Mono' }}>{formatCurrency(payload[0].value)}</strong>
      </p>
    </div>
  )
}

// Depreciation forecast helper
function calculateProjectedBookValue(asset, additionalYears) {
  const purchase_value = Number(asset.purchase_value)
  const salvage_value = Number(asset.salvage_value || 0)
  const useful_life = Number(asset.useful_life_years || 1)
  const rate = Number(asset.depreciation_rate_percent || 0) / 100
  const method = asset.depreciation_method
  const purchaseDateStr = asset.purchase_date

  if (!purchase_value || isNaN(purchase_value)) return 0
  if (!purchaseDateStr) return purchase_value

  const purchaseDate = new Date(purchaseDateStr)
  const now = new Date()
  
  let yearsOwned = (now - purchaseDate) / (1000 * 60 * 60 * 24 * 365.25) + additionalYears
  if (yearsOwned < 0) yearsOwned = 0

  if (method === 'Straight Line') {
    const annualDepreciation = (purchase_value - salvage_value) / useful_life
    const totalDepreciation = annualDepreciation * yearsOwned
    return Math.max(salvage_value, purchase_value - totalDepreciation)
  }

  if (method === 'Reducing Balance' || method === 'Declining Balance') {
    const currentValue = purchase_value * Math.pow(1 - rate, yearsOwned)
    return Math.max(salvage_value, currentValue)
  }

  return purchase_value
}

export default function Dashboard() {
  const { profile, can, isAdmin, isMod, currentCompany } = useAuth()
  const cc = currentCompany?.code
  const navigate = useNavigate()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const [tickets, setTickets] = useState([])
  const [schedules, setSchedules] = useState([])
  const [maintLogs, setMaintLogs] = useState([])
  const [auditSessions, setAuditSessions] = useState([])
  const [lowStockItems, setLowStockItems] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [expiringDocs, setExpiringDocs] = useState([])

  // Dashboard Filters State
  const [selectedSite, setSelectedSite] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [timeframe, setTimeframe] = useState('all') // '30' | '90' | 'year' | 'all'
  const [forecastYears, setForecastYears] = useState(0)
  const [actionCenterTab, setActionCenterTab] = useState('pending') // 'pending' | 'stock' | 'activity'

  const load = useCallback(async () => {
    try {
      setError(null)
      setRefreshing(true)

      let tQ = supabase.from('maintenance_tickets')
        .select('id, ticket_no, title, status, priority, sla_due_at, resolved_at, assigned_to, created_at, assets(asset_name, site, category)')
        .order('created_at', { ascending: false }).limit(100)
      if (cc) tQ = tQ.eq('company_code', cc)

      let sQ = supabase.from('maintenance_schedules')
        .select('id, title, next_due, status, assets(asset_name, site, category)')
        .eq('status', 'active').order('next_due').limit(50)

      let auQ = supabase.from('audit_sessions')
        .select('id, title, status, created_at')
        .order('created_at', { ascending: false }).limit(10)

      let invQ = supabase.from('inventory_items')
        .select('id, item_name, current_stock, min_stock, unit, site')
        .eq('is_active', true).order('item_name')

      let mlQ = supabase.from('maintenance_logs')
        .select('cost, performed_at, asset_id, assets(site, category)')
        .order('performed_at', { ascending: false }).limit(500)

      let assetsQ = supabase.from('assets')
        .select('id, asset_code, asset_name, make, site, status, category, purchase_value, salvage_value, useful_life_years, depreciation_rate_percent, depreciation_method, purchase_date, added_on')
        .or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
        .order('added_on', { ascending: false })
      if (cc) assetsQ = assetsQ.eq('company_code', cc)

      const [assetsRes, tRes, sRes, mlRes, auRes, invRes, activityRes, docsRes] = await Promise.all([
        assetsQ,
        tQ,
        sQ,
        mlQ,
        auQ,
        invQ,
        supabase.from('asset_audit')
          .select('id, action, created_at, changes, assets:asset_id(asset_name, site, category), profiles:user_id(full_name)')
          .order('created_at', { ascending: false }).limit(10),
        fetchExpiringDocuments(30)
      ])

      setAssets(assetsRes.data || [])
      setTickets(tRes.data || [])
      setSchedules(sRes.data || [])
      setMaintLogs(mlRes.data || [])
      setAuditSessions(auRes.data || [])
      setLowStockItems(invRes.data || [])
      setRecentActivity(activityRes.data || [])
      setExpiringDocs(docsRes || [])
    } catch (e) {
      setError(e.message || 'Failed to load dashboard data')
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [cc])

  useEffect(() => {
    load()
    const ch1 = supabase.channel('dash-assets').on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, load).subscribe()
    const ch2 = supabase.channel('dash-tickets').on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tickets' }, load).subscribe()
    const ch3 = supabase.channel('dash-inventory').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, load).subscribe()
    const ch4 = supabase.channel('dash-audit').on('postgres_changes', { event: '*', schema: 'public', table: 'asset_audit' }, load).subscribe()
    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
      supabase.removeChannel(ch3)
      supabase.removeChannel(ch4)
    }
  }, [load])

  // ── Derived filtered datasets ─────────────────────────────────────────

  const categoriesList = useMemo(() => {
    const set = new Set(assets.map(a => a.category).filter(Boolean))
    return Array.from(set).sort()
  }, [assets])

  const sitesList = useMemo(() => {
    const set = new Set(assets.map(a => a.site).filter(Boolean))
    return Array.from(set).sort()
  }, [assets])

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchSite = !selectedSite || a.site === selectedSite
      const matchCategory = !selectedCategory || a.category === selectedCategory
      return matchSite && matchCategory
    })
  }, [assets, selectedSite, selectedCategory])

  const timeframeDateLimit = useMemo(() => {
    const now = new Date()
    if (timeframe === '30') return new Date(now.setDate(now.getDate() - 30))
    if (timeframe === '90') return new Date(now.setDate(now.getDate() - 90))
    if (timeframe === 'year') return new Date(now.getFullYear(), 0, 1)
    return null
  }, [timeframe])

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const asset = t.assets
      const matchSite = !selectedSite || asset?.site === selectedSite
      const matchCategory = !selectedCategory || asset?.category === selectedCategory
      
      const createdDate = new Date(t.created_at)
      const matchTimeframe = !timeframeDateLimit || createdDate >= timeframeDateLimit
      
      return matchSite && matchCategory && matchTimeframe
    })
  }, [tickets, selectedSite, selectedCategory, timeframeDateLimit])

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const asset = s.assets
      const matchSite = !selectedSite || asset?.site === selectedSite
      const matchCategory = !selectedCategory || asset?.category === selectedCategory
      return matchSite && matchCategory
    })
  }, [schedules, selectedSite, selectedCategory])

  const filteredMaintLogs = useMemo(() => {
    return maintLogs.filter(l => {
      const asset = l.assets
      const matchSite = !selectedSite || asset?.site === selectedSite
      const matchCategory = !selectedCategory || asset?.category === selectedCategory
      
      const performedDate = new Date(l.performed_at)
      const matchTimeframe = !timeframeDateLimit || performedDate >= timeframeDateLimit
      
      return matchSite && matchCategory && matchTimeframe
    })
  }, [maintLogs, selectedSite, selectedCategory, timeframeDateLimit])

  const filteredRecentActivity = useMemo(() => {
    return recentActivity.filter(act => {
      const asset = act.assets
      const matchSite = !selectedSite || asset?.site === selectedSite
      const matchCategory = !selectedCategory || asset?.category === selectedCategory
      
      const createdDate = new Date(act.created_at)
      const matchTimeframe = !timeframeDateLimit || createdDate >= timeframeDateLimit
      
      return matchSite && matchCategory && matchTimeframe
    })
  }, [recentActivity, selectedSite, selectedCategory, timeframeDateLimit])

  const filteredLowStockItems = useMemo(() => {
    return lowStockItems.filter(i => {
      const matchSite = !selectedSite || i.site === selectedSite
      const isLowStock = i.min_stock && i.current_stock <= i.min_stock
      return matchSite && isLowStock
    })
  }, [lowStockItems, selectedSite])

  const filteredExpiringDocs = useMemo(() => {
    return expiringDocs.filter(d => {
      const matchSite = !selectedSite || d.assets?.site === selectedSite
      return matchSite
    })
  }, [expiringDocs, selectedSite])

  const { openTickets, overdueSchedules, slaBreached, unassignedTickets, inProgressAudits } = useMemo(() => {
    const now = new Date()
    return {
      openTickets:       filteredTickets.filter(t => t.status !== 'resolved'),
      overdueSchedules:  filteredSchedules.filter(s => new Date(s.next_due) < now),
      slaBreached:       filteredTickets.filter(t => t.sla_due_at && t.status !== 'resolved' && new Date(t.sla_due_at) < now),
      unassignedTickets: filteredTickets.filter(t => !t.assigned_to && t.status !== 'resolved'),
      inProgressAudits:  auditSessions.filter(s => s.status === 'in_progress'),
    }
  }, [filteredTickets, filteredSchedules, auditSessions])

  // Financial
  const totalPurchaseValue = useMemo(() => filteredAssets.reduce((a, x) => a + (Number(x.purchase_value) || 0), 0), [filteredAssets])
  const totalBookValue     = useMemo(() => filteredAssets.reduce((a, x) => a + calculateBookValue(x), 0), [filteredAssets])
  const totalDepreciation  = totalPurchaseValue - totalBookValue

  const maintCost = useMemo(() => {
    return filteredMaintLogs.reduce((a, l) => a + (Number(l.cost) || 0), 0)
  }, [filteredMaintLogs])

  const localStats = useMemo(() => {
    const total = filteredAssets.length
    const byStatus = {}
    const byCategory = {}
    const bySite = {}
    filteredAssets.forEach(a => {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1
      if (a.category) byCategory[a.category] = (byCategory[a.category] || 0) + 1
      if (a.site)     bySite[a.site]         = (bySite[a.site]         || 0) + 1
    })
    return { total, byStatus, byCategory, bySite }
  }, [filteredAssets])

  // Financial Forecast calculation
  const forecastStats = useMemo(() => {
    const totalPV = filteredAssets.reduce((acc, a) => acc + (Number(a.purchase_value) || 0), 0)
    const currentBV = filteredAssets.reduce((acc, a) => acc + calculateBookValue(a), 0)
    const projectedBV = filteredAssets.reduce((acc, a) => {
      return acc + calculateProjectedBookValue(a, Number(forecastYears))
    }, 0)
    const currentDepr = totalPV - currentBV
    const projectedDepr = totalPV - projectedBV
    return { totalPV, currentBV, projectedBV, currentDepr, projectedDepr }
  }, [filteredAssets, forecastYears])

  // Charts data derivation
  const { valueByCategory, pieData, barData, siteData, activeCount, repairCount, sitesCount } = useMemo(() => {
    const map = {}
    filteredAssets.forEach(a => {
      if (!a.category || !a.purchase_value) return
      map[a.category] = (map[a.category] || 0) + Number(a.purchase_value)
    })
    return {
      valueByCategory: Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
      pieData:  Object.entries(localStats.byStatus).map(([name, value]) => ({ name, value })),
      barData:  Object.entries(localStats.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, value })),
      siteData: Object.entries(localStats.bySite).sort((a, b) => b[1] - a[1]).slice(0, 5),
      activeCount:   localStats.byStatus['Active']       || 0,
      repairCount:   localStats.byStatus['Under Repair'] || 0,
      sitesCount:    Object.keys(localStats.bySite).length,
    }
  }, [filteredAssets, localStats])

  const filteredRecentlyAdded = useMemo(() => {
    return filteredAssets.slice(0, 8)
  }, [filteredAssets])

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
      {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
    </div>
  )

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* ── Unified Page Header ── */}
      <div className="flex flex-col gap-5 animate-fade-up" style={{ animationDelay: '0ms' }}>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-[1.6rem] font-bold text-text-0 m-0 mb-1 leading-tight">
              {greeting}, {profile?.full_name?.split(' ')[0] || 'User'}
            </h1>
            <p className="text-text-2 text-[0.85rem] font-sans m-0">
              Here is what's happening across your assets and facilities today.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Raise Ticket', icon: Ticket,        to: '/maintenance', color: 'var(--red)',    show: isAdmin || isMod || can('maintenance') },
              { label: 'New Audit',    icon: ClipboardCheck, to: '/audit',       color: 'var(--green)',  show: true },
              { label: 'Import Excel', icon: Upload,         to: '/import',      color: 'var(--cyan)',   show: can('import') },
              { label: 'Admin',        icon: Shield,         to: '/admin',       color: 'var(--purple)', show: isAdmin },
            ].filter(a => a.show).map(a => (
              <Link key={a.label} to={a.to} className="btn-ghost" style={{ padding: '8px 12px', fontSize: '0.78rem', gap: 6, textDecoration: 'none' }}>
                <a.icon size={14} style={{ color: a.color }} /> <span className="hidden sm:inline">{a.label}</span>
              </Link>
            ))}
            {can('add') && (
              <Link to="/assets/new" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem', gap: 6, textDecoration: 'none', marginLeft: 4 }}>
                <Plus size={14} /> <span className="hidden sm:inline">New Asset</span>
              </Link>
            )}
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-bg-1 p-3 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-3 flex-wrap w-full xl:w-auto">
            {/* Site Selector Dropdown */}
            <div style={{ position: 'relative', minWidth: 160, flex: '1 1 auto' }}>
              <MapPin size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none', zIndex: 3 }} />
              <select 
                value={selectedSite} 
                onChange={e => setSelectedSite(e.target.value)} 
                className="sel w-full" 
                style={{ height: 36, minHeight: 36, padding: '4px 32px 4px 32px', fontSize: '0.8rem', borderRadius: 8, color: selectedSite ? 'var(--text-0)' : 'var(--text-2)', fontWeight: selectedSite ? 600 : 400, border: '1px solid var(--border)', background: 'var(--bg-0)' }}
              >
                <option value="">All Sites</option>
                {sitesList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Category Selector Dropdown */}
            <div style={{ position: 'relative', minWidth: 160, flex: '1 1 auto' }}>
              <Tag size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none', zIndex: 3 }} />
              <select 
                value={selectedCategory} 
                onChange={e => setSelectedCategory(e.target.value)} 
                className="sel w-full" 
                style={{ height: 36, minHeight: 36, padding: '4px 32px 4px 32px', fontSize: '0.8rem', borderRadius: 8, color: selectedCategory ? 'var(--text-0)' : 'var(--text-2)', fontWeight: selectedCategory ? 600 : 400, border: '1px solid var(--border)', background: 'var(--bg-0)' }}
              >
                <option value="">All Categories</option>
                {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
            <button onClick={load} className="btn-ghost btn-sm text-text-2 border-none bg-transparent hover:bg-bg-2" title="Refresh Data">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <div className="toggle-wrap" style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', padding: 2 }}>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'year', label: 'YTD' },
                { id: '90', label: '90D' },
                { id: '30', label: '30D' }
              ].map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setTimeframe(t.id)} 
                  className={`toggle-opt ${timeframe === t.id ? 'active shadow-sm' : ''}`}
                  style={{ 
                    padding: '4px 12px', border: 'none', height: 28, fontSize: '0.72rem', borderRadius: 6, fontWeight: timeframe === t.id ? 700 : 500,
                    ...(timeframe !== t.id ? { background: 'transparent', color: 'var(--text-3)' } : {})
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="rounded-xl py-3 px-4 flex items-center gap-3 font-sans text-[0.85rem] text-red shadow-sm" style={{ backgroundColor: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle size={18} className="shrink-0" />
          <span className="flex-1 font-medium">{error}</span>
          <button onClick={load} className="bg-white/50 hover:bg-white/80 border border-red/20 rounded-md px-3 py-1.5 text-red cursor-pointer font-sans text-[0.78rem] transition-colors font-semibold">Retry</button>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package}  label="Total Assets" value={filteredAssets.length} color="var(--accent)" sub="Filtered"         delay={40} />
        <StatCard icon={Activity} label="Active"        value={activeCount}            color="var(--green)"  sub="Operational" delay={80}  progress={Math.round((activeCount / (filteredAssets.length || 1)) * 100)} />
        <StatCard icon={Wrench}   label="Under Repair"  value={repairCount}            color="var(--amber)"  sub="Attention"   delay={120}  progress={Math.round((repairCount / (filteredAssets.length || 1)) * 100)} />
        <StatCard icon={MapPin}   label="Sites"         value={sitesCount}             color="var(--cyan)"   sub="Locations"   delay={160} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
        {(isAdmin || isMod) && (
          <>
            <StatCard icon={IndianRupee}   label="Total Asset Value"   value={formatCurrency(totalPurchaseValue)} color="var(--accent)" sub="Purchase"    delay={200} />
            <StatCard icon={TrendingUp}    label="Current Book Value"  value={formatCurrency(totalBookValue)}     color="var(--green)"  sub="Depreciated" delay={240} progress={Math.round((totalBookValue / (totalPurchaseValue || 1)) * 100)} />
          </>
        )}
        <StatCard icon={Ticket}        label="Open Tickets"        value={openTickets.length}                 color="var(--red)"    sub="Maintenance" delay={280} />
        <StatCard icon={AlertTriangle} label="Overdue Tasks"       value={overdueSchedules.length}            color={overdueSchedules.length > 0 ? 'var(--red)' : 'var(--green)'} sub="Schedules" delay={320} />
      </div>

      {/* ── POWER BI COMMAND CENTER WIDGETS ── */}
      <React.Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading Power BI Visuals...</div>}>
        <SiteValuationMatrix 
          assets={filteredAssets} 
          selectedSite={selectedSite} 
          onSelectSite={(site) => setSelectedSite(site)} 
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiGaugeCard title="SLA Ticket Resolution Rate" value={tickets.length ? Math.round((tickets.filter(t=>t.status==='resolved').length / tickets.length)*100) : 96.5} target={95} />
          <KpiGaugeCard title="Stock Audit Reconciliation Accuracy" value={98.2} target={95} />
          <RealtimeTickerTile />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <FinancialWaterfallChart 
            purchaseValue={totalPurchaseValue} 
            depreciation={totalDepreciation} 
            maintCost={maintCost} 
            netBookValue={totalBookValue} 
          />
          <BreakdownDecomposition 
            maintLogs={filteredMaintLogs} 
            onSelectFilter={(site) => setSelectedSite(site)} 
          />
        </div>

        {/* Additional Power BI Analytics Visual Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <AssetRiskRadar 
            repairCount={repairCount} 
            overdueCount={overdueSchedules.length} 
            anomalyCount={0} 
            expiringCount={expiringDocs.length} 
            totalAssets={filteredAssets.length || 1} 
          />
          <MonthlyMaintenanceTrend maintLogs={filteredMaintLogs} />
          <InventoryParetoChart />
        </div>

        {/* Real-time Security & User Activity Command Center */}
        <div className="mt-4">
          <UserActivityAnalytics />
        </div>
      </React.Suspense>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Status Pie (1/3 width) */}
        <div className="card animate-fade-up col-span-1" style={{ animationDelay: '360ms' }}>
          <div className="card-header border-none pb-0">
            <h2 style={{ fontFamily: 'Oswald', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.06em', color: 'var(--text-1)', margin: 0 }}>STATUS BREAKDOWN</h2>
          </div>
          <div className="card-body">
            {pieData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} dataKey="value" stroke="var(--bg-1)" strokeWidth={2}>
                        {pieData.map((entry, i) => <Cell key={i} fill={(STATUS_COLOR[entry.name] || { hex: '#6b7a99' }).hex} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Oswald', color: 'var(--text-0)', lineHeight: 1 }}>{filteredAssets.length}</div>
                    <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 }}>Assets</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                  {pieData.map((d, i) => {
                    const c = STATUS_COLOR[d.name] || { hex: '#6b7a99' }
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.hex }} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-1)', fontFamily: 'DM Sans', fontWeight: 500 }}>{d.name}</span>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-0)', fontFamily: 'DM Mono' }}>{d.value}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontFamily: 'DM Sans' }}>No data yet</p>}
          </div>
        </div>

        {/* Category Bar (2/3 width) */}
        <div className="card animate-fade-up col-span-1 lg:col-span-2" style={{ animationDelay: '400ms' }}>
          <div className="card-header border-none pb-0 flex justify-between items-center">
            <h2 style={{ fontFamily: 'Oswald', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.06em', color: 'var(--text-1)', margin: 0 }}>ASSETS BY CATEGORY</h2>
            {(isAdmin || isMod) && (
              <span style={{ fontSize: '0.75rem', color: 'var(--purple)', fontWeight: 600, background: 'var(--purple-dim)', padding: '4px 10px', borderRadius: 8 }}>
                Total Maint. Cost: {formatCurrency(maintCost)}
              </span>
            )}
          </div>
          <div className="card-body">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="catBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" />
                      <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 11, fontFamily: 'DM Sans', fontWeight: 500 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-2)', radius: 8 }} />
                  <Bar dataKey="value" fill="url(#catBarGrad)" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', fontFamily: 'DM Sans' }}>No data yet</p>}
          </div>
        </div>
      </div>

      {/* ── Asset Value by Category (with gradient multi-color bar cells) ── */}
      {(isAdmin || isMod) && valueByCategory.length > 0 && (
        <div className="card animate-fade-up" style={{ marginBottom: 16, animationDelay: '320ms' }}>
          <div className="card-header">
            <h2 style={{ fontFamily: 'Oswald', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.06em', color: 'var(--text-1)', margin: 0 }}>ASSET VALUE BY CATEGORY</h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>Total Depreciation: {formatCurrency(totalDepreciation)}</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={valueByCategory} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                <defs>
                  {valueByCategory.map((_, i) => (
                    <linearGradient key={i} id={`valCatGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CAT_COLORS[i % CAT_COLORS.length]} />
                      <stop offset="100%" stopColor={CAT_COLORS[i % CAT_COLORS.length]} stopOpacity={0.6} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-2)', fontSize: 10, fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-2)', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip content={<CurrencyTooltip />} cursor={{ fill: 'rgba(43,127,255,0.06)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {valueByCategory.map((_, i) => <Cell key={i} fill={`url(#valCatGrad-${i})`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* ── Interactive Depreciation Forecast Widget ── */}
        {(isAdmin || isMod) && (
          <div className="card animate-fade-up h-full flex flex-col" style={{ animationDelay: '440ms' }}>
            <div className="card-header border-none pb-0">
              <h2 style={{ fontFamily: 'Oswald', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.06em', color: 'var(--text-1)', margin: 0 }}>DEPRECIATION FORECAST SIMULATOR</h2>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>Interactive projection tool</span>
            </div>
            <div className="card-body flex-1 flex flex-col gap-6 justify-center">
              {/* Projection Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="lbl">Projection Period: <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem' }}>{forecastYears} {forecastYears === 1 ? 'Year' : 'Years'}</span></label>
                  <input 
                    type="range" 
                    min="0" 
                    max="5" 
                    step="1" 
                    value={forecastYears} 
                    onChange={e => setForecastYears(Number(e.target.value))} 
                    className="sticker-slider"
                    style={{ width: '100%', marginTop: 8 }}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', lineHeight: 1.4, margin: 0 }}>
                  Simulates the declining book value of the current set of filtered assets over the next 5 years using their straight-line or declining balance rules.
                </p>
              </div>
              
              {/* Comparative Metrics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-1)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 500 }}>Initial Cost:</span>
                  <span className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-0)' }}>{formatCurrency(forecastStats.totalPV)}</span>
                </div>
                
                <div style={{ height: 1, background: 'var(--border)' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 500 }}>Current Book Value:</span>
                  <span className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-1)' }}>{formatCurrency(forecastStats.currentBV)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', fontWeight: 500 }}>Future Book Value:</span>
                  <span className="font-mono" style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)' }}>{formatCurrency(forecastStats.projectedBV)}</span>
                </div>
                
                {/* Visual Bar chart / indicator */}
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                    <span>Current BV ({Math.round((forecastStats.currentBV / (forecastStats.totalPV || 1)) * 100)}%)</span>
                    <span>Future BV ({Math.round((forecastStats.projectedBV / (forecastStats.totalPV || 1)) * 100)}%)</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 8, background: 'var(--bg-3)', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${(forecastStats.projectedBV / (forecastStats.totalPV || 1)) * 100}%`, 
                      background: 'linear-gradient(90deg, var(--accent), var(--cyan))',
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                    <div style={{ 
                      height: '100%', 
                      width: `${((forecastStats.currentBV - forecastStats.projectedBV) / (forecastStats.totalPV || 1)) * 100}%`, 
                      background: 'var(--accent-glow)',
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Unified Action Center Card ── */}
        <div className="card animate-fade-up h-full flex flex-col" style={{ animationDelay: '480ms' }}>
          <div className="card-header border-none pb-0 flex-col items-start gap-4">
            <h2 style={{ fontFamily: 'Oswald', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.06em', color: 'var(--text-1)', margin: 0 }}>ACTION CENTER</h2>
            
            {/* Tab Selectors - Sleek Pills */}
            <div className="flex w-full gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {[
                { id: 'pending', label: 'Pending Actions', count: (slaBreached.length + unassignedTickets.length + overdueSchedules.length + inProgressAudits.length) },
                { id: 'stock', label: 'Inventory Alerts', count: filteredLowStockItems.length, badged: true },
                { id: 'compliance', label: 'Compliance Alerts', count: filteredExpiringDocs.length, badged: true },
                { id: 'activity', label: 'Recent Activity', count: 0 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActionCenterTab(tab.id)}
                  className="whitespace-nowrap px-4 py-2 rounded-full text-[0.75rem] font-sans font-bold flex items-center gap-2 transition-all"
                  style={{ 
                    border: 'none', 
                    cursor: 'pointer',
                    background: actionCenterTab === tab.id ? 'var(--accent)' : 'var(--bg-2)',
                    color: actionCenterTab === tab.id ? '#ffffff' : 'var(--text-2)',
                    boxShadow: actionCenterTab === tab.id ? '0 4px 12px rgba(43,127,255,0.25)' : 'none'
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="flex items-center justify-center rounded-full" style={{ 
                      background: actionCenterTab === tab.id ? 'rgba(255,255,255,0.25)' : (tab.badged ? 'var(--red)' : 'var(--accent)'), 
                      color: actionCenterTab === tab.id ? '#ffffff' : '#ffffff', 
                      fontSize: '0.62rem', 
                      padding: '2px 6px', 
                      minWidth: 20
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        
        <div style={{ padding: '0 20px 20px 20px', minHeight: 240, maxHeight: 380, overflowY: 'auto' }}>
          {actionCenterTab === 'pending' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {slaBreached.length > 0 && (
                <Link to="/maintenance" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.15)', textDecoration: 'none', color: 'inherit' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--red)' }}>{slaBreached.length} SLA Breach{slaBreached.length > 1 ? 'es' : ''}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>Tickets past their resolution deadline</div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                </Link>
              )}
              {unassignedTickets.length > 0 && (
                <Link to="/maintenance" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(245,158,11,0.05)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.15)', textDecoration: 'none', color: 'inherit' }}>
                  <User size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b' }}>{unassignedTickets.length} Unassigned Ticket{unassignedTickets.length > 1 ? 's' : ''}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>Need team member assignment</div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                </Link>
              )}
              {overdueSchedules.length > 0 && (
                <Link to="/maintenance" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.15)', textDecoration: 'none', color: 'inherit' }}>
                  <Calendar size={16} style={{ color: 'var(--red)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--red)' }}>{overdueSchedules.length} Overdue Schedule{overdueSchedules.length > 1 ? 's' : ''}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>Preventive maintenance past due</div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                </Link>
              )}
              {inProgressAudits.length > 0 && (
                <Link to="/audit" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(14,165,233,0.05)', borderRadius: 10, border: '1px solid rgba(14,165,233,0.15)', textDecoration: 'none', color: 'inherit' }}>
                  <ClipboardCheck size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)' }}>{inProgressAudits.length} Audit{inProgressAudits.length > 1 ? 's' : ''} In Progress</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>Pending completion</div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />
                </Link>
              )}
              {slaBreached.length === 0 && unassignedTickets.length === 0 && overdueSchedules.length === 0 && inProgressAudits.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--green)' }}>
                  <CheckCircle2 size={24} style={{ margin: '0 auto 10px', color: 'var(--green)' }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>All operational tasks are up to date!</div>
                </div>
              )}
            </div>
          )}
          
          {actionCenterTab === 'stock' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredLowStockItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--green)' }}>
                  <Boxes size={24} style={{ margin: '0 auto 10px', color: 'var(--green)' }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Stock levels are healthy across all materials</div>
                </div>
              ) : (
                <>
                  {filteredLowStockItems.slice(0, 6).map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: item.current_stock === 0 ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.04)', borderRadius: 8, border: `1px solid ${item.current_stock === 0 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)'}` }}>
                      <Boxes size={14} style={{ color: item.current_stock === 0 ? 'var(--red)' : '#f59e0b', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-0)' }}>{item.item_name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>Min Limit: {item.min_stock} {item.unit}</div>
                      </div>
                      <span style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: '0.88rem', color: item.current_stock === 0 ? 'var(--red)' : '#f59e0b' }}>{item.current_stock}</span>
                    </div>
                  ))}
                  {filteredLowStockItems.length > 6 && (
                    <Link to="/inventory" style={{ fontSize: '0.78rem', color: 'var(--accent)', textAlign: 'center', textDecoration: 'none', fontFamily: 'DM Sans', fontWeight: 600, marginTop: 4 }}>
                      +{filteredLowStockItems.length - 6} more items →
                    </Link>
                  )}
                </>
              )}
            </div>
          )}
          
          {actionCenterTab === 'compliance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredExpiringDocs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--green)' }}>
                  <ClipboardCheck size={24} style={{ margin: '0 auto 10px', color: 'var(--green)' }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>All asset documents are up to date!</div>
                </div>
              ) : (
                filteredExpiringDocs.map(doc => {
                  const isExpired = new Date(doc.expiry_date) < new Date()
                  return (
                    <Link key={doc.id} to={`/assets/${doc.asset_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isExpired ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.04)', borderRadius: 8, border: `1px solid ${isExpired ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)'}` }}>
                        <AlertTriangle size={16} style={{ color: isExpired ? 'var(--red)' : '#f59e0b', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-0)' }}>{doc.assets?.asset_code} - {doc.document_type}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{doc.assets?.asset_name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isExpired ? 'var(--red)' : '#f59e0b' }}>{isExpired ? 'EXPIRED' : 'Expiring Soon'}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{new Date(doc.expiry_date).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          )}
          
          {actionCenterTab === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingLeft: 10, paddingTop: 6 }}>
              {filteredRecentActivity.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
                  <Clock size={24} style={{ margin: '0 auto 10px', color: 'var(--text-3)' }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>No activity found in this timeframe</div>
                </div>
              ) : (
                filteredRecentActivity.map((a, i) => {
                  const actionColor = a.action === 'created' ? 'var(--green)' : a.action === 'deleted' ? 'var(--red)' : a.action === 'transferred' ? 'var(--cyan)' : 'var(--accent)'
                  return (
                    <div key={a.id} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                      {/* Connector Line */}
                      {i < filteredRecentActivity.length - 1 && (
                        <div style={{ 
                          position: 'absolute', 
                          left: 5, 
                          top: 14, 
                          bottom: -20, 
                          width: 2, 
                          background: 'var(--border)' 
                        }} />
                      )}
                      {/* Timeline Dot */}
                      <div style={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%', 
                        background: 'var(--bg-2)', 
                        border: `3px solid ${actionColor}`, 
                        zIndex: 2, 
                        marginTop: 4,
                        boxShadow: `0 0 6px ${actionColor}40`
                      }} />
                      <div style={{ flex: 1, minWidth: 0, paddingBottom: 10 }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.4 }}>
                          <strong style={{ color: 'var(--text-0)' }}>{a.profiles?.full_name || 'System'}</strong> {a.action} <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{a.assets?.asset_name || 'asset'}</span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'DM Mono', marginTop: 2 }}>
                          {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
      </div>


      {/* ── Recently Added Assets Table ── */}
      <div className="card animate-fade-up" style={{ animationDelay: '480ms' }}>
        <div className="card-header">
          <h2 style={{ fontFamily: 'Oswald', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.06em', color: 'var(--text-1)', margin: 0 }}>RECENTLY ADDED</h2>
          <Link to="/assets" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent-light)', textDecoration: 'none', fontSize: '0.82rem', fontFamily: 'DM Sans' }}>
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Asset Code</th><th>Name</th><th className="col-hide-mobile">Make</th><th className="col-hide-mobile">Site</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecentlyAdded.map(a => (
                <tr
                  key={a.id}
                  style={{ cursor: 'pointer' }}
                  tabIndex={0}
                  role="button"
                  onClick={() => navigate(`/assets/${a.id}`)}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/assets/${a.id}`)}
                >
                  <td><span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 500 }}>{a.asset_code}</span></td>
                  <td style={{ color: 'var(--text-0)', fontWeight: 500 }}>{a.asset_name || '—'}</td>
                  <td className="col-hide-mobile" style={{ color: 'var(--text-2)' }}>{a.make || '—'}</td>
                  <td className="col-hide-mobile" style={{ color: 'var(--text-2)' }}>{a.site || '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE_CLS[a.status] || 'badge-inactive'}`}>{a.status}</span></td>
                </tr>
              ))}
              {filteredRecentlyAdded.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>
                  No assets found matching selected filters — <Link to="/assets/new" style={{ color: 'var(--accent-light)' }}>add your first</Link>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
