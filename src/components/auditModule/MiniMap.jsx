import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet icons (same as in SitesPage)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icon for items
const itemIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const verifiedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const unverifiedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function MiniMap({ site, items = [] }) {
  if (!site || !site.latitude || !site.longitude) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>No site GPS data available</span>
      </div>
    );
  }

  const center = [Number(site.latitude), Number(site.longitude)];
  const radius = Number(site.radius_meters) || 200;

  return (
    <div style={{ height: 300, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', zIndex: 0 }}>
      <MapContainer center={center} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Site center and radius */}
        <Marker position={center} opacity={0.6}>
          <Popup>Site Center: {site.name}</Popup>
        </Marker>
        <Circle center={center} radius={radius} pathOptions={{ color: 'var(--accent)', fillColor: 'var(--accent)', fillOpacity: 0.1 }} />

        {/* Scanned Items */}
        {items.filter(i => i.scan_latitude && i.scan_longitude).map(item => {
          const pos = [Number(item.scan_latitude), Number(item.scan_longitude)]
          const icon = item.geo_verified ? verifiedIcon : unverifiedIcon
          return (
            <Marker key={item.id} position={pos} icon={icon}>
              <Popup>
                <div style={{ fontFamily: 'DM Sans' }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>{item.asset?.asset_code}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{item.asset?.asset_name}</span>
                  <div style={{ marginTop: 4, fontSize: '0.7rem', color: item.geo_verified ? 'var(--green)' : 'var(--red)' }}>
                    {item.geo_verified ? 'Verified On-Site' : 'Scanned Off-Site'}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  );
}
