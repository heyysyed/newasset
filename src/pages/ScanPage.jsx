import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRScanner from '../components/checklist/QRScanner'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Wifi, QrCode } from 'lucide-react'

export default function ScanPage() {
  const navigate = useNavigate()

  const [nfcActive, setNfcActive] = useState(false)
  const [qrActive, setQrActive] = useState(false)

  const handleScan = (decoded) => {
    let scannedId = decoded
    if (decoded.includes('/scan/')) scannedId = decoded.split('/scan/')[1].split(/[/?]/)[0]
    else if (decoded.includes('/assets/')) scannedId = decoded.split('/assets/')[1].split(/[/?]/)[0]
    else if (decoded.includes('?id=')) scannedId = decoded.split('?id=')[1].split('&')[0]
    
    // Redirect to the asset detail page
    navigate(`/assets/${scannedId}`, { replace: true })
  }

  const startNFCScan = async () => {
    if (!('NDEFReader' in window)) {
      toast.error('NFC is not supported on this device/browser.')
      return
    }
    try {
      const ndef = new window.NDEFReader()
      await ndef.scan()
      setNfcActive(true)
      toast.success('Ready to scan NFC tag. Bring tag close.')
      
      ndef.onreadingerror = () => {
        toast.error("Error reading NFC tag.")
      }
      
      ndef.onreading = async (event) => {
        const tagId = event.serialNumber
        if (!tagId) return
        
        toast.loading('Looking up asset...')
        const { data, error } = await supabase.from('assets').select('id').eq('nfc_tag_id', tagId).single()
        toast.dismiss()
        
        if (error || !data) {
          toast.error('Unrecognized NFC tag')
          return
        }
        
        toast.success('Asset found!')
        navigate(`/assets/${data.id}`, { replace: true })
      }
    } catch (err) {
      toast.error('NFC Scan failed: ' + err.message)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      {/* Options for scanning mode */}
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 max-w-sm mx-auto">
        
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-text-0 mb-2">Scan Asset</h2>
          <p className="text-text-3 text-sm">Choose a method to scan and track an asset.</p>
        </div>

        <button 
          onClick={startNFCScan}
          className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3 bg-purple hover:bg-purple/90 shadow-lg shadow-purple/20 border-none rounded-2xl"
        >
          <Wifi size={24} className={nfcActive ? "animate-pulse" : ""} />
          {nfcActive ? 'Listening for NFC...' : 'Scan NFC Tag'}
        </button>
        
        <div className="w-full flex items-center gap-4 text-text-3 text-sm font-semibold uppercase">
          <div className="flex-1 h-px bg-border"></div>
          OR
          <div className="flex-1 h-px bg-border"></div>
        </div>

        <button 
          onClick={() => setQrActive(true)}
          className="w-full py-4 text-lg flex items-center justify-center gap-3 bg-bg-2 border border-border text-text-1 hover:bg-bg-3 hover:text-text-0 transition-colors rounded-2xl"
          style={{ position: 'relative' }}
        >
          <QrCode size={24} />
          Scan QR Code
        </button>

      </div>
      
      {qrActive && (
        <div className="fixed top-0 left-0 z-50 w-full h-full">
           <QRScanner onScan={handleScan} onClose={() => setQrActive(false)} />
        </div>
      )}
    </div>
  )
}
