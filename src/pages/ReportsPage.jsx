import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Sliders, ChevronRight, Play, Search, Clock, AlertTriangle, DollarSign,
  Star, HeartPulse, ShieldAlert, BadgeInfo, ArrowRight, XCircle,
  CheckCircle2, RefreshCw, TrendingUp, TrendingDown, Minus,
  Building2, Wrench, Boxes, BarChart3, Shield, Database,
  HardHat, Truck, Calculator, Activity, Layers
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase, fetchSites } from '../lib/supabase'
import { REPORT_CATEGORIES, ALL_REPORTS } from '../lib/reportRegistry'
import { executeCustomReport } from '../lib/reports'
import { getEnterpriseIntelligence } from '../lib/intelligence/intelligenceAggregator'
import ReportViewer from '../components/reports/ReportViewer'
import CustomReportBuilder from '../components/reports/CustomReportBuilder'
import BusinessQuestionBar from '../components/reports/BusinessQuestionBar'
import SkeletonLoader from '../components/ui/SkeletonLoader'
import LivePulse from '../components/ui/LivePulse'
import GlobalReportFilters from '../components/reports/GlobalReportFilters'
import { useIsMobile } from '../hooks/useBreakpoint'
import MobileReportsPage from '../components/mobile/MobileReportsPage'

// ─── Currency Formatter ───────────────────────────────────────────────────────
const formatCurrency = (val) => {
  if (val == null || isNaN(val)) return '₹0'
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
  return `₹${val.toLocaleString('en-IN')}`
}

// ─── Role-based mode config ───────────────────────────────────────────────────
const VIEW_MODES = [
  { id: 'EXECUTIVE',  label: 'Executive',  icon: Layers,    color: 'var(--status-special)' },
  { id: 'OPERATIONS', label: 'Operations', icon: Activity,  color: '#0ea5e9' },
  { id: 'MAINTENANCE',label: 'Maintenance',icon: Wrench,    color: 'var(--status-warning)' },
  { id: 'INVENTORY',  label: 'Inventory',  icon: Boxes,     color: '#10b981' },
  { id: 'FINANCE',    label: 'Finance',    icon: Calculator,color: 'var(--status-danger)' },
  { id: 'DATAQUALITY',label: 'Data Quality',icon: Database, color: '#06b6d4' },
]

// Maps viewMode → category priority order for modules
const MODE_CATEGORY_ORDER = {
  EXECUTIVE:   ['financial','asset','maintenance','inventory','compliance','site'],
  OPERATIONS:  ['asset','site','maintenance','inventory','compliance','financial'],
  MAINTENANCE: ['maintenance','compliance','asset','inventory','site','financial'],
  INVENTORY:   ['inventory','asset','maintenance','compliance','site','financial'],
  FINANCE:     ['financial','asset','compliance','maintenance','inventory','site'],
  DATAQUALITY: ['compliance','asset','financial','maintenance','inventory','site'],
}

// Maps viewMode → which KPI slots are prioritised (indices into kpis array)
const SEVERITY_COLORS = { CRITICAL: 'var(--status-danger)', HIGH: 'var(--status-warning)', MEDIUM: '#3b82f6', LOW: '#6b7280', INFO: '#6b7280' }
const SEVERITY_BG = { CRITICAL: 'var(--status-danger-soft)', HIGH: 'var(--status-warning-soft)', MEDIUM: 'rgba(59,130,246,0.1)', LOW: 'rgba(107,114,128,0.1)' }

// Financial roles
const FINANCIAL_ROLES = ['admin', 'super_admin']

export default function ReportsPage() {
  const { profile, can } = useAuth()
  const { reportId } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const canSeeFinancials = FINANCIAL_ROLES.includes(profile?.role)

  // ─── State ─────────────────────────────────────────────────────────────────
  const [selectedReportCard, setSelectedReportCard] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)
  const [sites, setSites] = useState([])
  const [savedTemplates, setSavedTemplates] = useState([])

  const [intelligence, setIntelligence] = useState(null)
  const [intelligenceLoading, setIntelligenceLoading] = useState(true)
  const [intelligenceError, setIntelligenceError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)

  const [viewMode, setViewMode] = useState('EXECUTIVE')
  const [expandedSection, setExpandedSection] = useState(null) // for drilldown

  const [filters, setFilters] = useState({ site: 'All', category: 'All', status: 'All', dateRange: 'Last 90 Days' })

  const [search, setSearch] = useState('')
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assetpro_report_favorites') || '[]') }
    catch { return [] }
  })
  const [recentReports, setRecentReports] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assetpro_report_recents') || '[]') }
    catch { return [] }
  })

  const assetCategories = ['Plant & Machinery', 'Vehicles', 'IT', 'Safety Equipment', 'Tools & Equipment', 'Other']

  // ─── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => { loadSitesAndTemplates() }, [])
  useEffect(() => { loadIntelligence() }, [filters])
  useEffect(() => {
    if (reportId) {
      const match = ALL_REPORTS.find(r => r.id === reportId)
      if (match) handleRunReport(match)
    }
  }, [reportId])

  const loadSitesAndTemplates = async () => {
    try {
      const s = await fetchSites()
      setSites(s.map(site => site.name) || [])
      const { data } = await supabase.from('report_templates').select('*').order('created_at', { ascending: false })
      setSavedTemplates(data?.length ? data : JSON.parse(localStorage.getItem('assetpro_report_templates') || '[]'))
    } catch (e) { console.warn('Failed loading templates:', e) }
  }

  const loadIntelligence = useCallback(async () => {
    setIntelligenceLoading(true)
    setIntelligenceError(null)
    try {
      const data = await getEnterpriseIntelligence(filters)
      if (data.status === 'ERROR') {
        setIntelligenceError(data.message || 'Failed to load intelligence.')
        setIntelligence(null)
      } else {
        setIntelligence(data)
        setLastRefreshed(new Date())
      }
    } catch (e) {
      setIntelligenceError(e.message)
    } finally {
      setIntelligenceLoading(false)
    }
  }, [filters])

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const toggleFavorite = (e, cardId) => {
    e.stopPropagation()
    const updated = favorites.includes(cardId) ? favorites.filter(id => id !== cardId) : [...favorites, cardId]
    setFavorites(updated)
    localStorage.setItem('assetpro_report_favorites', JSON.stringify(updated))
  }

  const handleRunReport = async (card, customConfig = null) => {
    setSelectedReportCard(card)
    setReportLoading(true)
    const updatedRecents = [card.id, ...recentReports.filter(id => id !== card.id)].slice(0, 10)
    setRecentReports(updatedRecents)
    localStorage.setItem('assetpro_report_recents', JSON.stringify(updatedRecents))
    try {
      const data = customConfig
        ? await executeCustomReport({ ...customConfig, canViewFinancials: can('view_financials') })
        : await card.fetcher({ ...filters, siteId: filters.site, canViewFinancials: can('view_financials') })
      setReportData(data)
    } catch (e) {
      setReportData({ state: 'QUERY_ERROR', message: e.message, summary: {}, chartData: [], columns: [], rows: [] })
    } finally {
      setReportLoading(false)
    }
  }

  const handleActionClick = (route) => { if (route) navigate(route) }

  const minutesAgo = lastRefreshed ? Math.round((Date.now() - lastRefreshed.getTime()) / 60000) : null

  // ─── Filtered & sorted modules by mode ──────────────────────────────────────
  const orderedCategoryIds = MODE_CATEGORY_ORDER[viewMode] || MODE_CATEGORY_ORDER.EXECUTIVE

  const filteredCards = useMemo(() => ALL_REPORTS.filter(c => {
    const matchSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.categoryLabel.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  }), [search])

  const modulesByMode = useMemo(() => {
    const byCategory = {}
    filteredCards.forEach(c => {
      if (!byCategory[c.category]) byCategory[c.category] = []
      byCategory[c.category].push(c)
    })
    // Return categories in mode-specific order
    return orderedCategoryIds
      .map(catId => ({
        catId,
        cat: REPORT_CATEGORIES.find(c => c.id === catId),
        cards: byCategory[catId] || []
      }))
      .filter(g => g.cards.length > 0 && g.cat)
  }, [filteredCards, viewMode])

  // ─── Render Helpers ──────────────────────────────────────────────────────────
  const KPICard = ({ label, value, sub, color = 'inherit', onClick }) => {
    const Component = onClick ? 'button' : 'div'
    const interactiveProps = onClick ? {
      onClick,
      'aria-label': `${label}, value: ${value}, ${sub || ''}`,
      title: `Click to view ${label} report`
    } : {}
    return (
      <Component
        {...interactiveProps}
        style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderTop: color !== 'inherit' ? `3px solid ${color}` : '3px solid var(--border)',
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          transition: 'transform 0.15s, box-shadow 0.15s',
          minWidth: 0,
          textAlign: 'left',
          width: '100%',
        }}
        onMouseEnter={e => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'
          }
        }}
        onMouseLeave={e => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }
        }}
        onFocus={e => {
          if (onClick) {
            e.currentTarget.style.outline = '2px solid var(--accent)'
            e.currentTarget.style.outlineOffset = '2px'
          }
        }}
        onBlur={e => {
          if (onClick) e.currentTarget.style.outline = 'none'
        }}
      >
        <span style={{
          color: 'var(--text-3)',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          }}>
          {label}
        </span>
        <span style={{
          color: color !== 'inherit' ? color : 'var(--text-0)',
          letterSpacing: '-0.02em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value ?? '-'}
        </span>
        {sub && (
          <span style={{
            color: 'var(--text-3)',
            marginTop: 2,
          }}>
            {sub}
          </span>
        )}
      </Component>
    )
  }


  const HealthBar = ({ label, obj, onClick }) => {
    if (!obj) return null
    const color = obj.score >= 75 ? '#10b981' : obj.score >= 50 ? 'var(--status-warning)' : 'var(--status-danger)'
    const Component = onClick ? 'button' : 'div'
    const interactiveProps = onClick ? {
      onClick,
      'aria-label': `View ${label} report, score ${obj.score}%`,
      title: `View ${label} report`
    } : {}

    return (
      <Component
        {...interactiveProps}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 0',
          cursor: onClick ? 'pointer' : 'default',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border)',
          width: '100%',
          textAlign: 'left'
        }}
        onMouseEnter={e => onClick && (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onFocus={e => onClick && (e.currentTarget.style.outline = '2px solid var(--accent)')}
        onBlur={e => onClick && (e.currentTarget.style.outline = 'none')}
      >
        <span style={{ color: 'var(--text-1)', flex: 1 }}>{label}</span>
        <span style={{ color: 'var(--text-3)' }}>{obj.weight}%</span>
        <div style={{ width: 80, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, obj.score)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
        </div>
        <span style={{ color, minWidth: 28, textAlign: 'right' }}>{obj.score}</span>
      </Component>
    )
  }

  const ExceptionCard = ({ exc }) => {
    const color = SEVERITY_COLORS[exc.severity] || '#6b7280'
    const bg = SEVERITY_BG[exc.severity] || 'rgba(107,114,128,0.1)'
    return (
      <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-1)', border: `1px solid ${color}40`, borderLeft: `4px solid ${color}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flex: 1 }}>
            <AlertTriangle size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }}/>
            <h4 style={{ margin: 0, color: 'var(--text-0)', }}>{exc.title}</h4>
          </div>
          <span style={{ padding: '2px 7px', borderRadius: 10, background: bg, color, whiteSpace: 'nowrap', flexShrink: 0 }}>{exc.severity}</span>
        </div>
        <p style={{ margin: 0, color: 'var(--text-2)', }}>{exc.explanation || exc.description}</p>
        {exc.evidence && (
          <p style={{ margin: 0, color: 'var(--text-3)', }}>
            <strong style={{ color: 'var(--text-2)' }}>Evidence:</strong> {exc.evidence}
          </p>
        )}
        {(exc.financialExposure > 0 || exc.financialImpact > 0) && canSeeFinancials && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <DollarSign size={13} color='var(--status-warning)' />
            <span style={{ color: 'var(--status-warning)' }}>Exposure: {formatCurrency(exc.financialExposure || exc.financialImpact)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 2 }}>
          <span style={{ color: 'var(--text-0)', flex: 1, }}>{exc.actionLabel || exc.recommendedAction}</span>
          {exc.route && (
            <button onClick={() => handleActionClick(exc.route)} className="btn-ghost" style={{ padding: '4px 10px', borderRadius: 6, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
              Action <ArrowRight size={12}/>
            </button>
          )}
        </div>
      </div>
    )
  }

  const RiskAssetCard = ({ asset }) => {
    const r = asset.risk
    const color = r.classification === 'Critical' ? 'var(--status-danger)' : r.classification === 'High' ? 'var(--status-warning)' : '#3b82f6'
    return (
      <button
        onClick={() => navigate(`/assets/${asset.id}`)}
        aria-label={`View risk details for ${asset.asset_name || asset.asset_code}, score ${r.score}, ${r.classification} risk`}
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'var(--bg-1)',
          border: `1px solid ${color}30`,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          cursor: 'pointer',
          transition: 'all 0.15s',
          width: '100%',
          textAlign: 'left'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-1)'; e.currentTarget.style.transform = 'translateY(0)' }}
        onFocus={e => { e.currentTarget.style.outline = '2px solid var(--accent)' }}
        onBlur={e => { e.currentTarget.style.outline = 'none' }}
      >
        <div style={{ minWidth: 42, height: 42, borderRadius: 10, background: `${color}20`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${color}40` }}>
          <span style={{ color, }}>{r.score}</span>
          <span style={{ color, }}>RISK</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--text-0)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {asset.asset_name || asset.asset_code || 'Unknown Asset'}
          </div>
          <div style={{ color: 'var(--text-3)', marginBottom: 4 }}>{asset.category} · {asset.site || 'No Site'}</div>
          {r.drivers.length > 0 && (
            <div style={{ color: 'var(--text-2)', }}>
              {r.drivers[0]}
            </div>
          )}
        </div>
        <span style={{ padding: '3px 8px', borderRadius: 8, background: `${color}15`, color, whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
          {r.classification}
        </span>
      </button>
    )
  }

  // ─── Mode-specific KPI config ─────────────────────────────────────────────
  const getKPIs = () => {
    if (!intelligence) return []
    const { kpis } = intelligence

    // Safe accessors - domains may have failed independently
    const inv = intelligence.inventory?.status === 'success' ? intelligence.inventory.data : null
    const dq  = intelligence.dataQuality?.status === 'success' ? intelligence.dataQuality.data : null

    // Null-safe formatters
    const fmtNum  = (v) => v == null ? '-' : v
    const fmtPct  = (v) => v == null ? '-' : `${v}%`
    const fmtCurr = (v) => v == null ? '-' : formatCurrency(v)

    const financialKPIs = canSeeFinancials ? [
      {
        label: 'GROSS ASSET VALUE',
        value: fmtCurr(kpis.grossAssetValue ?? kpis.totalAssetValue),
        sub: 'Recorded Purchase Value',
        onClick: () => handleRunReport(ALL_REPORTS.find(r => r.id === 'asset-current-valuation')),
      },
      {
        label: 'IDLE CAPITAL',
        value: fmtCurr(kpis.idleCapital),
        sub: 'Proxy - Idle/Down NBV',
        color: (kpis.idleCapital ?? 0) > 0 ? 'var(--status-warning)' : 'inherit',
        onClick: () => handleRunReport(ALL_REPORTS.find(r => r.id === 'idle-radar')),
      },
    ] : [
      { label: 'ASSET VALUE', value: '-', sub: 'Finance role required', color: '#6b7280' },
    ]

    const baseKPIs = [
      {
        label: 'ASSETS AT RISK',
        value: fmtNum(kpis.assetsAtRisk),
        sub: 'High & Critical Risk',
        color: (kpis.assetsAtRisk ?? 0) > 0 ? 'var(--status-danger)' : 'inherit',
        onClick: () => handleRunReport(ALL_REPORTS.find(r => r.id === 'asset-risk-profile')),
      },
      {
        label: 'MAINT. BACKLOG',
        value: fmtNum(kpis.maintenanceBacklog),
        sub: 'Open Tickets',
        color: (kpis.maintenanceBacklog ?? 0) > 20 ? 'var(--status-warning)' : 'inherit',
        onClick: () => handleRunReport(ALL_REPORTS.find(r => r.id === 'maintenance-backlog')),
      },
      {
        label: 'PM COMPLIANCE',
        value: kpis.pmCompliance == null ? 'Insufficient data' : fmtPct(kpis.pmCompliance),
        sub: 'Scheduled vs On-Time',
        color: kpis.pmCompliance == null ? '#6b7280' : (kpis.pmCompliance < 70 ? 'var(--status-danger)' : kpis.pmCompliance < 85 ? 'var(--status-warning)' : '#10b981'),
        onClick: () => handleRunReport(ALL_REPORTS.find(r => r.id === 'pm-compliance-intelligence')),
      },
      {
        label: 'CRITICAL EXCEPTIONS',
        value: fmtNum(kpis.criticalExceptions),
        sub: 'Immediate Attention',
        color: (kpis.criticalExceptions ?? 0) > 0 ? 'var(--status-danger)' : 'inherit',
      },
      inv ? {
        label: 'INVENTORY RISK',
        value: (inv.stockoutItemsCount ?? 0) + (inv.lowStockItemsCount ?? 0),
        sub: `${inv.stockoutItemsCount ?? 0} stockout · ${inv.lowStockItemsCount ?? 0} low`,
        color: (inv.stockoutItemsCount ?? 0) > 0 ? 'var(--status-danger)' : 'inherit',
        onClick: () => handleRunReport(ALL_REPORTS.find(r => r.id === 'inventory-position')),
      } : { label: 'INVENTORY RISK', value: '-', sub: 'Data unavailable' },
      dq ? {
        label: 'DATA QUALITY',
        value: fmtPct(dq.score),
        sub: `${dq.incompleteRecords} incomplete records`,
        color: (dq.score ?? 100) < 70 ? 'var(--status-warning)' : 'inherit',
        onClick: () => handleRunReport(ALL_REPORTS.find(r => r.id === 'data-quality-report')),
      } : { label: 'DATA QUALITY', value: '-', sub: 'Data unavailable' },
    ]

    const allKPIs = [...financialKPIs, ...baseKPIs]

    // Re-order by mode
    const modeOrder = {
      EXECUTIVE:   [0, 1, 2, 3, 4, 5, 6, 7],
      OPERATIONS:  [2, 3, 4, 5, 6, 7],
      MAINTENANCE: [3, 4, 2, 5, 0, 6],
      INVENTORY:   [5, 2, 3, 4, 0, 6],
      FINANCE:     [0, 1, 6, 2, 3, 4],
      DATAQUALITY: [6, 2, 3, 4, 5, 0],
    }
    return (modeOrder[viewMode] || modeOrder.EXECUTIVE).map(i => allKPIs[i]).filter(Boolean)
  }

  // ─── Report viewer state ──────────────────────────────────────────────────
  if (selectedReportCard && reportData) {
    return (
      <div style={{ padding: isMobile ? '16px' : '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
        <ReportViewer
          reportConfig={selectedReportCard}
          reportData={reportData}
          globalFilters={filters}
          onBack={() => { setSelectedReportCard(null); setReportData(null); if (reportId) navigate('/reports') }}
          user={profile}
          canSeeFinancials={canSeeFinancials}
        />
      </div>
    )
  }

  if (reportLoading) {
    return (
      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
        <SkeletonLoader type="card" count={6} />
      </div>
    )
  }

  if (isMobile) {
    return (
      <MobileReportsPage
        filteredCards={filteredCards}
        favorites={favorites}
        recentReports={recentReports}
        intelligence={intelligence}
        intelligenceLoading={intelligenceLoading}
        canSeeFinancials={canSeeFinancials}
        selectedCategory="all"
        setSelectedCategory={() => {}}
        search={search}
        setSearch={setSearch}
        filterSite={filters.site}
        setFilterSite={(val) => setFilters({ ...filters, site: val })}
        sites={sites}
        handleRunReport={handleRunReport}
        toggleFavorite={toggleFavorite}
        savedTemplates={savedTemplates}
        setShowCustomBuilder={setShowCustomBuilder}
      />
    )
  }

  // ─── Desktop Render ───────────────────────────────────────────────────────
  const kpis = getKPIs()

  return (
    <div style={{ padding: 'clamp(12px, 2.5vw, 24px)', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header (Premium Style) ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between bg-[var(--bg-0)] p-4 md:p-6 rounded-2xl border border-[var(--border)] shadow-sm mb-6 gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[var(--accent-glow)]">
            <BarChart3 size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-[var(--text-0)] m-0 leading-tight">
                Asset Intelligence Center
              </h1>
              <LivePulse color="#0ea5e9" size={8} label="LIVE" />
            </div>
            <p className="text-xs text-[var(--text-3)] tracking-wider m-0 mt-1 font-medium leading-tight">
              Enterprise decision support · Early warning · Risk monitoring
              {minutesAgo !== null && (
                <span> · Updated {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full xl:w-auto">
          {/* Mode switcher */}
          <div className="flex flex-wrap gap-1 bg-[var(--bg-2)] p-1 rounded-xl border border-[var(--border)]">
            {VIEW_MODES.map(m => {
              const Icon = m.icon
              const active = viewMode === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setViewMode(m.id)}
                  title={m.label}
                  aria-label={`Switch to ${m.label} mode`}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${active ? 'text-white' : 'text-[var(--text-2)] hover:bg-[var(--bg-3)]'}`}
                  style={active ? { backgroundColor: m.color } : {}}
                >
                  <Icon size={13} />
                  {m.label}
                </button>
              )
            })}
          </div>

          <button onClick={loadIntelligence} disabled={intelligenceLoading} className="btn-ghost" style={{ padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} style={{ animation: intelligenceLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>

          <button onClick={() => setShowCustomBuilder(true)} className="btn-primary" style={{ padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sliders size={13} /> Custom Report
          </button>
        </div>
      </div>

      {/* ── FILTERS ──────────────────────────────────────────────────────────── */}
      <GlobalReportFilters filters={filters} setFilters={setFilters} sites={sites} categories={assetCategories} />

      {/* ── BUSINESS QUESTION BAR ────────────────────────────────────────────── */}
      <BusinessQuestionBar onSelectReport={handleRunReport} allReports={ALL_REPORTS} />

      {/* ── INTELLIGENCE DASHBOARD ───────────────────────────────────────────── */}
      {intelligenceLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SkeletonLoader type="card" count={6} />
        </div>
      ) : intelligenceError ? (
        <div style={{ padding: 24, borderRadius: 14, background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-soft)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <XCircle size={20} color='var(--status-danger)' />
            <h3 style={{ margin: 0, color: 'var(--status-danger)', }}>Intelligence Load Failed</h3>
          </div>
          <p style={{ margin: 0, color: 'var(--text-2)', }}>{intelligenceError}</p>
          <button onClick={loadIntelligence} className="btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8 }}>Retry</button>
        </div>
      ) : intelligence && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KPI STRIP */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
            {kpis.map((kpi, i) => kpi && (
              <KPICard key={i} label={kpi.label} value={kpi.value} sub={kpi.sub} color={kpi.color} onClick={kpi.onClick} badge={kpi.badge} />
            ))}
          </div>

          {/* MAIN PANELS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 }}>

            {/* PORTFOLIO HEALTH - 4 cols */}
            <div style={{ gridColumn: 'span 4', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HeartPulse size={18} color="#10b981" /> PORTFOLIO HEALTH
                </h3>
                <span style={{ padding: '3px 8px', background: 'var(--bg-3)', borderRadius: 8, color: intelligence.confidence?.level === 'HIGH' ? '#10b981' : intelligence.confidence?.level === 'MEDIUM' ? 'var(--status-warning)' : 'var(--status-danger)' }}>
                  {intelligence.confidence?.level ?? 'UNKNOWN'} CONFIDENCE
                </span>
              </div>

              {/* Score */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <span style={{ color: (intelligence.health?.data?.score ?? 0) < 50 ? 'var(--status-danger)' : (intelligence.health?.data?.score ?? 0) < 75 ? 'var(--status-warning)' : '#10b981' }}>
                  {intelligence.health?.data?.score ?? '-'}
                </span>
                <div style={{ paddingBottom: 8 }}>
                  <div style={{ color: 'var(--text-3)' }}>/ 100</div>
                  <div style={{ color: 'var(--text-3)' }}>{(intelligence.health?.data?.score ?? 0) >= 75 ? 'GOOD' : (intelligence.health?.data?.score ?? 0) >= 50 ? 'FAIR' : 'POOR'}</div>
                </div>
              </div>

              {/* Component bars */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { label: 'Asset Health', key: 'asset' },
                  { label: 'Maintenance Health', key: 'maintenance' },
                  { label: 'Inventory Health', key: 'inventory' },
                  { label: 'Financial Health', key: 'financial' },
                  { label: 'Data Quality', key: 'dataQuality' },
                ].map(({ label, key }) => (
                  <HealthBar
                    key={key}
                    label={label}
                    obj={intelligence.health?.data?.components[key]}
                    onClick={() => {
                      const reportMap = { asset: 'executive-summary', maintenance: 'maintenance-backlog', inventory: 'inventory-position', financial: 'asset-current-valuation', dataQuality: 'data-quality-report' }
                      const r = ALL_REPORTS.find(rep => rep.id === reportMap[key])
                      if (r) handleRunReport(r)
                    }}
                  />
                ))}
              </div>

              <div style={{ paddingTop: 8, color: 'var(--text-3)', }}>
                {intelligence.confidence?.reason ?? ''}
              </div>
            </div>

            {/* TODAY'S ATTENTION - 8 cols */}
            <div style={{ gridColumn: 'span 8', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={18} color='var(--status-danger)' /> TODAY'S ATTENTION
                </h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-2)' }}>
                    {intelligence.exceptions.filter(e => e.severity === 'CRITICAL').length} critical · {intelligence.exceptions.filter(e => e.severity === 'HIGH').length} high
                  </span>
                </div>
              </div>

              {intelligence.exceptions.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40, color: 'var(--text-3)' }}>
                  <CheckCircle2 size={40} color="#10b981" />
                  <p style={{ margin: 0, }}>No critical exceptions detected</p>
                  <p style={{ margin: 0, color: 'var(--text-3)' }}>All monitored systems are within normal thresholds</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, overflowY: 'auto', maxHeight: 340 }}>
                  {/* Mode-filtered exceptions */}
                  {intelligence.exceptions
                    .filter(e => {
                      const domain = e.domain || e.type
                      if (viewMode === 'MAINTENANCE') return domain === 'MAINTENANCE'
                      if (viewMode === 'INVENTORY') return domain === 'INVENTORY'
                      if (viewMode === 'FINANCE') return domain === 'FINANCIAL' || domain === 'ASSET'
                      if (viewMode === 'DATAQUALITY') return domain === 'DATA_QUALITY'
                      if (viewMode === 'OPERATIONS') return domain !== 'FINANCIAL'
                      return true // EXECUTIVE = all
                    })
                    .slice(0, 6)
                    .map(exc => <ExceptionCard key={exc.id} exc={exc} />)}
                </div>
              )}
            </div>

            {/* RISK RADAR - 6 cols */}
            {intelligence.risk?.data?.criticalAssets?.length > 0 && (
              <div style={{ gridColumn: 'span 6', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={18} color='var(--status-danger)' /> RISK RADAR
                  </h3>
                  <span style={{ color: 'var(--text-3)' }}>Top risk assets (by score)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 280 }}>
                  {intelligence.risk.data.criticalAssets.slice(0, 6).map(a => <RiskAssetCard key={a.id} asset={a} />)}
                </div>
                <div style={{ color: 'var(--text-3)', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  Score = Age (20%) + Maintenance (35%) + Status (25%) + Activity Proxy (10%) + Data Quality (10%). Methodology is deterministic.
                </div>
              </div>
            )}

            {/* MAINTENANCE INTELLIGENCE - 6 cols */}
            {(viewMode === 'EXECUTIVE' || viewMode === 'MAINTENANCE' || viewMode === 'OPERATIONS') && intelligence.maintenance?.status === 'success' && (
              <div style={{ gridColumn: intelligence.risk?.data?.criticalAssets?.length > 0 ? 'span 6' : 'span 12', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wrench size={18} color='var(--status-warning)' /> MAINTENANCE INTELLIGENCE
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Backlog', value: intelligence.maintenance.data?.backlogCount ?? '-', color: (intelligence.maintenance.data?.backlogCount ?? 0) > 20 ? 'var(--status-warning)' : 'inherit' },
                    { label: 'Overdue', value: intelligence.maintenance.data?.overdueCount ?? '-', color: (intelligence.maintenance.data?.overdueCount ?? 0) > 0 ? 'var(--status-danger)' : 'inherit' },
                    { label: 'Critical Open', value: intelligence.maintenance.data?.criticalCount ?? '-', color: (intelligence.maintenance.data?.criticalCount ?? 0) > 0 ? 'var(--status-danger)' : 'inherit' },
                    { label: 'PM Compliance', value: intelligence.maintenance.data?.pmCompliance?.score != null ? `${intelligence.maintenance.data.pmCompliance.score}%` : '-', color: (intelligence.maintenance.data?.pmCompliance?.score ?? 100) < 80 ? 'var(--status-danger)' : '#10b981' },
                    { label: 'Repeat Failures', value: intelligence.maintenance.data?.repeatFailuresCount ?? '-', color: (intelligence.maintenance.data?.repeatFailuresCount ?? 0) > 0 ? 'var(--status-warning)' : 'inherit' },
                  ].map((m, i) => (
                    <div key={`skel2-${i}`} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text-3)', marginBottom: 4 }}>{m.label}</div>
                      <div style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                {/* Aging buckets */}
                {intelligence.maintenance.data?.agingBuckets && (
                  <div>
                    <div style={{ color: 'var(--text-3)', marginBottom: 6 }}>TICKET AGING</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {Object.entries(intelligence.maintenance.data.agingBuckets).map(([range, count]) => (
                        <div key={range} style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--bg-1)', border: '1px solid var(--border)', }}>
                          <span style={{ color: 'var(--text-3)' }}>{range}d </span>
                          <span style={{ color: count > 5 ? 'var(--status-warning)' : 'var(--text-0)' }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => handleRunReport(ALL_REPORTS.find(r => r.id === 'maintenance-backlog'))} className="btn-ghost" style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  View Maintenance Report <ArrowRight size={13}/>
                </button>
              </div>
            )}

            {/* INVENTORY INTELLIGENCE - conditional */}
            {(viewMode === 'EXECUTIVE' || viewMode === 'INVENTORY' || viewMode === 'OPERATIONS') && intelligence.inventory?.status === 'success' && ((intelligence.inventory.data?.stockoutItemsCount ?? 0) + (intelligence.inventory.data?.lowStockItemsCount ?? 0) > 0) && (
              <div style={{ gridColumn: 'span 6', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Boxes size={18} color="#10b981" /> INVENTORY INTELLIGENCE
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                  {[
                    { label: 'Stockouts', value: intelligence.inventory.data?.stockoutItemsCount ?? '-', color: (intelligence.inventory.data?.stockoutItemsCount ?? 0) > 0 ? 'var(--status-danger)' : '#10b981' },
                    { label: 'Low Stock', value: intelligence.inventory.data?.lowStockItemsCount ?? '-', color: (intelligence.inventory.data?.lowStockItemsCount ?? 0) > 0 ? 'var(--status-warning)' : 'inherit' },
                    { label: 'Stock Value', value: canSeeFinancials ? formatCurrency(intelligence.inventory.data?.stockValue) : '-', color: 'inherit' },
                    { label: 'Avg Daily Burn', value: (intelligence.inventory.data?.averageDailyBurn ?? 0) > 0 ? intelligence.inventory.data.averageDailyBurn : 'Insufficient data', color: 'inherit' },
                  ].map((m, i) => (
                    <div key={`skel2-${i}`} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text-3)', marginBottom: 4 }}>{m.label}</div>
                      <div style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleRunReport(ALL_REPORTS.find(r => r.id === 'inventory-position'))} className="btn-ghost" style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  View Inventory Report <ArrowRight size={13}/>
                </button>
              </div>
            )}

            {/* DATA QUALITY - show when DATA QUALITY mode or when score < 80 */}
            {intelligence.dataQuality?.status === 'success' && (viewMode === 'DATAQUALITY' || (intelligence.dataQuality.data?.score ?? 100) < 80) && (
              <div style={{ gridColumn: 'span 6', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h3 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Database size={18} color="#06b6d4" /> DATA QUALITY
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ color: (intelligence.dataQuality.data?.score ?? 100) < 70 ? 'var(--status-warning)' : '#10b981' }}>{intelligence.dataQuality.data?.score ?? '-'}%</span>
                  <div>
                    <div style={{ color: 'var(--text-2)' }}>{intelligence.dataQuality.data?.completeRecords ?? 0} complete · {intelligence.dataQuality.data?.incompleteRecords ?? 0} incomplete</div>
                    <div style={{ color: 'var(--text-3)', marginTop: 2 }}>Based on 8 critical fields per asset</div>
                  </div>
                </div>
                {(intelligence.dataQuality.data?.missingFields?.length ?? 0) > 0 && (
                  <div>
                    <div style={{ color: 'var(--text-3)', marginBottom: 6 }}>TOP MISSING FIELDS</div>
                    {intelligence.dataQuality.data.missingFields.slice(0, 4).map(({ field, count }) => (
                      <div key={field} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', }}>
                        <span style={{ color: 'var(--text-1)' }}>{field.replace(/_/g, ' ')}</span>
                        <span style={{ color: 'var(--status-warning)', }}>{count} assets</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => handleRunReport(ALL_REPORTS.find(r => r.id === 'data-quality-report'))} className="btn-ghost" style={{ alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  View Data Quality Report <ArrowRight size={13}/>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── INTELLIGENCE MODULES ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, color: 'var(--text-0)' }}>
            INTELLIGENCE MODULES
            <span style={{ padding: '2px 8px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-3)', marginLeft: 8, verticalAlign: 'middle' }}>
              {VIEW_MODES.find(m => m.id === viewMode)?.label} View
            </span>
          </h2>
          <div style={{ position: 'relative', width: 300 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter modules..."
              style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {modulesByMode.map(({ cat, cards }) => (
            <div key={cat.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 4, height: 18, background: cat.color, borderRadius: 2 }} />
                <h3 style={{ color: 'var(--text-0)', letterSpacing: '0.06em', margin: 0 }}>{cat.title}</h3>
                <span style={{ padding: '2px 8px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-3)' }}>{cards.length} MODULES</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {cards.map(card => {
                  const Icon = card.icon
                  const isFav = favorites.includes(card.id)
                  return (
                    <div
                      key={card.id}
                      className="interactive-card"
                      onClick={() => handleRunReport(card)}
                      style={{ padding: 18, borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ padding: 8, background: `${card.color}15`, borderRadius: 8, color: card.color }}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <div style={{ color: 'var(--text-3)', letterSpacing: '0.04em' }}>{card.categoryLabel.toUpperCase()}</div>
                            <h4 style={{ margin: 0, color: 'var(--text-0)' }}>{card.title}</h4>
                          </div>
                        </div>
                        <button onClick={(e) => toggleFavorite(e, card.id)} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: isFav ? 'var(--status-warning)' : 'var(--text-3)' }}>
                          <Star size={14} fill={isFav ? 'var(--status-warning)' : 'none'} />
                        </button>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-2)', }}>{card.description}</p>
                      <div style={{ marginTop: 'auto', textAlign: 'right', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>Analyze <ChevronRight size={12}/></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {modulesByMode.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
              No intelligence modules match "{search}"
            </div>
          )}
        </div>
      </div>

      {/* ── CUSTOM BUILDER MODAL ─────────────────────────────────────────────── */}
      {showCustomBuilder && (
        <CustomReportBuilder
          onClose={() => setShowCustomBuilder(false)}
          onSaveTemplate={(t) => setSavedTemplates([t, ...savedTemplates])}
          user={profile}
        />
      )}
    </div>
  )
}


