import React, { useMemo } from 'react'
import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function DepreciationChart({ assets }) {
  const chartData = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 11 }, (_, i) => currentYear + i)
    
    return years.map(year => {
      let totalBV = 0
      let totalExpense = 0
      let categoryExpenses = {}

      assets.forEach(asset => {
        if (!asset.purchase_value || !asset.purchase_date) return
        
        const cost = parseFloat(asset.purchase_value)
        const life = parseInt(asset.useful_life_years) || 5
        const purYear = new Date(asset.purchase_date).getFullYear()
        
        if (isNaN(cost) || isNaN(purYear)) return

        const yearlyDep = cost / life
        const cat = asset.category || 'Other'

        // Annual Depreciation Expense for this specific year
        if (year >= purYear && year < purYear + life) {
           totalExpense += yearlyDep
           if (!categoryExpenses[cat]) categoryExpenses[cat] = 0
           categoryExpenses[cat] += yearlyDep
        }

        // Remaining Book Value at the end of the year
        if (year < purYear) {
          totalBV += cost
        } else if (year >= purYear + life) {
          totalBV += 0
        } else {
          const age = year - purYear + 1
          totalBV += (cost - (yearlyDep * age))
        }
      })
      
      return {
        year: year.toString(),
        BookValue: Math.max(0, Math.round(totalBV)) || 0,
        AnnualExpense: Math.max(0, Math.round(totalExpense)) || 0
      }
    })
  }, [assets])

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
  const formatLakhs = (val) => `₹${(val/100000).toFixed(1)}L`

  const summaryStats = useMemo(() => {
    let currentBV = 0
    let total10YrExpense = 0
    let peakYear = ''
    let peakExpense = 0

    chartData.forEach(d => {
      if (d.year === new Date().getFullYear().toString()) {
        currentBV = d.BookValue
      }
      total10YrExpense += d.AnnualExpense
      if (d.AnnualExpense > peakExpense) {
        peakExpense = d.AnnualExpense
        peakYear = d.year
      }
    })

    return { currentBV, total10YrExpense, peakYear, peakExpense }
  }, [chartData])

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '16px', borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.08)', minWidth: '220px' }}>
          <p style={{ margin: '0 0 12px', color: 'var(--text-1)', fontWeight: '700', fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Year: {label}</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>Total Book Value</span>
            <span style={{ color: 'var(--accent)', fontWeight: '700', fontFamily: 'monospace' }}>{formatCurrency(payload.find(p => p.dataKey === 'BookValue')?.value || 0)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--red)', fontSize: '0.85rem', fontWeight: '600' }}>Annual P&L Hit</span>
            <span style={{ color: 'var(--red)', fontWeight: '700', fontFamily: 'monospace' }}>-{formatCurrency(payload.find(p => p.dataKey === 'AnnualExpense')?.value || 0)}</span>
          </div>
        </div>
      )
    }
    return null
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="bg-bg-0 border border-border rounded-2xl p-8 min-h-[400px] flex items-center justify-center">
        <div className="text-center text-text-3">
          <p className="font-semibold text-text-1 m-0">No assets found</p>
          <p className="text-sm m-0">Add assets to view depreciation forecast</p>
        </div>
      </div>
    )
  }

  const hasFinancialData = assets.some(a => a.purchase_value && a.purchase_date)
  if (!hasFinancialData) {
    return (
      <div className="bg-bg-0 border border-border rounded-2xl p-8 min-h-[400px] flex items-center justify-center">
        <div className="text-center text-text-3">
          <p className="font-semibold text-text-1 m-0">Missing Financial Data</p>
          <p className="text-sm m-0">Add purchase value and date to your assets to view forecasting.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-bg-0 border border-border rounded-2xl p-6 min-h-[450px] flex flex-col shadow-sm">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-border/50 pb-6">
        <div>
          <h3 className="text-lg font-bold text-text-0 m-0">10-Year Depreciation & P&L Forecast</h3>
          <p className="text-xs text-text-2 m-0 mt-1.5 max-w-lg leading-relaxed">
            Projects aggregate Remaining Book Value against forecasted Annual Depreciation Expenses.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="bg-bg-1 border border-border px-4 py-2 rounded-xl flex flex-col">
            <span className="text-[10px] text-text-3 uppercase tracking-wider font-semibold">Current Book Value</span>
            <span className="text-sm font-bold text-accent font-mono mt-0.5">{formatCurrency(summaryStats.currentBV)}</span>
          </div>
          <div className="bg-bg-1 border border-border px-4 py-2 rounded-xl flex flex-col">
            <span className="text-[10px] text-text-3 uppercase tracking-wider font-semibold">10-Yr Total Expense</span>
            <span className="text-sm font-bold text-red font-mono mt-0.5">{formatCurrency(summaryStats.total10YrExpense)}</span>
          </div>
          {summaryStats.peakExpense > 0 && (
            <div className="bg-amber-dim border border-amber/30 px-4 py-2 rounded-xl flex flex-col">
              <span className="text-[10px] text-amber uppercase tracking-wider font-semibold">Peak Expense ({summaryStats.peakYear})</span>
              <span className="text-sm font-bold text-amber font-mono mt-0.5">{formatCurrency(summaryStats.peakExpense)}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 text-[11px] mb-4 pl-2 font-medium">
        <div className="flex items-center gap-2 text-text-1">
          <span className="w-3 h-3 rounded-sm bg-accent opacity-30 border border-accent"></span> 
          Remaining Book Value
        </div>
        <div className="flex items-center gap-2 text-text-1">
          <span className="w-3 h-3 rounded-sm bg-amber border border-amber"></span> 
          Annual P&L Expense
        </div>
      </div>

      <div className="w-full h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis 
              dataKey="year" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text-1)', fontSize: 13, fontWeight: 700 }} 
              dy={15} 
            />
            
            {/* Left Y-Axis for Book Value */}
            <YAxis 
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tickFormatter={formatLakhs} 
              tick={{ fill: 'var(--text-1)', fontSize: 12, fontWeight: 600 }} 
              dx={-10}
              domain={[0, 'dataMax * 1.05']}
            />
            
            {/* Right Y-Axis for Annual Expense */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tickFormatter={formatLakhs} 
              tick={{ fill: 'var(--text-1)', fontSize: 12, fontWeight: 600 }} 
              dx={10}
              domain={[0, 'dataMax * 1.25']}
            />
            
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-2)', opacity: 0.4 }} />
            
            {/* 1. Remaining Book Value Area (Drawn First so it's in the background) */}
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="BookValue" 
              stroke="var(--accent)" 
              strokeWidth={4} 
              fill="url(#colorValue)" 
              animationDuration={1500}
            />

            {/* 2. Annual Expense Bar (Drawn Second so they sit ON TOP of the area) */}
            <Bar 
              dataKey="AnnualExpense" 
              fill="var(--amber)" 
              yAxisId="right"
              radius={[4, 4, 0, 0]}
              barSize={36}
              opacity={0.95}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
