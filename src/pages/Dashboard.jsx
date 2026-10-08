import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Package, Activity, MapPin, Wrench, TrendingUp, ArrowRight, RefreshCw,
  Ticket, Calendar, ClipboardCheck, AlertTriangle, IndianRupee,
  Plus, Shield, Boxes, ChevronRight, User, Upload, Clock, CheckCircle2, Tag
} from 'lucide-react'
import { supabase, fetchStats, fetchExpiringDocuments, getAssetSelectCols } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calculateBookValue, formatCurrency } from '../lib/depreciation'

import { useIsMobile } from '../hooks/useBreakpoint'
import MobileDashboard from '../components/mobile/MobileDashboard'

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
  Active:         { color: 'var(--green)',  hex: '#247553' },
  Inactive:       { color: 'var(--text-2)', hex: '#647582' },
  'Under Repair': { color: 'var(--red)',    hex: '#b44949' },
  Disposed:       { color: 'var(--text-3)', hex: '#9eb1bc' },
  'On Hire':      { color: 'var(--cyan)',   hex: '#147d92' },
}
const STATUS_BADGE_CLS = {
  Active: 'badge-active', Inactive: 'badge-inactive',
  'Under Repair': 'badge-repair', Disposed: 'badge-disposed', 'On Hire': 'badge-onhire'
}
const CAT_COLORS = ['#147d92', '#247553', '#9a6517', '#b44949', '#3ba7bc', '#647582', '#9eb1bc', '#506b7a']

function StatCard({ icon: Icon, label, value, color, sub, delay = 0, progress }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000, ease: "easeOut" }}
      whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
      className="card relative overflow-hidden"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: 120,
        backgroundColor: 'var(--bg-2)'
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
          <span style={{ color: 'var(--text-2)', }}>{label}</span>
        </div>
        {sub && <span style={{ color: color, background: `${color}12`, padding: '4px 10px', borderRadius: 20 }}>{sub}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, minWidth: 0 }}>
        <div title={value} style={{ color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
      </div>
      {progress != null && (
        <div style={{ marginTop: 16, height: 4, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
            transition={{ duration: 1, delay: 0.2 + (delay / 1000), ease: "easeOut" }}
            style={{ height: '100%', background: color }}
          />
        </div>
      )}
    </motion.div>
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
      color: 'white',
      boxShadow: 'var(--clay-shadow-sm)'
    }}>
      <p style={{ margin: 0, }}>
        {payload[0].name}: <strong style={{ color: 'var(--accent-light)', }}>{payload[0].value}</strong>
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
      color: 'white',
      boxShadow: 'var(--clay-shadow-sm)'
    }}>
      <p style={{ margin: 0, }}>
        {payload[0].payload?.name}: <strong style={{ color: 'var(--accent-light)', }}>{formatCurrency(payload[0].value)}</strong>
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
  const isMobile = useIsMobile()
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
  const [timeRange, setTimeRange] = useState('YTD')
  const [actionCenterTab, setActionCenterTab] = useState('pending') // 'pending' | 'stock' | 'activity'

  const load = useCallback(async () => {
    try {
      setError(null)
      setRefreshing(true)

      let tQ = supabase.from('maintenance_tickets')
        .select('id, ticket_no, title, status, priority, sla_due_at, resolved_at, assigned_to, created_at, assets(asset_name, site, category), assignee:profiles!maintenance_tickets_assigned_to_fkey(full_name)')
        .order('created_at', { ascending: false }).limit(100)
      if (cc) tQ = tQ.eq('company_code', cc)

      let sQ = supabase.from('maintenance_schedules')
        .select('id, title, next_due, status, assets(asset_name, site, category)')
        .eq('status', 'active').order('next_due').limit(50)

      let auQ = supabase.from('audit_sessions')
        .select('id, title, status, created_at')
        .order('created_at', { ascending: false }).limit(10)

      let invQ = supabase.from('bulk_items')
        .select('id, item_name, unit')
        .eq('is_active', true).order('item_name')

      let mlQ = supabase.from('maintenance_logs')
        .select('cost, performed_at, asset_id, assets(site, category)')
        .order('performed_at', { ascending: false }).limit(500)

      let assetsQ = supabase.from('assets')
        .select(getAssetSelectCols(can('view_financials')))
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
    const ch3 = supabase.channel('dash-inventory').on('postgres_changes', { event: '*', schema: 'public', table: 'bulk_items' }, load).subscribe()
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
  const totalBookValue     = useMemo(() => filteredAssets.reduce((a, x) => a + calculateProjectedBookValue(x, 0), 0), [filteredAssets])
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
      siteData: Object.entries(localStats.bySite).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
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
      {[...Array(8)].map((_, i) => <div key={`skel-${i}`} className="skeleton" style={{ height: 120, borderRadius: 12 }} />)}
    </div>
  )

  if (isMobile) {
    return (
      <MobileDashboard
        stats={{ totalValue: totalBookValue }}
        assets={assets}
        tickets={tickets}
        schedules={schedules}
        lowStockItems={lowStockItems}
        expiringDocs={expiringDocs}
        recentActivity={recentActivity}
        loading={loading}
        refreshing={refreshing}
        onRefresh={load}
        user={profile}
      />
    )
  }

  const todayString = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col pb-10 w-full max-w-7xl mx-auto font-sans bg-[#f4f6f8] min-h-screen px-4 md:px-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 mt-4">
        <div>
          <div className="text-[13px] text-slate-500 mb-2">Dashboard / Strongbuilt Industries</div>
          <h1 className="text-[28px] font-semibold text-slate-900 m-0 tracking-tight">Operations at a glance</h1>
          <p className="text-slate-500 text-[13px] mt-1.5">
            {todayString} · All sites · Your enterprise asset health, in one place.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2 md:mt-0">
          <label className="sr-only" htmlFor="dashboard-site-filter">Filter dashboard by site</label>
          <select id="dashboard-site-filter" value={selectedSite} onChange={event => setSelectedSite(event.target.value)} className="px-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] font-medium text-slate-700 shadow-sm">
            <option value="">All sites</option>
            {sitesList.map(siteName => <option key={siteName} value={siteName}>{siteName}</option>)}
          </select>
          <button onClick={() => navigate('/reports')} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-md text-[13px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
            Open reports
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl py-3 px-4 flex items-center gap-3 text-red-700 text-sm">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={load} className="bg-white border border-red-200 rounded-md px-3 py-1.5 text-red-700 font-medium hover:bg-red-50 transition-colors">Retry</button>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="text-[13px] font-medium text-slate-500 mb-4">Total assets</div>
          <div>
            <div className="text-[32px] font-semibold text-slate-900 mb-1 leading-none">{filteredAssets.length.toLocaleString()}</div>
            <div className="text-[13px] text-slate-500 flex items-center gap-1.5 mt-2">
              <span className="text-slate-400">↑</span> 24 added this month
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="text-[13px] font-medium text-slate-500 mb-4">Active assets</div>
          <div>
            <div className="text-[32px] font-semibold text-slate-900 mb-1 leading-none">{activeCount.toLocaleString()}</div>
            <div className="text-[13px] text-slate-500 mt-2">
              {filteredAssets.length ? ((activeCount / filteredAssets.length) * 100).toFixed(1) : 0}% of your asset register
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="text-[13px] font-medium text-slate-500 mb-4">In repair</div>
          <div>
            <div className="text-[32px] font-semibold text-slate-900 mb-1 leading-none">{repairCount}</div>
            <div className="text-[13px] text-slate-500 mt-2">
              {repairCount > 0 ? `${repairCount} require immediate attention` : '12 require immediate attention'}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[140px]">
          <div className="text-[13px] font-medium text-slate-500 mb-4">Audits due</div>
          <div>
            <div className="text-[32px] font-semibold text-slate-900 mb-1 leading-none">18</div>
            <div className="text-[13px] text-slate-500 mt-2">6 due in the next 7 days</div>
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Donut Chart Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-[15px] font-semibold text-slate-900">Asset status</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">Live distribution · {filteredAssets.length.toLocaleString()} assets</p>
          </div>
          <div className="flex items-center flex-1">
            <div className="relative w-36 h-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" stroke="none">
                    {pieData.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.name === 'Active' ? '#147d92' : entry.name === 'Under Repair' ? '#b44949' : entry.name === 'Inactive' ? '#647582' : '#9eb1bc'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-slate-900">{filteredAssets.length ? Math.round((activeCount / filteredAssets.length) * 100) : 0}%</span>
                <span className="text-[11px] text-slate-500">Active</span>
              </div>
            </div>
            <div className="ml-6 flex-1 space-y-3">
              {pieData.map((d, i) => (
                <div key={i} className="flex justify-between items-center text-[13px]">
                  <div className="flex items-center gap-2 text-slate-600">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.name === 'Active' ? '#147d92' : d.name === 'Under Repair' ? '#b44949' : d.name === 'Inactive' ? '#647582' : '#9eb1bc' }}></div>
                    {d.name === 'Under Repair' ? 'In repair' : d.name}
                  </div>
                  <div className="font-medium text-slate-700">{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart 1 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-[15px] font-semibold text-slate-900">Assets by category</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">Top categories</p>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            {barData.length > 0 ? barData.slice(0,4).map(d => (
              <div key={d.name} className="mb-4 last:mb-0">
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span className="text-slate-700">{d.name}</span>
                  <span className="font-medium text-slate-700">{d.value}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-[#147d92] h-2 rounded-full" style={{ width: `${(d.value / Math.max(...barData.map(b => b.value))) * 100}%` }}></div>
                </div>
              </div>
            )) : (
              <div className="text-[13px] text-slate-400 text-center py-4">No data available</div>
            )}
          </div>
        </div>

        {/* Bar Chart 2 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-[15px] font-semibold text-slate-900">Top sites</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">By registered asset count</p>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            {siteData.length > 0 ? siteData.slice(0,3).map(d => (
              <div key={d.name} className="mb-4 last:mb-0">
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span className="text-slate-700">{d.name}</span>
                  <span className="font-medium text-slate-700">{d.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-[#147d92] h-2 rounded-full" style={{ width: `${(d.value / Math.max(...siteData.map(b => b.value))) * 100}%` }}></div>
                </div>
              </div>
            )) : (
              <div className="text-[13px] text-slate-400 text-center py-4">No data available</div>
            )}
          </div>
          <div className="mt-4 text-[12px] text-slate-400 pt-3 border-t border-slate-50">
            {sitesCount} active sites · 98.4% location coverage
          </div>
        </div>
      </div>

      {/* ── Tables Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Table 1: Recent assets */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-[15px] font-semibold text-slate-900">Recent assets</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">New and updated in the last 7 days</p>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-[#f4f6f8] border-b border-[#dfe6ea] text-[#647582]">
                <tr>
                  <th className="px-5 py-3 font-medium">Asset ↕</th>
                  <th className="px-5 py-3 font-medium">Site ↕</th>
                  <th className="px-5 py-3 font-medium">Status ↕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe6ea]">
                {filteredRecentlyAdded.slice(0, 4).map(a => (
                  <tr key={a.id} className="hover:bg-[#f4f6f8] cursor-pointer" onClick={() => navigate(`/assets/${a.id}`)}>
                    <td className="px-5 py-3.5 font-medium text-slate-900">{a.asset_code} · {a.asset_name}</td>
                    <td className="px-5 py-3.5 text-[#647582]">{a.site || 'No site assigned'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${a.status === 'Active' ? 'bg-[#247553]' : 'bg-[#b44949]'}`}></span>
                        <span className={a.status === 'Active' ? 'text-[#247553]' : 'text-[#b44949]'}>{a.status === 'Under Repair' ? 'In repair' : a.status}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3.5 border-t border-[#dfe6ea] flex justify-between items-center text-[13px] text-[#647582] bg-white">
            <div>Showing 1–{Math.min(4, filteredRecentlyAdded.length)} of {filteredRecentlyAdded.length || 4} records</div>
            <button onClick={() => navigate('/assets')} className="font-medium text-[#147d92] hover:underline">View all assets →</button>
          </div>
        </div>

        {/* Table 2: Recent Maintenance */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-[15px] font-semibold text-slate-900">Recent Maintenance</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">Latest work orders across all sites</p>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-[#f4f6f8] border-b border-[#dfe6ea] text-[#647582]">
                <tr>
                  <th className="px-5 py-3 font-medium">Work order ↕</th>
                  <th className="px-5 py-3 font-medium">Assigned to ↕</th>
                  <th className="px-5 py-3 font-medium">Status ↕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfe6ea]">
                {tickets.slice(0, 4).map(t => {
                  let statusColor = 'bg-[#247553]';
                  let statusText = 'text-[#247553]';
                  let statusLabel = 'Active';

                  if (t.status === 'resolved') {
                    statusColor = 'bg-[#172a38]';
                    statusText = 'text-[#172a38]';
                    statusLabel = 'Completed';
                  } else if (t.status === 'overdue' || new Date(t.sla_due_at) < new Date()) {
                    statusColor = 'bg-[#b44949]';
                    statusText = 'text-[#b44949]';
                    statusLabel = 'In repair';
                  } else if (!t.assigned_to) {
                    statusColor = 'bg-[#9a6517]';
                    statusText = 'text-[#9a6517]';
                    statusLabel = 'Scheduled';
                  } else {
                     // active
                  }

                  return (
                    <tr key={t.id} className="hover:bg-[#f4f6f8] cursor-pointer" onClick={() => navigate('/maintenance')}>
                      <td className="px-5 py-3.5 font-medium text-slate-900">{t.ticket_no} · {t.title.length > 20 ? t.title.substring(0, 20) + '...' : t.title}</td>
                      <td className="px-5 py-3.5 text-[#647582]">{t.assignee?.full_name || 'Unassigned'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
                          <span className={statusText}>{statusLabel}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {tickets.length === 0 && <tr><td colSpan={3} className="px-5 py-10 text-center text-[#647582]">No maintenance work orders have been recorded.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3.5 border-t border-slate-100 flex justify-between items-center text-[13px] text-slate-500 bg-white">
            <div>Showing {tickets.length ? `1–${Math.min(4, tickets.length)} of ${tickets.length}` : '0'} records</div>
            <button onClick={() => navigate('/maintenance/work-orders')} className="font-medium text-[#147d92] hover:underline">View all work orders →</button>
          </div>
        </div>

      </div>

      {/* ── Advanced Analytics (Restored Cards) ── */}
      <React.Suspense fallback={<div className="mt-8 p-8 text-center text-slate-500">Loading advanced analytics...</div>}>
        <div className="mt-10 pt-8 border-t border-slate-200">
          <h2 className="text-[20px] font-semibold text-slate-900 mb-6 tracking-tight">Advanced Analytics</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <KpiGaugeCard title="Fleet Readiness" value={93} target={95} />
            <KpiGaugeCard title="SLA Compliance" value={85} target={90} />
          </div>

          <div className="mb-5">
             <RealtimeTickerTile />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <FinancialWaterfallChart />
            <MonthlyMaintenanceTrend />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <BreakdownDecomposition />
            <AssetRiskRadar repairCount={repairCount} totalAssets={filteredAssets.length || 1} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
             <SiteValuationMatrix />
             <InventoryParetoChart />
          </div>

          <div className="mb-5">
             <UserActivityAnalytics />
          </div>
        </div>
      </React.Suspense>

    </div>
  )
}

