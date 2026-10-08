import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, AlertCircle, Camera, CheckCircle2, Upload, RotateCcw, Loader, ArrowRight, Shield } from 'lucide-react'
import { signIn, signUp, supabase, updateProfile } from '../lib/supabase'
import { validatePersonPhoto, validateSignatureImage } from '../lib/imageValidation'

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
  }, [searchParams])

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
    <div className="flex min-h-screen font-sans bg-white">
      {/* Left Pane - Branding & Image */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col p-8 lg:p-12 text-white lg:h-screen lg:sticky lg:top-0 lg:overflow-y-auto" style={{ backgroundColor: '#142d3a' }}>

        {/* Logo / Brand */}
        <div className="flex items-center gap-3 font-bold text-xl tracking-wide mb-8 shrink-0 text-white">
          <span style={{ fontFamily: '"Stencil Becker Solid", "Stencil", sans-serif', letterSpacing: '0.05em' }}>STRONGBUILT</span> <span className="opacity-60">/ EAM</span>
        </div>

        {/* Main Image Container */}
        <div className="flex-1 flex flex-col justify-center min-h-0 py-4">
          <div className="w-full rounded-xl overflow-hidden shadow-2xl mb-8 relative shrink">
            <img
              src="/factory_floor.jpg"
              alt="Factory Floor"
              className="w-full h-auto max-h-[45vh] object-cover block"
            />
          </div>

          {/* Typography */}
          <div className="space-y-4 max-w-md shrink-0">
            <h1 className="text-3xl xl:text-4xl 2xl:text-[42px] font-bold leading-tight tracking-tight !text-white" style={{ color: 'white' }}>
              Every asset.<br />
              Every operation.<br />
              One source of truth.
            </h1>
            <p className="text-slate-400 text-base xl:text-lg leading-relaxed mt-4 sm:mt-6 !text-slate-300" style={{ color: '#cbd5e1' }}>
              A connected workspace for the people who keep your enterprise running.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs sm:text-sm mt-8 shrink-0" style={{ color: '#647582' }}>
          © 2026 Strongbuilt · Enterprise Asset Management
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 xl:px-24 py-10 lg:py-12 max-w-[650px] mx-auto w-full">

          {/* Mobile Logo (Hidden on Desktop) */}
          <div className="lg:hidden flex items-center gap-2 font-bold text-xl tracking-wide mb-10 text-[#142d3a]">
            <span style={{ fontFamily: '"Stencil Becker Solid", "Stencil", sans-serif', letterSpacing: '0.05em' }}>STRONGBUILT</span> <span className="opacity-60">/ EAM</span>
          </div>

          <div className="mb-8 lg:mb-10">
            <p className="text-[#9eb1bc] text-[10px] sm:text-[11px] font-bold tracking-wider uppercase mb-3 sm:mb-5">
              STRONGBUILT INDUSTRIES WORKSPACE
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#172a38] mb-2 sm:mb-3 tracking-tight">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-[#647582] text-sm">
              {tab === 'login'
                ? 'Sign in to your enterprise operations workspace.'
                : 'Join your team and start managing assets.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 sm:p-4 rounded-lg flex items-start gap-3 border border-red-100">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 text-emerald-700 p-3 sm:p-4 rounded-lg flex items-start gap-3 border border-emerald-100">
                <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{success}</p>
              </div>
            )}

            {tab === 'register' && (
              <div>
                <label className="block text-[11px] sm:text-xs font-medium text-slate-600 mb-1 sm:mb-1.5">Full name *</label>
                <div className="relative">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/50 focus:border-teal-600 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[12px] sm:text-[13px] font-medium text-slate-700 mb-1 sm:mb-1.5">Work email *</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/50 focus:border-teal-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] sm:text-[13px] font-medium text-slate-700 mb-1 sm:mb-1.5">Password *</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  minLength={6}
                  className="w-full pl-3 sm:pl-4 pr-10 sm:pr-12 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/50 focus:border-teal-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {tab === 'register' && (
                <p className="text-[11px] sm:text-xs text-slate-500 mt-2">Use 12+ characters with a number and a symbol.</p>
              )}
            </div>

            {/* Registration Extras */}
            {tab === 'register' && (
              <div className="pt-3 sm:pt-4 border-t border-slate-100 space-y-4 sm:space-y-5">
                {/* Profile photo */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    Profile Photo <span className="text-slate-400 font-normal normal-case">(optional)</span>
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-4">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 ${photoError ? 'border-red-500' : 'border-teal-600'} shrink-0`} />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center shrink-0">
                          {photoChecking ? <Loader size={18} className="text-teal-600 animate-spin" /> : <Camera size={16} className="text-slate-400" />}
                        </div>
                      )}
                      <label className={`px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 w-max ${photoChecking ? 'cursor-default opacity-70' : 'cursor-pointer text-slate-700'}`}>
                        <Camera size={14} />
                        {photoChecking ? 'Checking…' : photoPreview ? 'Change Photo' : 'Upload Photo'}
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} disabled={photoChecking} />
                      </label>
                    </div>
                  </div>
                  {photoError && (
                    <div className="mt-2 bg-red-50 text-red-600 border border-red-100 rounded-lg p-2 flex items-start gap-2 text-[11px] sm:text-xs">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <p>{photoError}</p>
                    </div>
                  )}
                </div>

                {/* Signature */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">
                    Signature <span className="text-slate-400 font-normal normal-case">(optional)</span>
                  </label>
                  <div className={`border rounded-xl bg-slate-50 overflow-hidden transition-colors ${sigError ? 'border-red-300' : sigUploadPrev ? 'border-teal-500 border-solid' : 'border-slate-200 border-dashed'}`}>
                    {sigUploadPrev ? (
                      <div className="p-3 sm:p-4">
                        <img src={sigUploadPrev} alt="Signature" className="max-h-12 max-w-full mx-auto block mix-blend-multiply" />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-3 sm:mt-4 gap-2">
                          <span className="text-teal-600 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium truncate">
                            <CheckCircle2 size={12} className="shrink-0"/> <span className="truncate">{sigUploadFile?.name}</span>
                          </span>
                          <button type="button" onClick={() => { setSigUploadFile(null); setSigUploadPrev(null); setSigError('') }} className="text-[10px] sm:text-[11px] font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1 self-start sm:self-auto">
                            <RotateCcw size={10}/> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-4 sm:p-5 ${sigChecking ? 'cursor-default' : 'cursor-pointer hover:bg-slate-100/50'}`}>
                        {sigChecking ? <Loader size={20} className="text-teal-600 animate-spin" /> : <Upload size={20} className="text-slate-400" />}
                        <span className="text-[11px] sm:text-xs font-medium text-slate-700 text-center">
                          {sigChecking ? 'Verifying...' : 'Click to upload'}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleSigUpload} disabled={sigChecking} />
                      </label>
                    )}
                  </div>
                  {sigError && (
                    <div className="mt-2 bg-red-50 text-red-600 border border-red-100 rounded-lg p-2 flex items-start gap-2 text-[11px] sm:text-xs">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <p>{sigError}</p>
                    </div>
                  )}
                </div>

                {/* TOS Checkbox */}
                <div className="pt-1 sm:pt-2">
                  <label className="flex items-start gap-2 sm:gap-3 cursor-pointer group">
                    <input type="checkbox" required className="mt-0.5 shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-600" />
                    <span className="text-[12px] sm:text-sm text-slate-600 group-hover:text-slate-800 transition-colors leading-tight sm:leading-normal">
                      I agree to the Terms of Service and Privacy Policy.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Additional Login specific options */}
            {tab === 'login' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 gap-3 sm:gap-0">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-600" />
                  <span className="text-[12px] sm:text-sm text-slate-600 group-hover:text-slate-800 transition-colors">Remember me</span>
                </label>
                <button type="button" className="text-[12px] sm:text-sm text-slate-500 hover:text-slate-900 transition-colors w-max">
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2 sm:pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-max hover:opacity-90 text-white font-medium py-2.5 sm:py-3 px-6 rounded-[4px] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-[13px] sm:text-sm min-w-[120px]"
                style={{ backgroundColor: '#147d92' }} // Exact color from design
              >
                {loading ? (
                  <><Loader size={16} className="animate-spin" /> Processing…</>
                ) : (
                  <>{tab === 'login' ? 'Sign in' : 'Create account'}</>
                )}
              </button>
            </div>

            {/* Toggle Tab */}
            <div className="pt-3 sm:pt-4 text-[12px] sm:text-sm text-slate-500">
              {tab === 'login' ? (
                <span>
                  New to Strongbuilt?{' '}
                  <button type="button" onClick={() => setTab('register')} className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
                    Create an account →
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button type="button" onClick={() => setTab('login')} className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
                    Sign in →
                  </button>
                </span>
              )}
            </div>

            {/* SSO Section */}
            {tab === 'login' && (
              <>
                <div className="relative py-3 sm:py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-[11px] sm:text-sm">
                    <span className="px-3 sm:px-4 bg-white text-slate-400">or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full sm:w-max px-4 sm:px-5 py-2 sm:py-2.5 border border-slate-200 text-slate-700 font-medium rounded text-[12px] sm:text-sm hover:bg-slate-50 transition-colors"
                >
                  Company single sign-on
                </button>

                <div className="mt-6 sm:mt-8 bg-[#e8f4f6] rounded-md p-3 sm:p-3.5 flex items-start gap-2 sm:gap-2.5 text-[#147d92]">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 opacity-80" />
                  <p className="text-[11px] sm:text-xs font-medium leading-relaxed">
                    Protected by enterprise SSO and role-based access.
                  </p>
                </div>
              </>
            )}

            {tab === 'register' && (
              <div className="mt-6 sm:mt-8 bg-[#e8f4f6] rounded-md p-3 sm:p-3.5 flex items-start gap-2 sm:gap-2.5 text-[#147d92]">
                <AlertCircle size={16} className="shrink-0 mt-0.5 opacity-80" />
                <p className="text-[11px] sm:text-xs font-medium leading-relaxed">
                  Your administrator will assign your role and site access after registration.
                </p>
              </div>
            )}
          </form>

          <div className="mt-auto pt-10 sm:pt-16 flex flex-wrap justify-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-slate-400">
            <a href="#" className="hover:text-slate-600 transition-colors">Privacy policy</a>
            <span className="hidden sm:inline">·</span>
            <a href="#" className="hover:text-slate-600 transition-colors">Terms of service</a>
            <span className="hidden sm:inline">·</span>
            <a href="#" className="hover:text-slate-600 transition-colors">Help center</a>
          </div>

        </div>
      </div>
    </div>
  )
}


