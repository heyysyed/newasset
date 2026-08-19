import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, AlertCircle, Camera, CheckCircle2, Upload, RotateCcw, Loader, ArrowRight, Shield } from 'lucide-react'
import { signIn, signUp, supabase, updateProfile } from '../lib/supabase'
import { validatePersonPhoto, validateSignatureImage } from '../lib/imageValidation'
import companyLogo from '../assets/logo.png'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab,      setTab]      = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  // Show deactivation message if redirected from Guard
  useEffect(() => {
    if (searchParams.get('deactivated') === '1') {
      setError('Your account has been deactivated. Contact an administrator.')
    }
  }, [])

  // ── Registration extras ──────────────────────────────────
  const [photoFile,     setPhotoFile]     = useState(null)
  const [photoPreview,  setPhotoPreview]  = useState(null)
  const [photoError,    setPhotoError]    = useState('')
  const [photoChecking, setPhotoChecking] = useState(false)

  const [sigUploadFile, setSigUploadFile] = useState(null)
  const [sigUploadPrev, setSigUploadPrev] = useState(null)
  const [sigError,      setSigError]      = useState('')
  const [sigChecking,   setSigChecking]   = useState(false)

  async function handlePhotoFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoError('')
    setPhotoChecking(true)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
    try {
      await validatePersonPhoto(file)
      setPhotoFile(file)
    } catch (err) {
      setPhotoError(err.message)
      setPhotoFile(null)
      setPhotoPreview(null)
    } finally {
      setPhotoChecking(false)
    }
  }

  async function handleSigUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setSigError('')
    setSigChecking(true)
    const reader = new FileReader()
    reader.onload = ev => setSigUploadPrev(ev.target.result)
    reader.readAsDataURL(file)
    try {
      await validateSignatureImage(file)
      setSigUploadFile(file)
    } catch (err) {
      setSigError(err.message)
      setSigUploadFile(null)
      setSigUploadPrev(null)
    } finally {
      setSigChecking(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      if (tab === 'login') {
        const { error: err, data: signInData } = await signIn(email, password)
        if (err) throw err
        // Check if account is deactivated
        const uid = signInData?.user?.id
        if (uid) {
          const { data: prof } = await supabase.from('profiles').select('is_active').eq('id', uid).single()
          if (prof && prof.is_active === false) {
            await supabase.auth.signOut()
            throw new Error('Your account has been deactivated. Contact an administrator.')
          }
        }
        navigate('/')
      } else {
        const { data, error: err } = await signUp(email, password, { full_name: name, role: 'user' })
        if (err) throw err

        const uid = data?.user?.id
        if (uid) {
          const updates = {}

          if (photoFile) {
            const ext  = photoFile.name.split('.').pop()
            const path = `profiles/${uid}/photo.${ext}`
            const { error: upErr } = await supabase.storage
              .from('checklist-uploads')
              .upload(path, photoFile, { upsert: true })
            if (!upErr) {
              const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
              updates.photo_url = publicUrl
            }
          }

          if (sigUploadFile) {
            const ext  = sigUploadFile.name.split('.').pop()
            const path = `profiles/${uid}/signature.${ext}`
            const { error: sigErr } = await supabase.storage
              .from('checklist-uploads')
              .upload(path, sigUploadFile, { upsert: true })
            if (!sigErr) {
              const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
              updates.signature_url = publicUrl
            }
          }

          if (Object.keys(updates).length > 0) {
            await updateProfile(uid, updates).catch(() => {})
          }
        }

        setSuccess('Account created! Check your email to confirm, then log in.')
        setTab('login')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Background decorative elements */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />
      <div className="login-bg-grid" />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }} className="animate-fade-up">

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="login-logo-wrap">
            <img src={companyLogo} alt="Strongbuilt" className="login-logo" />
          </div>
          <p style={{
            color: 'var(--text-1)', fontSize: '0.88rem', fontFamily: 'DM Sans',
            fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1.4, marginTop: 0,
          }}>
            Strongbuilt Constructions Pvt. Ltd.
          </p>
        </div>

        {/* Main card */}
        <div className="login-card">
          {/* Gradient top accent bar */}
          <div className="login-card-accent" />

          {/* Tabs */}
          <div className="login-tabs">
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
                className={`login-tab ${tab === t ? 'login-tab-active' : ''}`}
              >
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {error && (
              <div className="login-alert login-alert-error">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.83rem', fontFamily: 'DM Sans' }}>{error}</p>
              </div>
            )}
            {success && (
              <div className="login-alert login-alert-success">
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.83rem', fontFamily: 'DM Sans' }}>{success}</p>
              </div>
            )}

            {tab === 'register' && (
              <div>
                <label className="lbl">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required className="inp" />
              </div>
            )}

            <div>
              <label className="lbl">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required className="inp" style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div>
              <label className="lbl">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6} className="inp" style={{ paddingLeft: 40, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* ── Registration extras: photo + signature ── */}
            {tab === 'register' && (
              <>
                {/* Profile photo */}
                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 16 }}>
                  <label className="lbl" style={{ marginBottom: 8 }}>Profile Photo <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional — must show your face)</span></label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="Preview"
                          style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${photoError ? 'var(--red)' : 'var(--accent)'}`, flexShrink: 0 }} />
                      : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-3)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {photoChecking ? <Loader size={18} style={{ color: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} /> : <Camera size={18} style={{ color: 'var(--text-3)' }} />}
                        </div>
                    }
                    <label className="btn-ghost" style={{ cursor: photoChecking ? 'default' : 'pointer', fontSize: '0.78rem', padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px dashed var(--border)', borderRadius: 8 }}>
                      <Camera size={13} /> {photoChecking ? 'Checking…' : photoPreview ? 'Change Photo' : 'Upload Photo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFile} disabled={photoChecking} />
                    </label>
                  </div>
                  {photoError && (
                    <div style={{ marginTop: 7, background: 'var(--red-dim)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 7, padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <AlertCircle size={12} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                      <p style={{ color: 'var(--red)', fontSize: '0.72rem', fontFamily: 'DM Sans', margin: 0 }}>{photoError}</p>
                    </div>
                  )}
                </div>

                {/* Signature upload */}
                <div>
                  <label className="lbl" style={{ marginBottom: 6 }}>Signature <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional — white/light background)</span></label>
                  <div style={{ border: `1.5px solid ${sigError ? 'var(--red)' : sigUploadPrev ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, background: 'var(--bg-1)', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                    {sigUploadPrev ? (
                      <div style={{ padding: 12 }}>
                        <img src={sigUploadPrev} alt="Signature" style={{ maxHeight: 70, maxWidth: '100%', display: 'block', margin: '0 auto' }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                          <span style={{ fontSize: '0.65rem', fontFamily: 'DM Sans', fontWeight: 600, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={10}/> {sigUploadFile?.name}
                          </span>
                          <button type="button" onClick={() => { setSigUploadFile(null); setSigUploadPrev(null); setSigError('') }} className="btn-ghost"
                            style={{ padding: '2px 7px', fontSize: '0.62rem', border: 'none', background: 'transparent', fontFamily: 'DM Sans' }}>
                            <RotateCcw size={9}/> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '20px 14px', cursor: sigChecking ? 'default' : 'pointer' }}>
                        {sigChecking
                          ? <Loader size={20} style={{ color: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                          : <Upload size={20} style={{ color: 'var(--text-3)' }} />
                        }
                        <span style={{ fontSize: '0.75rem', fontFamily: 'DM Sans', color: 'var(--text-2)' }}>
                          {sigChecking ? 'Verifying signature…' : 'Click to upload signature image'}
                        </span>
                        <span style={{ fontSize: '0.62rem', fontFamily: 'DM Sans', color: 'var(--text-3)' }}>JPG, PNG, WEBP — white/light background required</span>
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSigUpload} disabled={sigChecking} />
                      </label>
                    )}
                  </div>
                  {sigError && (
                    <div style={{ marginTop: 6, background: 'var(--red-dim)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 7, padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <AlertCircle size={12} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                      <p style={{ color: 'var(--red)', fontSize: '0.72rem', fontFamily: 'DM Sans', margin: 0 }}>{sigError}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <button type="submit" disabled={loading} className="login-submit-btn">
              {loading
                ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Processing…</>
                : <>{tab === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></>
              }
            </button>

            {tab === 'login' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                color: 'var(--text-3)', fontSize: '0.76rem', fontFamily: 'DM Sans', marginTop: 2,
              }}>
                <Shield size={12} />
                <span>Admin role assignment required after registration</span>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <p style={{
            color: 'var(--text-2)', fontSize: '0.72rem', fontFamily: 'DM Sans',
            letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500,
          }}>
            Strongbuilt Asset Management System
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: '0.68rem', fontFamily: 'DM Sans', marginTop: 4 }}>
            v2.0
          </p>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-0);
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        /* Animated background orbs */
        .login-bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.5;
          pointer-events: none;
        }
        .login-bg-orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(79,126,255,0.15) 0%, transparent 70%);
          top: -150px; right: -100px;
          animation: loginFloat 20s ease-in-out infinite;
        }
        .login-bg-orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(107,150,255,0.12) 0%, transparent 70%);
          bottom: -100px; left: -100px;
          animation: loginFloat 25s ease-in-out infinite reverse;
        }
        .login-bg-orb-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: loginFloat 18s ease-in-out infinite;
        }

        /* Subtle grid pattern */
        .login-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(79,126,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,126,255,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        @keyframes loginFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }

        /* Logo container */
        .login-logo-wrap {
          width: 80px; height: 80px;
          margin: 0 auto 18px;
          border-radius: 22px;
          background: linear-gradient(145deg, #ffffff, #f0f4ff);
          border: 2px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            8px 8px 28px rgba(79,126,255,0.18),
            -4px -4px 16px rgba(255,255,255,0.9),
            inset 0 1px 0 rgba(255,255,255,0.8);
          overflow: hidden;
          padding: 10px;
        }
        .login-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        /* Card */
        .login-card {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 2px solid var(--border);
          border-radius: 24px;
          box-shadow:
            10px 10px 40px rgba(79,126,255,0.12),
            -4px -4px 20px rgba(255,255,255,0.8),
            0 1px 0 rgba(255,255,255,0.6) inset;
          position: relative;
          overflow: hidden;
        }

        .login-card-accent {
          height: 3px;
          background: linear-gradient(90deg, var(--accent), #6b96ff, var(--cyan));
          border-radius: 24px 24px 0 0;
        }

        /* Tabs */
        .login-tabs {
          display: flex;
          padding: 6px 28px 0;
          gap: 4px;
        }
        .login-tab {
          flex: 1;
          padding: 14px 8px 12px;
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Oswald', sans-serif;
          font-weight: 500;
          font-size: 0.88rem;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--text-3);
          border-bottom: 2.5px solid transparent;
          transition: all 0.25s ease;
          border-radius: 0;
        }
        .login-tab:hover {
          color: var(--text-2);
        }
        .login-tab-active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        /* Alert messages */
        .login-alert {
          border-radius: 12px;
          padding: 11px 14px;
          display: flex;
          align-items: center;
          gap: 8;
        }
        .login-alert-error {
          background: var(--red-dim);
          border: 1px solid rgba(239,68,68,0.2);
          color: var(--red);
        }
        .login-alert-success {
          background: var(--green-dim);
          border: 1px solid rgba(0,185,107,0.2);
          color: var(--green);
        }

        /* Submit button */
        .login-submit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 13px 24px;
          border-radius: 14px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: linear-gradient(135deg, var(--accent) 0%, #6b96ff 50%, #5a8aff 100%);
          color: white;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.3s ease;
          box-shadow:
            0 4px 16px rgba(79,126,255,0.35),
            0 1px 0 rgba(255,255,255,0.2) inset;
          min-height: 48px;
          margin-top: 6px;
          position: relative;
          overflow: hidden;
        }
        .login-submit-btn::before {
          content: '';
          position: absolute;
          top: 0; left: -100%; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.5s ease;
        }
        .login-submit-btn:hover:not(:disabled)::before {
          left: 100%;
        }
        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 8px 28px rgba(79,126,255,0.45),
            0 1px 0 rgba(255,255,255,0.2) inset;
        }
        .login-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* Responsive */
        @media (max-width: 480px) {
          .login-logo-wrap {
            width: 68px; height: 68px;
            border-radius: 18px;
            padding: 8px;
          }
          .login-card {
            border-radius: 20px;
          }
          .login-tabs {
            padding: 4px 20px 0;
          }
          .login-card form {
            padding: 20px 20px 24px !important;
          }
          .login-submit-btn {
            padding: 11px 20px;
            font-size: 0.85rem;
            min-height: 44px;
          }
        }
      `}</style>
    </div>
  )
}
