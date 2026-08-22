import React, { useState, useEffect } from 'react'
import { Filter, X, ChevronDown, Calendar, Building2, LayoutGrid, CheckCircle2 } from 'lucide-react'

export default function GlobalReportFilters({ filters, setFilters, sites, categories }) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Local state for debouncing
  const [localFilters, setLocalFilters] = useState(filters)

  // Sync when external filters change
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const handleApply = () => {
    setFilters(localFilters)
    setIsOpen(false)
  }

  const handleClear = () => {
    const cleared = { site: 'All', category: 'All', status: 'All', dateRange: 'Last 90 Days' }
    setLocalFilters(cleared)
    setFilters(cleared)
    setIsOpen(false)
  }

  const activeCount = Object.values(filters).filter(v => v !== 'All' && v !== 'All Time').length

  const activeChips = Object.entries(filters).filter(([k, v]) => v !== 'All' && v !== 'All Time')

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
            <Filter size={16} />
            <span style={{ letterSpacing: '0.04em' }}>GLOBAL CONTEXT</span>
          </div>
          
          {activeChips.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {activeChips.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--accent-glow)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 20, color: 'var(--accent)', }}>
                  <span style={{ opacity: 0.7, textTransform: 'uppercase' }}>{k}:</span> {v}
                  <X 
                    size={12} 
                    style={{ cursor: 'pointer', opacity: 0.7 }} 
                    onClick={() => {
                      const updated = { ...filters, [k]: k === 'dateRange' ? 'All Time' : 'All' }
                      setLocalFilters(updated)
                      setFilters(updated)
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No active filters</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {activeCount > 0 && (
            <button onClick={handleClear} className="btn-ghost" style={{ padding: '6px 12px', borderRadius: 8 }}>
              Clear
            </button>
          )}
          <button onClick={() => setIsOpen(!isOpen)} className="btn-secondary" style={{ padding: '6px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isOpen ? 'Close Filters' : 'Edit Filters'} <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {/* Site Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Building2 size={12} /> SITE / LOCATION
            </label>
            <select
              value={localFilters.site}
              onChange={e => setLocalFilters({ ...localFilters, site: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
            >
              <option value="All">All Enterprise Sites</option>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <LayoutGrid size={12} /> ASSET CATEGORY
            </label>
            <select
              value={localFilters.category}
              onChange={e => setLocalFilters({ ...localFilters, category: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle2 size={12} /> ASSET STATUS
            </label>
            <select
              value={localFilters.status}
              onChange={e => setLocalFilters({ ...localFilters, status: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Under Repair">Under Repair</option>
              <option value="In Transit">In Transit</option>
              <option value="Idle">Idle</option>
              <option value="Disposed">Disposed</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} /> REPORTING PERIOD
            </label>
            <select
              value={localFilters.dateRange}
              onChange={e => setLocalFilters({ ...localFilters, dateRange: e.target.value })}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
            >
              <option value="All Time">All Time</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Last 90 Days">Last 90 Days</option>
              <option value="Last 12 Months">Last 12 Months</option>
              <option value="YTD">Year to Date (YTD)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gridColumn: '1 / -1' }}>
            <button onClick={handleApply} className="btn-primary" style={{ padding: '8px 20px', borderRadius: 8, }}>
              Apply Global Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
