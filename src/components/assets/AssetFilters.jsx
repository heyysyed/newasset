import React from 'react'
import { Search, Filter, Columns, Layers, Save } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export default function AssetFilters({
  searchQ, statusQ, categoryQ, siteQ, 
  localSearch, setLocalSearch, setParam,
  showFilters, setShowFilters, 
  showColDropdown, setShowColDropdown, 
  visibleCols, toggleColumn, allColumns, 
  groupingOption, setGroupingOption, setExpandedGroups,
  STATUSES, categories, sites,
  savedViews, saveCurrentView, setParams,
  pageSize, setPageSize, setPage
}) {
  return (
    <div className="bg-bg-0 border border-border shadow-sm rounded-lg mb-4 p-4">
      {/* Saved Views Bar */}
      {(savedViews.length > 0 || searchQ || statusQ || categoryQ || siteQ) && (
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <span className="text-caption text-text-3 uppercase">Saved Views:</span>
          {savedViews.map(v => (
            <button key={v.id} onClick={() => {
              const n = new URLSearchParams()
              if (v.filters.search) n.set('search', v.filters.search)
              if (v.filters.status) n.set('status', v.filters.status)
              if (v.filters.category) n.set('category', v.filters.category)
              if (v.filters.site) n.set('site', v.filters.site)
              setParams(n)
            }} className="px-3 py-1 text-caption bg-bg-2 hover:bg-bg-3 border border-border rounded-full text-text-1 transition-colors">
              {v.name}
            </button>
          ))}
          {(searchQ || statusQ || categoryQ || siteQ) && (
            <button onClick={saveCurrentView} className="px-3 py-1 text-caption bg-accent-subtle text-accent hover:bg-accent hover:text-white border border-accent/20 rounded-full transition-colors flex items-center gap-1 ml-auto">
              <Save size={12} /> Save Current
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <form className="flex-1 relative" onSubmit={e => { e.preventDefault(); setParam('search', localSearch) }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 pointer-events-none" />
          <input 
            value={localSearch} 
            onChange={e => setLocalSearch(e.target.value)} 
            placeholder="Search assets by name, code, make..." 
            className="w-full h-[36px] pl-9 pr-3 bg-bg-0 border border-border rounded-md text-small text-text-0 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all" 
          />
        </form>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={showFilters ? 'primary' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)} icon={Filter}>
            Filters
          </Button>
          
          <div className="relative">
            <Button variant={showColDropdown ? 'primary' : 'outline'} size="sm" onClick={() => setShowColDropdown(!showColDropdown)} icon={Columns}>
              Columns
            </Button>
            {showColDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-bg-0 border border-border rounded-lg p-3 shadow-lg z-50 min-w-[200px]">
                <h4 className="m-0 mb-2 text-caption uppercase text-text-3">Visible Columns</h4>
                <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                  {allColumns.map(c => (
                    <label key={c.k} className="flex items-center gap-2 p-1.5 hover:bg-bg-1 rounded cursor-pointer text-small text-text-1">
                      <input type="checkbox" className="rounded border-border text-accent focus:ring-accent" checked={visibleCols.includes(c.k)} onChange={() => toggleColumn(c.k)} />
                      {c.l}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative group">
            <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3 group-hover:text-accent pointer-events-none transition-colors" />
            <select
              value={groupingOption}
              onChange={(e) => {
                setGroupingOption(e.target.value)
                setExpandedGroups(new Set())
              }}
              className="h-[36px] pl-8 pr-8 bg-bg-0 border border-border rounded-md text-small text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all appearance-none cursor-pointer"
            >
              <option value="">No Grouping</option>
              <option value="category">Category</option>
              <option value="site">Site</option>
              <option value="status">Status</option>
            </select>
          </div>
          
          <select
            value={pageSize}
            onChange={(e) => {
              if (setPageSize) setPageSize(Number(e.target.value))
              if (setPage) setPage(0)
              localStorage.setItem('assetpro_page_size', e.target.value)
            }}
            className="h-[36px] px-3 bg-bg-0 border border-border rounded-md text-small text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all cursor-pointer"
          >
            <option value={10}>10 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={500}>500 / page</option>
            <option value={1000000}>All items</option>
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border animate-fade-in">
          <div>
            <label className="block text-caption text-text-2 mb-1 uppercase tracking-wide">Status</label>
            <select value={statusQ} onChange={e => setParam('status', e.target.value)} className="w-full h-[36px] px-3 bg-bg-0 border border-border rounded-md text-small focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-caption text-text-2 mb-1 uppercase tracking-wide">Category</label>
            <select value={categoryQ} onChange={e => setParam('category', e.target.value)} className="w-full h-[36px] px-3 bg-bg-0 border border-border rounded-md text-small focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-caption text-text-2 mb-1 uppercase tracking-wide">Site / Project</label>
            <select value={siteQ} onChange={e => setParam('site', e.target.value)} className="w-full h-[36px] px-3 bg-bg-0 border border-border rounded-md text-small focus:border-accent focus:ring-2 focus:ring-accent/20">
              <option value="">All Sites</option>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
