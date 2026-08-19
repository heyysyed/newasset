import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Edit2, Eye, Copy, Trash2, Clock, Check, X, ChevronDown, ChevronRight, ChevronLeft, MapPin, PackageX } from 'lucide-react'
import EmptyState from '../EmptyState'
import { fetchSites } from '../../lib/supabase'
import { resolveSite } from '../../lib/siteResolver'

export default function AssetTable({
  assets, loading, selected, toggleSelect, toggleAll, columns, 
  toggleSort, sortCol, sortDir, sorted, navigate, can, isAdmin, 
  setInlineEdit, inlineEdit, handleInlineSave, STATUSES, sites, STATUS_BADGE, 
  calculateBookValue, formatCurrency, setCloneAsset, handleDelete, deleting, 
  setShowHistoryAsset, groupedAssets, expandedGroups, toggleGroupExpanded, 
  handleGroupSelectAll, totalPages, page, setPage, totalCount, pageSize, setPageSize,
  setAssignGroupAssets, setAssignGroupTab, setAssignGroupSearch, 
  setAssignGroupSelected, setAssignGroupNewName, setShowAssignGroup
}) {
  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: .25 }}>↕</span>
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }
  
  const ChevronUp = ({ size, style }) => <svg width={size} height={size} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>

  const [masterSitesList, setMasterSitesList] = useState([])
  useEffect(() => {
    fetchSites().then(data => setMasterSitesList(data || [])).catch(console.error)
  }, [])

  const siteMap = useMemo(() => {
    const map = new Map()
    if (!masterSitesList || !masterSitesList.length) return map
    masterSitesList.forEach(s => {
      if (s.name) map.set(s.name.toUpperCase(), s)
      if (s.site_code) map.set(s.site_code.toUpperCase(), s)
      if (Array.isArray(s.aliases)) {
        s.aliases.forEach(a => {
          if (a) map.set(String(a).toUpperCase(), s)
        })
      }
    })
    return map
  }, [masterSitesList])

  const getResolvedSite = useCallback((siteVal) => {
    if (!siteVal || siteVal === '—') return null
    const upper = String(siteVal).trim().toUpperCase()
    if (siteMap.has(upper)) return siteMap.get(upper)
    const res = resolveSite(siteVal, masterSitesList)
    return res.matched ? res.site : null
  }, [siteMap, masterSitesList])

  const renderAssetRow = (asset) => (
    <tr key={asset.id} onClick={() => navigate(`/assets/${asset.id}`)} style={{ cursor: 'pointer' }}>
      {(isAdmin || can('delete')) && <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(asset.id)} onChange={() => toggleSelect(asset.id)} /></td>}
      {columns.map(col => (
        <td key={col.k} onClick={e => { if ((col.k === 'status' || col.k === 'site') && can('edit')) { e.stopPropagation(); setInlineEdit({ id: asset.id, field: col.k, value: asset[col.k] || '' }) } }}>
          {inlineEdit && inlineEdit.id === asset.id && inlineEdit.field === col.k ? (
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
              <select className="sel" value={inlineEdit.value} onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                style={{ height: 28, fontSize: '0.72rem', padding: '0 6px' }}>
                {col.k === 'status' ? STATUSES.map(s => <option key={s} value={s}>{s}</option>) : sites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleInlineSave} style={{ background: 'var(--green)', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}><Check size={11} /></button>
              <button onClick={() => setInlineEdit(null)} style={{ background: 'var(--bg-3)', color: 'var(--text-3)', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}><X size={11} /></button>
            </div>
          ) : col.k === 'status' ? (
            <span className={`badge ${STATUS_BADGE[asset.status] || 'badge-inactive'}`}>{asset.status}</span>
          ) : col.k === 'purchase_value' ? (
            <span className="font-mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(calculateBookValue(asset))}</span>
          ) : col.k === 'asset_code' ? (
            <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 500 }}>{asset[col.k]}</span>
          ) : col.k === 'condition' ? (
            <span style={{
              fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6, fontWeight: 700,
              background: ['Operational', 'Good', 'Excellent'].includes(asset.condition) ? 'rgba(34,197,94,0.1)' : ['Damaged', 'Fair'].includes(asset.condition) ? 'rgba(245,158,11,0.1)' : ['Needs Repair', 'Under Repair'].includes(asset.condition) ? 'rgba(6,182,212,0.1)' : ['Non-Functional', 'Poor', 'Critical'].includes(asset.condition) ? 'rgba(239,68,68,0.1)' : 'rgba(100,116,139,0.1)',
              color: ['Operational', 'Good', 'Excellent'].includes(asset.condition) ? '#059669' : ['Damaged', 'Fair'].includes(asset.condition) ? '#d97706' : ['Needs Repair', 'Under Repair'].includes(asset.condition) ? '#0891b2' : ['Non-Functional', 'Poor', 'Critical'].includes(asset.condition) ? '#dc2626' : '#64748b'
            }}>
              {asset.condition || '—'}
            </span>
          ) : col.k === 'site' ? (
            (() => {
              const siteVal = asset.site || '—'
              if (siteVal === '—') return siteVal
              const resolved = getResolvedSite(siteVal)
              if (resolved && resolved.site_code) {
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, background: 'rgba(59,130,246,0.12)', color: '#2563eb', padding: '1px 6px', borderRadius: 4, fontSize: '0.72rem', border: '1px solid rgba(59,130,246,0.25)' }}>
                      [{resolved.site_code}]
                    </span>
                    <span>{resolved.name}</span>
                  </span>
                )
              }
              return siteVal
            })()
          ) : (
            asset[col.k] || '—'
          )}
        </td>
      ))}
      <td onClick={e => e.stopPropagation()} style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Link to={`/assets/${asset.id}`} className="btn-ghost btn-icon btn-sm" title="View"><Eye size={14} /></Link>
          {can('edit') && <Link to={`/assets/${asset.id}/edit`} className="btn-ghost btn-icon btn-sm" title="Edit"><Edit2 size={14} /></Link>}
          <button onClick={(e) => { e.stopPropagation(); setShowHistoryAsset(asset.id); }} className="btn-ghost btn-icon btn-sm" title="History Timeline"><Clock size={14} /></button>
          {can('add') && <button onClick={(e) => { e.stopPropagation(); setCloneAsset(asset); }} className="btn-ghost btn-icon btn-sm" title="Clone"><Copy size={14} /></button>}
          {isAdmin && <button onClick={(e) => { e.stopPropagation(); handleDelete([asset.id]); }} className="btn-ghost btn-icon btn-sm" style={{ color: 'var(--red)' }} title="Delete"><Trash2 size={14} /></button>}
        </div>
      </td>
    </tr>
  )



  return (
    <>
      {/* Desktop Table */}
      <div className="card desktop-table" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="tbl" style={{ minWidth: 500 }}>
            <thead>
              <tr>
                {(isAdmin || can('delete')) && <th style={{ width: 40 }}><input type="checkbox" checked={selected.size === assets.length && assets.length > 0} onChange={toggleAll} /></th>}
                {columns.map(col => <th key={col.k} onClick={() => toggleSort(col.k)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}><div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{col.l} <SortIcon col={col.k} /></div></th>)}
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(5)].map((_, i) => <tr key={i}><td colSpan={12}><div className="skeleton" style={{ height: 24, margin: '4px 0' }} /></td></tr>)}
              
              {!loading && !groupedAssets && sorted.map(renderAssetRow)}

              {!loading && groupedAssets && groupedAssets.map(group => {
                const isGroupExpanded = expandedGroups.has(group.key)
                const groupAssets = group.subgroupsArray.flatMap(sg => sg.assets)
                const allGroupSelected = group.totalAssets > 0 && groupAssets.every(a => selected.has(a.id))
                
                return (
                  <React.Fragment key={group.key}>
                    <tr style={{ background: 'var(--bg-1)' }}>
                      {(isAdmin || can('delete')) && (
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={allGroupSelected} onChange={() => handleGroupSelectAll(groupAssets)} />
                        </td>
                      )}
                      <td colSpan={columns.length + 1} style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }} onClick={() => toggleGroupExpanded(group.key)}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {isGroupExpanded ? <ChevronDown size={16} color="var(--accent)" /> : <ChevronRight size={16} color="var(--accent)" />}
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-0)', textTransform: 'uppercase' }}>
                              {group.key}
                            </span>
                            <span style={{ background: 'var(--accent)', color: 'white', fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 12 }}>
                              {group.subgroupsArray.length}
                            </span>
                            <span style={{ color: 'var(--text-3)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {group.subgroupsArray.length} types <span style={{ opacity: 0.5 }}>|</span> Active: {group.activeCount}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-2)' }}>PV: <span style={{ fontWeight: 600, color: 'var(--text-0)' }}>{formatCurrency(group.pv)}</span></span>
                            <span style={{ color: 'var(--text-2)' }}>BV: <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(group.bv)}</span></span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    {isGroupExpanded && group.subgroupsArray.map(subgroup => {
                        const subKey = `${group.key}::${subgroup.key}`
                        const isSubExpanded = expandedGroups.has(subKey)
                        const allSubSelected = subgroup.assets.length > 0 && subgroup.assets.every(a => selected.has(a.id))
                        
                        return (
                          <React.Fragment key={subKey}>
                            <tr style={{ background: 'var(--bg-1)' }}>
                              {(isAdmin || can('delete')) && (
                                <td onClick={e => e.stopPropagation()}>
                                  <input type="checkbox" checked={allSubSelected} onChange={() => handleGroupSelectAll(subgroup.assets)} />
                                </td>
                              )}
                              <td colSpan={columns.length + 1} style={{ padding: '6px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }} onClick={() => toggleGroupExpanded(subKey)}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingLeft: 20 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {isSubExpanded ? <ChevronDown size={14} color="var(--text-2)" /> : <ChevronRight size={14} color="var(--text-2)" />}
                                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-0)' }}>
                                      {subgroup.key}
                                    </span>
                                    {subgroup.assets.length > 1 && (
                                      <span style={{ background: 'var(--accent-glow)', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 12, textTransform: 'uppercase' }}>
                                        GROUPED
                                      </span>
                                    )}
                                    <span style={{ background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-1)' }}>
                                      {subgroup.assets.length} {subgroup.assets.length === 1 ? 'entry' : 'entries'}
                                    </span>
                                    <span style={{ color: 'var(--text-3)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                      Qty: {subgroup.quantitySum} <span style={{ opacity: 0.5 }}>|</span> Active: {subgroup.activeCount}
                                    </span>
                                    <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '2px 8px', minHeight: 'unset', borderRadius: 12, border: '1px solid var(--border)' }} onClick={(e) => { 
                                      e.stopPropagation()
                                      setAssignGroupAssets(subgroup.assets)
                                      setAssignGroupTab('existing')
                                      setAssignGroupSearch('')
                                      setAssignGroupSelected(subgroup.key)
                                      setAssignGroupNewName('')
                                      setShowAssignGroup(true)
                                    }}>
                                      <Edit2 size={12} style={{ marginRight: 4 }} /> Group
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.75rem' }}>
                                    <span style={{ color: 'var(--text-2)' }}>BV: <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(subgroup.bv)}</span></span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            {isSubExpanded && subgroup.assets.map(renderAssetRow)}
                          </React.Fragment>
                        )
                    })}
                  </React.Fragment>
                )
              })}
              
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: 40 }}>
                    <EmptyState 
                      icon={PackageX} 
                      title="No assets found" 
                      message="Try adjusting your filters or search query to find what you're looking for." 
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(totalPages > 1 || totalCount > 10) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {totalPages > 1 && (
              <>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-ghost" style={{ padding: '6px 10px' }}><ChevronLeft size={14} /></button>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let p
                    if (totalPages <= 7) p = i
                    else if (page < 4) p = i
                    else if (page > totalPages - 5) p = totalPages - 7 + i
                    else p = page - 3 + i
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        style={{
                          width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
                          fontFamily: 'DM Mono', fontSize: '0.78rem', fontWeight: page === p ? 700 : 500,
                          background: page === p ? 'var(--accent)' : 'var(--bg-3)',
                          color: page === p ? 'white' : 'var(--text-2)',
                        }}>
                        {p + 1}
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-ghost" style={{ padding: '6px 10px' }}><ChevronRight size={14} /></button>
              </>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: totalPages > 1 ? 16 : 0 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>{totalCount} total</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value))
                  setPage(0)
                  localStorage.setItem('assetpro_page_size', e.target.value)
                }}
                className="sel"
                style={{ padding: '2px 8px', fontSize: '0.75rem', height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-1)', cursor: 'pointer', outline: 'none' }}
              >
                <option value={10}>10 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={500}>500 / page</option>
                <option value={1000000}>All items</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card List */}
      <div className="card mobile-cards" style={{ overflow: 'hidden' }}>
        {loading && [...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 88, margin: '8px 12px', borderRadius: 12 }} />)}
        {!loading && sorted.map(asset => (
          <div key={asset.id} className="asset-card-mobile" onClick={() => navigate(`/assets/${asset.id}`)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>{asset.asset_code || '—'}</span>
              <span className={`badge ${STATUS_BADGE[asset.status] || 'badge-inactive'}`}>{asset.status}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-0)', marginBottom: 6, lineHeight: 1.3 }}>{asset.asset_name || '—'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {asset.make && (
                <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-2)', fontWeight: 500, fontFamily: 'DM Sans' }}>{asset.make}</span>
              )}
              {asset.site && (
                <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-2)', fontWeight: 500, fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={9} />{asset.site}
                </span>
              )}
              {asset.condition && (
                <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, background: asset.condition === 'Good' ? 'rgba(34,197,94,0.1)' : asset.condition === 'Poor' ? 'rgba(239,68,68,0.1)' : 'var(--bg-3)', color: asset.condition === 'Good' ? 'var(--green)' : asset.condition === 'Poor' ? 'var(--red)' : 'var(--text-2)', fontWeight: 600, fontFamily: 'DM Sans' }}>{asset.condition}</span>
              )}
              {asset.category && (
                <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, background: 'var(--accent-glow)', color: 'var(--accent)', fontWeight: 500, fontFamily: 'DM Sans' }}>{asset.category}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
              <Link to={`/assets/${asset.id}`} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.75rem', flex: 1, justifyContent: 'center', minWidth: 0 }}><Eye size={12} /> View</Link>
              {can('edit') && <Link to={`/assets/${asset.id}/edit`} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.75rem', flex: 1, justifyContent: 'center', minWidth: 0 }}><Edit2 size={12} /> Edit</Link>}
              <button onClick={() => setShowHistoryAsset(asset.id)} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.75rem', flex: 1, justifyContent: 'center', minWidth: 0 }}><Clock size={12} /> History</button>
              {can('add') && <button onClick={() => setCloneAsset(asset)} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.75rem', flex: 1, justifyContent: 'center', minWidth: 0 }}><Copy size={12} /> Clone</button>}
              {isAdmin && <button onClick={() => handleDelete([asset.id])} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.75rem', flex: 1, justifyContent: 'center', minWidth: 0, color: 'var(--red)', borderColor: 'rgba(239,68,68,0.2)' }}><Trash2 size={12} /> Delete</button>}
            </div>
          </div>
        ))}
        {!loading && sorted.length === 0 && (
          <div style={{ padding: 20 }}>
            <EmptyState 
              icon={PackageX} 
              title="No assets found" 
              message="Try adjusting your filters or search query to find what you're looking for." 
            />
          </div>
        )}
        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: 16 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-ghost" style={{ padding: '8px 16px' }}>← Prev</button>
            <span style={{ display: 'flex', alignItems: 'center', fontFamily: 'DM Mono', fontSize: '0.82rem', color: 'var(--text-2)' }}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-ghost" style={{ padding: '8px 16px' }}>Next →</button>
          </div>
        )}
      </div>
    </>
  )
}
