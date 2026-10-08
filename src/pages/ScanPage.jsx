import React, { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRScanner from '../components/checklist/QRScanner'
import { parseAssetScan } from '../lib/safeInput'

export default function ScanPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const handleScan = useCallback((decoded) => {
    const scannedId = parseAssetScan(decoded)
    if (!scannedId) { setError('This QR code does not contain a valid asset. Please try another sticker.'); return }
    navigate(`/assets/${scannedId}`, { replace: true })
  }, [navigate])

  return (
    <div style={{ padding: 20 }}>
      {/* The QRScanner renders as a full-screen modal by default */}
      {error ? <div role="alert"><p>{error}</p><button className="btn-primary" onClick={() => setError('')}>Scan again</button></div>
        : <QRScanner onScan={handleScan} onClose={() => navigate(-1)} />}
    </div>
  )
}
