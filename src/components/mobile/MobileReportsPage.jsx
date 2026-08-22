import React, { useState } from 'react'
import {
  Search, Star, BarChart2, Eye, HeartPulse, ShieldAlert, AlertTriangle,
  ArrowRight, CheckCircle2, Wrench, Boxes, Shield, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react'
import { REPORT_CATEGORIES, ALL_REPORTS } from '../../lib/reportRegistry'

const formatCurrency = (val) => {
  if (val == null || isNaN(val)) return '₹0'
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`
  return `₹${val.toLocaleString('en-IN')}`
}

const SEVERITY_COLORS = { CRITICAL: 'var(--status-danger)', HIGH: 'var(--status-warning)', MEDIUM: '#3b82f6' }

export default function MobileReportsPage({
  filteredCards = [],
  favorites = [],
  search = '',
  setSearch,
  filterSite,
  setFilterSite,
  sites = [],
  handleRunReport,
  toggleFavorite,
  intelligence,
  intelligenceLoading,
  canSeeFinancials = false,
}) {
  const [showModules, setShowModules] = useState(false)
  const [exceptionExpanded, setExceptionExpanded] = useState(false)

  const kpis = intelligence ? [
    { label: 'ASSETS AT RISK', value: intelligence.kpis.assetsAtRisk, color: intelligence.kpis.assetsAtRisk > 0 ? 'var(--status-danger)' : 'inherit' },
    { label: 'MAINTENANCE BACKLOG', value: intelligence.kpis.maintenanceBacklog, color: intelligence.kpis.maintenanceBacklog > 20 ? 'var(--status-warning)' : 'inherit' },
    { label: 'PM COMPLIANCE', value: `${intelligence.kpis.pmCompliance}%`, color: intelligence.kpis.pmCompliance < 80 ? 'var(--status-warning)' : '#10b981' },
    { label: 'CRITICAL EXCEPTIONS', value: intelligence.kpis.criticalExceptions, color: intelligence.kpis.criticalExceptions > 0 ? 'var(--status-danger)' : 'inherit' },
    ...(canSeeFinancials ? [
      { label: 'IDLE CAPITAL (PROXY)', value: formatCurrency(intelligence.kpis.idleCapital), color: 'var(--status-warning)' },
    ] : []),
  ] : []

  const criticalExceptions = intelligence?.exceptions?.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH').slice(0, exceptionExpanded ? 10 : 3) || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-0)', paddingBottom: 100 }}>

      {/* ── STICKY HEADER ────────────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h1 className="font-display" style={{ margin: 0, color: 'var(--text-0)' }}>INTELLIGENCE CENTER</h1>
            <p style={{ color: 'var(--text-3)', margin: 0 }}>Construction Asset Intelligence</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={filterSite}
              onChange={e => setFilterSite(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-0)', outline: 'none', maxWidth: 140 }}
            >
              <option value="All">All Sites</option>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', gap: 8 }}>
          <Search size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search intelligence modules..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-0)', flex: 1 }}
          />
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── HEALTH SCORE ────────────────────────────────────────────────────── */}
        {intelligenceLoading ? (
          <div style={{ padding: 20, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-3)', }}>
            Loading intelligence...
          </div>
        ) : intelligence ? (
          <>
            {/* Health */}
            <div style={{ padding: 20, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HeartPulse size={16} color="#10b981" /> PORTFOLIO HEALTH
                </h2>
                <span style={{ padding: '2px 7px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-3)' }}>
                  {intelligence.confidence.level}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div>
                  <span style={{ color: (intelligence.health?.data?.score ?? 0) < 50 ? 'var(--status-danger)' : (intelligence.health?.data?.score ?? 0) < 75 ? 'var(--status-warning)' : '#10b981' }}>
                    {intelligence.health?.data?.score ?? '-'}
                  </span>
                  <span style={{ color: 'var(--text-3)' }}>/100</span>
                </div>
                <div style={{ flex: 1 }}>
                  {['asset', 'maintenance', 'inventory'].map(key => {
                    const comp = intelligence.health?.data?.components?.[key]
                    if (!comp) return null
                    const color = comp.score >= 75 ? '#10b981' : comp.score >= 50 ? 'var(--status-warning)' : 'var(--status-danger)'
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-3)', width: 70, flexShrink: 0, textTransform: 'capitalize' }}>{key}</span>
                        <div style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 2 }}>
                          <div style={{ width: `${comp.score}%`, height: '100%', background: color, borderRadius: 2 }} />
                        </div>
                        <span style={{ color, minWidth: 24, textAlign: 'right' }}>{comp.score}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Exceptions */}
            {criticalExceptions.length > 0 && (
              <div style={{ borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--status-danger-soft)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                  <h2 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={16} color='var(--status-danger)' /> TODAY'S ATTENTION
                  </h2>
                  <span style={{ color: 'var(--status-danger)', }}>
                    {intelligence.exceptions.filter(e => e.severity === 'CRITICAL').length} critical
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {criticalExceptions.map((exc, i) => {
                    const color = SEVERITY_COLORS[exc.severity] || '#6b7280'
                    return (
                      <div key={exc.id} style={{ padding: '12px 16px', borderBottom: i < criticalExceptions.length - 1 ? '1px solid var(--border)' : 'none', borderLeft: `4px solid ${color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                          <h4 style={{ margin: 0, color: 'var(--text-0)', flex: 1, }}>{exc.title}</h4>
                          <span style={{ padding: '2px 6px', borderRadius: 6, background: `${color}20`, color, flexShrink: 0 }}>{exc.severity}</span>
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-2)', marginBottom: 8 }}>{exc.explanation || exc.description}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-2)', flex: 1 }}>{exc.actionLabel || exc.recommendedAction}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {intelligence.exceptions.length > 3 && (
                  <button
                    onClick={() => setExceptionExpanded(!exceptionExpanded)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-3)', border: 'none', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {exceptionExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    {exceptionExpanded ? 'Show Less' : `Show ${intelligence.exceptions.length - 3} More Exceptions`}
                  </button>
                )}
              </div>
            )}

            {intelligence.exceptions.length === 0 && (
              <div style={{ padding: 20, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <CheckCircle2 size={24} color="#10b981" />
                <div>
                  <div style={{ color: 'var(--text-0)' }}>No critical exceptions</div>
                  <div style={{ color: 'var(--text-3)' }}>All systems within normal thresholds</div>
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {kpis.map((kpi, i) => (
                <div key={i} style={{ padding: '14px', borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: 'var(--text-3)', letterSpacing: '0.05em' }}>{kpi.label}</span>
                  <span style={{ color: kpi.color || 'var(--text-0)', }}>{kpi.value}</span>
                </div>
              ))}
            </div>

            {/* Risk Assets */}
            {intelligence.risk?.data?.criticalAssets?.length > 0 && (
              <div style={{ borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={16} color='var(--status-danger)' />
                  <h2 style={{ margin: 0, color: 'var(--text-0)' }}>HIGHEST RISK ASSETS</h2>
                </div>
                {intelligence.risk.data.criticalAssets.slice(0, 3).map(asset => {
                  const r = asset.risk
                  const color = r.classification === 'Critical' ? 'var(--status-danger)' : 'var(--status-warning)'
                  return (
                    <div key={asset.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color, }}>{r.score}</span>
                        <span style={{ color, }}>RISK</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {asset.asset_name || asset.asset_code}
                        </div>
                        <div style={{ color: 'var(--text-3)' }}>{asset.category} · {asset.site || 'No site'}</div>
                        {r.drivers[0] && <div style={{ color: 'var(--text-2)', marginTop: 2 }}>{r.drivers[0]}</div>}
                      </div>
                      <span style={{ padding: '3px 7px', borderRadius: 8, background: `${color}15`, color, flexShrink: 0 }}>{r.classification}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 20, borderRadius: 14, background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-soft)', color: 'var(--status-danger)', textAlign: 'center' }}>
            Failed to load intelligence data
          </div>
        )}

        {/* ── MODULES TOGGLE ──────────────────────────────────────────────────── */}
        <button
          onClick={() => setShowModules(!showModules)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-0)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={16} style={{ color: 'var(--accent)' }} />
            Intelligence Modules ({ALL_REPORTS.length})
          </span>
          {showModules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showModules && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {REPORT_CATEGORIES.map(cat => {
              const catCards = filteredCards.filter(c => c.category === cat.id)
              if (catCards.length === 0) return null
              return (
                <div key={cat.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 3, height: 14, background: cat.color, borderRadius: 2 }} />
                    <span style={{ color: 'var(--text-3)', letterSpacing: '0.06em' }}>{cat.title.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {catCards.map(card => {
                      const Icon = card.icon || BarChart2
                      const isFav = favorites.includes(card.id)
                      return (
                        <div
                          key={card.id}
                          onClick={() => handleRunReport(card)}
                          style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: 'pointer', minHeight: 48 }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: `${card.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={16} style={{ color: card.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.title}</div>
                            <div style={{ color: 'var(--text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.description}</div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(e, card.id) }}
                            style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Star size={14} fill={isFav ? 'var(--status-warning)' : 'none'} style={{ color: isFav ? 'var(--status-warning)' : 'var(--text-3)' }} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
