import React, { useRef, useState, useEffect } from 'react'
import { Eraser, Check, PenTool } from 'lucide-react'

export default function ESignaturePad({ onSave, onClear, label = "Digital Signature Sign-off" }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#4f7eff'
  }, [])

  const startDrawing = (e) => {
    setIsDrawing(true)
    setIsEmpty(false)
    draw(e)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas && onSave) {
      const dataUrl = canvas.toDataURL('image/png')
      onSave(dataUrl)
    }
  }

  const draw = (e) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    
    const x = clientX - rect.left
    const y = clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.beginPath()
    setIsEmpty(true)
    if (onClear) onClear()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="lbl" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, }}>
          <PenTool size={14} color="var(--accent)" /> {label} *
        </label>
        <button 
          type="button" 
          onClick={clearCanvas} 
          className="btn-ghost" 
          style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Eraser size={13} /> Clear
        </button>
      </div>

      <div style={{ position: 'relative', border: '1.5px dashed var(--border)', borderRadius: 12, background: 'var(--bg-2)', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={440}
          height={130}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          style={{ width: '100%', height: 130, cursor: 'crosshair', touchAction: 'none' }}
        />
        {isEmpty && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--text-3)', }}>
            Sign here using finger or mouse cursor...
          </div>
        )}
      </div>
    </div>
  )
}
