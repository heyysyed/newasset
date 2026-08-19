import React, { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { isSiteMatch } from '../lib/siteMatcher'

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
        <h3 style={{ margin: 0, fontFamily: 'Oswald', fontSize: '1.2rem', color: 'var(--text-0)' }}>GEOGRAPHICAL DISTRIBUTION</h3>
        <p style={{ margin: '4px 0 0', color: 'var(--text-2)', fontSize: '0.85rem' }}>
          Showing {assets.length} total assets mapped across {siteData.length} site locations and {assetMarkers.length} individual machine GPS coordinates.
        </p>
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={center} zoom={siteData.length > 0 ? 5 : 4} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {siteData.map(site => (
            <Marker 
              key={site.name} 
              position={[site.lat, site.lng]}
              icon={createCustomIcon(site.totalValue > 500000 ? 'red' : site.totalValue > 100000 ? 'orange' : 'blue')}
            >
              <Popup>
                <div style={{ padding: 4 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: 6 }}>{site.name}</h4>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>Asset Count:</strong> {site.count}</p>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>Total Value:</strong> <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{formatCurrency(site.totalValue)}</span></p>
                </div>
              </Popup>
            </Marker>
          ))}
          
          {assetMarkers.map(a => (
            <Marker 
              key={`asset-${a.id}`} 
              position={[a.latitude, a.longitude]}
              icon={createCustomIcon('green')}
            >
              <Popup>
                <div style={{ padding: 4 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: 6 }}>{a.asset_name}</h4>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem', fontFamily: 'DM Mono' }}>{a.asset_code}</p>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem' }}><strong>Value:</strong> <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{formatCurrency(a.purchase_value || 0)}</span></p>
                  <p style={{ margin: '4px 0', fontSize: '0.75rem', color: 'var(--text-3)' }}>Scanned Location</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
