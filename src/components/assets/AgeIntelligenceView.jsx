import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { buildAsset360 } from '../../lib/intelligence/assetIntelligence'
import { formatCurrency } from '../../lib/depreciation'
import { Calendar, Package, IndianRupee, Clock, Activity, AlertTriangle, TrendingDown } from 'lucide-react'

export default function AgeIntelligenceView({ companyCode }) {
  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets_age_analytics', companyCode],
    queryFn: async () => {
      let q = supabase.from('assets').select('id, useful_life_years, purchase_date, purchase_value, salvage_value')
      if (companyCode) q = q.eq('company_code', companyCode)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })

  const analytics = useMemo(() => {
    if (!assets) return null
    
    const buckets = {
      new: { label: 'New & Early Life', count: 0, value: 0, color: 'var(--green)', desc: '< 25% Life Consumed' },
      active: { label: 'Active & Mature', count: 0, value: 0, color: 'var(--cyan)', desc: '25% - 75% Consumed' },
      aging: { label: 'Aging / Late Life', count: 0, value: 0, color: 'var(--amber)', desc: '75% - 100% Consumed' },
      eol: { label: 'End of Life (EOL)', count: 0, value: 0, color: 'var(--red)', desc: '> 100% Consumed' },
    }

    let totalValue = 0
    let totalAge = 0
    let totalPct = 0
    let pctCount = 0

    assets.forEach(asset => {
      const intel = buildAsset360(asset, { tickets: [], logs: [] }, { hasFinancialAccess: true })
      const pct = intel.age.data.lifeConsumedPct
      const age = intel.age.data.ageInYears || 0
      const val = Number(asset.purchase_value) || 0
      
      totalValue += val
      totalAge += age

      if (pct !== null && pct !== undefined) {
         totalPct += pct
         pctCount++
         
         if (pct < 25) { buckets.new.count++; buckets.new.value += val; }
         else if (pct < 75) { buckets.active.count++; buckets.active.value += val; }
         else if (pct < 100) { buckets.aging.count++; buckets.aging.value += val; }
         else { buckets.eol.count++; buckets.eol.value += val; }
      } else {
         // Fallback chronologically if useful life isn't defined
         if (age < 2) { buckets.new.count++; buckets.new.value += val; }
         else if (age < 6) { buckets.active.count++; buckets.active.value += val; }
         else if (age < 10) { buckets.aging.count++; buckets.aging.value += val; }
         else { buckets.eol.count++; buckets.eol.value += val; }
      }
    })

    const avgAge = assets.length > 0 ? (totalAge / assets.length).toFixed(1) : 0
    const avgPct = pctCount > 0 ? Math.round(totalPct / pctCount) : null

    return { buckets, totalValue, avgAge, avgPct, totalCount: assets.length }
  }, [assets])

  if (isLoading) {
    return <div className="h-32 bg-bg-1 border border-border rounded-xl animate-pulse mb-6" />
  }

  if (!analytics || analytics.totalCount === 0) return null

  return (
    <div className="bg-bg-0 border border-border rounded-2xl shadow-sm mb-6 overflow-hidden flex flex-col md:flex-row animate-fade-in">
      {/* 1. Summary Column */}
      <div className="p-6 md:w-[320px] shrink-0 border-b md:border-b-0 md:border-r border-border bg-[var(--bg-1)] flex flex-col">
        <h3 className="text-base font-bold text-text-0 mb-2 flex items-center gap-2">
          <Calendar size={18} style={{ color: 'var(--accent)' }} /> Fleet Age Intelligence
        </h3>
        <p className="text-[12px] text-text-2 mb-6 leading-relaxed">
          Dynamic lifecycle categorization based on consumed useful life, aiding CapEx forecasting.
        </p>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-bg-0 p-3 rounded-xl border border-border/60 shadow-sm">
            <div className="text-[10px] text-text-3 uppercase tracking-wider font-semibold mb-1">Tracked Assets</div>
            <div className="text-lg font-bold text-text-0 flex items-center gap-1.5">
              <Package size={14} className="text-accent" /> {analytics.totalCount}
            </div>
          </div>
          <div className="bg-bg-0 p-3 rounded-xl border border-border/60 shadow-sm">
            <div className="text-[10px] text-text-3 uppercase tracking-wider font-semibold mb-1">Capital At Risk</div>
            <div className="text-lg font-bold text-text-0 flex items-center gap-1.5">
              <TrendingDown size={14} className="text-red" /> {formatCurrency(analytics.buckets.eol.value)}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-border/60 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-wider font-semibold mb-1">Average Age</div>
            <div className="text-sm font-semibold text-text-1 flex items-center gap-1"><Clock size={12}/> {analytics.avgAge} Yrs</div>
          </div>
          {analytics.avgPct !== null && (
             <div className="text-right">
              <div className="text-[10px] text-text-3 uppercase tracking-wider font-semibold mb-1">Avg Consumed</div>
              <div className="text-sm font-semibold flex items-center gap-1 justify-end" style={{ color: analytics.avgPct > 75 ? 'var(--red)' : 'var(--amber)' }}>
                <Activity size={12}/> {analytics.avgPct}%
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 2. Distribution Column */}
      <div className="p-6 flex-1 flex flex-col justify-center gap-8">
        
        {/* Horizontal Pipeline Bar */}
        <div className="w-full">
          <div className="flex justify-between items-end mb-3">
            <span className="text-[11px] uppercase tracking-wider text-text-2 font-bold">Lifecycle Distribution Curve</span>
            <span className="text-[11px] text-text-3">{analytics.totalCount} Evaluated</span>
          </div>
          <div className="w-full h-5 rounded-full flex overflow-hidden bg-bg-2 shadow-inner border border-border/50">
            {Object.values(analytics.buckets).map((b, i) => {
              if (b.count === 0) return null;
              const widthPct = (b.count / analytics.totalCount) * 100;
              return (
                <div 
                  key={i} 
                  style={{ width: `${widthPct}%`, backgroundColor: b.color }} 
                  className="h-full transition-all duration-700 hover:brightness-110 flex items-center justify-center overflow-hidden"
                  title={`${b.label}: ${b.count} assets (${widthPct.toFixed(1)}%)`}
                >
                  {widthPct > 10 && <span className="text-[10px] text-white font-bold mix-blend-overlay">{Math.round(widthPct)}%</span>}
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Enhanced Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(analytics.buckets).map((b, i) => {
            const pct = analytics.totalCount > 0 ? ((b.count / analytics.totalCount) * 100).toFixed(1) : 0;
            return (
              <div key={i} className="p-4 bg-bg-1 rounded-xl border border-border flex flex-col relative overflow-hidden group shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-[var(--text-3)]">
                <div 
                  className="absolute top-0 left-0 w-full h-[4px]" 
                  style={{ backgroundColor: b.color }}
                />
                <div 
                  className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-[0.03]" 
                  style={{ backgroundColor: b.color }}
                />
                <div className="flex justify-between items-start mb-2 mt-1">
                   <div className="text-[11px] uppercase tracking-wider text-text-2 font-bold">{b.label}</div>
                   <div className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-bg-2 text-text-3">{pct}%</div>
                </div>
                
                <div className="text-[10px] text-text-3 mb-2 font-medium">{b.desc}</div>
                
                <div className="text-2xl font-bold mb-1 font-mono" style={{ color: b.count > 0 ? 'var(--text-0)' : 'var(--text-3)' }}>{b.count}</div>
                
                <div className="text-[11px] text-text-3 mt-auto pt-3 border-t border-border/60 flex justify-between items-center">
                  <span>Exposure</span>
                  <span className="font-mono font-medium text-text-2">{formatCurrency(b.value)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
