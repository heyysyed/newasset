import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Sparkles, FileSpreadsheet, TrendingUp, ShieldCheck, DollarSign,
  Building2, Sliders, ChevronRight, Play, Plus, Search, Calendar,
  BarChart3, Layers, FileText, CheckCircle2, Clock, AlertTriangle, Boxes,
  Calculator, Recycle, ShoppingCart, Flame, Truck, Wrench, FileCheck, HardHat,
  Star, StarOff, Radio, Shield, MapPin, Users, Activity
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase, fetchSites } from '../lib/supabase'
import { REPORT_CATEGORIES, ALL_REPORTS } from '../lib/reportRegistry'
import { executeCustomReport } from '../lib/reports'
import ReportViewer from '../components/reports/ReportViewer'
import CustomReportBuilder from '../components/reports/CustomReportBuilder'
import SkeletonLoader from '../components/ui/SkeletonLoader'
import LivePulse from '../components/ui/LivePulse'

export default function ReportsPage() {
  const { profile, user } = useAuth()
  const { reportId } = useParams()
  const navigate = useNavigate()

  const [selectedReportCard, setSelectedReportCard] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)
  const [sites, setSites] = useState([])
  const [savedTemplates, setSavedTemplates] = useState([])

  // Category & Filter states
  const [selectedCategory, setSelectedCategory] = useState('all') // 'all', 'favorites', 'recent', or category ID
  const [filterSite, setFilterSite] = useState('all')
  const [search, setSearch] = useState('')
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assetpro_report_favorites') || '[]') }
    catch (e) { return ['executive-summary', 'site-comparison', 'asset-valuation-journey'] }
  })
  const [recentReports, setRecentReports] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assetpro_report_recents') || '[]') }
    catch (e) { return [] }
  })

  useEffect(() => {
    loadSitesAndTemplates()
  }, [])

  // Deep-linking URL routing support
  useEffect(() => {
    if (reportId) {
      const match = ALL_REPORTS.find(r => r.id === reportId)
      if (match) {
        handleRunReport(match)
      }
    }
  }, [reportId])

  const loadSitesAndTemplates = async () => {
    try {
      const s = await fetchSites()
      setSites(s || [])

      const { data } = await supabase.from('report_templates').select('*').order('created_at', { ascending: false })
      if (data && data.length > 0) {
        setSavedTemplates(data)
      } else {
        const local = JSON.parse(localStorage.getItem('assetpro_report_templates') || '[]')
        setSavedTemplates(local)
      }
    } catch (e) {
      console.warn('Failed loading templates:', e)
    }
  }

  const toggleFavorite = (e, cardId) => {
    e.stopPropagation()
    let updated
    if (favorites.includes(cardId)) {
      updated = favorites.filter(id => id !== cardId)
    } else {
      updated = [...favorites, cardId]
    }
    setFavorites(updated)
    localStorage.setItem('assetpro_report_favorites', JSON.stringify(updated))
  }

  const handleRunReport = async (card, customConfig = null) => {
    setSelectedReportCard(card)
    setLoading(true)

    // Track Recently Used
    const updatedRecents = [card.id, ...recentReports.filter(id => id !== card.id)].slice(0, 10)
    setRecentReports(updatedRecents)
    localStorage.setItem('assetpro_report_recents', JSON.stringify(updatedRecents))

    try {
      let data
      if (customConfig) {
        data = await executeCustomReport(customConfig)
      } else {
        data = await card.fetcher({ siteId: filterSite })
      }
      setReportData(data)
    } catch (e) {
      setReportData({
        state: 'QUERY_ERROR',
        summary: {},
        chartData: [],
        columns: [],
        rows: [],
        message: e.message,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNewTemplate = (newTemplate) => {
    const updated = [newTemplate, ...savedTemplates]
    setSavedTemplates(updated)
    localStorage.setItem('assetpro_report_templates', JSON.stringify(updated))
  }

  // Filter Cards by Search & Category
  const filteredCards = ALL_REPORTS.filter(c => {
    const matchSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.categoryLabel.toLowerCase().includes(search.toLowerCase())

    if (!matchSearch) return false

    if (selectedCategory === 'all') return true
    if (selectedCategory === 'favorites') return favorites.includes(c.id)
    if (selectedCategory === 'recent') return recentReports.includes(c.id)
    return c.category === selectedCategory
  })

  if (selectedReportCard && reportData) {
    return (
      <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
        <ReportViewer
          reportConfig={selectedReportCard}
          reportData={reportData}
          onBack={() => {
            setSelectedReportCard(null)
            setReportData(null)
            if (reportId) navigate('/reports')
          }}
          user={profile}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Page Title & Industrial Header ── */}
      <div className="blueprint-grid" style={{ padding: 24, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-2)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.04em', margin: 0, color: 'var(--text-0)' }}>
                CONSTRUCTION ASSET INTELLIGENCE ({ALL_REPORTS.length} MODULES)
              </h1>
              <LivePulse color="#0ea5e9" size={8} label="COMMAND CENTER" />
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-2)', margin: 0, fontFamily: 'DM Sans' }}>
              Centralized intelligence command center across 9 construction modules: Executive, Fixed Assets, Equipment Maintenance, PM, Inventory, Procurement, Logistics, Safety & Fleet.
            </p>
          </div>

          <button
            onClick={() => setShowCustomBuilder(true)}
            className="btn-primary"
            style={{ fontSize: '0.82rem', padding: '10px 18px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Sliders size={16} /> Custom Report Builder
          </button>
        </div>

        {/* Top KPI Metrics Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 20 }}>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'DM Sans' }}>REGISTERED MODULES</span>
            <span className="data-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent)' }}>{ALL_REPORTS.length}</span>
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'DM Sans' }}>CORE MODULES</span>
            <span className="data-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--green)' }}>9 DOMAINS</span>
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'DM Sans' }}>STARRED FAVORITES</span>
            <span className="data-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>{favorites.length}</span>
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'DM Sans' }}>SAVED TEMPLATES</span>
            <span className="data-mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#8b5cf6' }}>{savedTemplates.length}</span>
          </div>
        </div>

        {/* Global Filter & Search Bar */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search all ${ALL_REPORTS.length} reports by title, description, or keyword...`}
              style={{
                width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-1)',
                fontSize: '0.82rem', color: 'var(--text-0)', outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.04em' }}>FILTER SITE:</span>
            <select
              value={filterSite}
              onChange={e => setFilterSite(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg-1)', fontSize: '0.82rem', color: 'var(--text-0)', outline: 'none'
              }}
            >
              <option value="all">All Enterprise Sites</option>
              {sites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Category Filter Tabs ── */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20, WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
            fontSize: '0.75rem', fontFamily: 'DM Sans', fontWeight: 700, whiteSpace: 'nowrap',
            borderColor: selectedCategory === 'all' ? 'var(--accent)' : 'var(--border)',
            background: selectedCategory === 'all' ? 'var(--accent-glow)' : 'var(--bg-2)',
            color: selectedCategory === 'all' ? 'var(--accent)' : 'var(--text-2)',
          }}
        >
          All ({ALL_REPORTS.length})
        </button>
        <button
          onClick={() => setSelectedCategory('favorites')}
          style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
            fontSize: '0.75rem', fontFamily: 'DM Sans', fontWeight: 700, whiteSpace: 'nowrap',
            borderColor: selectedCategory === 'favorites' ? '#f59e0b' : 'var(--border)',
            background: selectedCategory === 'favorites' ? 'rgba(245,158,11,0.12)' : 'var(--bg-2)',
            color: selectedCategory === 'favorites' ? '#f59e0b' : 'var(--text-2)',
            display: 'flex', alignItems: 'center', gap: 5
          }}
        >
          <Star size={13} fill={selectedCategory === 'favorites' ? '#f59e0b' : 'none'} /> Favorites ({favorites.length})
        </button>
        <button
          onClick={() => setSelectedCategory('recent')}
          style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
            fontSize: '0.75rem', fontFamily: 'DM Sans', fontWeight: 700, whiteSpace: 'nowrap',
            borderColor: selectedCategory === 'recent' ? '#8b5cf6' : 'var(--border)',
            background: selectedCategory === 'recent' ? 'rgba(139,92,246,0.12)' : 'var(--bg-2)',
            color: selectedCategory === 'recent' ? '#8b5cf6' : 'var(--text-2)',
            display: 'flex', alignItems: 'center', gap: 5
          }}
        >
          <Clock size={13} /> Recently Used ({recentReports.length})
        </button>

        {REPORT_CATEGORIES.map(cat => {
          const count = ALL_REPORTS.filter(r => r.category === cat.id).length
          const active = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
                fontSize: '0.75rem', fontFamily: 'DM Sans', fontWeight: 700, whiteSpace: 'nowrap',
                borderColor: active ? cat.color : 'var(--border)',
                background: active ? `${cat.color}15` : 'var(--bg-2)',
                color: active ? cat.color : 'var(--text-2)',
              }}
            >
              {cat.title} ({count})
            </button>
          )
        })}
      </div>

      {loading ? (
        <SkeletonLoader type="card" count={6} />
      ) : (
        <>
          {/* ── Grouped Standard Reports Cards Grid (155 Modules) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 28 }}>
            {REPORT_CATEGORIES.map(cat => {
              const categoryCards = filteredCards.filter(c => c.category === cat.id)
              if (categoryCards.length === 0) return null

              return (
                <div key={cat.id}>
                  {/* Category Section Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 4, height: 18, background: cat.color, borderRadius: 2 }} />
                    <h2 className="font-display" style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-0)', letterSpacing: '0.06em', margin: 0 }}>
                      {cat.title}
                    </h2>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-3)', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>
                      {categoryCards.length} MODULES
                    </span>
                  </div>

                  {/* Responsive Grid Layout for Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                    {categoryCards.map(card => {
                      const Icon = card.icon
                      const isFav = favorites.includes(card.id)
                      return (
                        <div
                          key={card.id}
                          className="interactive-card"
                          style={{
                            padding: 20,
                            borderRadius: 14,
                            background: 'var(--bg-2)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 16,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleRunReport(card)}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ padding: 10, background: `${card.color}15`, borderRadius: 10, color: card.color, border: `1px solid ${card.color}30` }}>
                                <Icon size={20} />
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: 'var(--bg-3)', color: 'var(--text-3)', letterSpacing: '0.04em' }}>
                                  {card.categoryLabel.toUpperCase()}
                                </span>
                                <button
                                  onClick={(e) => toggleFavorite(e, card.id)}
                                  className="btn-ghost"
                                  style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent' }}
                                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                  <Star size={16} fill={isFav ? '#f59e0b' : 'none'} style={{ color: isFav ? '#f59e0b' : 'var(--text-3)' }} />
                                </button>
                              </div>
                            </div>

                            <div>
                              <h3 className="font-display" style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-0)', letterSpacing: '0.03em' }}>
                                {card.title}
                              </h3>
                              <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.5, fontFamily: 'DM Sans' }}>
                                {card.description}
                              </p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              Generate Report <ChevronRight size={14} />
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Saved Custom Report Templates Grid ── */}
          {savedTemplates.length > 0 && (
            <div>
              <h2 className="font-display" style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-2)', letterSpacing: '0.06em', marginBottom: 14 }}>
                SAVED CUSTOM TEMPLATES ({savedTemplates.length})
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {savedTemplates.map(t => (
                  <div
                    key={t.id}
                    className="interactive-card"
                    style={{
                      padding: 18,
                      borderRadius: 14,
                      background: 'var(--bg-2)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sliders size={16} style={{ color: 'var(--accent)' }} />
                        <h3 style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: 'var(--text-0)' }}>
                          {t.name}
                        </h3>
                      </div>
                      <span className="data-mono" style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>
                        {t.data_source}
                      </span>
                    </div>

                    {t.description && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', margin: 0 }}>{t.description}</p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                      <button
                        onClick={() => handleRunReport({ id: `custom-${t.id}`, title: t.name, description: `Custom template on ${t.data_source}` }, t)}
                        className="btn-primary"
                        style={{ fontSize: '0.75rem', padding: '6px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Play size={12} /> Run Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Custom Report Builder Modal */}
      {showCustomBuilder && (
        <CustomReportBuilder
          onClose={() => setShowCustomBuilder(false)}
          onSaveTemplate={handleSaveNewTemplate}
          user={profile}
        />
      )}
    </div>
  )
}
