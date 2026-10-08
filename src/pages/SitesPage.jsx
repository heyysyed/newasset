import React, { useEffect, useState, useMemo } from 'react'
import { Plus, X, Save, Edit2, Trash2, MapPin, ChevronRight, ChevronDown, MoreVertical, PlusCircle } from 'lucide-react'
import { fetchSites, createSite, updateSite, deleteSite, supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isSiteMatch } from '../lib/siteMatcher'

export default function SitesPage() {
  const { user, currentCompany, isAdmin, isMod, can } = useAuth()
  const cc = currentCompany?.code

  const [sites, setSites] = useState([])
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)

  const [locationsStore, setLocationsStore] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assetpro_locations')) || {} }
    catch { return {} }
  })

  const [selectedSiteId, setSelectedSiteId] = useState(null)
  const [selectedLocId, setSelectedLocId] = useState(null)
  const [expandedNodes, setExpandedNodes] = useState({'loc-1': true})

  const [showSiteModal, setShowSiteModal] = useState(false)
  const [siteForm, setSiteForm] = useState({ id: '', name: '', site_code: '', address: '', is_active: true })

  const [locForm, setLocForm] = useState(null)

  useEffect(() => {
    localStorage.setItem('assetpro_locations', JSON.stringify(locationsStore))
  }, [locationsStore])

  useEffect(() => {
    loadData()
  }, [cc])

  async function loadData() {
    setLoading(true)
    try {
      const siteData = await fetchSites()
      setSites(siteData || [])

      if (cc) {
        const { data: aRes } = await supabase.from('assets').select('*').eq('company_code', cc)
        setAssets(aRes || [])
      }

      if (siteData && siteData.length > 0 && !selectedSiteId) {
        setSelectedSiteId(siteData[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const selectedSite = useMemo(() => sites.find(s => s.id === selectedSiteId) || sites[0] || null, [sites, selectedSiteId])

  const siteLocations = useMemo(() => {
    if (!selectedSite) return []
    return locationsStore[selectedSite.id] || []
  }, [selectedSite, locationsStore])

  useEffect(() => {
    if (sites.length > 0 && Object.keys(locationsStore).length === 0) {
      const initial = {}
      sites.forEach(s => {
        initial[s.id] = [
          { id: 'loc-1', name: 'Production floor', code: `${s.site_code || 'S'}-PROD`, parentId: null, manager: 'Jamie Lee' },
          { id: 'loc-2', name: 'Bay 01', code: `${s.site_code || 'S'}-PROD-01`, parentId: 'loc-1', manager: '' },
          { id: 'loc-3', name: 'Bay 02', code: `${s.site_code || 'S'}-PROD-02`, parentId: 'loc-1', manager: '' },
          { id: 'loc-4', name: 'Bay 04', code: `${s.site_code || 'S'}-PROD-04`, parentId: 'loc-1', manager: 'Morgan Chen' },
          { id: 'loc-5', name: 'Central store', code: `${s.site_code || 'S'}-CS`, parentId: null, manager: '' },
          { id: 'loc-6', name: 'Receiving Dock 2', code: `${s.site_code || 'S'}-RD2`, parentId: null, manager: '' },
          { id: 'loc-7', name: 'Utility room', code: `${s.site_code || 'S'}-UTIL`, parentId: null, manager: '' },
        ]
      })
      setLocationsStore(initial)
    }
  }, [sites])

  const handleSiteClick = (s) => {
    setSelectedSiteId(s.id)
    setSelectedLocId(null)
    setLocForm(null)
  }

  const handleLocClick = (loc) => {
    setSelectedLocId(loc.id)
    setLocForm({ ...loc })
  }

  const handleLocSave = (e) => {
    e.preventDefault()
    if (!selectedSite) return
    const siteLocs = [...(locationsStore[selectedSite.id] || [])]
    if (locForm.id.startsWith('new-')) {
      const newLoc = { ...locForm, id: `loc-${Date.now()}` }
      siteLocs.push(newLoc)
      setSelectedLocId(newLoc.id)
      setLocForm(newLoc)
    } else {
      const idx = siteLocs.findIndex(l => l.id === locForm.id)
      if (idx >= 0) siteLocs[idx] = locForm
    }
    setLocationsStore({ ...locationsStore, [selectedSite.id]: siteLocs })
  }

  const buildTree = (parentId = null) => {
    return siteLocations.filter(l => l.parentId === parentId).map(loc => ({
      ...loc,
      children: buildTree(loc.id)
    }))
  }

  const treeData = buildTree()

  const toggleNode = (e, id) => {
    e.stopPropagation()
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const renderTree = (nodes, depth = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedNodes[node.id]
      const isSelected = selectedLocId === node.id
      const hasChildren = node.children && node.children.length > 0

      const locAssets = assets.filter(a => a.location?.includes(node.name) || (selectedSite && isSiteMatch(a.site, selectedSite) && a.location === node.name))
      const assetCount = locAssets.length

      return (
        <div key={node.id}>
          <div
            onClick={() => handleLocClick(node)}
            className={`flex items-center py-1.5 px-2 cursor-pointer rounded-md transition-colors ${isSelected ? 'bg-slate-100 font-medium text-slate-900' : 'hover:bg-slate-50 text-slate-600'}`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <div className="w-4 h-4 flex items-center justify-center mr-1" onClick={(e) => hasChildren ? toggleNode(e, node.id) : null}>
              {hasChildren ? (
                isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
              ) : (
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              )}
            </div>
            <span className="text-[13px]">{node.name} {assetCount > 0 && <span className="text-slate-400 font-normal">· {assetCount} asset{assetCount !== 1 ? 's' : ''}</span>}</span>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      )
    })
  }

  const selectedLocAssets = useMemo(() => {
    if (!selectedLocId || !selectedSite) return []
    const loc = siteLocations.find(l => l.id === selectedLocId)
    if (!loc) return []
    return assets.filter(a => isSiteMatch(a.site, selectedSite) && a.location === loc.name)
  }, [selectedLocId, selectedSite, assets, siteLocations])

  const openSiteModal = (site = null) => {
    if (site) {
      setSiteForm({
        id: site.id, name: site.name || '', site_code: site.site_code || '', address: site.address || '', is_active: site.is_active ?? true
      })
    } else {
      setSiteForm({ id: '', name: '', site_code: '', address: '', is_active: true })
    }
    setShowSiteModal(true)
  }

  const saveSite = async (e) => {
    e.preventDefault()
    try {
      if (siteForm.id) {
        await updateSite(siteForm.id, siteForm, user?.id)
      } else {
        await createSite(siteForm, user?.id)
      }
      setShowSiteModal(false)
      loadData()
    } catch (err) {
      console.error(err)
      alert("Failed to save site")
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* ── Top Header ── */}
      <div className="px-8 py-6 max-w-[1400px] mx-auto">
        <div className="text-[13px] text-[#647582] mb-2 font-medium">Sites / Strongbuilt Industries</div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-bold text-[#172a38] m-0 tracking-tight">Sites & locations</h1>
            <p className="text-[14px] text-[#647582] mt-1 m-0">Organize physical locations and assign accountable site managers.</p>
          </div>
          <button onClick={() => openSiteModal()} className="bg-[#147d92] text-white px-4 py-2 rounded-md text-[13px] font-medium flex items-center gap-2 hover:bg-[#106778] transition-colors shadow-sm whitespace-nowrap self-start md:self-auto">
            <Plus size={16} /> Add site
          </button>
        </div>

        {/* ── Sites Table ── */}
        <div className="bg-white rounded-xl border border-[#dfe6ea] shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-[#f4f6f8] border-b border-[#dfe6ea] text-[#647582]">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Site ↕</th>
                  <th className="px-5 py-3.5 font-medium">Code ↕</th>
                  <th className="px-5 py-3.5 font-medium">Address ↕</th>
                  <th className="px-5 py-3.5 font-medium">Manager ↕</th>
                  <th className="px-5 py-3.5 font-medium">Assets ↕</th>
                  <th className="px-5 py-3.5 font-medium">Locations ↕</th>
                  <th className="px-5 py-3.5 font-medium">Status ↕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sites.map(site => {
                  const isSelected = selectedSite?.id === site.id
                  const sAssets = assets.filter(a => isSiteMatch(a.site, site))
                  const sLocs = locationsStore[site.id] || []

                  // Mock managers for visual match
                  let mgr = ''
                  if (site.name.includes('Detroit')) mgr = 'Jamie Lee'
                  else if (site.name.includes('Austin')) mgr = 'Taylor Brooks'
                  else if (site.name.includes('Denver')) mgr = 'Alex Rivera'

                  return (
                    <tr
                      key={site.id}
                      onClick={() => handleSiteClick(site)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-900">{site.name}</td>
                      <td className="px-5 py-3.5 text-slate-500">{site.site_code || '-'}</td>
                      <td className="px-5 py-3.5 text-slate-500 truncate max-w-[200px]">{site.address || '-'}</td>
                      <td className="px-5 py-3.5 text-slate-500">{mgr}</td>
                      <td className="px-5 py-3.5 text-slate-500">{sAssets.length}</td>
                      <td className="px-5 py-3.5 text-slate-500">{sLocs.length}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          {site.is_active ? 'Active' : 'Inactive'}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {sites.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-500">No sites found. Add a new site to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3.5 border-t border-slate-100 flex justify-between items-center text-[13px] text-slate-500 bg-white">
            <div>Showing 1–{sites.length} of {sites.length} records</div>
            <div className="flex gap-2 text-sm">
              <button className="px-1 hover:text-slate-900 disabled:opacity-50" disabled>‹</button>
              <button className="px-1 text-slate-900 font-medium">1</button>
              <button className="px-1 hover:text-slate-900 disabled:opacity-50" disabled>2</button>
              <button className="px-1 hover:text-slate-900 disabled:opacity-50" disabled>3</button>
              <button className="px-1 hover:text-slate-900 disabled:opacity-50" disabled>›</button>
            </div>
          </div>
        </div>

        {/* ── Split Layout: Hierarchy & Details ── */}
        {selectedSite && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
            {/* Left Col: Location Hierarchy */}
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-[15px] font-bold text-slate-900 mb-4">Location hierarchy</h2>

              <div className="mb-6">
                <div className="flex items-center py-1.5 px-2 font-semibold text-[13px] text-slate-900">
                  <div className="w-4 h-4 flex items-center justify-center mr-1">
                    <ChevronDown size={14} className="text-slate-600" />
                  </div>
                  {selectedSite.name} {selectedSite.site_code && <span className="text-slate-400 font-normal ml-1">· {selectedSite.site_code}</span>}
                </div>

                <div className="mt-1">
                  {renderTree(treeData)}
                </div>
              </div>

              <button
                onClick={() => {
                  const newLoc = { id: `new-${Date.now()}`, name: 'New Location', code: '', parentId: null, manager: '' }
                  setSelectedLocId(newLoc.id)
                  setLocForm(newLoc)
                }}
                className="w-full py-2 bg-white text-slate-700 border border-slate-200 rounded-md text-[13px] font-medium shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add location
              </button>
            </div>

            {/* Right Col: Selected Location Details */}
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              {!locForm ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                  <MapPin size={32} className="mb-3 opacity-30" />
                  <p className="text-[14px]">Select a location from the hierarchy to view details</p>
                </div>
              ) : (
                <form onSubmit={handleLocSave}>
                  <h2 className="text-[15px] font-bold text-slate-900 mb-6 flex items-center gap-2">
                    Selected location <span className="text-slate-400 font-normal">·</span> {locForm.name || 'New Location'}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-[13px] text-slate-500 mb-1.5 font-medium">Location name</label>
                      <input
                        type="text"
                        value={locForm.name}
                        onChange={e => setLocForm({...locForm, name: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 focus:outline-none focus:border-[#137986] focus:ring-1 focus:ring-[#137986]"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] text-slate-500 mb-1.5 font-medium">Code</label>
                      <input
                        type="text"
                        value={locForm.code}
                        onChange={e => setLocForm({...locForm, code: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 focus:outline-none focus:border-[#137986] focus:ring-1 focus:ring-[#137986]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
                    <div>
                      <label className="block text-[13px] text-slate-500 mb-1.5 font-medium">Parent location</label>
                      <select
                        value={locForm.parentId || ''}
                        onChange={e => setLocForm({...locForm, parentId: e.target.value || null})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 focus:outline-none focus:border-[#137986] focus:ring-1 focus:ring-[#137986]"
                      >
                        <option value="">None (Top Level)</option>
                        {siteLocations.filter(l => l.id !== locForm.id && !locForm.id.startsWith('new-')).map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[13px] text-slate-500 mb-1.5 font-medium">Responsible person</label>
                      <input
                        type="text"
                        value={locForm.manager || ''}
                        onChange={e => setLocForm({...locForm, manager: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 focus:outline-none focus:border-[#137986] focus:ring-1 focus:ring-[#137986]"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded text-[12px] font-medium border border-emerald-100">
                      Active
                    </span>
                  </div>

                  {/* Location Assets Sub-table */}
                  {!locForm.id.startsWith('new-') && (
                    <div className="border border-[#dfe6ea] rounded-lg overflow-hidden mb-8">
                      <table className="w-full text-left text-[13px] whitespace-nowrap">
                        <thead className="bg-[#f4f6f8] border-b border-[#dfe6ea] text-[#647582]">
                          <tr>
                            <th className="px-4 py-2.5 font-medium">Asset ↕</th>
                            <th className="px-4 py-2.5 font-medium">Category ↕</th>
                            <th className="px-4 py-2.5 font-medium">Status ↕</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#dfe6ea]">
                          {selectedLocAssets.slice(0, 3).map(asset => (
                            <tr key={asset.id} className="hover:bg-[#f4f6f8]">
                              <td className="px-4 py-2.5 font-medium text-[#172a38]">{asset.asset_code} <span className="font-normal text-[#647582] ml-1">· {asset.name}</span></td>
                              <td className="px-4 py-2.5 text-[#647582]">{asset.category || '-'}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5 text-[#247553] font-medium">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#247553]"></div>
                                  Active
                                </div>
                              </td>
                            </tr>
                          ))}
                          {selectedLocAssets.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-4 py-6 text-center text-[#9eb1bc] bg-white">No assets mapped to this location yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {selectedLocAssets.length > 0 && (
                        <div className="px-4 py-2 border-t border-[#dfe6ea] flex justify-between items-center text-[12px] text-[#647582] bg-white">
                          <div>Showing 1–{Math.min(selectedLocAssets.length, 3)} of {selectedLocAssets.length} records</div>
                          <div className="flex gap-2">
                            <button className="hover:text-[#172a38] disabled:opacity-50" disabled>‹</button>
                            <button className="text-[#172a38] font-medium">1</button>
                            <button className="hover:text-[#172a38] disabled:opacity-50" disabled>›</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <button type="submit" className="bg-[#147d92] text-white px-5 py-2.5 rounded-md text-[13px] font-medium hover:bg-[#106778] transition-colors shadow-sm">
                      Save location
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Site Modal */}
      {showSiteModal && (
        <div className="fixed inset-0 bg-[#142d3a]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-[#dfe6ea]">
            <div className="px-6 py-4 border-b border-[#dfe6ea] flex justify-between items-center">
              <h3 className="font-bold text-[15px] text-[#172a38]">{siteForm.id ? 'Edit Site' : 'Add New Site'}</h3>
              <button onClick={() => setShowSiteModal(false)} className="text-[#9eb1bc] hover:text-[#172a38]"><X size={18} /></button>
            </div>
            <form onSubmit={saveSite} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] text-[#647582] mb-1.5 font-medium">Site Name</label>
                  <input type="text" required value={siteForm.name} onChange={e => setSiteForm({...siteForm, name: e.target.value})} className="w-full px-3 py-2 border border-[#dfe6ea] rounded-md text-[13px] focus:border-[#147d92] focus:ring-1 focus:ring-[#147d92] outline-none" />
                </div>
                <div>
                  <label className="block text-[13px] text-[#647582] mb-1.5 font-medium">Site Code</label>
                  <input type="text" value={siteForm.site_code} onChange={e => setSiteForm({...siteForm, site_code: e.target.value})} className="w-full px-3 py-2 border border-[#dfe6ea] rounded-md text-[13px] focus:border-[#147d92] focus:ring-1 focus:ring-[#147d92] outline-none" />
                </div>
                <div>
                  <label className="block text-[13px] text-[#647582] mb-1.5 font-medium">Address</label>
                  <textarea rows={2} value={siteForm.address} onChange={e => setSiteForm({...siteForm, address: e.target.value})} className="w-full px-3 py-2 border border-[#dfe6ea] rounded-md text-[13px] focus:border-[#147d92] focus:ring-1 focus:ring-[#147d92] outline-none"></textarea>
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button type="button" onClick={() => setShowSiteModal(false)} className="px-4 py-2 text-[13px] font-medium text-[#647582] bg-white border border-[#dfe6ea] rounded-md hover:bg-[#f4f6f8]">Cancel</button>
                <button type="submit" className="px-4 py-2 text-[13px] font-medium text-white bg-[#147d92] rounded-md hover:bg-[#106778]">Save Site</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
