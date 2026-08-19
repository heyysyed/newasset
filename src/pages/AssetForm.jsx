import React, { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { 
  Save, ArrowLeft, AlertCircle, Lock, GitBranch, Package, 
  MapPin, Tag, ShoppingCart, IndianRupee, Factory, QrCode, ClipboardEdit, Calendar
} from 'lucide-react'
import { createAsset, fetchAsset, updateAsset, fetchSites, supabase, generateAssetCode, fetchEmployees } from '../lib/supabase'
import { resolveSite } from '../lib/siteResolver'
import { useAuth } from '../context/AuthContext'

const OCRInvoiceParser = lazy(() => import('../components/common/OCRInvoiceParser'))

const STATUSES   = ['Active', 'Inactive', 'Under Repair', 'Disposed', 'On Hire']
const CATEGORIES = ['Plant & Machinery', 'Tools & Equipment', 'Vehicles', 'Electronics', 'Safety Equipment', 'Scaffolding', 'IT', 'Other']
const UOM_OPTIONS = ['nos', 'kg', 'meters', 'liters', 'boxes', 'pieces', 'sets', 'rolls', 'bags', 'tons', 'sqm', 'cum', 'rft']

const EMPTY = {
  asset_code:'', asset_name:'', make:'', model_no:'', purchase_order_no:'',
  serial_no:'', capacity:'', status:'Active', category:'', site:'', type_code:'',
  purchase_date:'', warranty_expiry: '', notes:'', parent_asset_id: null, quantity:'1', uom:'nos', asset_type:'serialized',
  purchase_value:'', salvage_value:'', useful_life_years:'5',
  depreciation_method:'Straight Line', depreciation_rate_percent:'',
  assigned_to: null, assigned_employee_id: null,
  custom_fields: {}
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }) {
  return (
    <div className="card" style={{ marginBottom: 24, padding: 0, border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', background: 'rgba(79, 126, 255, 0.03)', borderBottom: '1px solid var(--border)' }}>
        {Icon && <Icon size={18} style={{ color: 'var(--accent)' }} />}
        <h2 style={{ fontFamily:'Oswald', fontWeight:600, fontSize:'0.9rem', letterSpacing:'0.05em', textTransform:'uppercase', color:'var(--text-1)', margin:0 }}>
          {title}
        </h2>
      </div>
      <div className="card-body form-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap: '20px 16px', padding: 24 }}>
        {children}
      </div>
    </div>
  )
}

function Field({ fkey, label, required, type='text', options, disabled: forceDisabled, mono, form, errors, onSet, isEdit, fieldDisabled, icon: Icon }) {
  const dis = forceDisabled || fieldDisabled(fkey)
  const err = errors[fkey]
  return (
    <div>
      <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>
        {Icon && <Icon size={14} style={{ opacity: 0.7 }} />}
        {label} 
        {required && <span style={{ color:'var(--red)' }}>*</span>}
        {dis && isEdit && <span style={{ marginLeft:4, opacity:0.5 }}><Lock size={10}/></span>}
      </label>
      {options ? (
        <select value={form[fkey]||''} onChange={e=>onSet(fkey,e.target.value)} disabled={dis} className="sel">
          <option value="">Select...</option>
          {options.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type} value={form[fkey]||''} onChange={e=>onSet(fkey, mono ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`} disabled={dis} className="inp"
          style={{ fontFamily: mono ? 'DM Mono' : 'DM Sans', fontSize: mono ? '0.85rem' : '0.875rem', colorScheme: type==='date'?'light':undefined }}
        />
      )}
      {err && <p style={{ color:'var(--red)', fontSize:'0.75rem', marginTop:6, display:'flex', alignItems:'center', gap:4, fontFamily:'DM Sans' }}><AlertCircle size={12}/>{err}</p>}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AssetForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin, can, canEditField, visibleFields, settings, currentCompany } = useAuth()
  const companyCode = currentCompany?.code || 'SBC'
  const isEdit = Boolean(id)

  const [form, setForm]   = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving]   = useState(false)
  const [errors, setErrors]   = useState({})
  const [saved, setSaved]     = useState(false)
  
  const [allAssets, setAllAssets] = useState([])
  const [siteOptions, setSiteOptions] = useState([])
  const [allSitesList, setAllSitesList] = useState([])
  const [profiles, setProfiles] = useState([])
  const [employees, setEmployees] = useState([])

  const customFields = settings?.custom_fields || []

  useEffect(() => {
    supabase.from('assets').select('id, asset_code, asset_name, category').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%').order('asset_name').then(({ data }) => setAllAssets(data || []))
    fetchSites().then(sitesData => {
      setAllSitesList(sitesData || [])
      const fromTable = (sitesData || []).map(s => s.name)
      supabase.from('assets').select('site').then(assetsRes => {
        const fromAssets = (assetsRes.data || []).map(a => a.site).filter(Boolean)
        setSiteOptions([...new Set([...fromTable, ...fromAssets])].sort())
      })
    }).catch(console.error)
    supabase.from('profiles').select('id, full_name, email, is_active').eq('is_active', true).order('full_name').then(({ data }) => setProfiles(data || []))
    fetchEmployees().then(data => setEmployees((data || []).filter(e => e.is_active))).catch(console.error)
  }, [])

  useEffect(() => {
    if (!isEdit) return
    fetchAsset(id).then(a => {
      setForm({ ...EMPTY, ...a, purchase_date: a.purchase_date || '', custom_fields: a.custom_fields || {} })
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
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const payload = { ...form, company_code: companyCode }
      delete payload.profiles
      delete payload.employees
      if (!payload.purchase_date) delete payload.purchase_date
      if (!payload.warranty_expiry) delete payload.warranty_expiry
      if (payload.checklist_template_id) payload.checklist_template_id = payload.checklist_template_id
      else delete payload.checklist_template_id
      if (!payload.parent_asset_id) delete payload.parent_asset_id
      
      const numFields = ['purchase_value', 'salvage_value', 'useful_life_years', 'depreciation_rate_percent', 'latitude', 'longitude', 'quantity']
      numFields.forEach(f => {
        if (payload[f] === '') payload[f] = null
        else if (payload[f] !== null) payload[f] = Number(payload[f])
      })

      payload.asset_type = (Number(payload.quantity) || 1) > 1 ? 'bulk' : 'serialized'
      if (!payload.uom) payload.uom = 'nos'

      if (isEdit) await updateAsset(id, payload, user?.id)
      else await createAsset(payload, user?.id)
      setSaved(true)
      setTimeout(() => navigate(isEdit ? `/assets/${id}` : '/assets'), 800)
    } catch (err) {
      if (err.code === '23505' || err.message?.includes('unique')) setErrors({ asset_code: 'This Asset Code already exists' })
      else alert('Error: ' + err.message)
    } finally { setSaving(false) }
  }

  const fieldDisabled = useCallback((key) => {
    if (isAdmin) return false
    if (!isEdit) return false
    return !canEditField(key)
  }, [isAdmin, isEdit, canEditField])

  if (!can('add') && !isEdit) return (
    <div style={{ textAlign:'center', padding:60 }}>
      <Lock size={40} style={{ color:'var(--text-3)', margin:'0 auto 16px' }}/>
      <p style={{ color:'var(--text-2)', fontFamily:'DM Sans' }}>You don't have permission to add assets.</p>
    </div>
  )

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
      <div style={{ width:32, height:32, border:'2px solid var(--accent)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const isFieldVisible = (key) => (visibleFields() || []).some(f => f?.key === key)
  
  const displayProfiles = [...profiles]
  if (form.assigned_to && !displayProfiles.some(p => p.id === form.assigned_to)) displayProfiles.push(form.profiles || { id: form.assigned_to, full_name: 'Current Assignee' })
  
  const displayEmployees = [...employees]
  if (form.assigned_employee_id && !displayEmployees.some(e => e.id === form.assigned_employee_id)) displayEmployees.push(form.employees || { id: form.assigned_employee_id, full_name: 'Current Assignee', employee_code: '—' })

  const fieldProps = { form, errors, onSet: handleSet, isEdit, fieldDisabled }

  // Generate QR preview URL using a free API (qrserver)
  const qrPreviewUrl = form.asset_code ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(form.asset_code)}&color=111827&bgcolor=ffffff` : null;

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 1240, margin: '0 auto', padding: '10px 16px 40px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/assets" className="btn-ghost" style={{ padding: 12, borderRadius: '50%', background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-2)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-0)', margin: '0 0 4px', letterSpacing: '0.02em' }}>
              {isEdit ? 'Edit Asset Profile' : 'New Asset Registration'}
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: '0.9rem', margin: 0, fontFamily: 'DM Sans' }}>
              {isEdit ? 'Update specifications and tracking details' : 'Enter specifications to generate a tracking profile'}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 32, alignItems: 'start' }}>
        
        {/* LEFT COLUMN - FORM SECTIONS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          
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
                <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}><Factory size={14}/> Category</label>
                <select value={form.category} onChange={e=>handleSet('category',e.target.value)} disabled={fieldDisabled('category')} className="sel">
                  <option value="">Select Category...</option>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {isFieldVisible('make')       && <Field fkey="make"       label="Make / Manufacturer" {...fieldProps}/>}
            {isFieldVisible('model_no')   && <Field fkey="model_no"   label="Model Number" mono {...fieldProps}/>}
            {isFieldVisible('serial_no')  && <Field fkey="serial_no"  label="Serial / VIN Number" mono {...fieldProps}/>}
            {isFieldVisible('capacity')   && <Field fkey="capacity"   label="Capacity / Specs" {...fieldProps}/>}
            
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
              <div style={{ flex: '2 1 0' }}>
                <Field fkey="quantity" label="Quantity Received" type="number" {...fieldProps}/>
              </div>
              <div style={{ flex: '1 1 0' }}>
                <label className="lbl" style={{ color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>Unit of Measure</label>
                <select value={form.uom || 'nos'} onChange={e => handleSet('uom', e.target.value)} className="sel">
                  {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            
            {Number(form.quantity) > 1 && (
              <div style={{ gridColumn: '1 / -1', padding: '16px 20px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, fontSize: '0.85rem', color: 'var(--accent)', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Package size={18} /> <strong>Bulk Asset Detected:</strong> Tracked as a batch ({form.quantity} {form.uom || 'nos'}). Individual QR tags will not be generated for each item.
              </div>
            )}
          </Section>

          <Section title="Location & Assignment" icon={MapPin}>
            {isFieldVisible('status')   && <Field fkey="status" label="Current Status" options={STATUSES} {...fieldProps}/>}
            {isFieldVisible('site') && (() => {
              const siteResolution = resolveSite(form.site, allSitesList)
              return (
                <div>
                  <label className="lbl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> Site / Location</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 400 }}>Type code, alias or select</span>
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
                        <div style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, fontSize: '0.78rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                          <span>✅ Linked to:</span>
                          {siteResolution.site_code && (
                            <span style={{ fontFamily: 'DM Mono, monospace', background: 'rgba(16,185,129,0.2)', padding: '1px 6px', borderRadius: 4 }}>
                              [{siteResolution.site_code}]
                            </span>
                          )}
                          <span>{siteResolution.site_name}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400, marginLeft: 'auto' }}>
                            (Matched by: {siteResolution.matched_by})
                          </span>
                        </div>
                      ) : (
                        <div style={{ padding: '6px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>ℹ️ Custom location string: "{form.site}". No site code or alias matched.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
            <div>
              <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>Custody Assignment</label>
              <select
                value={form.assigned_to ? `user:${form.assigned_to}` : form.assigned_employee_id ? `employee:${form.assigned_employee_id}` : ''}
                onChange={e => {
                  const val = e.target.value
                  if (!val) { handleSet('assigned_to', null); handleSet('assigned_employee_id', null) }
                  else if (val.startsWith('user:')) { handleSet('assigned_to', val.split(':')[1]); handleSet('assigned_employee_id', null) }
                  else if (val.startsWith('employee:')) { handleSet('assigned_employee_id', val.split(':')[1]); handleSet('assigned_to', null) }
                }}
                className="sel"
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
            
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}><GitBranch size={14} /> Link to Parent Asset</label>
              <select value={form.parent_asset_id || ''} onChange={e => handleSet('parent_asset_id', e.target.value || null)} className="sel">
                <option value="">Standalone Asset (No Parent)</option>
                {allAssets.filter(a => a.id !== id).map(a => <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_code})</option>)}
              </select>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 6, fontFamily: 'DM Sans' }}>Attach this as a component of a larger machine or plant assembly.</p>
            </div>
          </Section>

          <Section title="BuildSmart ERP Links & Financials" icon={ShoppingCart}>
            {isFieldVisible('purchase_order_no') && <Field fkey="purchase_order_no" label="ORDERNO (PO Number)" mono {...fieldProps}/>}
            
            <div>
              <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>REQNO (Requisition No)</label>
              <input type="text" value={form.custom_fields?.reqno || ''} onChange={e => handleSetCustom('reqno', e.target.value)} className="inp" placeholder="e.g. REQ-001" style={{ fontFamily: 'DM Mono' }} />
            </div>
            <div>
              <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>CREDNAME (Supplier)</label>
              <input type="text" value={form.custom_fields?.supplier_name || ''} onChange={e => handleSetCustom('supplier_name', e.target.value)} className="inp" placeholder="Creditor Name" />
            </div>
            <div>
              <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>TRANSREF / DOCNUMBER</label>
              <input type="text" value={form.custom_fields?.invoice_reference || ''} onChange={e => handleSetCustom('invoice_reference', e.target.value)} className="inp" placeholder="Invoice / Transaction Ref" />
            </div>
            <div>
              <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>CONTRACT / ACTIVITY (Cost Code)</label>
              <input type="text" value={form.custom_fields?.cost_code || ''} onChange={e => handleSetCustom('cost_code', e.target.value)} className="inp" placeholder="Contract or Activity Code" style={{ fontFamily: 'DM Mono' }} />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {isFieldVisible('purchase_date') ? (
                <Field fkey="purchase_date" label="Commissioning Date" type="date" {...fieldProps}/>
              ) : (
                <Field fkey="purchase_date" label="Commissioning Date" type="date" {...fieldProps}/> // Render anyway if they requested it explicitly
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600 }}>Start Of Warranty</label>
              <input type="date" value={form.custom_fields?.start_of_warranty || ''} onChange={e => handleSetCustom('start_of_warranty', e.target.value)} className="inp" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600 }}>Construction Year</label>
              <input type="number" value={form.custom_fields?.construction_year || ''} onChange={e => handleSetCustom('construction_year', e.target.value)} className="inp" placeholder="e.g. 2026" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Field fkey="warranty_expiry" label="End Of Warranty" type="date" {...fieldProps}/>
            </div>
          </Section>

          {customFields.length > 0 && (
            <Section title="Additional Custom Fields" icon={Tag}>
              {customFields.map(cf => (
                <div key={cf.key}>
                  <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>{cf.label}</label>
                  {cf.type === 'select' ? (
                    <select value={form.custom_fields?.[cf.key]||''} onChange={e=>handleSetCustom(cf.key, e.target.value)} className="sel">
                      <option value="">Select…</option>
                      {(cf.options||[]).map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={cf.type||'text'} value={form.custom_fields?.[cf.key]||''} onChange={e=>handleSetCustom(cf.key, e.target.value)} className="inp" placeholder={`Enter ${cf.label}`}/>
                  )}
                </div>
              ))}
            </Section>
          )}

          {isFieldVisible('notes') && (
            <Section title="Additional Notes" icon={ClipboardEdit}>
              <div style={{ gridColumn: '1 / -1' }}>
                <textarea value={form.notes||''} onChange={e=>handleSet('notes',e.target.value)} disabled={fieldDisabled('notes')} rows={4} className="inp" style={{ resize:'vertical', padding: '16px' }} placeholder="Any additional notes or specifications…"/>
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT COLUMN - STICKY PREVIEW & ACTIONS */}
        <div style={{ position: 'sticky', top: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Action Card */}
          <div className="card" style={{ padding: 24, border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-0)' }}>Save Entry</h3>
            <p style={{ margin: '0 0 24px', fontSize: '0.85rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
              Ensure all ERP cross-references are accurate before saving this record.
            </p>
            <div style={{ display:'flex', flexDirection: 'column', gap: 14 }}>
              <button type="submit" disabled={saving||saved} className="btn-primary" style={{
                width: '100%', padding: '14px', justifyContent: 'center', fontSize: '1.05rem', fontWeight: 600,
                background: saved ? 'linear-gradient(135deg, #059669, var(--green))' : undefined,
                boxShadow: saved ? '0 4px 20px rgba(5, 150, 105, 0.4)' : '0 4px 20px rgba(43, 127, 255, 0.4)'
              }}>
                {saving ? <><div style={{ width:18,height:18,border:'3px solid rgba(255,255,255,0.4)',borderTopColor:'white',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/> Processing…</>
                 : saved  ? <>✓ Verified & Saved</>
                 : <><Save size={18}/>{isEdit ? 'Update Asset Record' : 'Register Asset'}</>}
              </button>
              <Link to="/assets" className="btn-ghost" style={{ textDecoration:'none', justifyContent: 'center', padding: '12px', fontSize: '0.95rem' }}>Discard & Cancel</Link>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
            <div style={{ background: 'var(--bg-2)', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.03em' }}>
                <QrCode size={16} style={{ opacity: 0.8 }} /> LIVE PREVIEW
              </h3>
            </div>
            
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ 
                width: 160, height: 160, margin: '0 auto 24px', background: '#fff', borderRadius: 16, padding: 12,
                border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {qrPreviewUrl ? (
                  <img src={qrPreviewUrl} alt="QR Code Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <QrCode size={56} style={{ color: 'var(--text-4)' }} />
                )}
              </div>
              
              <div style={{ fontFamily: 'DM Mono', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-0)', marginBottom: 10, letterSpacing: '0.05em' }}>
                {form.asset_code || 'AWAITING INPUT'}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>
                {form.asset_name || 'Unnamed Asset'}
              </div>
              <div style={{ display: 'inline-flex', padding: '6px 14px', background: 'var(--bg-2)', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 20 }}>
                {form.category || 'No Category'} • {form.site || 'No Site'}
              </div>
              
              {(form.custom_fields?.supplier_name || form.purchase_order_no) && (
                <div style={{ textAlign: 'left', background: 'var(--bg-1)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-1)' }}>
                  {form.purchase_order_no && <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: 'var(--text-3)' }}>PO Number:</strong> <span style={{ fontFamily: 'DM Mono', fontWeight: 600 }}>{form.purchase_order_no}</span></div>}
                  {form.custom_fields?.supplier_name && <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: 'var(--text-3)' }}>Supplier:</strong> <span style={{ fontWeight: 600 }}>{form.custom_fields?.supplier_name}</span></div>}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </form>
  )
}
