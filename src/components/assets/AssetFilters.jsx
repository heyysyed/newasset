import React from 'react'
import { Search, Filter, Columns, Layers, Save } from 'lucide-react'

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
    <div className="card" style={{ marginBottom: 16, padding: 14 }}>
      {/* Saved Views Bar */}
      {(savedViews.length > 0 || searchQ || statusQ || categoryQ || siteQ) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>Saved Views:</span>
          {savedViews.map(v => (
            <button key={v.id} onClick={() => {
              const n = new URLSearchParams()
              if (v.filters.search) n.set('search', v.filters.search)
              if (v.filters.status) n.set('status', v.filters.status)
              if (v.filters.category) n.set('category', v.filters.category)
              if (v.filters.site) n.set('site', v.filters.site)
              setParams(n)
            }} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 20 }}>
              {v.name}
            </button>
          ))}
          {(searchQ || statusQ || categoryQ || siteQ) && (
            <button onClick={saveCurrentView} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: 20, color: 'var(--accent)', borderColor: 'var(--accent)' }}>
              <Save size={12} /> Save Current
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <form style={{ flex: 1, position: 'relative' }} onSubmit={e => { e.preventDefault(); setParam('search', localSearch) }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder="Search records…" className="inp" style={{ paddingLeft: 36 }} />
        </form>
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-ghost ${showFilters ? 'nav-active' : ''}`}>
          <Filter size={15} /> <span className="mobile-hide">Filters</span>
        </button>
        
        {/* Columns Dropdown */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowColDropdown(!showColDropdown)} className={`btn-ghost ${showColDropdown ? 'nav-active' : ''}`}>
            <Columns size={15} /> <span className="mobile-hide">Columns</span>
          </button>
          {showColDropdown && (
            <div style={{ position: 'absolute', top: '110%', right: 0, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, boxShadow: 'var(--clay-shadow)', zIndex: 100, minWidth: 200 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-2)' }}>Visible Columns</h4>
              {allColumns.map(c => (
                <label key={c.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={visibleCols.includes(c.k)} onChange={() => toggleColumn(c.k)} />
                  {c.l}
                </label>
              ))}
            </div>
          )}
        </div>


        <div style={{ position: 'relative' }} title="Group Assets">
          <Layers size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: groupingOption ? 'var(--accent)' : 'var(--text-3)', pointerEvents: 'none' }} />
          <select
            value={groupingOption}
            onChange={(e) => {
              setGroupingOption(e.target.value)
              setExpandedGroups(new Set())
            }}
            className="sel"
            style={{ paddingLeft: 32, paddingRight: 8, color: groupingOption ? 'var(--text-0)' : 'var(--text-3)', fontWeight: groupingOption ? 600 : 400, width: 'auto', cursor: 'pointer' }}
          >
            <option value="">Group</option>
            <option value="category">Category</option>
            <option value="site">Site</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div style={{ position: 'relative' }} title="Rows per page">
          <select
            value={pageSize}
            onChange={(e) => {
              if (setPageSize) setPageSize(Number(e.target.value))
              if (setPage) setPage(0)
              localStorage.setItem('assetpro_page_size', e.target.value)
            }}
            className="sel"
            style={{ color: 'var(--text-2)', paddingLeft: 12, paddingRight: 8, cursor: 'pointer', width: 'auto' }}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
          <div><label className="lbl">Status</label><select value={statusQ} onChange={e => setParam('status', e.target.value)} className="sel"><option value="">All</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="lbl">Category</label><select value={categoryQ} onChange={e => setParam('category', e.target.value)} className="sel"><option value="">All</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="lbl">Site</label><select value={siteQ} onChange={e => setParam('site', e.target.value)} className="sel"><option value="">All</option>{sites.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>
      )}
    </div>
  )
}
