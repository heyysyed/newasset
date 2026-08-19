import React, { useRef, useState, useEffect } from 'react'
import { Camera, RotateCcw, Check, X, UserCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * SelfieCapture — opens device camera, captures a photo, uploads to Supabase Storage.
 * Optional: save the photo as the user's profile picture.
 *
 * Props:
 *   userId       — logged-in user id (for profile photo save)
 *   onCapture(url) — called when photo is confirmed & uploaded
 *   onClear()    — called when selfie is removed
 */
export default function SelfieCapture({ userId, onCapture, onClear }) {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [mode,          setMode]          = useState('idle')   // idle | camera | captured | done
  const [photoDataUrl,  setPhotoDataUrl]  = useState(null)
  const [photoUrl,      setPhotoUrl]      = useState(null)     // uploaded public URL
  const [saveToProfile, setSaveToProfile] = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [error,         setError]         = useState('')

  // Stop camera stream on unmount
  useEffect(() => () => stopCamera(), [])

  // Attach stream to video element once it's in the DOM (after mode → 'camera')
  useEffect(() => {
    if (mode === 'camera' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [mode])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      setMode('camera')   // render the <video> first, then useEffect attaches the stream
    } catch {
      setError('Camera access denied. Please allow camera permission in your browser.')
    }
  }

  const capture = () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
    setPhotoDataUrl(dataUrl)
    stopCamera()
    setMode('captured')
  }

  const retake = () => {
    setPhotoDataUrl(null)
    setPhotoUrl(null)
    onClear?.()
    startCamera()
  }

  const confirmPhoto = async () => {
    if (!photoDataUrl) return
    setUploading(true)
    try {
      // base64 → blob
      const res  = await fetch(photoDataUrl)
      const blob = await res.blob()
      const path = `selfies/${userId || 'anon'}/${Date.now()}.jpg`

      const { error: upErr } = await supabase.storage
        .from('checklist-uploads')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)

      // Optionally save as profile photo
      if (saveToProfile && userId) {
        await supabase.from('profiles').update({ photo_url: publicUrl }).eq('id', userId)
      }

      setPhotoUrl(publicUrl)
      setMode('done')
      onCapture(publicUrl)
    } catch (err) {
      setError('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const clear = () => {
    stopCamera()
    setPhotoDataUrl(null)
    setPhotoUrl(null)
    setMode('idle')
    setError('')
    onClear?.()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (mode === 'done' && photoDataUrl) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <img
          src={photoDataUrl}
          alt="Identity selfie"
          style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--green)', boxShadow: '0 2px 8px rgba(0,185,107,0.25)' }}
        />
        <div>
          <div style={{ fontSize: '0.72rem', fontFamily: 'DM Sans', fontWeight: 700, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={12} /> Selfie verified
          </div>
          {saveToProfile && (
            <div style={{ fontSize: '0.65rem', fontFamily: 'DM Sans', color: 'var(--text-3)', marginTop: 1 }}>Saved to profile</div>
          )}
        </div>
        <button type="button" onClick={clear} className="btn-ghost"
          style={{ padding: '4px 9px', fontSize: '0.68rem', color: 'var(--red)', marginLeft: 'auto' }}>
          <X size={11} /> Remove
        </button>
      </div>
    )
  }

  if (mode === 'captured' && photoDataUrl) {
    return (
      <div>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
          <img
            src={photoDataUrl}
            alt="Preview"
            style={{ width: '100%', maxWidth: 280, borderRadius: 12, border: '1px solid var(--border)', display: 'block' }}
          />
          {/* Oval face guide overlay */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ width: '55%', height: '75%', borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.6)' }} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={saveToProfile} onChange={e => setSaveToProfile(e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 13, height: 13 }} />
          <span style={{ fontSize: '0.72rem', fontFamily: 'DM Sans', color: 'var(--text-1)' }}>
            Save as my profile photo
          </span>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={retake} className="btn-ghost" style={{ fontSize: '0.75rem' }}>
            <RotateCcw size={12} /> Retake
          </button>
          <button type="button" onClick={confirmPhoto} disabled={uploading}
            className="btn-primary" style={{ fontSize: '0.75rem' }}>
            <Check size={12} /> {uploading ? 'Uploading…' : 'Use this photo'}
          </button>
        </div>
        {error && <p style={{ fontSize: '0.68rem', color: 'var(--red)', fontFamily: 'DM Sans', marginTop: 6 }}>{error}</p>}
      </div>
    )
  }

  if (mode === 'camera') {
    return (
      <div>
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 8, background: '#000' }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: '100%', display: 'block', maxWidth: 280, borderRadius: 12 }}
          />
          {/* Face oval guide */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ width: '55%', height: '75%', borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.5)' }} />
          </div>
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}>
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'DM Sans', background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 10 }}>
              Centre your face in the oval
            </span>
          </div>
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={capture} className="btn-primary" style={{ fontSize: '0.78rem', flex: 1 }}>
            <Camera size={13} /> Capture
          </button>
          <button type="button" onClick={clear} className="btn-ghost" style={{ fontSize: '0.78rem' }}>
            <X size={13} /> Cancel
          </button>
        </div>
      </div>
    )
  }

  // idle
  return (
    <div>
      <button type="button" onClick={startCamera} className="btn-ghost"
        style={{ fontSize: '0.78rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 7, width: '100%', justifyContent: 'center', border: '1px dashed var(--border)', borderRadius: 10 }}>
        <Camera size={14} style={{ color: 'var(--cyan)' }} />
        <span style={{ fontFamily: 'DM Sans' }}>Add Selfie Verification</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginLeft: 4 }}>(optional · enhanced proof)</span>
      </button>
      {error && <p style={{ fontSize: '0.68rem', color: 'var(--red)', fontFamily: 'DM Sans', marginTop: 6 }}>{error}</p>}
    </div>
  )
}
