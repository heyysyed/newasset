import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { buildAsset360 } from '../../lib/intelligence/assetIntelligence'
import { formatCurrency } from '../../lib/depreciation'
import { Calendar, Package, IndianRupee } from 'lucide-react'

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
      new: { label: '< 1 Year', count: 0, value: 0, color: '#3b82f6' },
      mid: { label: '1 - 3 Years', count: 0, value: 0, color: '#10b981' },
      old: { label: '3 - 5 Years', count: 0, value: 0, color: 'var(--status-warning)' },
      eol: { label: '> 5 Years (EOL)', count: 0, value: 0, color: 'var(--status-danger)' },
    }

    let totalValue = 0

    assets.forEach(asset => {
      const intel = buildAsset360(asset, { tickets: [], logs: [] }, { hasFinancialAccess: true })
      const age = intel.age.data.ageYears
      const val = Number(asset.purchase_value) || 0
      
      totalValue += val

      if (age < 1) {
        buckets.new.count++
        buckets.new.value += val
      } else if (age <= 3) {
        buckets.mid.count++
        buckets.mid.value += val
      } else if (age <= 5) {
        buckets.old.count++
        buckets.old.value += val
      } else {
        buckets.eol.count++
        buckets.eol.value += val
      }
    })

    const chartData = [
      { name: buckets.new.label, value: buckets.new.count, color: buckets.new.color },
      { name: buckets.mid.label, value: buckets.mid.count, color: buckets.mid.color },
      { name: buckets.old.label, value: buckets.old.count, color: buckets.old.color },
      { name: buckets.eol.label, value: buckets.eol.count, color: buckets.eol.color },
    ].filter(d => d.value > 0)

    return { buckets, totalValue, chartData, totalCount: assets.length }
  }, [assets])

  if (isLoading) {
    return <div className="h-24 bg-bg-1 border border-border rounded-xl animate-pulse mb-4" />
  }

  if (!analytics || analytics.totalCount === 0) return null

  return (
    <div className="bg-bg-0 border border-border rounded-xl shadow-sm mb-4 overflow-hidden flex flex-col md:flex-row animate-fade-in">
      <div className="p-4 md:w-1/3 border-b md:border-b-0 md:border-r border-border bg-bg-1 flex flex-col justify-center">
        <h3 className="text-small text-text-0 mb-1 flex items-center gap-1.5">
          <Calendar size={16} className="text-purple-500" /> Fleet Age Intelligence
        </h3>
        <p className="text-caption text-text-3 mb-4 leading-relaxed">
          Provides portfolio-wide visibility into asset lifecycle maturity to aid replacement CapEx planning.
        </p>
        <div className="flex gap-4">
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-wider">Tracked Assets</div>
            <div className="text-section-title text-text-0 flex items-center gap-1.5 mt-0.5">
              <Package size={16} className="text-accent" /> {analytics.totalCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-3 uppercase tracking-wider">Total Evaluated</div>
            <div className="text-section-title text-text-0 flex items-center gap-1.5 mt-0.5">
              <IndianRupee size={16} className="text-green" /> {formatCurrency(analytics.totalValue)}
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-5 md:w-2/3 flex flex-col justify-center gap-6">
        
        {/* Horizontal Pipeline Bar */}
        <div className="w-full">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] uppercase tracking-wider text-text-3 font-semibold">Lifecycle Distribution</span>
          </div>
          <div className="w-full h-4 rounded-full flex overflow-hidden bg-bg-3 shadow-inner">
            {Object.values(analytics.buckets).map((b, i) => {
              if (b.count === 0) return null;
              const widthPct = (b.count / analytics.totalCount) * 100;
              return (
                <div 
                  key={i} 
                  style={{ width: `${widthPct}%`, backgroundColor: b.color }} 
                  className="h-full transition-all duration-700 hover:brightness-110"
                  title={`${b.label}: ${b.count} assets (${widthPct.toFixed(1)}%)`}
                />
              )
            })}
          </div>
        </div>
        
        {/* Enhanced Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.values(analytics.buckets).map((b, i) => (
            <div key={i} className="p-3 bg-bg-0 rounded-lg border border-border flex flex-col relative overflow-hidden group shadow-sm transition-shadow hover:shadow-md">
              <div 
                className="absolute top-0 left-0 w-full h-[3px]" 
                style={{ backgroundColor: b.color }}
              />
              <div 
                className="absolute inset-0 opacity-[0.02] transition-opacity group-hover:opacity-[0.06]" 
                style={{ backgroundColor: b.color }}
              />
              <div className="text-[11px] uppercase tracking-wider text-text-2 mb-1.5 mt-1 font-semibold">{b.label}</div>
              <div className="text-page-title text-text-0 mb-1" style={{ color: b.count > 0 ? 'var(--text-0)' : 'var(--text-3)' }}>{b.count}</div>
              <div className="text-[10px] text-text-3 mt-auto pt-2 border-t border-border/40">
                Value: <span className="font-mono text-text-2">{formatCurrency(b.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


