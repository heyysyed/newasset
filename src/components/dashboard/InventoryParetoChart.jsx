import React, { useState, useEffect, useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { formatCurrency } from '../../lib/depreciation'
import { Layers, PieChart } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function InventoryParetoChart() {
  const [items, setItems] = useState([])

  useEffect(() => {
    supabase.from('bulk_items').select('*').then(res => setItems(res.data || []))
  }, [])

  const paretoData = useMemo(() => {
    if (!items.length) return []
    // Group by category
    const catMap = {}
    items.forEach(i => {
      const cat = i.category || 'General Tools'
      const val = Number(i.unit_price || 0) * 100 // baseline stock valuation
      catMap[cat] = (catMap[cat] || 0) + val
    })

    // Sort descending
    const sorted = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const total = sorted.reduce((acc, x) => acc + x.value, 0)
    let cumulative = 0

    return sorted.map(x => {
      cumulative += x.value
      const cumPct = total > 0 ? (cumulative / total) * 100 : 0
      return {
        ...x,
        cumulativePct: Math.round(cumPct)
      }
    })
  }, [items])

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    return (
      <div style={{ background: 'var(--bg-3)', color: 'var(--text-0)', padding: '8px 12px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ color: 'var(--status-info)' }}>{item.name}</div>
        <div>Stock Value: <strong style={{ color: '#34d399', }}>{formatCurrency(item.value)}</strong></div>
        <div>Cumulative Share: <strong style={{ color: '#fbbf24', }}>{item.cumulativePct}%</strong></div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 20, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Inventory Pareto (80/20) Analysis
          </h3>
          <p style={{ margin: 0, color: 'var(--text-2)' }}>Bar = Category Value (₹) | Line = Cumulative %</p>
        </div>
        <Layers size={18} color="#7c3aed" />
      </div>

      <div style={{ height: 220, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={paretoData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
            <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#7c3aed" fontSize={10} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left" dataKey="value" fill='var(--accent)' radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cumulativePct" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3, fill: '#7c3aed' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}


