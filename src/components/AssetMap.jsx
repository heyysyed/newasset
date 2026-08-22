import React, { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { isSiteMatch } from '../lib/siteMatcher'
import { buildAsset360 } from '../lib/intelligence/assetIntelligence'
import { buildSite360 } from '../lib/intelligence/siteIntelligence'
import { Shield, Activity, TrendingDown, IndianRupee, MapPin } from 'lucide-react'

// Fix for default Leaflet icon paths in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// A custom icon for high-value clusters (optional)
const createCustomIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function AssetMap({ assets, sites }) {
  // Group assets by site
  const siteData = useMemo(() => {
    const data = {}
    assets.forEach(a => {
      if (!a.site) return
      if (!data[a.site]) {
        // Find the site to get coordinates
        const siteMeta = sites.find(s => isSiteMatch(a.site, s.name))
        data[a.site] = {
          name: a.site,
          count: 0,
          totalValue: 0,
          lat: siteMeta?.latitude ? parseFloat(siteMeta.latitude) : null,
          lng: siteMeta?.longitude ? parseFloat(siteMeta.longitude) : null,
          assets: []
        }
      }
      data[a.site].count += 1
      data[a.site].totalValue += parseFloat(a.purchase_value || 0)
      data[a.site].assets.push(a)
    })
    
    // Filter out sites that don't have valid coordinates
    return Object.values(data).filter(s => s.lat && s.lng && !isNaN(s.lat) && !isNaN(s.lng))
  }, [assets, sites])

  // Get individual assets with coordinates
  const assetMarkers = useMemo(() => {
    return assets.filter(a => a.latitude && a.longitude && !isNaN(a.latitude) && !isNaN(a.longitude))
  }, [assets])

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)

  // Default center (India roughly)
  const center = siteData.length > 0 ? [siteData[0].lat, siteData[0].lng] : assetMarkers.length > 0 ? [assetMarkers[0].latitude, assetMarkers[0].longitude] : [20.5937, 78.9629]

  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 500 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', zIndex: 10 }}>
        <h3 style={{ margin: 0, color: 'var(--text-0)' }}>GEOGRAPHICAL DISTRIBUTION</h3>
        <p style={{ margin: '4px 0 0', color: 'var(--text-2)', }}>
          Showing {assets.length} total assets mapped across {siteData.length} site locations and {assetMarkers.length} individual machine GPS coordinates.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png" alt="green marker" style={{ width: 12, height: 20 }} />
            <span style={{ color: 'var(--text-1)' }}>EXACT ASSET LOCATION</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" alt="blue marker" style={{ width: 12, height: 20 }} />
            <span style={{ color: 'var(--text-1)' }}>SITE-LEVEL AGGREGATION</span>
          </div>
        </div>
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={center} zoom={siteData.length > 0 ? 5 : 4} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {siteData.map(site => {
            // Compute Site Intelligence
            const siteIntel = buildSite360({ name: site.name, latitude: site.lat, longitude: site.lng }, { siteAssets: site.assets, maintenanceTickets: [] })
            
            return (
              <Marker 
                key={site.name} 
                position={[site.lat, site.lng]}
                icon={createCustomIcon(site.totalValue > 500000 ? 'red' : site.totalValue > 100000 ? 'orange' : 'blue')}
              >
                <Popup>
                  <div style={{ padding: 4, minWidth: 220 }}>
                    <div style={{ color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 4 }}>SITE INTELLIGENCE 360</div>
                    <h4 style={{ margin: '0 0 8px', borderBottom: '1px solid #eee', paddingBottom: 6, }}>{site.name}</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      <div style={{ background: 'var(--bg-2)', padding: 6, borderRadius: 6 }}>
                        <div style={{ color: 'var(--text-3)' }}>TOTAL ASSETS</div>
                        <div >{site.count}</div>
                      </div>
                      <div style={{ background: 'var(--bg-2)', padding: 6, borderRadius: 6 }}>
                        <div style={{ color: 'var(--text-3)' }}>HEALTH</div>
                        <div style={{ color: siteIntel.health.data.score > 70 ? 'var(--green)' : 'var(--amber)' }}>{siteIntel.health.data.score}%</div>
                      </div>
                      <div style={{ background: 'var(--bg-2)', padding: 6, borderRadius: 6 }}>
                        <div style={{ color: 'var(--text-3)' }}>RISK</div>
                        <div style={{ color: siteIntel.risk.data.level === 'HIGH' ? 'var(--red)' : 'var(--text-1)' }}>{siteIntel.risk.data.level}</div>
                      </div>
                      <div style={{ background: 'var(--bg-2)', padding: 6, borderRadius: 6 }}>
                        <div style={{ color: 'var(--text-3)' }}>DOWN</div>
                        <div style={{ color: siteIntel.portfolio.data.downAssets > 0 ? 'var(--red)' : 'var(--text-1)' }}>{siteIntel.portfolio.data.downAssets}</div>
                      </div>
                    </div>
                    <p style={{ margin: '4px 0', }}><strong>CapEx Exposed:</strong> <span style={{ color: 'var(--accent)', }}>{formatCurrency(site.totalValue)}</span></p>
                  </div>
                </Popup>
              </Marker>
            )
          })}
          
          {assetMarkers.map(a => {
            const assetIntel = buildAsset360(a, { tickets: [], logs: [] }, { hasFinancialAccess: true })
            return (
            <Marker 
              key={`asset-${a.id}`} 
              position={[a.latitude, a.longitude]}
              icon={createCustomIcon(assetIntel.health.data.score < 50 ? 'red' : assetIntel.health.data.score < 80 ? 'orange' : 'green')}
            >
              <Popup>
                <div style={{ padding: 4, minWidth: 200 }}>
                  <div style={{ color: 'var(--green)', textTransform: 'uppercase', marginBottom: 4 }}>ASSET INTELLIGENCE 360</div>
                  <h4 style={{ margin: '0 0 4px', }}>{a.asset_name}</h4>
                  <p style={{ margin: '0 0 8px', color: 'var(--text-3)', borderBottom: '1px solid #eee', paddingBottom: 6 }}>{a.asset_code}</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    <div style={{ background: 'var(--bg-2)', padding: 6, borderRadius: 6 }}>
                      <div style={{ color: 'var(--text-3)' }}>HEALTH</div>
                      <div style={{ color: assetIntel.health.data.score > 70 ? 'var(--green)' : 'var(--amber)' }}>{assetIntel.health.data.score}%</div>
                    </div>
                    <div style={{ background: 'var(--bg-2)', padding: 6, borderRadius: 6 }}>
                      <div style={{ color: 'var(--text-3)' }}>RISK</div>
                      <div style={{ color: assetIntel.risk.data.level === 'HIGH' ? 'var(--red)' : 'var(--text-1)' }}>{assetIntel.risk.data.level}</div>
                    </div>
                  </div>
                  
                  <p style={{ margin: '4px 0', }}><strong>Value:</strong> <span style={{ color: 'var(--accent)', }}>{formatCurrency(a.purchase_value || 0)}</span></p>
                  <p style={{ margin: '4px 0', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} /> {assetIntel.location.data.precision}
                  </p>
                </div>
              </Popup>
            </Marker>
          )})}
        </MapContainer>
      </div>
    </div>
  )
}
