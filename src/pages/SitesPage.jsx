import React, { useEffect, useState, useMemo } from 'react'
import { PlusCircle, MapPin, Edit2, Trash2, Loader2, ArrowRight, X, Save, List, Map as MapIcon, Activity, Package, DollarSign, Info } from 'lucide-react'
import { fetchSites, createSite, updateSite, deleteSite, supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { calculateBookValue, formatCurrency } from '../lib/depreciation'
import { isSiteMatch } from '../lib/siteMatcher'
import { useIsMobile } from '../hooks/useBreakpoint'
import MobileSitesPage from '../components/mobile/MobileSitesPage'
import Site360Workspace from '../components/sites/Site360Workspace'
import MobileSiteDetail from '../components/mobile/MobileSiteDetail'

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to handle map clicks for the form
function FormMapHandler({ position, setPosition, radius }) {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  
  return position.lat && position.lng ? (
    <>
      <Marker position={[position.lat, position.lng]} />
      <Circle center={[position.lat, position.lng]} radius={radius || 0} pathOptions={{ color: 'var(--accent)', fillColor: 'var(--accent)', fillOpacity: 0.2 }} />
    </>
  ) : null
}

export default function SitesPage() {
  const { user, currentCompany, can, isAdmin, isMod } = useAuth()
  const cc = currentCompany?.code
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  
  const [sites, setSites] = useState([])
  const [assets, setAssets] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  
  // UI Views
  const [viewMode, setViewMode] = useState('list') // 'list' or 'map'

  // Drawer & Analytics State
  const [selectedSite, setSelectedSite] = useState(null)
  const [showDrawer, setShowDrawer] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingSite, setEditingSite] = useState(null)
  const [form, setForm] = useState({ name: '', site_code: '', aliases: '', address: '', latitude: '', longitude: '', is_active: true, radius_meters: 200 })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    loadData()
  }, [cc])

  async function loadData() {
    setLoading(true)
    try {
      const siteData = await fetchSites()
      setSites(siteData || [])

      if (cc) {
        const [aRes, tRes] = await Promise.all([
          supabase.from('assets').select('*').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%').eq('company_code', cc),
          supabase.from('maintenance_tickets').select('*').eq('company_code', cc).neq('status', 'Resolved').neq('status', 'Closed')
        ])
        setAssets(aRes.data || [])
        setTickets(tRes.data || [])
      }
    } catch (e) {
      console.error('Failed to load data:', e)
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditingSite(null)
    setForm({ name: '', site_code: '', aliases: '', address: '', latitude: '', longitude: '', is_active: true, radius_meters: 200 })
    setErrors({})
    setShowModal(true)
  }

  function openEdit(site) {
    setEditingSite(site)
    setForm({
      name: site.name || '',
      site_code: site.site_code || '',
      aliases: Array.isArray(site.aliases) ? site.aliases.join(', ') : '',
      address: site.address || '',
      latitude: site.latitude || '',
      longitude: site.longitude || '',
      radius_meters: site.radius_meters || 200,
      is_active: site.is_active ?? true
    })
    setErrors({})
    setShowModal(true)
  }

  function openDrawer(site) {
    setSelectedSite(site)
    setShowDrawer(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = 'Required'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const aliasArray = (form.aliases || '').split(',').map(a => a.trim().toUpperCase()).filter(Boolean)
      const payload = {
        name: form.name.trim(),
        site_code: (form.site_code || '').trim().toUpperCase() || null,
        aliases: aliasArray,
        address: form.address,
        latitude: form.latitude === '' ? null : form.latitude,
        longitude: form.longitude === '' ? null : form.longitude,
        radius_meters: form.radius_meters === '' ? 200 : form.radius_meters,
        is_active: form.is_active
      }

      if (editingSite) {
        await updateSite(editingSite.id, payload, user?.id)
      } else {
        await createSite(payload, user?.id)
      }
      setShowModal(false)
      loadData()
    } catch (e) {
      if (e.message?.includes('unique') || e.code === '23505') {
        setErrors({ name: 'A site with this name or code already exists' })
      } else {
        alert(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete site "${name}"? This might break assets linked to this site.`)) return
    try {
      await deleteSite(id, user?.id)
      loadData()
    } catch (e) {
      alert(`Error deleting site: ${e.message}`)
    }
  }

  // Analytics helper for drawer
  const getSiteAnalytics = (siteName) => {
    const siteAssets = assets.filter(a => isSiteMatch(a.site, siteName))
    const activeAssets = siteAssets.filter(a => a.status === 'Active')
    const totalBookValue = siteAssets.reduce((sum, a) => sum + calculateBookValue(a), 0)
    
    // Find tickets linked to assets at this site
    const assetIds = siteAssets.map(a => a.id)
    const siteTickets = tickets.filter(t => assetIds.includes(t.asset_id))

    return { total: siteAssets.length, active: activeAssets.length, value: totalBookValue, openTickets: siteTickets.length }
  }

  // Calculate default map center
  const validSites = sites.filter(s => s.latitude && s.longitude)
  const defaultCenter = validSites.length > 0 
    ? [validSites[0].latitude, validSites[0].longitude] 
    : [20.5937, 78.9629] // Default to India roughly

  if (isMobile) {
    return (
      <>
        <MobileSitesPage
          sites={sites}
          loading={loading}
          can={can}
          isAdmin={isAdmin}
          isMod={isMod}
          openNew={openNew}
          openEdit={openEdit}
          handleDelete={handleDelete}
          openDrawer={openDrawer}
          getSiteAnalytics={getSiteAnalytics}
        />
        {/* Modals from Desktop to handle creation/editing etc */}
        {showDrawer && selectedSite && (
          <div className="drawer-backdrop" onClick={() => setShowDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 100 }} />
        )}
        {showDrawer && selectedSite && (
          <div className="drawer animate-slide-in-right sites-drawer" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 450, background: 'var(--bg-1)', zIndex: 101, boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={20} color="var(--accent)" /> {selectedSite.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedSite.is_active ? 'var(--green)' : 'var(--red)' }} />
                  <span style={{ color: 'var(--text-2)' }}>{selectedSite.is_active ? 'Active Site' : 'Inactive Site'}</span>
                </div>
              </div>
              <button onClick={() => setShowDrawer(false)} className="btn-ghost" style={{ padding: 8, background: 'var(--bg-1)' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                <div style={{ background: 'var(--bg-2)', padding: '16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--text-3)' }}>
                    <Package size={16} /> <span style={{ textTransform: 'uppercase', }}>Total Assets</span>
                  </div>
                  <div style={{ color: 'var(--text-0)' }}>{getSiteAnalytics(selectedSite.name).total}</div>
                </div>
                <div style={{ background: 'rgba(220,38,38,0.05)', padding: '16px', borderRadius: 12, border: '1px solid rgba(220,38,38,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--red)' }}>
                    <Activity size={16} /> <span style={{ textTransform: 'uppercase', }}>Open Tickets</span>
                  </div>
                  <div style={{ color: 'var(--red)' }}>{getSiteAnalytics(selectedSite.name).openTickets}</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', }}>Location Details</div>
                <div style={{ padding: 16 }}>
                  <p style={{ margin: '0 0 12px 0', color: 'var(--text-1)', }}>
                    {selectedSite.address || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No address provided</span>}
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {selectedSite.latitude && selectedSite.longitude ? (
                      <>
                        <div style={{ background: 'var(--bg-1)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', }}>
                          Lat: <span >{Number(selectedSite.latitude).toFixed(4)}</span>
                        </div>
                        <div style={{ background: 'var(--bg-1)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', }}>
                          Lng: <span >{Number(selectedSite.longitude).toFixed(4)}</span>
                        </div>
                        <div style={{ background: 'var(--accent-glow)', color: 'var(--accent)', padding: '4px 10px', borderRadius: 6, }}>
                          {selectedSite.radius_meters}m Radius
                        </div>
                      </>
                    ) : (
                      <span style={{ color: 'var(--amber)', background: 'var(--status-warning-soft)', padding: '4px 8px', borderRadius: 6, }}>No GPS coordinates</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showModal && (
          <div className="modal-backdrop" style={{ zIndex: 200 }}>
            <div className="modal-container sites-modal-container animate-scale-in" style={{ maxWidth: 600, margin: '20px auto', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header">
                <h2>{editingSite ? 'Edit Site' : 'Add New Site'}</h2>
                <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <form id="site-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="form-group">
                    <label>Site Name <span style={{ color: 'var(--red)' }}>*</span></label>
                    <input type="text" className={`input ${errors.name ? 'error' : ''}`} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Main Warehouse" autoFocus />
                    {errors.name && <span className="error-text">{errors.name}</span>}
                  </div>
                  <div className="form-group">
                    <label>Site Code</label>
                    <input type="text" className="input font-mono uppercase" value={form.site_code} onChange={e => setForm({...form, site_code: e.target.value.toUpperCase()})} placeholder="e.g. WH-01" />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <textarea className="input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} rows={3} placeholder="Full physical address" />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <input type="checkbox" id="site_active" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} />
                    <label htmlFor="site_active" style={{ margin: 0, cursor: 'pointer' }}>Site is Active</label>
                  </div>
                </form>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" form="site-form" className="btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Saving...' : (editingSite ? 'Save Changes' : 'Create Site')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Header & Toggles */}
      <div className="animate-fade-up" style={{ marginBottom: 24 }}>
        {/* Title Row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 className="text-page-title m-0 mb-1 tracking-wide uppercase">
              SITE <span className="text-accent">MANAGEMENT</span>
            </h1>
            <p style={{ margin: 0, color: 'var(--text-2)', }} className="hidden md:block">
              Manage geographical locations, geofencing coordinates, and view site analytics.
            </p>
          </div>

          {(isAdmin || isMod || can('add')) && (
            <button onClick={openNew} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', minHeight: 44 }}>
              <PlusCircle size={16} /> Add Site
            </button>
          )}
        </div>

        {/* View Toggle Row */}
        <div className="tab-container" style={{ margin: 0 }}>
          <button
            onClick={() => setViewMode('list')}
            className={`tab-btn ${viewMode === 'list' ? 'active' : ''}`}
          >
            <List size={15} /> List View
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`tab-btn ${viewMode === 'map' ? 'active' : ''}`}
          >
            <MapIcon size={15} /> Map View
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          Loading sites & geospatial data...
        </div>
      ) : viewMode === 'map' ? (
        /* ── INTERACTIVE MAP VIEW ── */
        <div className="card animate-fade-up sites-map-container" style={{ height: 'calc(100vh - 200px)', minHeight: 500, overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={defaultCenter} zoom={validSites.length > 0 ? 5 : 4} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <ZoomControl position="bottomright" />
            
            {validSites.map(site => (
              <React.Fragment key={site.id}>
                <Marker position={[Number(site.latitude), Number(site.longitude)]}>
                  <Popup className="custom-popup">
                    <div style={{ padding: '4px 0', minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: site.is_active ? 'var(--green)' : 'var(--red)' }} />
                        {site.site_code && (
                          <span style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(59,130,246,0.3)' }}>
                            [{site.site_code}]
                          </span>
                        )}
                        <strong style={{ color: '#111', }}>{site.name}</strong>
                      </div>
                      <p style={{ margin: '0 0 12px 0', color: '#666', }}>{site.address || 'No address provided'}</p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        <div style={{ background: '#f5f7fa', padding: '6px 8px', borderRadius: 6, textAlign: 'center' }}>
                          <div style={{ color: '#666', textTransform: 'uppercase' }}>Assets</div>
                          <div style={{ color: '#333' }}>{getSiteAnalytics(site.name).total}</div>
                        </div>
                        <div style={{ background: '#fef2f2', padding: '6px 8px', borderRadius: 6, textAlign: 'center' }}>
                          <div style={{ color: 'var(--status-danger)', textTransform: 'uppercase' }}>Alerts</div>
                          <div style={{ color: 'var(--status-danger)' }}>{getSiteAnalytics(site.name).openTickets}</div>
                        </div>
                      </div>
                      
                      <button onClick={() => openDrawer(site)} style={{ width: '100%', background: 'var(--accent)', color: 'white', border: 'none', padding: '8px', borderRadius: 6, cursor: 'pointer' }}>
                        View Site Details
                      </button>
                    </div>
                  </Popup>
                </Marker>
                <Circle 
                  center={[Number(site.latitude), Number(site.longitude)]} 
                  radius={Number(site.radius_meters) || 200} 
                  pathOptions={{ color: site.is_active ? 'var(--accent)' : 'var(--text-3)', fillColor: site.is_active ? 'var(--accent)' : 'var(--text-3)', fillOpacity: 0.15, weight: 2 }} 
                />
              </React.Fragment>
            ))}
          </MapContainer>
          
          {/* Map Overlay Stats */}
          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', padding: '12px 16px', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'var(--accent-glow)', color: 'var(--accent)', padding: 8, borderRadius: 8 }}><MapPin size={20} /></div>
              <div>
                <div style={{ color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', }}>Total Sites</div>
                <div style={{ color: '#111', }}>{sites.length}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── LIST VIEW (Desktop Table & Mobile Cards) ── */
        <>
          <div className="card animate-fade-up desktop-table">
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Site Details</th>
                    <th style={{ width: '25%' }}>Address</th>
                    <th style={{ width: '18%' }}>Geofence</th>
                    <th style={{ textAlign: 'center', width: '10%' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '10%' }}>Analytics</th>
                    <th style={{ textAlign: 'right', width: '15%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)', }}>
                        <MapPin size={32} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
                        No sites configured. Add your first site to map your assets.
                      </td>
                    </tr>
                  )}
                  {sites.map(site => {
                    const analytics = getSiteAnalytics(site.name)
                    return (
                    <tr key={site.id} onClick={() => openDrawer(site)} style={{ cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-2)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ color: 'var(--text-0)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <MapPin size={18} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {site.site_code && (
                                <span style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.25)' }}>
                                  [{site.site_code}]
                                </span>
                              )}
                              <span style={{ letterSpacing: '0.02em' }}>{site.name}</span>
                            </div>
                            {Array.isArray(site.aliases) && site.aliases.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {site.aliases.slice(0, 3).map((a, idx) => (
                                  <span key={idx} style={{ color: 'var(--text-2)', background: 'var(--bg-1)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                                    {a}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={site.address}>
                          {site.address || <span style={{ color: 'var(--text-3)' }}>-</span>}
                        </div>
                      </td>
                      <td className="font-mono" style={{ color: 'var(--text-2)' }}>
                        {(site.latitude && site.longitude) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ border: '1px solid var(--border)', background: 'var(--bg-1)', padding: '2px 8px', borderRadius: 6, display: 'inline-block', width: 'fit-content' }}>Lat: <span style={{ color: 'var(--text-0)', }}>{Number(site.latitude).toFixed(4)}</span></span>
                            <span style={{ border: '1px solid var(--border)', background: 'var(--bg-1)', padding: '2px 8px', borderRadius: 6, display: 'inline-block', width: 'fit-content' }}>Lng: <span style={{ color: 'var(--text-0)', }}>{Number(site.longitude).toFixed(4)}</span></span>
                            <span style={{ color: 'var(--accent)', marginTop: 4, }}>{site.radius_meters}m Radius</span>
                          </div>
                        ) : <span style={{ color: 'var(--amber)', background: 'var(--status-warning-soft)', padding: '4px 8px', borderRadius: 6, display: 'inline-block', }}>No Coordinates</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: site.is_active ? 'var(--green)' : 'var(--text-3)' }} />
                          <span style={{ color: site.is_active ? 'var(--text-1)' : 'var(--text-3)' }}>{site.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                          <span style={{ color: 'var(--text-0)' }}>{analytics.total}</span>
                          <span style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', }}>Assets</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {(isAdmin || isMod) && (
                            <button onClick={(e) => { e.stopPropagation(); openEdit(site); }} className="btn-ghost btn-icon" title="Edit Site">
                              <Edit2 size={14} />
                            </button>
                          )}
                          {(isAdmin || isMod) && (
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(site.id, site.name); }} className="btn-ghost btn-icon" style={{ color: 'var(--red)' }} title="Delete Site">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    )})}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mobile-cards">
            {sites.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', }}>
                <MapPin size={32} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
                No sites configured. Add your first site to map your assets.
              </div>
            ) : (
              sites.map(site => {
                const analytics = getSiteAnalytics(site.name)
                return (
                  <div 
                    key={site.id} 
                    className="card animate-fade-up" 
                    onClick={() => openDrawer(site)}
                    style={{ 
                      padding: 16, 
                      cursor: 'pointer', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 12,
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ 
                          width: 32, 
                          height: 32, 
                          borderRadius: 8, 
                          background: 'var(--accent-glow)', 
                          color: 'var(--accent)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <MapPin size={16} />
                        </div>
                        <h3 style={{ 
                          margin: 0, 
                          color: 'var(--text-0)',
                          letterSpacing: '0.02em'
                        }}>
                          {site.name}
                        </h3>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: site.is_active ? 'var(--green)' : 'var(--text-3)' }} />
                        <span style={{ color: site.is_active ? 'var(--text-1)' : 'var(--text-3)' }}>
                          {site.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <p style={{ 
                      margin: 0, 
                      color: 'var(--text-2)', 
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {site.address || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No address provided</span>}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {(site.latitude && site.longitude) ? (
                        <span style={{ 
                          background: 'var(--bg-1)', 
                          color: 'var(--accent)', 
                          padding: '4px 10px', 
                          borderRadius: 20, 
                          border: '1.5px solid var(--accent-glow)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          Geofence: {site.radius_meters}m
                        </span>
                      ) : (
                        <span style={{ 
                          background: 'var(--status-warning-soft)', 
                          color: 'var(--amber)', 
                          padding: '4px 10px', 
                          borderRadius: 20, 
                          border: '1.5px solid var(--status-warning-soft)'
                        }}>
                          No Coordinates
                        </span>
                      )}

                      <span style={{ 
                        background: 'var(--bg-1)', 
                        color: 'var(--text-1)', 
                        padding: '4px 10px', 
                        borderRadius: 20, 
                        border: '1.5px solid var(--border)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        Assets: {analytics.total}
                      </span>

                      {analytics.openTickets > 0 && (
                        <span style={{ 
                          background: 'var(--status-danger-soft)', 
                          color: 'var(--red)', 
                          padding: '4px 10px', 
                          borderRadius: 20, 
                          border: '1.5px solid var(--status-danger-soft)'
                        }}>
                          Alerts: {analytics.openTickets}
                        </span>
                      )}
                    </div>

                    {(isAdmin || isMod) && (
                      <div 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'flex-end', 
                          gap: 8, 
                          borderTop: '1px solid var(--border)', 
                          paddingTop: 12,
                          marginTop: 4
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEdit(site); }} 
                          className="btn-ghost" 
                          style={{ 
                            padding: '6px 12px', 
                            height: 36, 
                            minHeight: 36, 
                            borderRadius: 8, 
                            background: 'var(--bg-1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(site.id, site.name); }} 
                          className="btn-ghost" 
                          style={{ 
                            padding: '6px 12px', 
                            height: 36, 
                            minHeight: 36, 
                            borderRadius: 8, 
                            color: 'var(--red)',
                            background: 'var(--bg-1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* ── SITE ANALYTICS DRAWER / MOBILE DETAIL ── */}
      {showDrawer && selectedSite && (
        isMobile ? (
          <MobileSiteDetail 
            site={selectedSite}
            siteAssets={assets.filter(a => isSiteMatch(a.site, selectedSite.name))} 
            siteTickets={tickets.filter(t => assets.filter(a => isSiteMatch(a.site, selectedSite.name)).map(a => a.id).includes(t.asset_id))}
            can={can}
            onClose={() => setShowDrawer(false)}
            navigate={navigate}
          />
        ) : (
          <>
            <div className="drawer-backdrop" onClick={() => setShowDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 100 }} />
            <div className="drawer animate-slide-in-right sites-drawer" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 450, background: 'var(--bg-1)', zIndex: 101, boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)' }}>
                <div>
                  <h2 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={20} color="var(--accent)" /> {selectedSite.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedSite.is_active ? 'var(--green)' : 'var(--red)' }} />
                    <span style={{ color: 'var(--text-2)' }}>{selectedSite.is_active ? 'Active Site' : 'Inactive Site'}</span>
                  </div>
                </div>
                <button onClick={() => setShowDrawer(false)} className="btn-ghost" style={{ padding: 8, background: 'var(--bg-1)' }}><X size={18} /></button>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <Site360Workspace 
                  site={selectedSite} 
                  siteAssets={assets.filter(a => isSiteMatch(a.site, selectedSite.name))} 
                  siteTickets={tickets.filter(t => assets.filter(a => isSiteMatch(a.site, selectedSite.name)).map(a => a.id).includes(t.asset_id))} 
                />
              </div>
              
              <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                <button onClick={() => navigate(`/assets?site=${encodeURIComponent(selectedSite.name)}`)} className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  View Assets Inventory <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </>
        )
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {showModal && (
        <div className="modal-bg" onClick={() => !saving && setShowModal(false)}>
          <div className="modal sites-modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, width: '90%' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, letterSpacing: '0.04em', }}>
                {editingSite ? 'EDIT SITE' : 'ADD NEW SITE'}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: 4 }}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="sites-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24 }}>
              {/* Form Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="lbl">Site Name <span style={{ color: 'var(--red)' }}>*</span></label>
                    <input type="text" className="inp" value={form.name} onChange={e => { setForm({ ...form, name: e.target.value.toUpperCase() }); setErrors({ ...errors, name: null }) }} placeholder="e.g. CENTRAL STORE" />
                    {errors.name && <p style={{ color: 'var(--red)', marginTop: 4 }}>{errors.name}</p>}
                  </div>
                  <div>
                    <label className="lbl">Site Code / Prefix</label>
                    <input type="text" className="inp font-mono" value={form.site_code} onChange={e => setForm({ ...form, site_code: e.target.value.toUpperCase() })} placeholder="e.g. P148, CS, HO" />
                  </div>
                </div>

                <div>
                  <label className="lbl">Site Aliases (Comma-separated)</label>
                  <input type="text" className="inp" value={form.aliases} onChange={e => setForm({ ...form, aliases: e.target.value })} placeholder="e.g. WORLI, AAKASA, AKASHA" />
                  <span style={{ color: 'var(--text-3)', display: 'block', marginTop: 4 }}>Add alternate keywords to enable instant auto-linking in imports</span>
                </div>
                
                <div>
                  <label className="lbl">Address</label>
                  <textarea className="inp" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} placeholder="Full address of the site..." />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="lbl">Latitude (GPS)</label>
                    <input type="number" step="any" className="inp" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="e.g. 19.0760" />
                  </div>
                  <div>
                    <label className="lbl">Longitude (GPS)</label>
                    <input type="number" step="any" className="inp" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="e.g. 72.8777" />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label className="lbl">Geofence Radius (meters)</label>
                    <input type="number" className="inp" value={form.radius_meters} onChange={e => setForm({ ...form, radius_meters: e.target.value })} min="10" />
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                    <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ width: 16, height: 16 }} />
                    <label htmlFor="is_active" style={{ cursor: 'pointer', userSelect: 'none' }}>Site is Active</label>
                  </div>
                </div>
              </div>

              {/* Map Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="lbl" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Interactive Map Editor</span>
                  <span style={{ color: 'var(--accent)', }}>Click map to drop pin</span>
                </label>
                <div style={{ flex: 1, minHeight: 300, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <MapContainer center={[Number(form.latitude) || 20.5937, Number(form.longitude) || 78.9629]} zoom={form.latitude ? 15 : 4} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                    <FormMapHandler 
                      position={{ lat: Number(form.latitude) || 0, lng: Number(form.longitude) || 0 }} 
                      setPosition={(pos) => setForm({ ...form, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) })}
                      radius={Number(form.radius_meters) || 0}
                    />
                  </MapContainer>
                </div>
              </div>
              
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary" style={{ minWidth: 120 }}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save Site</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 768px) {
          .sites-header-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 14px !important;
          }
          .sites-header-actions {
            width: 100% !important;
            justify-content: space-between !important;
            flex-wrap: wrap !important;
            gap: 10px !important;
          }
          .sites-drawer {
            max-width: 100% !important;
          }
          .sites-form-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
            padding: 16px !important;
          }
          .sites-modal-container {
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 20px 20px 0 0 !important;
            max-height: 92vh !important;
            margin: 0 !important;
          }
        }
        @media (max-width: 480px) {
          .sites-map-container {
            height: 380px !important;
            min-height: 380px !important;
          }
          .sites-header-actions {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .sites-header-actions > * {
            width: 100% !important;
            justify-content: center !important;
          }
        }
        @media (max-width: 1024px) {
          .desktop-table {
            display: none !important;
          }
          .mobile-cards {
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </div>
  )
}
