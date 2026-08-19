import React from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { formatCurrency } from '../../lib/depreciation'
import { TrendingDown, IndianRupee } from 'lucide-react'

export default function FinancialWaterfallChart({ purchaseValue = 0, depreciation = 0, maintCost = 0, netBookValue = 0 }) {
  const data = [
    { name: 'Purchase Cost', value: purchaseValue, fill: '#2563eb', type: 'initial' },
    { name: '(-) Depreciation', value: depreciation, fill: '#f59e0b', type: 'deduction' },
    { name: '(-) Maintenance', value: maintCost, fill: '#ef4444', type: 'deduction' },
    { name: 'Net Asset Value', value: netBookValue, fill: '#059669', type: 'final' }
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    return (
      <div style={{ background: '#0f172a', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', fontFamily: 'DM Sans', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ fontWeight: 700 }}>{item.name}</div>
        <div style={{ fontFamily: 'DM Mono', color: item.fill }}>{formatCurrency(item.value)}</div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 20, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Financial Waterfall Ledger
          </h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Capital expenditure vs depreciation & repair deductions</p>
        </div>
        <IndianRupee size={18} color="#2563eb" />
      </div>

      <div style={{ height: 220, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `₹${(v/100000).toFixed(1)}L`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
