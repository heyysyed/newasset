import React from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { formatCurrency } from '../../lib/depreciation'
import { TrendingDown, IndianRupee } from 'lucide-react'

export default function FinancialWaterfallChart({ purchaseValue = 0, depreciation = 0, maintCost = 0, netBookValue = 0 }) {
  const data = [
    { name: 'Purchase Cost', value: purchaseValue, fill: 'var(--accent)', type: 'initial' },
    { name: '(-) Depreciation', value: depreciation, fill: 'var(--status-warning)', type: 'deduction' },
    { name: '(-) Maintenance', value: maintCost, fill: 'var(--status-danger)', type: 'deduction' },
    { name: 'Net Asset Value', value: netBookValue, fill: '#059669', type: 'final' }
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    return (
      <div style={{ background: 'var(--bg-3)', color: 'var(--text-0)', padding: '8px 12px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div >{item.name}</div>
        <div style={{ color: item.fill }}>{formatCurrency(item.value)}</div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 20, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Financial Waterfall Ledger
          </h3>
          <p style={{ margin: 0, color: 'var(--text-2)' }}>Capital expenditure vs depreciation & repair deductions</p>
        </div>
        <IndianRupee size={18} color='var(--accent)' />
      </div>

      <div style={{ height: 220, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={(v) => `₹${(v/100000).toFixed(1)}L`} />
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


