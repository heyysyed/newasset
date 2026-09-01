import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Edit2, Eye, Copy, Trash2, Clock, Check, X, ChevronDown, ChevronRight, ChevronLeft, MapPin, PackageX, ChevronUp } from 'lucide-react'
import EmptyState from '../EmptyState'
import { fetchSites } from '../../lib/supabase'
import { resolveSite } from '../../lib/siteResolver'
import { StatusBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { buildAsset360 } from '../../lib/intelligence/assetIntelligence'

export default function AssetTable({
  assets, loading, selected, toggleSelect, toggleAll, columns, 
  toggleSort, sortCol, sortDir, sorted, navigate, can, isAdmin, 
  setInlineEdit, inlineEdit, handleInlineSave, STATUSES, sites, STATUS_BADGE, 
  calculateBookValue, formatCurrency, setCloneAsset, handleDelete, deleting, 
  setShowHistoryAsset, groupedAssets, expandedGroups, toggleGroupExpanded, 
  handleGroupSelectAll, totalPages, page, setPage, totalCount, pageSize, setPageSize,
  setAssignGroupAssets, setAssignGroupTab, setAssignGroupSearch, 
  setAssignGroupSelected, setAssignGroupNewName, setShowAssignGroup,
  handleExportDossier
}) {
  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span className="opacity-30 inline-block w-3 text-center">↕</span>
    return sortDir === 'asc' ? <ChevronUp size={14} className="inline" /> : <ChevronDown size={14} className="inline" />
  }

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
    if (!siteVal || siteVal === '-') return null
    const upper = String(siteVal).trim().toUpperCase()
    if (siteMap.has(upper)) return siteMap.get(upper)
    const res = resolveSite(siteVal, masterSitesList)
    return res.matched ? res.site : null
  }, [siteMap, masterSitesList])

  const renderAssetRow = (asset) => (
    <tr key={asset.id} onClick={() => navigate(/assets/ + asset.id)} className="hover:bg-bg-1 cursor-pointer transition-colors group border-b border-border last:border-0">
      {(isAdmin || can('delete')) && (
        <td onClick={e => e.stopPropagation()} className="px-4 py-3 w-10 text-center">
          <input type="checkbox" className="rounded border-border text-accent focus:ring-accent" checked={selected.has(asset.id)} onChange={() => toggleSelect(asset.id)} />
        </td>
      )}
      {columns.map(col => (
        <td key={col.k} className="px-4 py-3 text-small text-text-1" onClick={e => { if ((col.k === 'status' || col.k === 'site') && can('edit')) { e.stopPropagation(); setInlineEdit({ id: asset.id, field: col.k, value: asset[col.k] || '' }) } }}>
          {inlineEdit && inlineEdit.id === asset.id && inlineEdit.field === col.k ? (
            <div onClick={e => e.stopPropagation()} className="flex items-center gap-2">
              <select className="h-7 text-caption px-2 rounded border border-border bg-bg-0" value={inlineEdit.value} onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })}>
                {col.k === 'status' ? STATUSES.map(s => <option key={s} value={s}>{s}</option>) : sites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleInlineSave} className="bg-success text-white p-1 rounded hover:bg-success-hover transition-colors"><Check size={12} /></button>
              <button onClick={() => setInlineEdit(null)} className="bg-bg-3 text-text-2 p-1 rounded hover:text-text-0 transition-colors"><X size={12} /></button>
            </div>
          ) : col.k === 'status' ? (
            <StatusBadge status={asset.status} />
          ) : col.k === 'purchase_value' ? (
            <span className="font-mono text-body-medium text-text-0">{formatCurrency(calculateBookValue(asset))}</span>
          ) : col.k === 'asset_code' ? (
            <span className="font-mono text-caption text-body-medium text-text-2 group-hover:text-accent transition-colors">{asset[col.k]}</span>
          ) : col.k === 'condition' ? (
            <span className="text-caption px-2 py-0.5 rounded-full text-body-medium bg-bg-2 text-text-2">
              {asset.condition || '-'}
            </span>
          ) : col.k === 'site' ? (
            (() => {
              const siteVal = asset.site || '-'
              if (siteVal === '-') return siteVal
              const resolved = getResolvedSite(siteVal)
              if (resolved && resolved.site_code) {
                let cleanName = resolved.name;
                if (cleanName.toUpperCase().startsWith(resolved.site_code.toUpperCase())) {
                  cleanName = cleanName.substring(resolved.site_code.length).replace(/^[\s-]+/, '');
                }
                return (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-mono bg-accent-subtle text-accent px-1.5 py-0.5 rounded text-[10px] border border-accent/20">
                      {resolved.site_code}
                    </span>
                    <span>{cleanName}</span>
                  </span>
                )
              }
              return siteVal
            })()
          ) : col.k === 'age' ? (
            <span className="text-caption text-text-1">{buildAsset360(asset).age.data.ageYears}y</span>
          ) : col.k === 'health' ? (
            (() => {
              const h = buildAsset360(asset).health.data
              return <span className={`text-caption  ${h.score > 70 ? 'text-green' : 'text-amber'}`}>{h.score}%</span>
            })()
          ) : col.k === 'risk' ? (
            (() => {
              const r = buildAsset360(asset).risk.data
              return <span className={`text-caption  ${r.score > 70 ? 'text-red' : 'text-green'}`}>{r.score}%</span>
            })()
          ) : col.k === 'location_precision' ? (
            (() => {
              const l = buildAsset360(asset).location.data.precision
              return <span className={`text-[10px] px-1.5 py-0.5 rounded  uppercase ${l === 'EXACT GPS' ? 'bg-green-dim text-green' : 'bg-amber-dim text-amber'}`}>{l}</span>
            })()
          ) : (
            <span className={col.k === 'asset_name' ? 'text-body-medium text-text-0' : ''}>{asset[col.k] || '-'}</span>
          )}
        </td>
      ))}
      <td onClick={e => e.stopPropagation()} className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/assets/${asset.id}`)} icon={Eye} className="h-8 w-8 !p-0 justify-center text-text-2 hover:text-text-0" title="View" />
          {handleExportDossier && <Button variant="ghost" size="sm" onClick={() => handleExportDossier(asset)} icon={PackageX} className="h-8 w-8 !p-0 justify-center text-text-2 hover:text-accent" title="Export Dossier" />}
          {can('edit') && <Button variant="ghost" size="sm" onClick={() => navigate(`/assets/${asset.id}/edit`)} icon={Edit2} className="h-8 w-8 !p-0 justify-center text-text-2 hover:text-text-0" title="Edit" />}
          <Button variant="ghost" size="sm" onClick={() => setShowHistoryAsset(asset.id)} icon={Clock} className="h-8 w-8 !p-0 justify-center text-text-2 hover:text-text-0" title="History" />
          {can('add') && <Button variant="ghost" size="sm" onClick={() => setCloneAsset(asset)} icon={Copy} className="h-8 w-8 !p-0 justify-center text-text-2 hover:text-text-0" title="Clone" />}
          {isAdmin && <Button variant="ghost" size="sm" onClick={() => handleDelete([asset.id])} icon={Trash2} className="h-8 w-8 !p-0 justify-center text-danger hover:text-danger hover:bg-danger-subtle" title="Delete" />}
        </div>
      </td>
    </tr>
  )

  return (
    <>
      <div className="bg-bg-0 border border-border shadow-sm rounded-lg overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-bg-1 border-b border-border text-caption uppercase tracking-wider text-text-2">
                {(isAdmin || can('delete')) && (
                  <th className="px-4 py-3 w-10 text-center">
                    <input type="checkbox" className="rounded border-border text-accent focus:ring-accent" checked={selected.size === assets.length && assets.length > 0} onChange={toggleAll} />
                  </th>
                )}
                {columns.map(col => (
                  <th key={col.k} onClick={() => toggleSort(col.k)} className="px-4 py-3 cursor-pointer hover:text-text-0 transition-colors whitespace-nowrap select-none">
                    <div className="flex items-center gap-1">{col.l} <SortIcon col={col.k} /></div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={12} className="px-4 py-4">
                    <div className="h-6 bg-bg-2 rounded animate-pulse w-full"></div>
                  </td>
                </tr>
              ))}
              
              {!loading && !groupedAssets && sorted.map(renderAssetRow)}

              {!loading && groupedAssets && groupedAssets.map(group => {
                const isGroupExpanded = expandedGroups.has(group.key)
                const groupAssets = group.subgroupsArray.flatMap(sg => sg.assets)
                const allGroupSelected = group.totalAssets > 0 && groupAssets.every(a => selected.has(a.id))
                
                return (
                  <React.Fragment key={group.key}>
                    <tr className="bg-bg-2 border-b border-border">
                      {(isAdmin || can('delete')) && (
                        <td onClick={e => e.stopPropagation()} className="px-4 py-3 text-center">
                          <input type="checkbox" className="rounded border-border text-accent focus:ring-accent" checked={allGroupSelected} onChange={() => handleGroupSelectAll(groupAssets)} />
                        </td>
                      )}
                      <td colSpan={columns.length + 1} className="px-4 py-3 cursor-pointer" onClick={() => toggleGroupExpanded(group.key)}>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            {isGroupExpanded ? <ChevronDown size={16} className="text-text-2" /> : <ChevronRight size={16} className="text-text-2" />}
                            <span className="text-small text-text-0 uppercase">
                              {(() => {
                                if (typeof group.key !== 'string') return group.key;
                                const resolved = getResolvedSite(group.key);
                                if (resolved) {
                                  // Clean up cases where site name itself includes the code, e.g. "P149 MARQUEE" and code is "P149"
                                  let cleanName = resolved.name;
                                  if (resolved.site_code && cleanName.toUpperCase().startsWith(resolved.site_code.toUpperCase())) {
                                    cleanName = cleanName.substring(resolved.site_code.length).replace(/^[\s-]+/, '');
                                  }
                                  return resolved.site_code ? `[${resolved.site_code}] ${cleanName}` : cleanName;
                                }
                                return group.key.replace(/^([a-z0-9]+)\s*-\s*\1\s+/i, '$1 ');
                              })()}
                            </span>
                            <span className="bg-bg-3 text-text-1 text-caption text-body-medium px-2 py-0.5 rounded-full">{group.subgroupsArray.length}</span>
                            <span className="text-caption text-text-3 flex items-center gap-2">
                              {group.subgroupsArray.length} types <span className="text-border">|</span> Active: {group.activeCount}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-caption">
                            <span className="text-text-2">PV: <span className="text-body-medium text-text-0">{formatCurrency(group.pv)}</span></span>
                            <span className="text-text-2">BV: <span className="text-body-medium text-text-0">{formatCurrency(group.bv)}</span></span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    {isGroupExpanded && group.subgroupsArray.map(subgroup => {
                        const subKey = group.key + "::" + subgroup.key
                        const isSubExpanded = expandedGroups.has(subKey)
                        const allSubSelected = subgroup.assets.length > 0 && subgroup.assets.every(a => selected.has(a.id))
                        
                        return (
                          <React.Fragment key={subKey}>
                            <tr className="bg-bg-1/50 border-b border-border">
                              {(isAdmin || can('delete')) && (
                                <td onClick={e => e.stopPropagation()} className="px-4 py-2 text-center">
                                  <input type="checkbox" className="rounded border-border text-accent focus:ring-accent" checked={allSubSelected} onChange={() => handleGroupSelectAll(subgroup.assets)} />
                                </td>
                              )}
                              <td colSpan={columns.length + 1} className="px-4 py-2 cursor-pointer pl-8" onClick={() => toggleGroupExpanded(subKey)}>
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                  <div className="flex items-center gap-3">
                                    {isSubExpanded ? <ChevronDown size={14} className="text-text-3" /> : <ChevronRight size={14} className="text-text-3" />}
                                    <span className="text-body-medium text-small text-text-1">{subgroup.key}</span>
                                    <span className="bg-bg-2 text-text-2 text-[10px] text-body-medium px-2 py-0.5 rounded-full">{subgroup.assets.length} items</span>
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
                  <td colSpan={columns.length + 1} className="px-4 py-16 text-center">
                    <EmptyState 
                      icon={PackageX} 
                      title="No assets found" 
                      message="Try adjusting your filters or search query." 
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(totalPages > 1 || totalCount > 10) && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg-0">
            <div className="text-small text-text-2">
              Showing <span className="text-body-medium text-text-0">{totalCount}</span> results
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} icon={ChevronLeft} className="w-8 h-8 !p-0 justify-center" />
                <div className="flex items-center gap-1 px-2 text-small">
                  Page <span className="text-body-medium">{page + 1}</span> of {totalPages}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} icon={ChevronRight} className="w-8 h-8 !p-0 justify-center" />
              </div>
            )}
          </div>
        )}
      </div>

        {/* Mobile Card List */}
        <div className="md:hidden flex flex-col gap-3 pb-8">
          {loading && [...Array(4)].map((_, i) => <div key={i} className="h-32 bg-bg-1 rounded-2xl border border-border animate-pulse" />)}
          {!loading && sorted.map(asset => (
            <div key={asset.id} className="bg-bg-0 border border-border rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform flex flex-col gap-3 relative" onClick={() => navigate(`/assets/${asset.id}`)}>
              {/* Asset Name, Code & Status */}
              <div>
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-text-0 text-[1rem] leading-tight pr-8">{asset.asset_name}</h3>
                  <div className="shrink-0">
                    <StatusBadge status={asset.status} />
                  </div>
                </div>
                <div className="font-mono text-caption text-text-2 tracking-wide">{asset.asset_code}</div>
              </div>

              {/* Location & Category */}
              <div className="flex flex-col gap-1.5 mt-1">
                <div className="flex items-center gap-2 text-[13px] text-text-1">
                  <MapPin size={14} className="text-text-3" />
                  <span className="truncate">{asset.site || 'No site'}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-text-1">
                  <PackageX size={14} className="text-text-3" />
                  <span className="truncate">{asset.category || 'Uncategorized'}</span>
                </div>
              </div>

              {/* Important metadata */}
              {(asset.condition || asset.make) && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {asset.condition && (
                    <span className="text-[11px] text-body-medium px-2 py-1 bg-bg-2 text-text-2 rounded-md">
                      {asset.condition}
                    </span>
                  )}
                  {asset.make && (
                    <span className="text-[11px] text-body-medium px-2 py-1 bg-bg-2 text-text-2 rounded-md">
                      {asset.make} {asset.model}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                <button 
                  onClick={(e) => { e.stopPropagation(); navigate(`/assets/${asset.id}`) }}
                  className="flex-1 bg-bg-1 hover:bg-bg-2 text-text-0 text-small text-body-medium py-2 rounded-lg transition-colors"
                >
                  View Asset
                </button>
                <div className="relative">
                  {/* For now, just placeholder for More action. Real implementation would use a dropdown or bottom sheet */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowHistoryAsset(asset.id) }} 
                    className="p-2 text-text-2 hover:text-text-0 bg-bg-1 hover:bg-bg-2 rounded-lg transition-colors"
                  >
                    <Clock size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        {!loading && sorted.length === 0 && (
          <EmptyState icon={PackageX} title="No assets" />
        )}
      </div>
    </>
  )
}


