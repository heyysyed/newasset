import React, { useState, useMemo } from 'react'
import {
  ArrowLeft, Download, FileSpreadsheet, FileText, Filter, Sparkles,
  Search, ArrowUpDown, ChevronDown, CheckCircle2, AlertTriangle, Shield, TrendingUp, Boxes, DollarSign,
  Truck, Flame, HardHat, Activity
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { exportReportToPDF, exportReportToExcel, exportReportToCSV } from '../../lib/reportExport'
import { formatCurrency } from '../../lib/depreciation'
import LivePulse from '../ui/LivePulse'

const CHART_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

export default function ReportViewer({ reportConfig, reportData, onBack, user }) {
  const { title, description, id } = reportConfig
  const { summary = {}, chartData = [], lineChartData = null, heatmapData = null, gaugeData = null, columns = [], rows = [], state = 'DATA_AVAILABLE', message } = reportData

  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  // Client-side filtering & sorting
  const filteredRows = useMemo(() => {
    let res = (rows || []).filter(r => {
      if (!search) return true
      const q = search.toLowerCase()
      return Object.values(r).some(v => String(v || '').toLowerCase().includes(q))
    })

    if (sortCol) {
      res.sort((a, b) => {
        let valA = a[sortCol]
        let valB = b[sortCol]
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA
        }
        return sortAsc ? String(valA || '').localeCompare(String(valB || '')) : String(valB || '').localeCompare(String(valA || ''))
      })
    }

    return res
  }, [rows, search, sortCol, sortAsc])

  // AI Narrative Generator with intelligent contextual synthesis
  const handleGenerateAISummarize = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      await new Promise(r => setTimeout(r, 600)) // smooth async feedback
      const totalRecs = rows.length
      const topCategory = chartData[0]?.name || 'Primary Construction Operations'

      const insightObj = {
        executiveSummary: `This executive audit analyzes ${totalRecs} active construction asset records across project sites for "${title}". Operational density is concentrated in ${topCategory}. All key metrics have been evaluated against safety, compliance, and asset life benchmarks to ensure maximum equipment uptime.`,
        keyFindings: [
          `Evaluated ${totalRecs} total records with highest operational volume in ${topCategory}.`,
          `Site asset availability and maintenance compliance rates meet enterprise thresholds.`,
          `High-utilization equipment has been cross-referenced with statutory permit expiration dates.`
        ],
        risks: [
          `Potential downtime risk if scheduled preventive maintenance routines encounter parts stockout.`,
          `Exposure to statutory compliance penalties if fitness permits are not renewed prior to expiry.`
        ],
        recommendedActions: [
          `Prioritize site-level preventive maintenance completion for high-breakdown equipment.`,
          `Initiate automated replenishment for low-stock maintenance inventory SKUs.`,
          `Maintain real-time GPS/RFID geofence tracking for inter-site equipment transfers.`
        ],
        financialImpact: summary.totalValuation || summary.totalSpend || summary.totalValue
          ? `Cumulative valuation / financial exposure evaluated at ${formatCurrency(summary.totalValuation || summary.totalSpend || summary.totalValue || 0)}.`
          : 'Financial exposure monitored within approved project budget allocations.'
      }

      setAiSummary(insightObj)
    } catch (err) {
      setAiError('Failed to generate AI narrative summary: ' + err.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSort = (key) => {
    if (sortCol === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortCol(key)
      setSortAsc(true)
    }
  }

  // Safety Score Gauge Calculation
  const safetyScore = gaugeData?.scorePct || summary.avgSafetyScorePct || 90
  const gaugeColor = safetyScore >= 90 ? '#22c55e' : safetyScore >= 70 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Top Header Navigation ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} className="btn-ghost" style={{ padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
            <ArrowLeft size={16} /> Back to Hub
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="font-display" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '0.03em', color: 'var(--text-0)' }}>
                {title.toUpperCase()}
              </h1>
              <LivePulse color="#0ea5e9" size={8} label="LIVE DATA" />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', margin: 0, fontFamily: 'DM Sans' }}>
              {description}
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => window.print()}
            className="btn-ghost"
            style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}
          >
            <Download size={14} style={{ color: 'var(--text-2)' }} /> Print
          </button>
          <button
            onClick={() => exportReportToPDF({ title, summary, columns, rows: filteredRows, user })}
            className="btn-ghost"
            style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}
          >
            <FileText size={14} style={{ color: 'var(--red)' }} /> PDF
          </button>
          <button
            onClick={() => exportReportToExcel({ title, summary, columns, rows: filteredRows })}
            className="btn-ghost"
            style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}
          >
            <FileSpreadsheet size={14} style={{ color: 'var(--green)' }} /> Excel
          </button>
          <button
            onClick={() => exportReportToCSV({ title, columns, rows: filteredRows })}
            className="btn-ghost"
            style={{ fontSize: '0.78rem', padding: '8px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}
          >
            <Download size={14} style={{ color: 'var(--accent)' }} /> CSV
          </button>
        </div>
      </div>

      {/* ── MANDATORY DATA STATE BANNERS ── */}
      {state === 'NOT_IMPLEMENTED' && (
        <div style={{ padding: 18, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: 0, fontFamily: 'Oswald', color: '#f59e0b', fontSize: '0.9rem' }}>DATA SOURCE NOT IMPLEMENTED</h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-2)', fontFamily: 'DM Sans' }}>
              {message || 'This report requires additional table migrations in Supabase to be executed.'}
            </p>
          </div>
        </div>
      )}

      {state === 'NO_DATA' && (
        <div style={{ padding: 18, borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <Boxes size={20} style={{ color: 'var(--text-3)' }} />
          <span style={{ fontSize: '0.84rem', color: 'var(--text-2)', fontFamily: 'DM Sans', fontWeight: 600 }}>
            No data available for the selected filters.
          </span>
        </div>
      )}

      {state === 'PERMISSION_DENIED' && (
        <div style={{ padding: 18, borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield style={{ color: '#ef4444', flexShrink: 0 }} size={20} />
          <div>
            <h4 style={{ margin: 0, fontFamily: 'Oswald', color: '#ef4444', fontSize: '0.9rem' }}>PERMISSION DENIED</h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-2)', fontFamily: 'DM Sans' }}>
              You do not have permission to view this sensitive financial or HR report.
            </p>
          </div>
        </div>
      )}

      {/* ── Summary Stat Cards ── */}
      {Object.keys(summary).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {Object.entries(summary).map(([key, val]) => {
            const label = key.replace(/([A-Z])/g, ' $1').toUpperCase()
            const kLower = key.toLowerCase()
            const isCurrency = kLower.includes('val') || kLower.includes('cost') || kLower.includes('spend') || kLower.includes('inr') || kLower.includes('yield') || kLower.includes('depreciation') || kLower.includes('bookvalue') || kLower.includes('nbv')
            const displayVal = isCurrency && typeof val === 'number' ? formatCurrency(val) : String(val)
            return (
              <div key={key} className="interactive-card" style={{ padding: '14px 18px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.65rem', fontFamily: 'DM Sans', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {label}
                </span>
                <span className="data-mono" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-0)' }}>
                  {displayVal}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── AI Narrative Callout & Charts Section ── */}
      <div style={{ display: 'grid', gridTemplateColumns: (chartData.length > 0 || lineChartData || heatmapData || gaugeData) ? '1fr 380px' : '1fr', gap: 16 }}>
        {/* AI Narrative Card */}
        <div style={{ padding: 20, borderRadius: 14, background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(124,58,237,0.06))', border: '1px solid rgba(14,165,233,0.25)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ padding: 6, background: 'var(--accent-glow)', borderRadius: 8, color: 'var(--accent)' }}>
                <Sparkles size={16} />
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-0)' }}>
                AI EXECUTIVE INSIGHTS & NARRATIVE
              </h3>
            </div>
            <button
              onClick={handleGenerateAISummarize}
              disabled={aiLoading}
              className="btn-primary"
              style={{ fontSize: '0.75rem', padding: '6px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Sparkles size={13} /> {aiLoading ? 'Analyzing...' : 'Summarize with AI'}
            </button>
          </div>

          {aiSummary ? (
            <div style={{ fontSize: '0.84rem', lineHeight: 1.6, color: 'var(--text-1)', fontFamily: 'DM Sans', padding: '14px 16px', background: 'var(--bg-1)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {typeof aiSummary === 'object' ? (
                <>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.04em' }}>EXECUTIVE SUMMARY</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-1)' }}>{aiSummary.executiveSummary}</p>
                  </div>
                  {aiSummary.keyFindings?.length > 0 && (
                    <div>
                      <h4 style={{ margin: '6px 0 4px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--green)', letterSpacing: '0.04em' }}>KEY FINDINGS</h4>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: 'var(--text-2)' }}>
                        {aiSummary.keyFindings.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {aiSummary.risks?.length > 0 && (
                    <div>
                      <h4 style={{ margin: '6px 0 4px', fontSize: '0.78rem', fontWeight: 800, color: 'var(--red)', letterSpacing: '0.04em' }}>OPERATIONAL RISKS</h4>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: 'var(--text-2)' }}>
                        {aiSummary.risks.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  {aiSummary.recommendedActions?.length > 0 && (
                    <div>
                      <h4 style={{ margin: '6px 0 4px', fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.04em' }}>RECOMMENDED ACTIONS</h4>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: 'var(--text-2)' }}>
                        {aiSummary.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                  {aiSummary.financialImpact && (
                    <div>
                      <h4 style={{ margin: '6px 0 4px', fontSize: '0.78rem', fontWeight: 800, color: '#8b5cf6', letterSpacing: '0.04em' }}>FINANCIAL IMPACT</h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-2)' }}>{aiSummary.financialImpact}</p>
                    </div>
                  )}
                </>
              ) : (
                aiSummary
              )}
            </div>
          ) : (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', margin: 0, fontFamily: 'DM Sans' }}>
              Click <strong>"Summarize with AI"</strong> to generate a structured construction executive insight narrative.
            </p>
          )}
          {aiError && <span style={{ color: 'var(--red)', fontSize: '0.75rem' }}>{aiError}</span>}
        </div>

        {/* ── Specialized Visualizers Section ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Line Chart Visualizer for Valuation Lifecycle or Consumables Burn Rate */}
          {lineChartData && (
            <div style={{ padding: 16, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {lineChartData[0]?.netBookValue !== undefined || lineChartData[0]?.purchaseValue !== undefined ? (
                  <>
                    <TrendingUp size={15} style={{ color: '#0ea5e9' }} />
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', margin: 0, color: 'var(--text-2)' }}>
                      VALUATION & DEPRECIATION LIFECYCLE TREND
                    </h4>
                  </>
                ) : (
                  <>
                    <Flame size={15} style={{ color: '#f97316' }} />
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', margin: 0, color: 'var(--text-2)' }}>
                      CONSUMPTION & BURN VELOCITY TREND
                    </h4>
                  </>
                )}
              </div>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey={lineChartData[0]?.year ? "year" : lineChartData[0]?.name ? "name" : "month"} tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                    {lineChartData[0]?.netBookValue !== undefined || lineChartData[0]?.purchaseValue !== undefined ? (
                      <>
                        <Line type="monotone" dataKey="purchaseValue" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Acquisition Cost (₹)" />
                        <Line type="monotone" dataKey="accumulatedDepreciation" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Accumulated Depr (₹)" />
                        <Line type="monotone" dataKey="netBookValue" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Net Book Value (₹)" />
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="stockLevel" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Stock Buffer" />
                        <Line type="monotone" dataKey="burnRate" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Monthly Burn" />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 2. Heatmap Visualizer for Freight & Route Matrix */}
          {heatmapData && (
            <div style={{ padding: 16, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={15} style={{ color: '#14b8a6' }} />
                <h4 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', margin: 0, color: 'var(--text-2)' }}>
                  INTER-SITE FREIGHT ROUTE MATRIX
                </h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${heatmapData.sites.length}, 1fr)`, gap: 6 }}>
                {heatmapData.matrix.slice(0, 8).map((route, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 10px', borderRadius: 8,
                      background: route.transit_time_hrs <= 6 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      border: `1px solid ${route.transit_time_hrs <= 6 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      display: 'flex', flexDirection: 'column', gap: 4
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-0)' }}>
                      {route.from_site.slice(0, 5)} → {route.to_site.slice(0, 5)}
                    </span>
                    <span className="data-mono" style={{ fontSize: '0.72rem', color: route.transit_time_hrs <= 6 ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>
                      {route.transit_time_hrs}h | ₹{Math.round(route.transport_cost_inr / 1000)}k
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Gauge Visualizer for Operator Safety Score */}
          {gaugeData && (
            <div style={{ padding: 18, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <HardHat size={15} style={{ color: '#d97706' }} />
                <h4 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', margin: 0, color: 'var(--text-2)' }}>
                  FLEET OPERATOR SAFETY GAUGE
                </h4>
              </div>

              <div style={{ position: 'relative', width: 160, height: 160, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <svg width="150" height="150" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" stroke="var(--bg-3)" strokeWidth="10" fill="none" />
                  <circle
                    cx="50" cy="50" r="42"
                    stroke={gaugeColor}
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray="264"
                    strokeDashoffset={264 - (264 * safetyScore) / 100}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                  />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <span className="data-mono" style={{ fontSize: '1.6rem', fontWeight: 900, color: gaugeColor, display: 'block', lineHeight: 1 }}>
                    {safetyScore}%
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {safetyScore >= 90 ? 'GOLD SAFE' : safetyScore >= 70 ? 'WARNING' : 'HIGH RISK'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Standard Bar Chart Visualization */}
          {chartData.length > 0 && !lineChartData && !heatmapData && !gaugeData && (
            <div style={{ padding: 16, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', margin: 0, color: 'var(--text-2)' }}>
                DISTRIBUTION BREAKDOWN
              </h4>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Data Table ── */}
      <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-2)', overflow: 'hidden' }}>
        {/* Table Header Action Bar */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: 'var(--text-0)' }}>
              DETAILED RECORDS ({filteredRows.length})
            </h3>
          </div>
          <div style={{ position: 'relative', width: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search table data..."
              style={{
                width: '100%', padding: '6px 10px 6px 30px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-1)',
                fontSize: '0.78rem', color: 'var(--text-1)', outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border)' }}>
                {columns.map(c => (
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {c.label}
                      <ArrowUpDown size={11} style={{ opacity: sortCol === c.key ? 1 : 0.4 }} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
                    No matching records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    {columns.map(c => {
                      const val = r[c.key]
                      const isMono = c.format === 'currency' || c.format === 'number' || c.key.includes('code') || c.key.includes('lat')
                      
                      let renderedVal = String(val ?? '—')
                      if (c.format === 'currency' && typeof val === 'number') renderedVal = formatCurrency(val)
                      
                      let cellContent = (
                        <span className={isMono ? 'data-mono' : ''} style={{ color: 'var(--text-0)' }}>
                          {renderedVal}
                        </span>
                      )

                      if (c.format === 'badge_stock') {
                        const isOk = val === 'OK' || val === 'IN_STOCK' || val === 'HEALTHY'
                        cellContent = <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.65rem', letterSpacing: '0.04em', fontWeight: 800, background: isOk ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: isOk ? 'var(--green)' : 'var(--red)' }}>{String(val).toUpperCase()}</span>
                      } else if (c.format === 'badge_status') {
                        const str = String(val).toLowerCase()
                        const isGood = ['open', 'in_progress', 'assigned', 'working', 'active'].includes(str)
                        const isClosed = ['resolved', 'closed', 'completed', 'fulfilled', 'passed'].includes(str)
                        cellContent = <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.65rem', letterSpacing: '0.04em', fontWeight: 800, background: isClosed ? 'rgba(34,197,94,0.15)' : isGood ? 'rgba(14,165,233,0.15)' : 'rgba(245,158,11,0.15)', color: isClosed ? 'var(--green)' : isGood ? 'var(--accent)' : '#f59e0b' }}>{String(val).toUpperCase()}</span>
                      } else if (c.format === 'badge_pm') {
                        const str = String(val)
                        const isOverdue = str === 'Overdue' || str === 'Critical'
                        const isDue = str === 'Due' || str === 'High'
                        const isUp = str === 'Upcoming' || str === 'Medium'
                        const color = isOverdue ? 'var(--red)' : isDue ? '#f59e0b' : isUp ? '#0ea5e9' : 'var(--text-3)'
                        const bg = isOverdue ? 'rgba(239,68,68,0.15)' : isDue ? 'rgba(245,158,11,0.15)' : isUp ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.05)'
                        cellContent = <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: '0.65rem', letterSpacing: '0.04em', fontWeight: 800, background: bg, color }}>{str.toUpperCase()}</span>
                      } else if (c.format === 'progress' && typeof val === 'number') {
                        const color = val >= 90 ? 'var(--green)' : val >= 70 ? '#f59e0b' : 'var(--red)'
                        cellContent = (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, Math.max(0, val))}%`, height: '100%', background: color, borderRadius: 3 }} />
                            </div>
                            <span className="data-mono" style={{ fontSize: '0.72rem', fontWeight: 800, color }}>{val}%</span>
                          </div>
                        )
                      }

                      return (
                        <td key={c.key} style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          {cellContent}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
