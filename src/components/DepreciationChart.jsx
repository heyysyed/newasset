import React, { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { calculateBookValue } from '../lib/depreciation'

export default function DepreciationChart({ assets }) {
  // We calculate the aggregated sum of Book Values over the next 10 years.
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 11 }, (_, i) => currentYear + i)
    
    return years.map(year => {
      // Calculate total BV if the current year were 'year'
      let totalBV = 0
      assets.forEach(asset => {
        if (!asset.purchase_value || !asset.purchase_date) return
        
        const cost = parseFloat(asset.purchase_value)
        const life = parseInt(asset.useful_life_years) || 5
        const purYear = new Date(asset.purchase_date).getFullYear()
        
        if (isNaN(cost) || isNaN(purYear)) return

        // Age at 'year'
        const age = year - purYear
        
        if (age < 0) {
          // Hasn't been purchased yet (if forecasting future purchases)
          totalBV += cost
        } else if (age >= life) {
          // Fully depreciated
          totalBV += 0
        } else {
          // Straight line depreciation
          const yearlyDep = cost / life
          totalBV += (cost - (yearlyDep * age))
        }
      })
      
      return {
        year: year.toString(),
        Value: Math.max(0, Math.round(totalBV)) || 0
      }
    })
  }, [assets])

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 12, boxShadow: 'var(--clay-shadow)' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--text-1)' }}>Year: {label}</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '1.2rem', color: 'var(--accent)' }}>
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card" style={{ padding: '24px', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontFamily: 'Oswald', fontSize: '1.3rem', color: 'var(--text-0)' }}>10-YEAR DEPRECIATION FORECAST</h3>
        <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: '0.85rem' }}>
          Projected aggregate book value of currently filtered assets over the next decade (straight-line method).
        </p>
      </div>
      
      <div style={{ width: '100%', height: 350 }}>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f7eff" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#4f7eff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tickFormatter={(val) => `₹${(val/100000).toFixed(1)}L`} 
              tick={{ fill: '#64748b', fontSize: 12 }} 
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="Value" 
              stroke="#4f7eff" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
