import React, { useState, useMemo, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Building2, Layers, Package, IndianRupee, ChevronRight, Check } from 'lucide-react'
import { formatCurrency, calculateBookValue } from '../../lib/depreciation'
import { supabase } from '../../lib/supabase'

const SITE_COLORS = ['var(--accent)', '#059669', 'var(--status-warning)', '#0891b2', '#7c3aed', 'var(--status-danger)', '#db2777', '#475569', 'var(--status-success)', '#ca8a04']

export default function SiteValuationMatrix({ assets = [], selectedSite, onSelectSite }) {
  const [metricMode, setMetricMode] = useState('combined') // 'combined' | 'machinery' | 'bulk' | 'count'
  const [bulkStock, setBulkStock] = useState([])
  const [tickets, setTickets] = useState([])

  useEffect(() => {
    fetchBulkAndTickets()
  }, [])

  const fetchBulkAndTickets = async () => {
    try {
      const [bRes, tRes] = await Promise.all([
        supabase.from('bulk_site_stock').select('*, bulk_items(*)'),
        supabase.from('maintenance_tickets').select('id, status, assets(site)').neq('status', 'resolved')
      ])
      setBulkStock(bRes.data || [])
      setTickets(tRes.data || [])
    } catch (e) {
      console.error('Error fetching site matrix data:', e)
    }
  }

  // Helper for formatting into Lakhs / Crores
  const formatIndianCurrencyCompact = (val) => {
    if (!val || isNaN(val)) return '₹0'
    const num = Number(val)
    if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`
    if (num >= 100000) return `₹ ${(num / 100000).toFixed(2)} L`
    return `₹ ${num.toLocaleString('en-IN')}`
  }

  // Helper to merge short site nicknames with full site codes (e.g. "BALMORAL" -> "P158 - P158 BALMORAL")
  const getCanonicalSite = (rawSite, mapObj) => {
    if (!rawSite) return 'Unassigned Store'
    const rawClean = String(rawSite).trim().toLowerCase()

    for (const key of Object.keys(mapObj)) {
      const keyClean = key.toLowerCase()
      if (rawClean === keyClean) return key

      const rawWords = rawClean.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3)
      const keyWords = keyClean.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3)

      if (rawWords.some(rw => keyWords.includes(rw))) {
        if (rawSite.length > key.length) {
          const item = mapObj[key]
          delete mapObj[key]
          item.site = rawSite
          mapObj[rawSite] = item
          return rawSite
        }
        return key
      }
    }
    return rawSite
  }

  // Grouping Data by Site
  const siteMatrixData = useMemo(() => {
    const map = {}

    // 1. Process Assets
    assets.forEach(ast => {
      const rawS = ast.site || 'Unassigned Store'
      const site = getCanonicalSite(rawS, map)
      if (!map[site]) {
        map[site] = { site, machineryValue: 0, bulkValue: 0, assetCount: 0, openTickets: 0 }
      }
      map[site].machineryValue += calculateBookValue(ast)
      map[site].assetCount += 1
    })

    // 2. Process Bulk Site Stock
    bulkStock.forEach(st => {
      const rawS = st.site || 'Unassigned Store'
      const site = getCanonicalSite(rawS, map)
      const flatRate = Number(st.bulk_items?.unit_price || 0)
      const usable = Number(st.usable_qty || 0)
      const val = usable * flatRate

      if (!map[site]) {
        map[site] = { site, machineryValue: 0, bulkValue: 0, assetCount: 0, openTickets: 0 }
      }
      map[site].bulkValue += val
    })

    // 3. Process Open Tickets per site
    tickets.forEach(t => {
      const rawS = t.site_name || t.assets?.site
      if (rawS) {
        const site = getCanonicalSite(rawS, map)
        if (map[site]) {
          map[site].openTickets += 1
        }
      }
    })

    const result = Object.values(map).map(item => {
      const combined = item.machineryValue + item.bulkValue
      let displayValue = combined
      if (metricMode === 'machinery') displayValue = item.machineryValue
      if (metricMode === 'bulk') displayValue = item.bulkValue
      if (metricMode === 'count') displayValue = item.assetCount

      return {
        ...item,
        combinedValuation: combined,
        displayValue
      }
    })

    // Sort descending by displayValue
    return result.sort((a, b) => b.displayValue - a.displayValue)
  }, [assets, bulkStock, tickets, metricMode])

  const totalMatrixValue = useMemo(() => {
    return siteMatrixData.reduce((acc, row) => acc + row.displayValue, 0)
  }, [siteMatrixData])

  const pieChartData = useMemo(() => {
    return siteMatrixData.filter(d => d.displayValue > 0).map(d => ({
      name: d.site,
      value: d.displayValue
    }))
  }, [siteMatrixData])

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const siteName = payload[0].name
    const siteObj = siteMatrixData.find(s => s.site === siteName) || {}

    return (
      <div style={{ background: '#0f172a', color: '#fff', padding: '10px 14px', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color: 'var(--status-info)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={14} /> {siteName}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div>Machinery Net Value: <strong style={{ color: '#34d399', }}>{formatIndianCurrencyCompact(siteObj.machineryValue)}</strong></div>
          <div>Bulk Inventory Value: <strong style={{ color: '#fbbf24', }}>{formatIndianCurrencyCompact(siteObj.bulkValue)}</strong></div>
          <div>Total Asset Count: <strong style={{ color: '#fff', }}>{siteObj.assetCount} units</strong></div>
          {siteObj.openTickets > 0 && <div style={{ color: '#f87171', }}>Open Repair Tickets: {siteObj.openTickets}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 20, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 16 }}>
      
      {/* Header & Metric Toggle Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} color='var(--accent)' /> Site Asset & Valuation Matrix
          </h3>
          <p style={{ margin: 0, color: '#64748b', }}>
            Multi-site capital breakdown combining heavy machinery book value and live bulk inventory stock
          </p>
        </div>

        {/* Toggle Mode Pills */}
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          {[
            { id: 'combined', label: 'Combined' },
            { id: 'machinery', label: 'Machinery' },
            { id: 'bulk', label: 'Bulk Stock' },
            { id: 'count', label: 'Asset Count' }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMetricMode(m.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: metricMode === m.id ? 'var(--accent)' : 'transparent',
                color: metricMode === m.id ? '#ffffff' : '#64748b',
                transition: 'all 0.15s'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2-Column Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'center' }}>
        
        {/* Left Column: Donut Chart with Center KPI */}
        <div style={{ position: 'relative', width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={105}
                dataKey="value"
                stroke="#ffffff"
                strokeWidth={2}
                onClick={(entry) => onSelectSite(selectedSite === entry.name ? '' : entry.name)}
                style={{ cursor: 'pointer' }}
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={SITE_COLORS[index % SITE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
              {metricMode === 'count' ? 'TOTAL UNITS' : 'TOTAL VALUATION'}
            </div>
            <div style={{ color: '#0f172a', }}>
              {metricMode === 'count' ? totalMatrixValue : formatIndianCurrencyCompact(totalMatrixValue)}
            </div>
            <div style={{ color: 'var(--accent)', marginTop: 2 }}>
              {siteMatrixData.length} Active Sites
            </div>
          </div>
        </div>

        {/* Right Column: High-Density Site Data Matrix Table */}
        <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px', color: '#64748b', textTransform: 'uppercase' }}>Site Name</th>
                <th style={{ padding: '8px 12px', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Machinery (₹)</th>
                <th style={{ padding: '8px 12px', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Bulk Stock (₹)</th>
                <th style={{ padding: '8px 12px', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Total Valuation</th>
              </tr>
            </thead>
            <tbody>
              {siteMatrixData.map((row, idx) => {
                const isSelected = selectedSite === row.site
                return (
                  <tr 
                    key={row.site}
                    onClick={() => onSelectSite(isSelected ? '' : row.site)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(37,99,235,0.08)' : '#ffffff',
                      borderLeft: isSelected ? '4px solid var(--accent)' : '4px solid transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '10px 12px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SITE_COLORS[idx % SITE_COLORS.length] }} />
                      {row.site}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>
                      {formatIndianCurrencyCompact(row.machineryValue)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>
                      {formatIndianCurrencyCompact(row.bulkValue)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0f172a' }}>
                      {formatIndianCurrencyCompact(row.combinedValuation)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}


