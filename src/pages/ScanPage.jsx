import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import QRScanner from '../components/checklist/QRScanner'

export default function ScanPage() {
  const navigate = useNavigate()

  const handleScan = (decoded) => {
    let scannedId = decoded
    if (decoded.includes('/scan/')) scannedId = decoded.split('/scan/')[1].split(/[/?]/)[0]
    else if (decoded.includes('/assets/')) scannedId = decoded.split('/assets/')[1].split(/[/?]/)[0]
    else if (decoded.includes('?id=')) scannedId = decoded.split('?id=')[1].split('&')[0]
    
    // Redirect to the asset detail page
    navigate(`/assets/${scannedId}`, { replace: true })
  }

  return (
    <div style={{ padding: 20 }}>
      {/* The QRScanner renders as a full-screen modal by default */}
      <QRScanner onScan={handleScan} onClose={() => navigate(-1)} />
    </div>
  )
}
