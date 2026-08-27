import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, FileSpreadsheet, FileText, Sparkles,
  Search, ArrowUpDown, AlertTriangle, Shield, TrendingUp, Boxes, DollarSign,
  Truck, Flame, HardHat, Info, CheckCircle2, ShieldCheck
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import { exportReportToPDF, exportReportToExcel, exportReportToCSV } from '../../lib/reportExport'
import { formatCurrency } from '../../lib/depreciation'
import LivePulse from '../ui/LivePulse'
import { useIsMobile } from '../../hooks/useBreakpoint'

export default function ReportViewer({ reportConfig, reportData, onBack, user }) {
  const { title, description, id, category = '' } = reportConfig
  const { 
    summary = {}, 
    chartData = [], 
    lineChartData = null, 
    heatmapData = null, 
    gaugeData = null, 
    columns = [], 
    rows = [], 
    state = 'DATA_AVAILABLE', 
    message,
    methodology,
    confidence
  } = reportData
  
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState(null)
  const [sortAsc, setSortAsc] = useState(true)
  
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

  const handleSort = (key) => {
    if (sortCol === key) setSortAsc(!sortAsc)
    else { setSortCol(key); setSortAsc(true) }
  }

  // Safety Score Gauge Calculation
  const safetyScore = gaugeData?.scorePct || summary.avgSafetyScorePct || 90
  const gaugeColor = safetyScore >= 90 ? '#22c55e' : safetyScore >= 70 ? 'var(--status-warning)' : 'var(--status-danger)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} className="btn-ghost" style={{ padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, letterSpacing: '0.03em', color: 'var(--text-0)' }}>
                {title.toUpperCase()}
              </h1>
              <LivePulse color="#0ea5e9" size={8} label="LIVE DATA" />
            </div>
            <p style={{ color: 'var(--text-2)', margin: 0 }}>
              {description}
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} className="btn-ghost" style={{ padding: '8px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
            <Download size={14} style={{ color: 'var(--text-2)' }} /> Print
          </button>
          <button onClick={() => exportReportToPDF({ title, summary, columns, rows: filteredRows, user })} className="btn-ghost" style={{ padding: '8px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
            <FileText size={14} style={{ color: 'var(--red)' }} /> PDF
          </button>
          <button onClick={() => exportReportToExcel({ title, summary, columns, rows: filteredRows })} className="btn-ghost" style={{ padding: '8px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
            <FileSpreadsheet size={14} style={{ color: 'var(--green)' }} /> Excel
          </button>
        </div>
      </div>

      {/* ── CONTEXT & ALERTS ── */}
      {state === 'NOT_IMPLEMENTED' && (
        <div style={{ padding: 18, borderRadius: 12, background: 'var(--status-warning-soft)', border: '1px solid var(--status-warning-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={20} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: 0, color: 'var(--status-warning)', }}>DATA SOURCE NOT IMPLEMENTED</h4>
            <p style={{ margin: '2px 0 0', color: 'var(--text-2)' }}>{message || 'This report requires additional table migrations in Supabase to be executed.'}</p>
          </div>
        </div>
      )}

      {state === 'NO_DATA' && (
        <div style={{ padding: 18, borderRadius: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <Boxes size={20} style={{ color: 'var(--text-3)' }} />
          <span style={{ color: 'var(--text-2)', }}>No data available for the selected filters.</span>
        </div>
      )}

      {/* ── KPIs ── */}
      {Object.keys(summary).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {Object.entries(summary).map(([key, val]) => {
            if (key === 'insight' || key === 'methodology') return null;
            const label = key.replace(/([A-Z])/g, ' $1').toUpperCase()
            const isCurrency = key.toLowerCase().includes('val') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('exposure')
            const displayVal = isCurrency && typeof val === 'number' ? formatCurrency(val) : String(val)
            return (
              <div key={key} className="interactive-card" style={{ padding: '16px 20px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ color: 'var(--text-3)', letterSpacing: '0.05em' }}>{label}</span>
                <span className="data-mono" style={{ color: 'var(--text-0)' }}>{displayVal}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CHARTS ── */}
      {chartData.length > 0 && (
        <div style={{ padding: 20, borderRadius: 14, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h4 style={{ letterSpacing: '0.05em', margin: 0, color: 'var(--text-0)' }}>DATA DISTRIBUTION</h4>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-3)' }} />
                <YAxis tick={{ fill: 'var(--text-3)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, }} />
                <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── DETAIL TABLE ── */}
      {rows.length > 0 && (
        <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-2)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: 'var(--text-0)' }}>DETAILED RECORDS ({filteredRows.length})</h3>
            <div style={{ position: 'relative', width: 280 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search detail table..."
                style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
              />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border)' }}>
                  {columns.map(c => (
                    <th key={c.key} onClick={() => handleSort(c.key)} style={{ padding: '12px 16px', color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {c.label}
                        <ArrowUpDown size={12} style={{ opacity: sortCol === c.key ? 1 : 0.4 }} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={columns.length} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)' }}>No matching records found.</td></tr>
                ) : filteredRows.map((r, idx) => {
                    const hasDrilldown = Boolean(r.id)
                    const handleRowClick = () => {
                      if (!hasDrilldown) return
                      if (String(r.id).startsWith('mt-')) navigate(`/admin/maintenance/tickets/${String(r.id).replace('mt-','')}`)
                      else if (String(r.id).startsWith('inv-')) navigate(`/admin/inventory/${String(r.id).replace('inv-','')}`)
                      else navigate(`/admin/assets/${r.id}`)
                    }
                    return (
                    <tr 
                      key={idx} onClick={handleRowClick}
                      style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', cursor: hasDrilldown ? 'pointer' : 'default', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => hasDrilldown && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onMouseLeave={(e) => hasDrilldown && (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                    >
                      {columns.map(c => {
                        const val = r[c.key]
                        const isMono = c.format === 'currency' || c.format === 'number'
                        let renderedVal = String(val ?? '-')
                        if (c.format === 'currency' && typeof val === 'number') renderedVal = formatCurrency(val)
                        return (
                          <td key={c.key} style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span className={isMono ? 'data-mono' : ''} style={{ color: 'var(--text-0)' }}>{renderedVal}</span>
                          </td>
                        )
                      })}
                    </tr>
                  )})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── METHODOLOGY & CONFIDENCE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <div style={{ padding: 20, borderRadius: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={18} style={{ color: 'var(--accent)' }} />
            <h4 style={{ margin: 0, color: 'var(--text-0)' }}>METHODOLOGY TRANSPARENCY</h4>
          </div>
          <p style={{ margin: 0, color: 'var(--text-2)', }}>
            {methodology?.what || 'Report relies on direct aggregation of transactional records in the selected time period.'}
          </p>
          {methodology?.why && (
            <p style={{ margin: 0, color: 'var(--text-2)', }}>
              <strong>Business Rationale:</strong> {methodology.why}
            </p>
          )}
          {methodology?.limitations && (
            <p style={{ margin: 0, color: 'var(--status-warning)', }}>
              <strong>Limitations:</strong> {methodology.limitations}
            </p>
          )}
        </div>

        <div style={{ padding: 20, borderRadius: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} style={{ color: confidence?.level === 'High' ? '#10b981' : confidence?.level === 'Medium' ? 'var(--status-warning)' : 'var(--status-danger)' }} />
            <h4 style={{ margin: 0, color: 'var(--text-0)' }}>DATA CONFIDENCE: {confidence?.level || 'MODERATE'}</h4>
          </div>
          <p style={{ margin: 0, color: 'var(--text-2)', }}>
            {confidence?.reason || 'Confidence is inferred based on standard data completeness thresholds. Some required fields may be incomplete or extrapolated.'}
          </p>
        </div>
      </div>

    </div>
  )
}


