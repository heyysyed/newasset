import React, { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { RotateCcw, CheckCircle2 } from 'lucide-react'

export default function SignaturePad({ onSave, onClear, label = 'Sign here' }) {
  const sigCanvas = useRef(null)
  const [captured, setCaptured] = useState(false)

  // Auto-save every time the user lifts the pen — no separate Save button needed
  const handleEnd = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return
    const dataURL = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png')
    onSave(dataURL)
    setCaptured(true)
  }

  const clear = () => {
    sigCanvas.current.clear()
    setCaptured(false)
    onSave(null)        // tell parent signature is gone
    if (onClear) onClear()
  }

  return (
    <div style={{ marginBottom: 4 }}>
      {label ? <label className="lbl">{label}</label> : null}
      <div style={{
        border: `1.5px solid ${captured ? 'var(--green)' : 'var(--border)'}`,
        borderRadius: 12,
        background: 'var(--bg-1)',
        overflow: 'hidden',
        position: 'relative',
        transition: 'border-color 0.2s',
      }}>
        <SignatureCanvas
          ref={sigCanvas}
          penColor="#2b7fff"
          onEnd={handleEnd}
          canvasProps={{ style: { width: '100%', height: 160, cursor: 'crosshair', display: 'block' } }}
        />

        {/* Watermark hint */}
        {!captured && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none', userSelect: 'none',
            fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: 'DM Sans',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.5,
          }}>
            <span style={{ fontSize: '1.4rem' }}>✍️</span>
            Sign here
          </div>
        )}

        {/* Status bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px',
          background: captured ? 'rgba(0,185,107,0.08)' : 'rgba(0,0,0,0.03)',
          borderTop: '1px solid var(--border)',
        }}>
          {captured
            ? <span style={{ fontSize: '0.68rem', color: 'var(--green)', fontFamily: 'DM Sans', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} /> Signature captured
              </span>
            : <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>Draw your signature above</span>
          }
          <button
            type="button"
            onClick={clear}
            className="btn-ghost"
            style={{ padding: '3px 9px', fontSize: '0.68rem', fontFamily: 'DM Sans', border: 'none', background: 'transparent' }}
          >
            <RotateCcw size={11} /> Clear
          </button>
        </div>
      </div>
    </div>
  )
}
