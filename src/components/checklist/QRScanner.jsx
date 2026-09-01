import React, { useEffect } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { X, Camera, QrCode } from 'lucide-react'

export default function QRScanner({ onScan, onClose }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
    })

    scanner.render((decodedText) => {
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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-[420px] bg-[var(--bg-0)] rounded-[24px] sm:rounded-[32px] shadow-2xl overflow-hidden border border-[var(--border)] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-[var(--border)] bg-[var(--bg-1)] relative overflow-hidden">
          {/* Subtle gradient glow in header */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--accent)] via-[var(--cyan)] to-[var(--purple)]" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-sm shrink-0">
              <QrCode size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-0)] m-0 tracking-tight">Scan Asset QR</h2>
              <p className="text-xs sm:text-sm text-[var(--text-3)] m-0 mt-0.5">Point camera at the sticker</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-2)] text-[var(--text-2)] hover:bg-[var(--bg-3)] hover:text-[var(--text-0)] border border-[var(--border)] transition-colors shrink-0 relative z-10"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Scanner Container */}
        <div className="p-4 sm:p-6 bg-[var(--bg-0)] flex flex-col items-center justify-center">
          <div className="w-full rounded-[24px] overflow-hidden shadow-inner border-[4px] border-[var(--bg-2)] relative bg-[var(--bg-1)]">
            <div id="qr-reader" className="w-full" />
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 sm:p-5 bg-[var(--bg-1)] border-t border-[var(--border)] text-center">
          <p className="text-xs sm:text-sm text-[var(--text-2)] m-0 flex items-center justify-center gap-2">
            <Camera size={16} className="text-[var(--text-3)]" /> Ensure good lighting for fast scanning
          </p>
        </div>
      </div>

      <style>{`
        /* Overriding Html5QrcodeScanner default ugly styles */
        #qr-reader {
          border: none !important;
          width: 100% !important;
          margin: 0 !important;
        }
        #qr-reader__dashboard {
          padding: 24px 20px !important;
          background: transparent !important;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        #qr-reader__dashboard_section_csr span, #qr-reader__status_span {
          display: none !important;
        }
        #qr-reader img {
          display: none !important;
        }
        #qr-reader button {
          background: var(--accent) !important;
          color: white !important;
          border: none !important;
          padding: 12px 24px !important;
          border-radius: 12px !important;
          font-family: inherit !important;
          font-size: 0.95rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          width: 100%;
          transition: opacity 0.2s;
          box-shadow: 0 4px 12px var(--accent-soft);
        }
        #qr-reader button:hover {
          opacity: 0.9;
        }
        #qr-reader select {
          background: var(--bg-2) !important;
          color: var(--text-1) !important;
          border: 1px solid var(--border) !important;
          padding: 12px !important;
          border-radius: 10px !important;
          width: 100%;
          font-family: inherit;
          font-size: 0.9rem !important;
          outline: none;
        }
        #qr-reader a {
          display: none !important; /* Hide Powered by link */
        }
        #qr-reader video {
          object-fit: cover !important;
          width: 100% !important;
          border-radius: 20px !important;
        }
        #qr-reader__scan_region {
          background: var(--bg-0);
        }
      `}</style>
    </div>
  )
}


