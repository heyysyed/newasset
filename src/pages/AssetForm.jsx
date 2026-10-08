import React, { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { 
  Save, ArrowLeft, AlertCircle, Lock, GitBranch, Package, 
  MapPin, Tag, ShoppingCart, IndianRupee, Factory, QrCode, ClipboardEdit, Calendar, Loader2,
  Camera, Image as ImageIcon, UploadCloud, Maximize, Wifi
} from 'lucide-react'
import toast from 'react-hot-toast'
import { createAsset, fetchAsset, updateAsset, fetchSites, supabase, generateAssetCode, fetchEmployees } from '../lib/supabase'
import { resolveSite } from '../lib/siteResolver'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useBreakpoint'
import QRScanner from '../components/checklist/QRScanner'
import ImageUpload from '../components/common/ImageUpload'

const OCRInvoiceParser = lazy(() => import('../components/common/OCRInvoiceParser'))

const STATUSES   = ['Active', 'Inactive', 'Under Repair', 'Disposed', 'On Hire']
const STATIC_CATEGORIES = ['Plant & Machinery', 'Tools & Equipment', 'Vehicles', 'Electronics', 'Safety Equipment', 'Scaffolding', 'IT', 'Other']

const EMPTY = {
  asset_code:'', asset_name:'', make:'', model_no:'', purchase_order_no:'',
  serial_no:'', capacity:'', status:'Active', category:'', site:'', type_code:'',
  purchase_date:'', warranty_expiry: '', notes:'', parent_asset_id: null, asset_type:'serialized',
  purchase_value:'', salvage_value:'', useful_life_years:'5',
  depreciation_method:'Straight Line', depreciation_rate_percent:'',
  assigned_to: null, assigned_employee_id: null,
  nfc_tag_id: '',
  custom_fields: {}
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-bg-1 border border-border rounded-2xl mb-6 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 bg-bg-2 border-b border-border">
        {Icon && <Icon size={18} className="text-accent" />}
        <h2 className="text-small tracking-wide uppercase text-text-1 m-0">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
        {children}
      </div>
    </div>
  )
}

function Field({ fkey, label, required, type='text', options, disabled: forceDisabled, mono, form, errors, onSet, isEdit, fieldDisabled, icon: Icon, fullWidth }) {
  const dis = forceDisabled || fieldDisabled(fkey)
  const err = errors[fkey]
  return (
    <div className={fullWidth ? 'col-span-1 md:col-span-2' : ''}>
      <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2">
        {Icon && <Icon size={14} className="opacity-70" />}
        {label} 
        {required && <span className="text-danger">*</span>}
        {dis && isEdit && <span className="ml-1 opacity-50"><Lock size={10}/></span>}
      </label>
      {options ? (
        <select 
          value={form[fkey]||''} 
          onChange={e=>onSet(fkey,e.target.value)} 
          disabled={dis} 
          className="sel w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent"
        >
          <option value="">Select...</option>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type} 
          value={form[fkey]||''} 
          onChange={e=>onSet(fkey, mono ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`} 
          disabled={dis} 
          className={`inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent ${mono ? 'font-mono text-small' : 'font-sans text-small'}`}
          style={{ colorScheme: type==='date'?'light':undefined }}
        />
      )}
      {err && <p className="text-danger text-[11px] mt-1.5 flex items-center gap-1"><AlertCircle size={12}/>{err}</p>}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AssetForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin, can, canEditField, visibleFields, settings, currentCompany } = useAuth()
  const isMobile = useIsMobile()
  const companyCode = currentCompany?.code || 'SBC'
  const isEdit = Boolean(id)

  const [form, setForm]   = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [errors, setErrors]   = useState({})
  const [saved, setSaved]     = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  
  const [allAssets, setAllAssets] = useState([])
  const [siteOptions, setSiteOptions] = useState([])
  const [allSitesList, setAllSitesList] = useState([])
  const [profiles, setProfiles] = useState([])
  const [employees, setEmployees] = useState([])
  const [checklists, setChecklists] = useState([])
  const [dbCategories, setDbCategories] = useState([])

  const customFields = settings?.custom_fields || []

  useEffect(() => {
    supabase.from('assets').select('id, asset_code, asset_name, category').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%').order('asset_name').then(({ data }) => setAllAssets(data || []))
    fetchSites().then(sitesData => {
      setAllSitesList(sitesData || [])
      // Only use official registered sites — no fallback from asset history
      setSiteOptions((sitesData || []).map(s => s.name).sort())
    }).catch(console.error)
    supabase.from('profiles').select('id, full_name, email, is_active').eq('is_active', true).order('full_name').then(({ data }) => setProfiles(data || []))
    fetchEmployees().then(data => setEmployees((data || []).filter(e => e.is_active))).catch(console.error)
    supabase.from('maintenance_checklists').select('id, name, frequency').order('name').then(({ data }) => setChecklists(data || [])).catch(console.error)
    // Load categories from DB master list
    supabase.from('asset_categories').select('name').order('name').then(({ data }) => {
      if (data && data.length > 0) setDbCategories(data.map(c => c.name))
      else setDbCategories(STATIC_CATEGORIES)
    }).catch(() => setDbCategories(STATIC_CATEGORIES))
  }, [])

  useEffect(() => {
    if (!isEdit) return
    fetchAsset(id).then(a => {
      setForm({ ...EMPTY, ...a, purchase_date: a.purchase_date || '', custom_fields: a.custom_fields || {}, nfc_tag_id: a.nfc_tag_id || '' })
      setLoading(false)
    }).catch(err => {
      console.error("Fetch error:", err)
      setLoading(false)
      if (!err.message?.includes('checklist_template_id')) navigate('/assets')
    })
  }, [id])

  useEffect(() => {
    if (isEdit) return
    if (!form.asset_name.trim() || !form.category) {
      setForm(f => ({ ...f, asset_code: '' }))
      return
    }
    let cancelled = false
    generateAssetCode(form.asset_name, form.category, companyCode).then(code => {
      if (!cancelled) setForm(f => ({ ...f, asset_code: code }))
    })
    return () => { cancelled = true }
  }, [form.asset_name, form.category, companyCode, isEdit])

  const handleSet = useCallback((key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: '' }))
  }, [])
  
  const handleSetCustom = useCallback((key, val) => {
    setForm(f => ({ ...f, custom_fields: { ...(f.custom_fields || {}), [key]: val } }))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.asset_name.trim()) errs.asset_name = 'Required'
    
    // Strict site validation
    if (form.site) {
      const siteResolution = resolveSite(form.site, allSitesList)
      if (!siteResolution.matched) {
        errs.site = 'Site does not match any registered site'
      }
    } else {
      errs.site = 'Site is required'
    }

    if (Object.keys(errs).length) { 
      setErrors(errs); 
      toast.error('Please fix the highlighted errors before saving.')
      return 
    }

    setSaving(true)
    const savePromise = (async () => {
      const payload = { ...form, company_code: companyCode }
      delete payload.profiles
      delete payload.employees
      if (!payload.purchase_date) delete payload.purchase_date
      if (!payload.warranty_expiry) delete payload.warranty_expiry
      if (payload.checklist_template_id) payload.checklist_template_id = payload.checklist_template_id
      else payload.checklist_template_id = null
      if (!payload.parent_asset_id) delete payload.parent_asset_id
      if (!payload.nfc_tag_id) payload.nfc_tag_id = null
      
      const numFields = ['purchase_value', 'salvage_value', 'useful_life_years', 'depreciation_rate_percent', 'latitude', 'longitude']
      numFields.forEach(f => {
        if (payload[f] === '') payload[f] = null
        else if (payload[f] !== null) payload[f] = Number(payload[f])
      })
      // Assets created from this form are always single serialized units
      payload.asset_type = 'serialized'
      payload.quantity = 1

      if (isEdit) await updateAsset(id, payload, user?.id)
      else await createAsset(payload, user?.id)
      setSaved(true)
      setTimeout(() => navigate(isEdit ? `/assets/${id}` : '/assets'), 1200)
    })()

    toast.promise(savePromise, {
      loading: isEdit ? 'Updating asset...' : 'Registering new asset...',
      success: isEdit ? 'Asset updated successfully!' : 'Asset registered successfully!',
      error: (err) => {
        if (err.code === '23505' || err.message?.includes('unique')) {
          setErrors({ asset_code: 'This Asset Code already exists' })
          return 'Asset code must be unique'
        }
        return 'Failed to save asset: ' + err.message
      }
    })

    try {
      await savePromise
    } catch (err) {
      // Error handled by toast.promise
    } finally { setSaving(false) }
  }

  const fieldDisabled = useCallback((key) => {
    if (isAdmin) return false
    if (!isEdit) return false
    return !canEditField(key)
  }, [isAdmin, isEdit, canEditField])

  if (!can('add') && !isEdit) return (
    <div className="flex flex-col items-center justify-center p-16 text-center">
      <Lock size={40} className="text-text-3 mb-4"/>
      <p className="text-text-2 font-sans">You don't have permission to add assets.</p>
    </div>
  )

  if (loading) return (
    <div className="flex justify-center p-16">
      <Loader2 size={32} className="text-accent animate-spin" />
    </div>
  )

  const isFieldVisible = (key) => (visibleFields() || []).some(f => f?.key === key)
  
  const displayProfiles = [...profiles]
  if (form.assigned_to && !displayProfiles.some(p => p.id === form.assigned_to)) displayProfiles.push(form.profiles || { id: form.assigned_to, full_name: 'Current Assignee' })
  
  const displayEmployees = [...employees]
  if (form.assigned_employee_id && !displayEmployees.some(e => e.id === form.assigned_employee_id)) displayEmployees.push(form.employees || { id: form.assigned_employee_id, full_name: 'Current Assignee', employee_code: '-' })

  const fieldProps = { form, errors, onSet: handleSet, isEdit, fieldDisabled }

  // Generate QR preview URL using a free API (qrserver)
  const qrPreviewUrl = form.asset_code ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(form.asset_code)}&color=111827&bgcolor=ffffff` : null;

  return (
    <>
    <form onSubmit={handleSubmit} className="w-full max-w-[1240px] mx-auto px-4 md:px-6 py-6 pb-28 md:pb-12 bg-bg-0 min-h-screen">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div className="flex items-center gap-4">
          <Link to="/assets" className="p-2.5 rounded-full bg-bg-1 border border-border text-text-2 hover:bg-bg-2 hover:text-text-1 transition-colors active:scale-95 shadow-sm">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-page-title md:text-page-title text-text-0 m-0 mb-1 tracking-wide uppercase">
              {isEdit ? 'Edit Asset Profile' : 'New Asset Registration'}
            </h1>
            <p className="text-text-3 text-small m-0 font-sans">
              {isEdit ? 'Update specifications and tracking details' : 'Enter specifications to generate a tracking profile'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-[1fr_360px] gap-6 md:gap-8 items-start">
        
        {/* LEFT COLUMN - FORM SECTIONS */}
        <div className="flex flex-col gap-0 w-full min-w-0">
          
          {!isEdit && (
            <Suspense fallback={null}>
              <OCRInvoiceParser onParsedData={(data) => {
                setForm(prev => ({
                  ...prev,
                  asset_code: data.asset_code || prev.asset_code,
                  asset_name: data.model || prev.asset_name,
                  model_no: data.model || prev.model_no,
                  serial_no: data.serial_no || prev.serial_no,
                  purchase_value: data.purchase_cost || prev.purchase_value,
                  warranty_expiry: data.warranty_expiry || prev.warranty_expiry
                }))
              }} />
            </Suspense>
          )}

          <Section title="Identity & Specifications" icon={ClipboardEdit}>
            {isFieldVisible('asset_name') && <Field fkey="asset_name" label="Asset Name" icon={Tag} required {...fieldProps}/>}
            {isFieldVisible('category') && (
              <div>
                <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', marginBottom: 8 }}><Factory size={14}/> Category</label>
                <select value={form.category} onChange={e=>handleSet('category',e.target.value)} disabled={fieldDisabled('category')} className="sel">
                  <option value="">Select Category...</option>
                  {dbCategories.map(c=><option key={c} value={c}>{c}</option>)}
                  {/* Show existing custom category if not in master list */}
                  {form.category && !dbCategories.includes(form.category) && (
                    <option value={form.category}>{form.category}</option>
                  )}
                </select>
              </div>
            )}
            {isFieldVisible('make')       && <Field fkey="make"       label="Make / Manufacturer" {...fieldProps}/>}
            {isFieldVisible('model_no')   && <Field fkey="model_no"   label="Model Number" mono {...fieldProps}/>}
            
            {isFieldVisible('serial_no') && (
              <div className="">
                <label className="flex items-center justify-between text-text-2 text-caption mb-2">
                  <span className="flex items-center gap-1.5"><QrCode size={14} className="opacity-70" /> Serial / VIN Number</span>
                  <button type="button" onClick={() => setScannerOpen(true)} className="text-[10px] uppercase font-bold text-accent bg-accent/10 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-accent/20 transition-colors border-none cursor-pointer">
                    <Maximize size={10} /> Scan
                  </button>
                </label>
                <input
                  type="text" 
                  value={form['serial_no']||''} 
                  onChange={e=>handleSet('serial_no', e.target.value.toUpperCase())}
                  placeholder={`Enter serial / vin number`} 
                  disabled={fieldDisabled('serial_no')} 
                  className={`inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-mono text-small`}
                />
                {errors['serial_no'] && <p className="text-danger text-[11px] mt-1.5 flex items-center gap-1"><AlertCircle size={12}/>{errors['serial_no']}</p>}
              </div>
            )}

            <div className="">
              <label className="flex items-center justify-between text-text-2 text-caption mb-2">
                <span className="flex items-center gap-1.5"><Wifi size={14} className="opacity-70" /> NFC Tag ID</span>
                <button 
                  type="button" 
                  onClick={async () => {
                    if (!('NDEFReader' in window)) {
                      toast.error('NFC is not supported on this device/browser. Use Chrome on Android.')
                      return
                    }
                    try {
                      const ndef = new window.NDEFReader()
                      await ndef.scan()
                      toast.success('Bring NFC tag close to your phone...')
                      ndef.onreading = event => {
                        const { serialNumber } = event
                        if (serialNumber) {
                          handleSet('nfc_tag_id', serialNumber)
                          toast.success('NFC Tag Scanned!')
                        }
                      }
                      ndef.onreadingerror = () => toast.error('Error reading NFC tag')
                    } catch(err) {
                      toast.error('NFC Scan failed: ' + err.message)
                    }
                  }} 
                  className="text-[10px] uppercase font-bold text-purple bg-purple/10 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-purple/20 transition-colors border-none cursor-pointer"
                >
                  <Wifi size={10} /> Pair Tag
                </button>
              </label>
              <input
                type="text" 
                value={form.nfc_tag_id || ''} 
                onChange={e=>handleSet('nfc_tag_id', e.target.value.toUpperCase())}
                placeholder={`Empty...`} 
                disabled={fieldDisabled('nfc_tag_id')} 
                className={`inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-mono text-small`}
              />
            </div>

            {isFieldVisible('capacity')   && <Field fkey="capacity"   label="Capacity / Specs" {...fieldProps}/>}
          </Section>

          <Section title="Media & Attachments" icon={ImageIcon}>
            <div className="col-span-1 md:col-span-2">
              <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2"><UploadCloud size={14}/> Upload Asset Photos & Documents</label>
              <ImageUpload 
                maxFiles={3} 
                onFilesChange={(newFiles) => {
                  // If we had a Supabase bucket, we would upload these to 'assets' bucket here
                  // and set the resulting URLs to form.attachments
                  console.log("Files ready for upload:", newFiles)
                }} 
              />
            </div>
          </Section>

          <Section title="Location & Assignment" icon={MapPin}>
            {isFieldVisible('status')   && <Field fkey="status" label="Current Status" options={STATUSES} {...fieldProps}/>}
            {isFieldVisible('site') && (() => {
              const siteResolution = resolveSite(form.site, allSitesList)
              return (
                <div>
                  <label className="lbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-2)', marginBottom: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> Site / Location</span>
                    <span style={{ color: 'var(--text-3)', }}>Type code, alias or select</span>
                  </label>
                  
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={form.site || ''}
                      onChange={e => {
                        const val = e.target.value
                        handleSet('site', val)
                        const res = resolveSite(val, allSitesList)
                        if (res.matched) handleSet('site_id', res.site_id)
                        else handleSet('site_id', null)
                      }}
                      placeholder="e.g. P148, WORLI, CS, CENTRAL STORE"
                      disabled={fieldDisabled('site')}
                      className="inp"
                      style={{ flex: 1 }}
                      list="site-datalist"
                    />
                    <select
                      value={siteResolution.matched ? siteResolution.site_name : (siteOptions.includes(form.site) ? form.site : '')}
                      onChange={e => {
                        const sel = e.target.value
                        handleSet('site', sel)
                        const res = resolveSite(sel, allSitesList)
                        if (res.matched) handleSet('site_id', res.site_id)
                      }}
                      disabled={fieldDisabled('site')}
                      className="sel"
                      style={{ width: 140 }}
                    >
                      <option value="">Select...</option>
                      {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <datalist id="site-datalist">
                      {allSitesList.map(s => (
                        <option key={s.id} value={s.site_code ? `[${s.site_code}] ${s.name}` : s.name}>
                          {s.name} {s.site_code ? `(${s.site_code})` : ''}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* Live Auto-Link Feedback Badge */}
                  {form.site && (
                    <div style={{ marginTop: 8 }}>
                      {siteResolution.matched ? (
                        <div style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, color: '#059669', display: 'flex', alignItems: 'center', gap: 6, }}>
                          <span>✅ Linked to:</span>
                          {siteResolution.site_code && (
                            <span style={{ background: 'rgba(16,185,129,0.2)', padding: '1px 6px', borderRadius: 4 }}>
                              [{siteResolution.site_code}]
                            </span>
                          )}
                          <span>{siteResolution.site_name}</span>
                          <span style={{ opacity: 0.8, marginLeft: 'auto' }}>
                            (Matched by: {siteResolution.matched_by})
                          </span>
                        </div>
                      ) : (
                        <div style={{ padding: '6px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>ℹ️ Custom location string: "{form.site}". No site code or alias matched.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
            <div className="col-span-1 md:col-span-2">
              <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2">Custody Assignment</label>
              <select
                value={form.assigned_to ? `user:${form.assigned_to}` : form.assigned_employee_id ? `employee:${form.assigned_employee_id}` : ''}
                onChange={e => {
                  const val = e.target.value
                  if (!val) { handleSet('assigned_to', null); handleSet('assigned_employee_id', null) }
                  else if (val.startsWith('user:')) { handleSet('assigned_to', val.split(':')[1]); handleSet('assigned_employee_id', null) }
                  else if (val.startsWith('employee:')) { handleSet('assigned_employee_id', val.split(':')[1]); handleSet('assigned_to', null) }
                }}
                className="sel w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent"
              >
                <option value="">Unassigned</option>
                <optgroup label="System Users (App Access)">
                  {displayProfiles.map(p => <option key={p.id} value={`user:${p.id}`}>{p.full_name || p.email}</option>)}
                </optgroup>
                <optgroup label="Employees (Field Staff)">
                  {displayEmployees.map(emp => <option key={emp.id} value={`employee:${emp.id}`}>{emp.full_name} ({emp.employee_code})</option>)}
                </optgroup>
              </select>
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2"><GitBranch size={14} /> Link to Parent Asset</label>
              <select value={form.parent_asset_id || ''} onChange={e => handleSet('parent_asset_id', e.target.value || null)} className="sel w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent">
                <option value="">Standalone Asset (No Parent)</option>
                {allAssets.filter(a => a.id !== id).map(a => <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_code})</option>)}
              </select>
              <p className="text-[11px] text-text-3 mt-1.5 font-sans">Attach this as a component of a larger machine or plant assembly.</p>
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2"><ClipboardEdit size={14} /> Maintenance Checklist</label>
              <select value={form.checklist_template_id || ''} onChange={e => handleSet('checklist_template_id', e.target.value || null)} className="sel w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent">
                <option value="">No checklist assigned</option>
                {checklists.map(c => <option key={c.id} value={c.id}>{c.name} {c.frequency ? `(${c.frequency})` : ''}</option>)}
              </select>
              <p className="text-[11px] text-text-3 mt-1.5 font-sans">Assign an inspection checklist to this asset.</p>
            </div>
          </Section>

          <Section title="BuildSmart ERP Links & Financials" icon={ShoppingCart}>
            {isFieldVisible('purchase_order_no') && <Field fkey="purchase_order_no" label="ORDERNO (PO Number)" mono {...fieldProps}/>}
            
            <div>
              <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2">REQNO (Requisition No)</label>
              <input type="text" value={form.custom_fields?.reqno || ''} onChange={e => handleSetCustom('reqno', e.target.value)} className="inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-mono text-small" placeholder="e.g. REQ-001" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2">CREDNAME (Supplier)</label>
              <input type="text" value={form.custom_fields?.supplier_name || ''} onChange={e => handleSetCustom('supplier_name', e.target.value)} className="inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-sans text-small" placeholder="Creditor Name" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2">TRANSREF / DOCNUMBER</label>
              <input type="text" value={form.custom_fields?.invoice_reference || ''} onChange={e => handleSetCustom('invoice_reference', e.target.value)} className="inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-sans text-small" placeholder="Invoice / Transaction Ref" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2">CONTRACT / ACTIVITY (Cost Code)</label>
              <input type="text" value={form.custom_fields?.cost_code || ''} onChange={e => handleSetCustom('cost_code', e.target.value)} className="inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-mono text-small" placeholder="Contract or Activity Code" />
            </div>

            {isFieldVisible('purchase_value')          && <Field fkey="purchase_value"          label="Capitalized Value (₹)" icon={IndianRupee} type="number" {...fieldProps}/>}
            {isFieldVisible('salvage_value')           && <Field fkey="salvage_value"           label="Salvage Value (₹)" icon={IndianRupee} type="number" {...fieldProps}/>}
            {isFieldVisible('useful_life_years')       && <Field fkey="useful_life_years"       label="Useful Life (Years)" type="number" {...fieldProps}/>}
            {isFieldVisible('depreciation_method')     && <Field fkey="depreciation_method"     label="Depreciation Method" options={['Straight Line', 'Reducing Balance', 'Declining Balance']} {...fieldProps}/>}
            {isFieldVisible('depreciation_rate_percent') && ['Reducing Balance', 'Declining Balance'].includes(form.depreciation_method) && (
              <Field fkey="depreciation_rate_percent" label="Depreciation Rate (%)" type="number" {...fieldProps}/>
            )}
          </Section>

          <Section title="Date Information" icon={Calendar}>
            <div className="flex flex-col gap-2">
              {isFieldVisible('purchase_date') ? (
                <Field fkey="purchase_date" label="Commissioning Date" type="date" {...fieldProps}/>
              ) : (
                <Field fkey="purchase_date" label="Commissioning Date" type="date" {...fieldProps}/> // Render anyway if they requested it explicitly
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-text-2 text-caption">Start Of Warranty</label>
              <input type="date" value={form.custom_fields?.start_of_warranty || ''} onChange={e => handleSetCustom('start_of_warranty', e.target.value)} className="inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-sans text-small" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-text-2 text-caption">Construction Year</label>
              <input type="number" value={form.custom_fields?.construction_year || ''} onChange={e => handleSetCustom('construction_year', e.target.value)} className="inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-sans text-small" placeholder="e.g. 2026" />
            </div>
            <div className="flex flex-col gap-2">
              <Field fkey="warranty_expiry" label="End Of Warranty" type="date" {...fieldProps}/>
            </div>
          </Section>

          {customFields.length > 0 && (
            <Section title="Additional Custom Fields" icon={Tag}>
              {customFields.map(cf => (
                <div key={cf.key}>
                  <label className="flex items-center gap-1.5 text-text-2 text-caption mb-2">{cf.label}</label>
                  {cf.type === 'select' ? (
                    <select value={form.custom_fields?.[cf.key]||''} onChange={e=>handleSetCustom(cf.key, e.target.value)} className="sel w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent">
                      <option value="">Select…</option>
                      {(cf.options||[]).map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={cf.type||'text'} value={form.custom_fields?.[cf.key]||''} onChange={e=>handleSetCustom(cf.key, e.target.value)} className="inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-sans text-small" placeholder={`Enter ${cf.label}`}/>
                  )}
                </div>
              ))}
            </Section>
          )}

          {isFieldVisible('notes') && (
            <Section title="Additional Notes" icon={ClipboardEdit}>
              <div className="col-span-1 md:col-span-2">
                <textarea value={form.notes||''} onChange={e=>handleSet('notes',e.target.value)} disabled={fieldDisabled('notes')} rows={4} className="inp w-full bg-bg-1 border border-border text-text-0 rounded-xl focus:border-accent font-sans text-small p-4 resize-y" placeholder="Any additional notes or specifications…"/>
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT COLUMN - STICKY PREVIEW & ACTIONS */}
        <div className="flex flex-col gap-6 w-full md:sticky md:top-8 z-10">
          
          {/* Action Card */}
          <div className="bg-bg-1 border border-border rounded-2xl p-6 shadow-sm hidden md:block">
            <h3 className="text-section-title text-text-0 m-0 mb-3">Save Entry</h3>
            <p className="text-small text-text-3 m-0 mb-6 leading-relaxed">
              Ensure all ERP cross-references are accurate before saving this record.
            </p>
            <div className="flex flex-col gap-3">
              <button type="submit" disabled={saving||saved} className={`btn-primary w-full py-3.5 text-[15px]  shadow-lg flex items-center justify-center gap-2 ${saved ? 'bg-green hover:bg-green/90 shadow-green/20' : 'shadow-accent/20'}`}>
                {saving ? <><Loader2 size={18} className="animate-spin"/> Processing…</>
                 : saved  ? <>✓ Verified & Saved</>
                 : <><Save size={18}/>{isEdit ? 'Update Asset Record' : 'Register Asset'}</>}
              </button>
              <Link to="/assets" className="btn-ghost w-full py-3 text-center text-[15px]">Discard & Cancel</Link>
            </div>
          </div>

          {/* Sticky Mobile Actions (Only visible on mobile) */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-bg-1 border-t border-border shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-[100]">
            <div className="flex gap-3">
              <Link to="/assets" className="btn-ghost py-3.5 px-4 bg-bg-2 border border-border text-text-1 text-small text-center">Cancel</Link>
              <button type="submit" disabled={saving||saved} className={`flex-1 btn-primary py-3.5 text-[15px]  shadow-lg flex items-center justify-center gap-2 ${saved ? 'bg-green hover:bg-green/90 shadow-green/20' : 'shadow-accent/20'}`}>
                {saving ? <Loader2 size={18} className="animate-spin"/>
                 : saved  ? <>✓ Saved</>
                 : <><Save size={18}/>{isEdit ? 'Update' : 'Save Asset'}</>}
              </button>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="bg-bg-1 border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-bg-2 px-6 py-4 border-b border-border">
              <h3 className="m-0 text-[15px] text-text-2 flex items-center gap-2 tracking-wide uppercase">
                <QrCode size={16} className="opacity-80" /> LIVE PREVIEW
              </h3>
            </div>
            
            <div className="p-8 text-center">
              <div className="w-40 h-40 mx-auto mb-6 bg-[var(--bg-surface)] rounded-2xl p-3 border border-border shadow-[0_8px_24px_rgba(0,0,0,0.06)] flex items-center justify-center">
                {qrPreviewUrl ? (
                  <img src={qrPreviewUrl} alt="QR Code Preview" className="w-full h-full object-contain" />
                ) : (
                  <QrCode size={56} className="text-text-4" />
                )}
              </div>
              
              <div className="font-mono text-section-title text-text-0 mb-2 tracking-wider">
                {form.asset_code || 'AWAITING INPUT'}
              </div>
              <div className="text-[17px] text-text-1 mb-2">
                {form.asset_name || 'Unnamed Asset'}
              </div>
              <div className="inline-flex px-3.5 py-1.5 bg-bg-2 rounded-full text-caption text-text-2 mb-5">
                {form.category || 'No Category'} • {form.site || 'No Site'}
              </div>
              
              {(form.custom_fields?.supplier_name || form.purchase_order_no) && (
                <div className="text-left bg-bg-1 p-4 rounded-xl border border-border text-[13px] text-text-1">
                  {form.purchase_order_no && <div className="mb-1.5 flex justify-between"><strong className="text-text-3 font-normal">PO Number:</strong> <span className="font-mono">{form.purchase_order_no}</span></div>}
                  {form.custom_fields?.supplier_name && <div className="flex justify-between"><strong className="text-text-3 font-normal">Supplier:</strong> <span >{form.custom_fields?.supplier_name}</span></div>}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </form>
    
    {scannerOpen && (
      <QRScanner 
        onClose={() => setScannerOpen(false)} 
        onScan={(data) => {
          handleSet('serial_no', data.toUpperCase())
          toast.success(`Scanned: ${data}`)
        }} 
      />
    )}
    </>
  )
}


