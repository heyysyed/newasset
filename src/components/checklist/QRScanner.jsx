import React, { useEffect } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { X, Camera } from 'lucide-react'

export default function QRScanner({ onScan, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    })

    scanner.render((decodedText) => {
      // Assuming QR contains the Asset ID/UUID
      scanner.clear()
      onScan(decodedText)
    }, (error) => {
      // console.warn(error)
    })

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner", err))
    }
  }, [onScan])

  return (
    <div className="modal-bg" style={{ zIndex: 2000 }}>
      <div className="modal" style={{ maxWidth: 500, padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ background: 'var(--bg-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
              <Camera size={18} />
            </div>
            <div>
              <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0, color: 'var(--text-0)' }}>SCAN ASSET QR</h2>
              <span style={{ color: 'var(--text-3)', }}>Point at the sticker QR code</span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
        </div>
        
        <div style={{ padding: 24, background: 'var(--bg-1)' }}>
          <div id="qr-reader" style={{ width: '100%', borderRadius: 12, overflow: 'hidden', border: 'none' }} />
        </div>
        
        <div style={{ padding: '14px 24px', background: 'var(--bg-2)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-3)', margin: 0 }}>
            Make sure the QR code is well-lit and within the box.
          </p>
        </div>
      </div>

      <style>{`
        #qr-reader__dashboard {
          padding: 20px !important;
          background: var(--bg-2) !important;
          border-top: 1px solid var(--border) !important;
        }
        #qr-reader__status_span {
          display: none !important;
        }
        #qr-reader img {
          display: none !important;
        }
        #qr-reader button {
          background: var(--accent) !important;
          color: white !important;
          border: none !important;
          padding: 8px 16px !important;
          border-radius: 6px !important;
          font-family: var(--font-sans) !important;
          font-size: 0.85rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
        }
        #qr-reader select {
          background: var(--bg-3) !important;
          color: var(--text-1) !important;
          border: 1px solid var(--border) !important;
          padding: 6px !important;
          border-radius: 4px !important;
          margin: 10px 0 !important;
        }
      `}</style>
    </div>
  )
}


