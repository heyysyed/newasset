import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  supabase, deleteAsset, transferAsset, fetchFilterOptions,
  fetchAssetPhotos, uploadAssetPhoto, deleteAssetPhoto,
  fetchAssetAttachments, uploadAssetAttachment, deleteAssetAttachment,
  fetchAssetDocuments, uploadAssetDocument, deleteAssetDocument,
  fetchChildAssets, linkChildAsset, unlinkChildAsset, searchAssetsForLinking,
  fetchMaintenanceSubmissions, fetchAsset,
} from '../lib/supabase'
import {
  Edit2, ArrowLeft, Tag, Trash2, Calendar, MapPin, Clock, History, Wrench,
  Gauge, Info, IndianRupee, ClipboardList, Send, X, Camera, Image, Upload,
  FileText, Download, Loader2, ChevronDown, ChevronRight, Eye, Copy, Layers,
  GitBranch, Link2, Unlink, Search, Plus, Package, Shield, AlertTriangle,
  CheckCircle2, XCircle, TrendingDown, Hash, Building2, User, Clipboard,
  BarChart3, Activity, Zap, ArrowRight, ExternalLink, MoreVertical,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useAuth } from '../context/AuthContext'
import { calculateBookValue, formatCurrency } from '../lib/depreciation'
import { calculateAssetHealth } from '../lib/predictiveMaintenance'
import AssetTimeline from '../components/assets/AssetTimeline'

/* ───── constants ───── */
const STATUS_BADGE = {
  Active: 'badge-active', Inactive: 'badge-inactive',
  'Under Repair': 'badge-repair', Disposed: 'badge-disposed', 'On Hire': 'badge-onhire'
}
const CONDITIONS = ['Operational', 'Damaged', 'Needs Repair', 'Non-Functional', 'Missing']
const COND_COLOR = { 
  Operational: '#00b96b', Good: '#00b96b', Excellent: '#00b96b', 
  Damaged: '#f59e0b', Fair: '#f59e0b', 
  'Needs Repair': '#06b6d4', 
  'Non-Functional': '#ef4444', Poor: '#ef4444', Critical: '#ef4444', 
  Missing: '#64748b' 
}
const COND_ICON = { 
  Operational: CheckCircle2, Good: CheckCircle2, Excellent: CheckCircle2, 
  Damaged: AlertTriangle, Fair: AlertTriangle, 
  'Needs Repair': Wrench, 
  'Non-Functional': XCircle, Poor: XCircle, Critical: XCircle, 
  Missing: HelpCircle 
}

/* ───── helpers ───── */
function daysAgo(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now - d) / 86400000)
}
function ageLabel(dateStr) {
  const days = daysAgo(dateStr)
  if (days === null) return '—'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  return m > 0 ? `${y}y ${m}mo` : `${y}y`
}
function warrantyDaysLeft(dateStr) {
  if (!dateStr) return null
  const exp = new Date(dateStr)
  const now = new Date()
  return Math.ceil((exp - now) / 86400000)
}

/* ───── Reusable Pill Tab ───── */
const PillTab = ({ active, onClick, icon: Icon, label, count }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
    borderRadius: 12, cursor: 'pointer',
    background: active ? 'linear-gradient(135deg, var(--accent), #6b96ff)' : 'var(--bg-2)',
    color: active ? '#fff' : 'var(--text-2)',
    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '0.8rem',
    boxShadow: active ? '0 4px 16px rgba(79,126,255,0.35)' : 'var(--clay-shadow-sm)',
    border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
    whiteSpace: 'nowrap',
  }}>
    <Icon size={14} />
    <span>{label}</span>
    {count !== undefined && count !== null && (
      <span style={{
        fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10,
        background: active ? 'rgba(255,255,255,0.25)' : 'var(--bg-3)',
        color: active ? '#fff' : 'var(--text-3)',
        minWidth: 20, textAlign: 'center',
      }}>{count}</span>
    )}
  </button>
)

/* ───── Section Card ───── */
function SectionCard({ title, icon: Icon, children, defaultOpen = true, actions, noPad, accentColor }) {
  const [open, setOpen] = useState(defaultOpen)
  const accent = accentColor || 'var(--accent)'
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1.5px solid var(--border)', borderRadius: 18,
      boxShadow: 'var(--clay-shadow)', overflow: 'hidden',
    }}>
      <div onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
        cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}12`, color: accent, flexShrink: 0,
        }}>
          {Icon && <Icon size={15} />}
        </div>
        <h3 style={{
          fontFamily: "'Oswald', sans-serif", fontSize: '0.82rem', textTransform: 'uppercase',
          margin: 0, color: 'var(--text-1)', flex: 1, letterSpacing: '0.04em', fontWeight: 600,
        }}>{title}</h3>
        {actions && <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>{actions}</div>}
        <div style={{
          width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-3)',
        }}>
          {open ? <ChevronDown size={13} style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-3)' }} />}
        </div>
      </div>
      {open && <div style={{ padding: noPad ? 0 : 20 }}>{children}</div>}
    </div>
  )
}

/* ───── Info Field ───── */
const InfoField = ({ label, value, mono, icon: FieldIcon, accent }) => {
  if (value === undefined || value === null || value === '') return null
  return (
    <div style={{
      padding: '14px 16px', background: 'var(--bg-1)', borderRadius: 12,
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {FieldIcon && <FieldIcon size={11} style={{ color: accent || 'var(--text-3)' }} />}
        <p style={{
          fontFamily: "'Oswald', sans-serif", fontWeight: 500, fontSize: '0.6rem',
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', margin: 0,
        }}>{label}</p>
      </div>
      <p style={{
        fontFamily: mono ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
        fontSize: '0.88rem', color: 'var(--text-0)', fontWeight: mono ? 500 : 600, margin: 0,
        wordBreak: 'break-word',
      }}>{value}</p>
    </div>
  )
}

/* ───── Stat Mini Card ───── */
const StatMini = ({ label, value, icon: Icon, color, sub }) => (
  <div style={{
    padding: '16px', background: 'var(--bg-2)', borderRadius: 14,
    border: '1.5px solid var(--border)', boxShadow: 'var(--clay-shadow-sm)',
    display: 'flex', alignItems: 'center', gap: 14,
    position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}60)` }} />
    <div style={{
      width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `${color}12`, color: color, flexShrink: 0,
    }}>
      <Icon size={20} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--text-0)', margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  </div>
)

/* ───── Empty State ───── */
const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div style={{ padding: '48px 20px', textAlign: 'center' }}>
    <div style={{
      width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
      background: 'linear-gradient(135deg, var(--bg-3), var(--bg-4))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'var(--clay-shadow-sm)',
    }}>
      <Icon size={28} style={{ color: 'var(--text-3)', opacity: 0.5 }} />
    </div>
    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-2)', margin: '0 0 4px' }}>{title}</p>
    {description && <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', margin: '0 0 16px', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>{description}</p>}
    {action}
  </div>
)

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════ */
export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin, can, canEditField, visibleFields } = useAuth()

  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [asset, setAsset] = useState(null)
  const [movements, setMovements] = useState([])
  const [maintenance, setMaintenance] = useState({ tickets: [], schedules: [], logs: [] })
  const [utilities, setUtilities] = useState([])
  const [audit, setAudit] = useState([])
  const [photos, setPhotos] = useState([])
  const [attachments, setAttachments] = useState([])
  const [relatedAssets, setRelatedAssets] = useState([])
  const [childAssets, setChildAssets] = useState([])
  const [parentAsset, setParentAsset] = useState(null)
  const [checklistHistory, setChecklistHistory] = useState([])
  const [linkedChecklists, setLinkedChecklists] = useState({ daily: null, weekly: null, monthly: null })
  const [qrUrl, setQrUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  
  // Documents
  const [documents, setDocuments] = useState([])
  const [docUploading, setDocUploading] = useState(false)

  // GPS Update
  const [updatingGPS, setUpdatingGPS] = useState(false)

  // Child asset linking
  const [showLinkChild, setShowLinkChild] = useState(false)
  const [childSearch, setChildSearch] = useState('')
  const [childSearchResults, setChildSearchResults] = useState([])
  const [childSearching, setChildSearching] = useState(false)

  // Transfer
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [transferNotes, setTransferNotes] = useState('')
  const [sites, setSites] = useState([])
  const [transferring, setTransferring] = useState(false)

  // Uploading state
  const [photoUploading, setPhotoUploading] = useState(false)
  const [attachUploading, setAttachUploading] = useState(false)

  // Condition editing
  const [editingCondition, setEditingCondition] = useState(false)

  const assigneeLabel = useMemo(() => {
    if (!asset) return 'Unassigned'
    if (asset.profiles) {
      const p = Array.isArray(asset.profiles) ? asset.profiles[0] : asset.profiles
      if (p) return `${p.full_name || p.email}`
    }
    if (asset.employees) {
      const e = Array.isArray(asset.employees) ? asset.employees[0] : asset.employees
      if (e) return `${e.full_name} (${e.employee_code})`
    }
    return 'Unassigned'
  }, [asset])

  const assigneeType = useMemo(() => {
    if (!asset) return null
    if (asset.profiles) {
      const p = Array.isArray(asset.profiles) ? asset.profiles[0] : asset.profiles
      if (p) return 'user'
    }
    if (asset.employees) {
      const e = Array.isArray(asset.employees) ? asset.employees[0] : asset.employees
      if (e) return 'employee'
    }
    return null
  }, [asset])

  useEffect(() => { fetchAssetData() }, [id])

  async function fetchAssetData() {
    setLoading(true)
    try {
      const a = await fetchAsset(id)
      if (!a) throw new Error('Asset not found')

      const [mov, tkt, sch, utl, aud, mlg, ph, att, docs] = await Promise.all([
        supabase.from('asset_movements').select('*, profiles:profiles!moved_by(full_name)').eq('asset_id', id).order('moved_at', { ascending: false }),
        supabase.from('maintenance_tickets').select('*, profiles:profiles!reported_by(full_name)').eq('asset_id', id).order('created_at', { ascending: false }),
        supabase.from('maintenance_schedules').select('*').eq('asset_id', id).order('next_due'),
        supabase.from('utility_readings').select('*, profiles!recorded_by(full_name)').eq('asset_id', id).order('reading_date', { ascending: false }),
        supabase.from('asset_audit').select('*, profiles!user_id(full_name)').eq('asset_id', id).order('created_at', { ascending: false }),
        supabase.from('maintenance_logs').select('*, profiles!performed_by(full_name)').eq('asset_id', id).order('performed_at', { ascending: false }),
        fetchAssetPhotos(id),
        fetchAssetAttachments(id),
        fetchAssetDocuments(id),
      ])

      setAsset(a)
      setMovements(mov.data || [])
      setMaintenance({ tickets: tkt.data || [], schedules: sch.data || [], logs: mlg.data || [] })
      setUtilities(utl.data || [])
      setAudit(aud.data || [])
      setPhotos(ph)
      setAttachments(att)
      setDocuments(docs)

      // Fetch child assets
      try {
        const children = await fetchChildAssets(id)
        setChildAssets(children)
      } catch (e) { console.error('Child assets:', e) }

      // Fetch checklist history for this asset
      try {
        const { data: clHistory } = await supabase
          .from('maintenance_audit_submissions')
          .select('*, checklist:maintenance_checklists(id, name, frequency), checker_profile:profiles!checker_id(full_name), hod_profile:profiles!hod_id(full_name)')
          .eq('asset_id', id)
          .order('submitted_at', { ascending: false })
        setChecklistHistory(clHistory || [])
      } catch (e) { console.error('Checklist history:', e); setChecklistHistory([]) }

      // Find linked checklists by asset name (from both tables)
      try {
        const assetName = a.asset_name || ''
        const { data: newCl } = await supabase.from('maintenance_checklists').select('*')
        const { data: oldCl } = await supabase.from('checklist_templates').select('*').eq('is_active', true)
        const all = [...(newCl || []), ...(oldCl || [])]
        const matched = { daily: null, weekly: null, monthly: null }
        for (const cl of all) {
          const names = cl.linked_asset_names || []
          const isLinked = names.some(n => n.toLowerCase() === assetName.toLowerCase()) ||
            (cl.category && a.category && cl.category.toLowerCase() === a.category.toLowerCase()) ||
            (a.checklist_template_id && cl.id === a.checklist_template_id)
          if (isLinked) {
            const freq = cl.frequency || 'monthly'
            if (!matched[freq]) matched[freq] = cl
          }
        }
        setLinkedChecklists(matched)
      } catch (e) { console.error('Linked checklists:', e) }

      // Fetch parent asset if this is a child
      if (a.parent_asset_id) {
        try {
          const { data: parent } = await supabase.from('assets').select('id, asset_code, asset_name, status, category, site').eq('id', a.parent_asset_id).single()
          setParentAsset(parent)
        } catch (e) { console.error('Parent asset:', e); setParentAsset(null) }
      } else {
        setParentAsset(null)
      }

      // Related assets (same site or category, max 6)
      if (a.site || a.category) {
        let rq = supabase.from('assets').select('id, asset_name, asset_code, status, site, category').neq('id', id).limit(6)
        if (a.site) rq = rq.eq('site', a.site)
        else if (a.category) rq = rq.eq('category', a.category)
        const { data: rel } = await rq
        setRelatedAssets(rel || [])
      }
    } catch (e) { console.error(e); navigate('/assets') }
    finally { setLoading(false) }
  }

  async function loadSites() {
    try { const { sites: s } = await fetchFilterOptions(); setSites(s) } catch (e) { console.error(e) }
  }
  useEffect(() => { if (showTransfer) loadSites() }, [showTransfer])

  // Generate QR — only for serialized assets (qty = 1)
  const isBulk = asset ? (asset.asset_type === 'bulk' || Number(asset.quantity) > 1) : false
  useEffect(() => {
    if (!asset?.id || isBulk) return
    const url = `${window.location.origin}/scan/${asset.id}`
    QRCode.toDataURL(url, {
      width: 300, margin: 1, color: { dark: '#0d1117', light: '#ffffff' }
    }).then(setQrUrl).catch(console.error)
  }, [asset?.id, isBulk])

  async function handleDelete() {
    if (!window.confirm('Permanently delete this asset?')) return
    try { await deleteAsset(id, user.id); navigate('/assets') }
    catch (e) { alert(`Error: ${e.message}`) }
  }

  async function handleTransfer() {
    if (!transferTarget) return alert('Select a target site.')
    if (!transferNotes) return alert('Provide a reason.')
    setTransferring(true)
    try {
      await transferAsset(asset.id, user.id, asset.site || '', transferTarget, transferNotes)
      setShowTransfer(false); setTransferNotes(''); setTransferTarget(''); fetchAssetData()
    } catch (e) { alert(`Transfer failed: ${e.message}`) }
    finally { setTransferring(false) }
  }

  async function handleConditionChange(val) {
    try {
      await supabase.from('assets').update({ condition: val }).eq('id', id)
      setAsset(prev => ({ ...prev, condition: val }))
      setEditingCondition(false)
    } catch (e) { console.error(e) }
  }

  async function handlePhotoUpload(file) {
    if (!file) return
    setPhotoUploading(true)
    try { const p = await uploadAssetPhoto(id, file, '', user.id); setPhotos(prev => [...prev, p]) }
    catch (e) { alert('Upload failed: ' + e.message) }
    setPhotoUploading(false)
  }

  async function handlePhotoDelete(photoId) {
    try { await deleteAssetPhoto(photoId); setPhotos(prev => prev.filter(p => p.id !== photoId)) }
    catch (e) { console.error(e) }
  }

  async function handleAttachUpload(file) {
    if (!file) return
    setAttachUploading(true)
    try { const a = await uploadAssetAttachment(id, file, user.id); setAttachments(prev => [...prev, a]) }
    catch (e) { alert('Upload failed: ' + e.message) }
    setAttachUploading(false)
  }

  async function handleAttachDelete(attachId) {
    try { await deleteAssetAttachment(attachId); setAttachments(prev => prev.filter(a => a.id !== attachId)) }
    catch (e) { console.error(e) }
  }

  async function handleSearchChildren(q) {
    setChildSearch(q)
    if (q.length < 2) { setChildSearchResults([]); return }
    setChildSearching(true)
    try {
      const excludeIds = [id, ...childAssets.map(c => c.id)]
      const results = await searchAssetsForLinking(q, excludeIds)
      setChildSearchResults(results.filter(r => r.id !== asset?.parent_asset_id))
    } catch (e) { console.error(e) }
    setChildSearching(false)
  }

  async function handleLinkChild(childId) {
    try {
      await linkChildAsset(id, childId, user.id)
      const children = await fetchChildAssets(id)
      setChildAssets(children)
      setChildSearchResults(prev => prev.filter(r => r.id !== childId))
    } catch (e) { alert('Link failed: ' + e.message) }
  }

  async function handleUnlinkChild(childId) {
    if (!window.confirm('Remove this child asset?')) return
    try {
      await unlinkChildAsset(childId, user.id)
      setChildAssets(prev => prev.filter(c => c.id !== childId))
    } catch (e) { alert('Unlink failed: ' + e.message) }
  }

  function downloadQR() {
    if (!qrUrl) return
    const a = document.createElement('a'); a.href = qrUrl; a.download = `${asset.asset_code}-qr.png`; a.click()
  }

  function copyAssetCode() {
    navigator.clipboard.writeText(asset.asset_code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function printAssetPDF() {
    const a = asset
    const bv = calculateBookValue(a)
    const assigneeVal = a.profiles
      ? `User: ${Array.isArray(a.profiles) ? a.profiles[0]?.full_name || a.profiles[0]?.email : a.profiles.full_name || a.profiles.email}`
      : a.employees
      ? `Employee: ${Array.isArray(a.employees) ? a.employees[0]?.full_name : a.employees.full_name} (${Array.isArray(a.employees) ? a.employees[0]?.employee_code : a.employees.employee_code})`
      : 'Unassigned'
    const html = `<!DOCTYPE html><html><head><title>${a.asset_code} — Asset Detail</title>
    <style>body{font-family:'Segoe UI',sans-serif;padding:40px;color:#1a1a2e;max-width:100%;margin:0 auto}
    h1{font-size:1.5rem;margin-bottom:4px}h2{font-size:1rem;margin-top:24px;border-bottom:2px solid #4f7eff;padding-bottom:4px;color:#4f7eff}
    .meta{color:#666;font-size:0.82rem}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
    .field{padding:8px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb}
    .field-label{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;color:#666;margin-bottom:2px}
    .field-value{font-weight:600;font-size:0.88rem}
    @media print{body{padding:20px}}</style></head><body>
    <h1>${a.asset_name}</h1>
    <p class="meta">${a.asset_code} · ${a.category || ''} · ${a.status}</p>
    <h2>Technical Specifications</h2>
    <div class="grid">
      <div class="field"><div class="field-label">Make</div><div class="field-value">${a.make || '—'}</div></div>
      <div class="field"><div class="field-label">Model</div><div class="field-value">${a.model_no || '—'}</div></div>
      <div class="field"><div class="field-label">Serial No</div><div class="field-value">${a.serial_no || '—'}</div></div>
      <div class="field"><div class="field-label">Capacity</div><div class="field-value">${a.capacity || '—'}</div></div>
      <div class="field"><div class="field-label">Site</div><div class="field-value">${a.site || '—'}</div></div>
      <div class="field"><div class="field-label">Assignee</div><div class="field-value">${assigneeVal}</div></div>
      <div class="field"><div class="field-label">Condition</div><div class="field-value">${a.condition || '—'}</div></div>
    </div>
    <h2>Financial Data</h2>
    <div class="grid">
      <div class="field"><div class="field-label">Purchase Value</div><div class="field-value">${formatCurrency(a.purchase_value)}</div></div>
      <div class="field"><div class="field-label">Current Book Value</div><div class="field-value">${formatCurrency(bv)}</div></div>
      <div class="field"><div class="field-label">Salvage Value</div><div class="field-value">${formatCurrency(a.salvage_value)}</div></div>
      <div class="field"><div class="field-label">Useful Life</div><div class="field-value">${a.useful_life_years || '—'} years</div></div>
      <div class="field"><div class="field-label">Purchase Date</div><div class="field-value">${a.purchase_date ? new Date(a.purchase_date).toLocaleDateString() : '—'}</div></div>
      <div class="field"><div class="field-label">Depreciation Method</div><div class="field-value">${a.depreciation_method || '—'}</div></div>
    </div>
    ${maintenance.logs.length > 0 ? `<h2>Maintenance History</h2><table style="width:100%;border-collapse:collapse;font-size:0.82rem"><thead><tr style="background:#4f7eff;color:white"><th style="padding:6px 10px;text-align:left">Work</th><th>Cost</th><th>Date</th></tr></thead><tbody>${maintenance.logs.map(l => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${l.work_done}</td><td style="border-bottom:1px solid #e5e7eb">${formatCurrency(l.cost)}</td><td style="border-bottom:1px solid #e5e7eb">${new Date(l.performed_at).toLocaleDateString()}</td></tr>`).join('')}</tbody></table>` : ''}
    <p style="margin-top:40px;text-align:center;color:#999;font-size:0.68rem">Strongbuilt · Generated ${new Date().toLocaleString()}</p>
    </body></html>`
    const w = window.open('', '_blank'); w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500)
  }

  // ── Depreciation Schedule ─────────────────────────────────────────────
  const depreciationMissing = useMemo(() => {
    const missing = []
    if (!asset?.purchase_value) missing.push('Purchase Value')
    if (!asset?.purchase_date) missing.push('Purchase Date')
    if (!asset?.useful_life_years) missing.push('Useful Life (Years)')
    return missing
  }, [asset])

  const depreciationSchedule = useMemo(() => {
    if (depreciationMissing.length > 0) return []
    const pv = Number(asset.purchase_value)
    if (pv <= 0 || isNaN(pv)) return []
    const sv = Number(asset.salvage_value || 0)
    const life = Number(asset.useful_life_years) || 5
    const method = asset.depreciation_method || 'Straight Line'
    const rate = Number(asset.depreciation_rate_percent || 10) / 100
    const startYear = new Date(asset.purchase_date).getFullYear()
    const rows = []
    let bv = pv
    for (let y = 0; y < life; y++) {
      let dep = 0
      if (method === 'Reducing Balance' || method === 'Declining Balance') { dep = bv * rate; if (bv - dep < sv) dep = bv - sv }
      else { dep = (pv - sv) / life } // default Straight Line
      if (dep < 0) dep = 0
      bv = Math.max(sv, bv - dep)
      rows.push({ year: startYear + y + 1, depreciation: dep, bookValue: bv })
    }
    return rows
  }, [asset, depreciationMissing])

  // Depreciation percentage
  const depPct = useMemo(() => {
    if (!asset?.purchase_value) return 0
    const pv = Number(asset.purchase_value)
    const bv = calculateBookValue(asset)
    if (pv <= 0) return 0
    return Math.min(100, Math.round(((pv - bv) / pv) * 100))
  }, [asset])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 100, gap: 16 }}>
      <Loader2 size={36} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }} />
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', color: 'var(--text-3)' }}>Loading asset details...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const fields = visibleFields().filter(f => !f.readOnly)
  const customFields = Object.entries(asset.custom_fields || {})
  const condColor = COND_COLOR[asset.condition] || 'var(--text-3)'
  const CondIcon = COND_ICON[asset.condition] || Gauge
  const wDays = warrantyDaysLeft(asset.warranty_expiry)
  const totalMaintenanceCost = maintenance.logs.reduce((a, l) => a + (Number(l.cost) || 0), 0)

  /* ═══════════════════════════════════════════════════════════
     TAB: GENERAL
     ═══════════════════════════════════════════════════════════ */
  const renderGeneral = () => {
    const health = calculateAssetHealth(asset, maintenance.logs)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Quick Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <StatMini
            label="Health Score" value={`${health.score}/100`}
            icon={Activity} color={health.color}
            sub={`${health.label} (${health.riskLevel})`}
          />
          <StatMini
            label="Asset Age" value={ageLabel(asset.purchase_date || asset.created_at)}
            icon={Clock} color="var(--accent)"
            sub={asset.purchase_date ? `Since ${new Date(asset.purchase_date).toLocaleDateString()}` : 'Purchase date not set'}
          />
          <StatMini
            label="Condition" value={asset.condition || 'Not Set'}
            icon={CondIcon} color={condColor}
            sub={editingCondition ? 'Editing...' : (can('edit') ? 'Click to change' : undefined)}
          />
          <StatMini
            label="Warranty"
            value={wDays !== null ? (wDays > 0 ? `${wDays}d left` : 'Expired') : 'N/A'}
            icon={Shield} color={wDays > 0 ? 'var(--green)' : wDays !== null ? 'var(--red)' : 'var(--text-3)'}
            sub={asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString() : 'Not set'}
          />
          <StatMini
            label="Movements" value={movements.length}
            icon={History} color="var(--cyan)"
            sub={movements.length > 0 ? `Last: ${new Date(movements[0]?.moved_at).toLocaleDateString()}` : 'No transfers'}
          />
        </div>

      {/* Main 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Technical Specs */}
          <SectionCard title="Technical Specifications" icon={Info} accentColor="var(--accent)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
              <InfoField label="Asset Code" value={asset.asset_code} mono icon={Hash} accent="var(--accent)" />
              <InfoField label="Category" value={asset.category} icon={Tag} />
              <InfoField label="Site / Location" value={asset.site} icon={Building2} accent="var(--cyan)" />
              <InfoField label="Assignee" value={assigneeLabel} icon={User} accent={assigneeType === 'user' ? 'var(--accent)' : assigneeType === 'employee' ? 'var(--green)' : 'var(--text-3)'} />
              <InfoField label="Make" value={asset.make} />
              <InfoField label="Model No" value={asset.model_no} mono />
              <InfoField label="Serial No" value={asset.serial_no} mono icon={Clipboard} />
              <InfoField label="Capacity" value={asset.capacity} />
              <InfoField label="Purchase Order" value={asset.purchase_order_no} mono />
              <InfoField label="Quantity" value={asset.quantity ? `${asset.quantity} ${(asset.uom || 'nos').toUpperCase()}` : null} icon={Package} />
              {asset.asset_type === 'bulk' && <InfoField label="Asset Type" value="Bulk (Qty Tracked)" icon={Layers} accent="var(--amber)" />}
              <InfoField label="Department" value={asset.department} icon={Building2} />
              <InfoField label="Type Code" value={asset.type_code} mono />
              {customFields.map(([k, v]) => <InfoField key={k} label={k} value={String(v)} />)}
            </div>
            {asset.notes && (
              <div style={{ marginTop: 14, padding: '14px 16px', background: 'linear-gradient(135deg, var(--accent-glow), rgba(79,126,255,0.05))', borderRadius: 12, border: '1px solid rgba(79,126,255,0.15)' }}>
                <p style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.6rem', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.06em', fontWeight: 600 }}>Notes</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-1)', lineHeight: 1.6, margin: 0 }}>{asset.notes}</p>
              </div>
            )}
          </SectionCard>

          {/* Financial */}
          <SectionCard title="Financial Data" icon={IndianRupee} accentColor="var(--green)">
            {asset.purchase_value ? (
              <>
                {/* Value Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, rgba(0,185,107,0.08), rgba(0,185,107,0.02))', border: '1px solid rgba(0,185,107,0.15)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Purchase Price</p>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--text-0)' }}>{formatCurrency(asset.purchase_value)}</div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, rgba(79,126,255,0.08), rgba(79,126,255,0.02))', border: '1px solid rgba(79,126,255,0.15)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Current Value</p>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--accent)' }}>{formatCurrency(calculateBookValue(asset))}</div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 14, background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))', border: '1px solid rgba(239,68,68,0.15)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Total Depreciation</p>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--red)' }}>{formatCurrency(Number(asset.purchase_value) - calculateBookValue(asset))}</div>
                  </div>
                </div>

                {/* Depreciation Progress Bar */}
                {asset.purchase_value && (
                  <div style={{ marginBottom: 16, padding: '14px 16px', background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase' }}>Depreciation Progress</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: depPct > 75 ? 'var(--red)' : depPct > 50 ? 'var(--amber)' : 'var(--green)' }}>{depPct}%</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-4)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 6, transition: 'width 1s ease',
                        width: `${depPct}%`,
                        background: depPct > 75 ? 'linear-gradient(90deg, var(--red), #ff6b6b)' : depPct > 50 ? 'linear-gradient(90deg, var(--amber), #fbbf24)' : 'linear-gradient(90deg, var(--green), #34d399)',
                      }} />
                    </div>
                  </div>
                )}

                {/* Additional financial details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 10 }}>
                  <InfoField label="Purchase Date" value={asset.purchase_date && new Date(asset.purchase_date).toLocaleDateString()} icon={Calendar} />
                  <InfoField label="Useful Life" value={asset.useful_life_years ? `${asset.useful_life_years} Years` : null} />
                  <InfoField label="Salvage Value" value={asset.salvage_value ? formatCurrency(asset.salvage_value) : null} mono />
                  <InfoField label="Depreciation Method" value={asset.depreciation_method || 'Not Set'} />
                  {['Reducing Balance', 'Declining Balance'].includes(asset.depreciation_method) && <InfoField label="Depreciation Rate" value={`${asset.depreciation_rate_percent || 0}%`} mono />}
                  <InfoField label="Warranty" value={asset.warranty_expiry ? (new Date(asset.warranty_expiry) > new Date() ? `Active until ${new Date(asset.warranty_expiry).toLocaleDateString()}` : 'Expired') : 'Not Set'} icon={Shield} accent={wDays > 0 ? 'var(--green)' : 'var(--red)'} />
                </div>
              </>
            ) : (
              <EmptyState
                icon={IndianRupee}
                title="No financial data recorded"
                description="Add purchase value, depreciation settings and warranty info to track your asset's financial lifecycle."
                action={
                  <Link to={`/assets/${id}/edit`} className="btn-primary" style={{ textDecoration: 'none', fontSize: '0.82rem', padding: '10px 20px' }}>
                    <Edit2 size={13} /> Add Financial Details
                  </Link>
                }
              />
            )}
          </SectionCard>

          {/* Depreciation Schedule */}
          <SectionCard title="Depreciation Schedule" icon={TrendingDown} defaultOpen={false} accentColor="var(--amber)">
            {depreciationSchedule.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  <span>Method: <strong style={{ color: 'var(--text-1)' }}>{asset.depreciation_method || 'Straight Line'}</strong></span>
                  {['Reducing Balance', 'Declining Balance'].includes(asset.depreciation_method) && <span>Rate: <strong style={{ color: 'var(--text-1)' }}>{asset.depreciation_rate_percent || 10}%</strong></span>}
                  <span>Salvage: <strong style={{ color: 'var(--text-1)' }}>{formatCurrency(asset.salvage_value || 0)}</strong></span>
                </div>
                <table className="tbl" style={{ fontSize: '0.82rem' }}>
                  <thead><tr><th>Year</th><th>Annual Depreciation</th><th>Book Value</th></tr></thead>
                  <tbody>
                    {depreciationSchedule.map(r => (
                      <tr key={r.year} style={{ background: r.year === new Date().getFullYear() ? 'var(--accent-glow)' : undefined }}>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: r.year === new Date().getFullYear() ? 700 : 400 }}>{r.year} {r.year === new Date().getFullYear() ? '← current' : ''}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", color: 'var(--red)' }}>-{formatCurrency(r.depreciation)}</td>
                        <td style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{formatCurrency(r.bookValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={TrendingDown}
                title="Cannot generate schedule"
                description={`Missing: ${depreciationMissing.join(', ')}`}
                action={
                  <Link to={`/assets/${id}/edit`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.78rem' }}>
                    <Edit2 size={12} /> Edit Asset
                  </Link>
                }
              />
            )}
          </SectionCard>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* QR Code or Bulk Badge */}
          {isBulk ? (
            <SectionCard title="Bulk Asset" icon={Package} accentColor="var(--amber)">
              <div style={{ textAlign: 'center', padding: '20px 12px' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20, margin: '0 auto 14px',
                  background: 'linear-gradient(135deg, var(--amber-dim), rgba(245,158,11,0.05))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(245,158,11,0.15)',
                }}>
                  <Package size={32} style={{ color: 'var(--amber)' }} />
                </div>
                <p style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-0)', marginBottom: 4 }}>
                  {asset.quantity} {(asset.uom || 'nos').toUpperCase()}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: 4 }}>Bulk / Quantity-tracked asset</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', margin: 0 }}>No individual QR code · Partial transfers supported</p>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Asset Tag (QR)" icon={Tag} accentColor="var(--purple)">
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  background: 'white', padding: 14, borderRadius: 16, display: 'inline-block',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
                  border: '1px solid var(--border)', minWidth: 160, minHeight: 160,
                }}>
                  {qrUrl ? (
                    <img src={qrUrl} alt="QR Code" style={{ width: 150, height: 150, display: 'block' }} />
                  ) : (
                    <div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={downloadQR} className="btn-ghost" style={{ fontSize: '0.72rem', padding: '8px 16px' }}><Download size={13} /> Download</button>
                  {can('print_stickers') && <Link to={`/stickers?ids=${asset.id}`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.72rem', padding: '8px 16px' }}><Tag size={13} /> Print Tag</Link>}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Condition + Status Card */}
          <SectionCard title="Asset Status" icon={Activity} accentColor={condColor}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Condition */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: `${condColor}08`, borderRadius: 12, border: `1px solid ${condColor}20`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CondIcon size={18} style={{ color: condColor }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Condition</span>
                </div>
                {editingCondition ? (
                  <select className="sel" value={asset.condition || ''} onChange={e => handleConditionChange(e.target.value)}
                    onBlur={() => setEditingCondition(false)} autoFocus style={{ height: 34, fontSize: '0.78rem', width: 130, minHeight: 34 }}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <span onClick={() => can('edit') && setEditingCondition(true)}
                    style={{
                      fontWeight: 700, color: condColor, cursor: can('edit') ? 'pointer' : 'default',
                      padding: '5px 14px', borderRadius: 8, background: `${condColor}15`,
                      fontSize: '0.82rem',
                    }}>
                    {asset.condition || 'Not Set'}
                  </span>
                )}
              </div>

              {/* Location */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MapPin size={16} style={{ color: 'var(--cyan)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Location</span>
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, background: 'var(--bg-3)', padding: '5px 14px', borderRadius: 8, color: 'var(--text-1)' }}>{asset.site || 'Not Set'}</span>
              </div>

              {/* Assignee */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <User size={16} style={{ color: assigneeType ? 'var(--green)' : 'var(--text-3)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Assigned To</span>
                </div>
                <span style={{
                  fontSize: '0.82rem', fontWeight: 600, padding: '5px 14px', borderRadius: 8,
                  background: assigneeType ? 'var(--green-dim)' : 'var(--bg-3)',
                  color: assigneeType ? 'var(--green)' : 'var(--text-3)',
                }}>{assigneeLabel}</span>
              </div>

              {/* Warranty Progress */}
              {asset.warranty_expiry && (
                <div style={{
                  padding: '14px 16px', background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Shield size={16} style={{ color: wDays > 0 ? 'var(--green)' : 'var(--red)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Warranty</span>
                    </div>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700,
                      color: wDays > 0 ? 'var(--green)' : 'var(--red)',
                    }}>
                      {wDays > 0 ? `${wDays} days remaining` : `Expired ${Math.abs(wDays)}d ago`}
                    </span>
                  </div>
                  {wDays > 0 && asset.purchase_date && (
                    <div style={{ height: 6, background: 'var(--bg-4)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${Math.max(5, Math.min(100, (wDays / (daysAgo(asset.purchase_date) + wDays)) * 100))}%`,
                        background: wDays > 90 ? 'linear-gradient(90deg, var(--green), #34d399)' : wDays > 30 ? 'linear-gradient(90deg, var(--amber), #fbbf24)' : 'linear-gradient(90deg, var(--red), #ff6b6b)',
                        transition: 'width 1s ease',
                      }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Photo Gallery */}
          <SectionCard title={`Photos (${photos.length})`} icon={Camera} accentColor="var(--cyan)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
              {photos.map(p => (
                <div key={p.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1.5px solid var(--border)', cursor: 'pointer' }} onClick={() => setPhotoPreview(p.photo_url)}>
                  <img src={p.photo_url} alt="asset" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {can('edit') && (
                    <button onClick={e => { e.stopPropagation(); handlePhotoDelete(p.id) }} style={{
                      position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
                    }}><X size={11} /></button>
                  )}
                </div>
              ))}
              {can('edit') && (
                <label style={{
                  aspectRatio: '1', borderRadius: 12, border: '2px dashed var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', gap: 6, background: 'var(--bg-1)', 
                }}>
                  {photoUploading
                    ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                    : <><Camera size={18} style={{ color: 'var(--text-3)' }} /><span style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 600 }}>ADD PHOTO</span></>}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handlePhotoUpload(f); e.target.value = '' }} />
                </label>
              )}
            </div>
          </SectionCard>

          {/* Attachments */}
          <SectionCard title={`Documents (${attachments.length})`} icon={FileText} accentColor="var(--purple)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attachments.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)',
                  
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--purple-dim)', color: 'var(--purple)', flexShrink: 0,
                  }}><FileText size={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-0)' }}>{a.file_name}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontFamily: "'DM Sans', sans-serif" }}>{a.file_type} · {(a.file_size / 1024).toFixed(0)} KB</div>
                  </div>
                  <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ padding: '6px 10px', fontSize: '0.72rem' }}><Download size={13} /></a>
                  {can('edit') && <button onClick={() => handleAttachDelete(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4, opacity: 0.6 }}><Trash2 size={14} /></button>}
                </div>
              ))}
              {can('edit') && (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '14px 16px', borderRadius: 12, border: '2px dashed var(--border)',
                  cursor: 'pointer', background: 'var(--bg-1)', 
                }}>
                  {attachUploading
                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                    : <><Upload size={14} style={{ color: 'var(--text-3)' }} /><span style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 500 }}>Upload Document</span></>}
                  <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handleAttachUpload(f); e.target.value = '' }} />
                </label>
              )}
            </div>
          </SectionCard>

          {/* Related Assets */}
          {relatedAssets.length > 0 && (
            <SectionCard title={`Related Assets at ${asset.site || 'Same Category'}`} icon={Layers} defaultOpen={false}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {relatedAssets.map(r => (
                  <Link key={r.id} to={`/assets/${r.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: 'var(--bg-1)', borderRadius: 12, textDecoration: 'none', color: 'inherit',
                    border: '1px solid var(--border)', 
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-0)' }}>{r.asset_name}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontFamily: "'DM Mono', monospace" }}>{r.asset_code}</div>
                    </div>
                    <span className={`badge ${STATUS_BADGE[r.status] || 'badge-inactive'}`} style={{ fontSize: '0.6rem' }}>{r.status}</span>
                    <ArrowRight size={14} style={{ color: 'var(--text-3)' }} />
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  )
}

  /* ═══════════════════════════════════════════════════════════
     TAB: MOVEMENTS
     ═══════════════════════════════════════════════════════════ */
  const renderMovements = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Timeline Visualization */}
      {movements.length > 0 && (
        <div style={{
          background: 'var(--bg-2)', border: '1.5px solid var(--border)', borderRadius: 18,
          padding: 24, boxShadow: 'var(--clay-shadow)', overflow: 'hidden', position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--cyan), var(--accent))' }} />
          <h4 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.8rem', textTransform: 'uppercase', margin: '0 0 20px', color: 'var(--text-2)', letterSpacing: '0.04em' }}>Movement Timeline</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
            {[...movements].reverse().map((m, idx, arr) => (
              <React.Fragment key={m.id}>
                <div style={{ textAlign: 'center', minWidth: 110, flexShrink: 0 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', margin: '0 auto 8px',
                    background: idx === arr.length - 1 ? 'linear-gradient(135deg, var(--accent), #6b96ff)' : 'var(--green)',
                    border: '3px solid var(--bg-2)', boxShadow: idx === arr.length - 1 ? '0 0 12px rgba(79,126,255,0.4)' : '0 2px 6px rgba(0,185,107,0.2)',
                  }} />
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-0)' }}>{m.to_location}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontFamily: "'DM Mono', monospace" }}>{new Date(m.moved_at).toLocaleDateString()}</div>
                </div>
                {idx < arr.length - 1 && <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, var(--green), var(--border))', minWidth: 30 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Lifecycle Timeline */}
      <SectionCard title="Lifecycle Timeline" icon={History} noPad accentColor="var(--accent)">
        <div style={{ padding: '0 20px' }}>
          <AssetTimeline asset={asset} movements={movements} maintenance={maintenance} audit={audit} />
        </div>
      </SectionCard>

      {/* Movement Table */}
      <SectionCard title={`Movement History (${movements.length})`} icon={History} noPad accentColor="var(--cyan)">
        {movements.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Moved By</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--text-3)' }}>{m.from_location || 'Initial'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-0)' }}>{m.to_location}</td>
                    <td>{m.profiles?.full_name}</td>
                    <td style={{ color: 'var(--text-3)', fontStyle: 'italic', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--text-3)' }}>{new Date(m.moved_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={History} title="No movement history" description="Transfers between sites will appear here as a timeline." />
        )}
      </SectionCard>
    </div>
  )

  /* ═══════════════════════════════════════════════════════════
     TAB: MAINTENANCE
     ═══════════════════════════════════════════════════════════ */
  const renderMaintenance = () => {
    const openTickets = maintenance.tickets.filter(t => t.status !== 'resolved')
    const overdue = maintenance.schedules.filter(s => new Date(s.next_due) < new Date())
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Maintenance Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <StatMini label="Total Cost" value={formatCurrency(totalMaintenanceCost)} icon={IndianRupee} color="var(--green)" sub={`${maintenance.logs.length} service records`} />
          <StatMini label="Open Tickets" value={openTickets.length} icon={Wrench} color={openTickets.length > 0 ? 'var(--amber)' : 'var(--green)'} sub={openTickets.length > 0 ? 'Needs attention' : 'All clear'} />
          <StatMini label="PM Schedules" value={maintenance.schedules.length} icon={Calendar} color="var(--accent)" sub={overdue.length > 0 ? `${overdue.length} overdue` : 'On track'} />
        </div>

        {/* Service History */}
        <SectionCard title={`Service History — ${formatCurrency(totalMaintenanceCost)} total`} icon={History} accentColor="var(--green)">
          {maintenance.logs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {maintenance.logs.map(l => (
                <div key={l.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: l.schedule_id ? 'var(--green-dim)' : 'var(--amber-dim)',
                    color: l.schedule_id ? 'var(--green)' : 'var(--amber)', flexShrink: 0,
                  }}>
                    <Wrench size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-0)' }}>{l.work_done}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'flex', gap: 8 }}>
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: l.schedule_id ? 'var(--green-dim)' : 'var(--amber-dim)', color: l.schedule_id ? 'var(--green)' : 'var(--amber)', fontWeight: 600, fontSize: '0.6rem' }}>
                        {l.schedule_id ? 'PREVENTIVE' : 'CORRECTIVE'}
                      </span>
                      <span>{l.profiles?.full_name || 'System'}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: "'DM Mono', monospace", color: 'var(--text-0)' }}>{formatCurrency(l.cost || 0)}</div>
                    <div style={{ fontSize: '0.68rem', fontFamily: "'DM Mono', monospace", color: 'var(--text-3)' }}>{new Date(l.performed_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Wrench} title="No maintenance history" description="Service records and costs will be tracked here." />
          )}
        </SectionCard>

        {/* Open Tickets + PM Schedules side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <SectionCard title={`Open Tickets (${openTickets.length})`} icon={AlertTriangle} accentColor="var(--amber)">
            {openTickets.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {openTickets.map(t => (
                  <div key={t.id} style={{
                    padding: '12px 14px', background: 'var(--bg-1)', borderRadius: 10, border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                      <span>{t.title}</span>
                      <span style={{
                        fontSize: '0.58rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        background: t.priority === 'high' || t.priority === 'critical' ? 'var(--red-dim)' : 'var(--amber-dim)',
                        color: t.priority === 'high' || t.priority === 'critical' ? 'var(--red)' : 'var(--amber)',
                        textTransform: 'uppercase',
                      }}>{t.priority}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{new Date(t.created_at).toLocaleDateString()} · {t.profiles?.full_name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={CheckCircle2} title="No open tickets" description="All maintenance issues resolved." />
            )}
          </SectionCard>

          <SectionCard title={`PM Schedules (${maintenance.schedules.length})`} icon={Calendar} accentColor="var(--accent)">
            {maintenance.schedules.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {maintenance.schedules.map(s => {
                  const isOverdue = new Date(s.next_due) < new Date()
                  return (
                    <div key={s.id} style={{
                      padding: '12px 14px', background: isOverdue ? 'rgba(239,68,68,0.04)' : 'var(--bg-1)',
                      borderRadius: 10, border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
                        <span>{s.title}</span>
                        <span style={{
                          fontSize: '0.58rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: 'var(--accent-glow)', color: 'var(--accent)', textTransform: 'uppercase',
                        }}>{s.frequency}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: isOverdue ? 'var(--red)' : 'var(--text-3)', fontWeight: isOverdue ? 600 : 400 }}>
                        {isOverdue ? '⚠ OVERDUE — ' : 'Next: '}{new Date(s.next_due).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState icon={Calendar} title="No schedules" description="Add preventive maintenance schedules." />
            )}
          </SectionCard>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════
     TAB: CHECKLISTS
     ═══════════════════════════════════════════════════════════ */
  const renderChecklists = () => {
    const FREQ = [
      { key: 'daily', label: 'Daily', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.03))' },
      { key: 'weekly', label: 'Weekly', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', gradient: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.03))' },
      { key: 'monthly', label: 'Monthly', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.03))' },
    ]
    const APPROVAL = {
      pending_checker: { label: 'Pending Checker', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
      pending_hod: { label: 'Pending HOD', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
      approved: { label: 'Approved', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
      rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Linked checklists by frequency */}
        <SectionCard title="Linked Checklists" icon={ClipboardList} accentColor="var(--accent)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {FREQ.map(f => {
              const cl = linkedChecklists[f.key]
              return (
                <div key={f.key} style={{
                  padding: '18px 16px', borderRadius: 14, border: `1.5px solid ${cl ? f.color + '30' : 'var(--border)'}`,
                  background: cl ? f.gradient : 'var(--bg-1)', textAlign: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {cl && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: f.color }} />}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${f.color}15`, margin: '0 auto 10px',
                  }}>
                    <ClipboardList size={16} style={{ color: f.color }} />
                  </div>
                  <div style={{ fontSize: '0.65rem', fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: f.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    {f.label}
                  </div>
                  {cl ? (
                    <>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-0)', margin: '0 0 4px' }}>{cl.name}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{(cl.items || []).length} items</p>
                    </>
                  ) : (
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic', margin: 0 }}>Not linked</p>
                  )}
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* Performed checklist history */}
        <SectionCard
          title={`Performed Checklists`}
          icon={CheckCircle2}
          accentColor="var(--green)"
          actions={<span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: "'DM Sans', sans-serif" }}>{checklistHistory.length} records</span>}
        >
          {checklistHistory.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No checklists performed yet" description="Completed inspection checklists for this asset will appear here." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checklistHistory.map(sub => {
                const ap = APPROVAL[sub.approval_status] || APPROVAL.pending_checker
                const freq = sub.checklist?.frequency || 'monthly'
                const fc = FREQ.find(f => f.key === freq) || FREQ[2]
                const passCount = (sub.results || []).filter(r => r.answer === 'pass').length
                const failCount = (sub.results || []).filter(r => r.answer === 'fail').length
                const totalItems = (sub.results || []).length
                const passPct = totalItems > 0 ? Math.round((passCount / totalItems) * 100) : 0
                return (
                  <div key={sub.id} style={{
                    padding: '14px 16px', borderRadius: 12,
                    display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                    background: 'var(--bg-1)', border: '1px solid var(--border)',
                  }} onClick={async () => {
                    try {
                      const { default: generateAuditPDF } = await import('../components/auditModule/generateAuditPDF.js')
                      const { default: logo } = await import('../assets/logo.png')
                      const doc = await generateAuditPDF({
                        ...sub,
                        asset: { asset_code: asset.asset_code, asset_name: asset.asset_name, site: asset.site },
                      }, logo)
                      doc.save(`checklist-${asset.asset_code}-${new Date(sub.submitted_at).toISOString().split('T')[0]}.pdf`)
                    } catch (e) { console.error(e) }
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: fc.bg, color: fc.color, flexShrink: 0,
                    }}>
                      <ClipboardList size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-0)' }}>
                          {sub.checklist?.name || 'Checklist'}
                        </span>
                        <span style={{ fontSize: '0.55rem', padding: '2px 7px', borderRadius: 6, background: fc.bg, color: fc.color, fontWeight: 700, textTransform: 'uppercase' }}>
                          {fc.label}
                        </span>
                        <span style={{ fontSize: '0.55rem', padding: '2px 7px', borderRadius: 6, background: ap.bg, color: ap.color, fontWeight: 700 }}>
                          {ap.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.68rem', color: 'var(--text-3)' }}>
                        <span>By: {sub.prepared_name || '—'}</span>
                        <span style={{ color: 'var(--green)', fontWeight: 600 }}>{passCount} Pass</span>
                        {failCount > 0 && <span style={{ color: 'var(--red)', fontWeight: 600 }}>{failCount} Fail</span>}
                        <span>{totalItems} items</span>
                      </div>
                      {/* Mini pass/fail bar */}
                      <div style={{ height: 4, background: 'var(--bg-4)', borderRadius: 3, marginTop: 6, overflow: 'hidden', maxWidth: 200 }}>
                        <div style={{ height: '100%', width: `${passPct}%`, background: failCount > 0 ? 'linear-gradient(90deg, var(--green), var(--amber))' : 'var(--green)', borderRadius: 3 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', fontFamily: "'DM Sans', sans-serif" }}>
                        {new Date(sub.submitted_at).toLocaleDateString('en-GB')}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', marginTop: 4 }}>
                        <Download size={10} /> PDF
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════
     TAB: AUDIT
     ═══════════════════════════════════════════════════════════ */
  const renderAudit = () => {
    const actionConfig = {
      created: { color: 'var(--green)', bg: 'var(--green-dim)', icon: Plus, label: 'Created' },
      updated: { color: 'var(--amber)', bg: 'var(--amber-dim)', icon: Edit2, label: 'Updated' },
      deleted: { color: 'var(--red)', bg: 'var(--red-dim)', icon: Trash2, label: 'Deleted' },
      transferred: { color: 'var(--cyan)', bg: 'var(--cyan-dim)', icon: Send, label: 'Transferred' },
    }
    return (
      <SectionCard title={`Audit Trail (${audit.length})`} icon={ClipboardList} noPad accentColor="var(--purple)">
        {audit.length > 0 ? (
          <div>
            {audit.map((log, idx) => {
              const cfg = actionConfig[log.action] || actionConfig.updated
              const ActionIcon = cfg.icon
              return (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                  borderBottom: idx < audit.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: cfg.bg, color: cfg.color, flexShrink: 0,
                  }}>
                    <ActionIcon size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', color: 'var(--text-0)', fontWeight: 600 }}>{log.profiles?.full_name || 'System'}</span>
                      <span style={{
                        fontSize: '0.58rem', padding: '2px 8px', borderRadius: 6,
                        background: cfg.bg, color: cfg.color, fontWeight: 700, textTransform: 'uppercase',
                      }}>{cfg.label}</span>
                    </div>
                    {log.changes && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', margin: '4px 0 0', lineHeight: 1.4 }}>
                        {typeof log.changes === 'string' ? log.changes : JSON.stringify(log.changes)}
                      </p>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-3)', fontSize: '0.72rem', fontFamily: "'DM Mono', monospace", flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState icon={ClipboardList} title="No audit entries" description="All changes to this asset are automatically logged." />
        )}
      </SectionCard>
    )
  }

  /* ═══════════════════════════════════════════════════════════
     TAB: CHILDREN
     ═══════════════════════════════════════════════════════════ */
  const renderChildren = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Link Child Asset */}
      {can('edit') && (
        <SectionCard title="Link Child Assets" icon={Link2} accentColor="var(--accent)"
          actions={
            <button onClick={() => { setShowLinkChild(!showLinkChild); setChildSearch(''); setChildSearchResults([]) }}
              className={showLinkChild ? "btn-danger" : "btn-ghost"} style={{ fontSize: '0.72rem', padding: '6px 14px' }}>
              {showLinkChild ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Add Child</>}
            </button>
          }
        >
          {showLinkChild && (
            <div>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input
                  type="text" value={childSearch} onChange={e => handleSearchChildren(e.target.value)}
                  placeholder="Search by asset name or code..." className="inp"
                  style={{ paddingLeft: 38, fontSize: '0.85rem' }} autoFocus
                />
              </div>
              {childSearching && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 10 }}>Searching...</p>}
              {childSearchResults.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {childSearchResults.map(r => (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-0)' }}>{r.asset_name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: "'DM Mono', monospace" }}>{r.asset_code} · {r.category} · {r.site || 'No site'}</div>
                      </div>
                      <span className={`badge ${STATUS_BADGE[r.status] || 'badge-inactive'}`} style={{ fontSize: '0.6rem' }}>{r.status}</span>
                      <button onClick={() => handleLinkChild(r.id)} className="btn-primary" style={{ padding: '6px 14px', fontSize: '0.72rem' }}>
                        <Link2 size={12} /> Link
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {childSearch.length >= 2 && !childSearching && childSearchResults.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>No available assets found matching "{childSearch}"</p>
              )}
            </div>
          )}
          {!showLinkChild && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', margin: 0, textAlign: 'center' }}>Click "Add Child" to search and link sub-components.</p>
          )}
        </SectionCard>
      )}

      {/* Child Assets List */}
      <SectionCard title={`Child Assets (${childAssets.length})`} icon={GitBranch} accentColor="var(--cyan)">
        {childAssets.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {childAssets.map(c => (
              <div key={c.id} style={{
                padding: '16px', background: 'var(--bg-1)', borderRadius: 14,
                border: '1.5px solid var(--border)', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--cyan), var(--accent))' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <Link to={`/assets/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-0)', marginBottom: 2 }}>{c.asset_name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--accent)', fontFamily: "'DM Mono', monospace" }}>{c.asset_code}</div>
                  </Link>
                  <span className={`badge ${STATUS_BADGE[c.status] || 'badge-inactive'}`} style={{ fontSize: '0.6rem', flexShrink: 0, marginLeft: 8 }}>{c.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                    {c.category}{c.make ? ` · ${c.make}` : ''}{c.model_no ? ` ${c.model_no}` : ''}
                  </div>
                  {can('edit') && (
                    <button onClick={() => handleUnlinkChild(c.id)} title="Remove child" style={{
                      background: 'var(--red-dim)', border: 'none', cursor: 'pointer', color: 'var(--red)',
                      padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', fontWeight: 600,
                    }}>
                      <Unlink size={12} /> Unlink
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={GitBranch}
            title="No child assets linked"
            description="Child assets are sub-components or parts that belong to this asset. Link them to track the full asset hierarchy."
          />
        )}
      </SectionCard>
    </div>
  )

  /* ═══════════════════════════════════════════════════════════
     TAB: DOCUMENTS & COMPLIANCE
     ═══════════════════════════════════════════════════════════ */
  const renderDocuments = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionCard title="Compliance & Documents" icon={FileText} accentColor="var(--purple)">
          {/* Upload Form */}
          {can('edit') && (
            <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem' }}>Upload Document</h4>
              <form onSubmit={async (e) => {
                e.preventDefault()
                const form = e.target
                const file = form.file.files[0]
                if (!file) return alert('Please select a file')
                const meta = {
                  document_type: form.doc_type.value,
                  document_number: form.doc_number.value,
                  issue_date: form.issue_date.value || null,
                  expiry_date: form.expiry_date.value || null
                }
                setDocUploading(true)
                try {
                  const doc = await uploadAssetDocument(id, file, meta, user.id)
                  setDocuments(prev => [...prev, doc].sort((a,b) => new Date(a.expiry_date||'9999-01-01') - new Date(b.expiry_date||'9999-01-01')))
                  form.reset()
                } catch(err) { alert('Upload failed: ' + err.message) }
                finally { setDocUploading(false) }
              }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label className="lbl">Document Type</label>
                  <select name="doc_type" className="sel" required style={{ width: '100%', height: 38 }}>
                    <option value="Insurance">Insurance</option>
                    <option value="Registration">Registration</option>
                    <option value="Warranty">Warranty</option>
                    <option value="Manual">Manual</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label className="lbl">Doc Number (Opt)</label>
                  <input type="text" name="doc_number" className="inp" placeholder="Policy #, etc" style={{ height: 38 }} />
                </div>
                <div style={{ flex: 1, minWidth: 130 }}>
                  <label className="lbl">Issue Date (Opt)</label>
                  <input type="date" name="issue_date" className="inp" style={{ height: 38 }} />
                </div>
                <div style={{ flex: 1, minWidth: 130 }}>
                  <label className="lbl">Expiry Date (Opt)</label>
                  <input type="date" name="expiry_date" className="inp" style={{ height: 38 }} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="lbl">File (PDF/Image)</label>
                  <input type="file" name="file" className="inp" accept=".pdf,image/*" required style={{ height: 38 }} />
                </div>
                <button type="submit" className="btn-primary" disabled={docUploading} style={{ height: 38, padding: '0 24px' }}>
                  {docUploading ? 'Uploading...' : 'Upload'}
                </button>
              </form>
            </div>
          )}

          {/* List */}
          {documents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {documents.map(doc => {
                const isExpiring = doc.expiry_date && new Date(doc.expiry_date) < new Date(Date.now() + 30 * 86400000)
                const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date()
                const badgeColor = isExpired ? 'var(--red)' : isExpiring ? 'var(--amber)' : 'var(--green)'
                const badgeText = isExpired ? 'Expired' : isExpiring ? 'Expiring Soon' : 'Active'
                
                return (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--bg-1)', borderRadius: 12, border: `1px solid ${isExpiring || isExpired ? badgeColor+'40' : 'var(--border)'}` }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
                      <FileText size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-0)', textDecoration: 'none' }}>{doc.document_type}</a>
                        {doc.expiry_date && <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 8, background: `${badgeColor}15`, color: badgeColor, fontWeight: 700 }}>{badgeText}</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', gap: 12 }}>
                        {doc.document_number && <span>#{doc.document_number}</span>}
                        {doc.expiry_date && <span>Expires: {new Date(doc.expiry_date).toLocaleDateString()}</span>}
                        <span>By: {doc.profiles?.full_name}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: '6px 10px' }}><Eye size={14} /></a>
                      {can('delete') && <button onClick={() => deleteAssetDocument(doc.id).then(() => setDocuments(docs => docs.filter(d => d.id !== doc.id)))} className="btn-danger" style={{ padding: '6px 10px' }}><Trash2 size={14} /></button>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
             <EmptyState icon={FileText} title="No documents" description="Upload insurance, registration, manuals, or warranty certificates." />
          )}
        </SectionCard>
      </div>
    )
  }

  const handleUpdateGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.")
      return
    }
    setUpdatingGPS(true)
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        
        const { error } = await supabase.from('assets').update({
          latitude: lat,
          longitude: lng,
          updated_at: new Date().toISOString()
        }).eq('id', asset.id)

        if (error) throw error

        setAsset(prev => ({ ...prev, latitude: lat, longitude: lng }))
        alert("GPS Location successfully updated and tagged to this machine!")
      } catch (err) {
        alert("Failed to update GPS: " + err.message)
      } finally {
        setUpdatingGPS(false)
      }
    }, (error) => {
      alert("Error getting location: " + error.message)
      setUpdatingGPS(false)
    }, { enableHighAccuracy: true })
  }

  /* ═══════════════════════════════════════════════════════════
     PAGE LAYOUT
     ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: '0 4px' }}>
      {/* ── HERO HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(79,126,255,0.06), rgba(107,150,255,0.03), rgba(6,182,212,0.04))',
        border: '1.5px solid var(--border)', borderRadius: 20, padding: '24px 28px',
        marginBottom: 24, position: 'relative', overflow: 'hidden',
        boxShadow: 'var(--clay-shadow)',
      }}>
        {/* Gradient accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, var(--accent), var(--cyan), var(--purple))' }} />

        {/* Top row: back + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/assets" style={{
              padding: 10, borderRadius: 12, color: 'var(--text-2)', display: 'inline-flex',
              background: 'var(--bg-2)', border: '1.5px solid var(--border)', textDecoration: 'none',
              boxShadow: 'var(--clay-shadow-sm)', transition: 'all 0.15s',
            }}><ArrowLeft size={18} /></Link>
            <div>
              <p style={{ fontFamily: "'Oswald', sans-serif", fontSize: '0.6rem', letterSpacing: '0.12em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 2 }}>Asset Management</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--accent)', margin: 0 }}>{asset.asset_code}</h1>
                <button onClick={copyAssetCode} title="Copy code" style={{
                  background: copied ? 'var(--green-dim)' : 'var(--bg-2)', border: `1px solid ${copied ? 'var(--green)' : 'var(--border)'}`,
                  cursor: 'pointer', borderRadius: 6, padding: '3px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: copied ? 'var(--green)' : 'var(--text-3)', transition: 'all 0.2s',
                }}>
                  {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={printAssetPDF} className="btn-ghost" style={{ border: '1.5px solid var(--border)' }}><Download size={14} /> PDF</button>
            {can('edit') && <button onClick={handleUpdateGPS} className="btn-ghost" style={{ border: '1.5px solid var(--border)' }} disabled={updatingGPS}>{updatingGPS ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MapPin size={14} />} {updatingGPS ? 'UPDATING...' : 'UPDATE GPS'}</button>}
            {can('edit') && <button onClick={() => setShowTransfer(true)} className="btn-ghost" style={{ border: '1.5px solid var(--border)' }}><Send size={14} /> TRANSFER</button>}
            {can('print_stickers') && <Link to={`/stickers?ids=${asset.id}`} className="btn-ghost" style={{ textDecoration: 'none' }}><Tag size={14} /> TAG</Link>}
            {(isAdmin || canEditField('status')) && <Link to={`/assets/${id}/edit`} className="btn-primary" style={{ textDecoration: 'none' }}><Edit2 size={14} /> EDIT</Link>}
            {can('delete') && <button onClick={handleDelete} className="btn-danger" style={{ padding: '9px 12px' }}><Trash2 size={14} /></button>}
          </div>
        </div>

        {/* Asset Name + Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '2rem', fontWeight: 700, margin: 0, color: 'var(--text-0)' }}>{asset.asset_name}</h2>
              <span className={`badge ${STATUS_BADGE[asset.status] || 'badge-inactive'}`} style={{ height: 'fit-content', padding: '5px 12px', fontSize: '0.75rem' }}>{asset.status?.toUpperCase()}</span>
              <span style={{
                fontSize: '0.72rem', padding: '4px 10px', borderRadius: 6,
                background: `${condColor}12`, color: condColor, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <CondIcon size={12} /> {asset.condition || 'N/A'}
              </span>
            </div>
            <p style={{ color: 'var(--text-3)', fontSize: '0.88rem', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
              {[asset.make, asset.model_no && `Model ${asset.model_no}`, asset.category].filter(Boolean).join(' · ')}
            </p>
            {parentAsset && (
              <Link to={`/assets/${parentAsset.id}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
                padding: '5px 12px', background: 'var(--accent-glow)', borderRadius: 8,
                border: '1px solid rgba(79,126,255,0.2)', textDecoration: 'none',
                fontSize: '0.75rem', color: 'var(--accent)', fontFamily: "'DM Sans', sans-serif",
              }}>
                <GitBranch size={12} /> Child of: <strong>{parentAsset.asset_name}</strong>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', opacity: 0.7 }}>({parentAsset.asset_code})</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── PILL TABS ── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        paddingBottom: 4, msOverflowStyle: 'none', scrollbarWidth: 'none',
      }}>
        <PillTab active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={Info} label="General" />
        <PillTab active={activeTab === 'movements'} onClick={() => setActiveTab('movements')} icon={History} label="Lifecycle" />
        <PillTab active={activeTab === 'maintenance'} onClick={() => setActiveTab('maintenance')} icon={Wrench} label="Maintenance" count={maintenance.logs.length} />
        <PillTab active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} icon={FileText} label="Documents" count={documents.length} />
        <PillTab active={activeTab === 'children'} onClick={() => setActiveTab('children')} icon={GitBranch} label="Children" count={childAssets.length} />
        <PillTab active={activeTab === 'checklists'} onClick={() => setActiveTab('checklists')} icon={ClipboardList} label="Checklists" count={checklistHistory.length} />
        <PillTab active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={Shield} label="Audit" count={audit.length} />
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ minHeight: 400 }}>
        {activeTab === 'general' && renderGeneral()}
        {activeTab === 'movements' && renderMovements()}
        {activeTab === 'maintenance' && renderMaintenance()}
        {activeTab === 'documents' && renderDocuments()}
        {activeTab === 'children' && renderChildren()}
        {activeTab === 'checklists' && renderChecklists()}
        {activeTab === 'audit' && renderAudit()}
      </div>

      {/* ── TRANSFER MODAL ── */}
      {showTransfer && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setShowTransfer(false)}>
          <div className="modal" style={{ maxWidth: 480, padding: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(79,126,255,0.06), transparent)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent-glow)', color: 'var(--accent)',
                }}><Send size={16} /></div>
                <h3 style={{ margin: 0, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: '0.95rem', letterSpacing: '0.04em' }}>Transfer Asset</h3>
              </div>
              <button onClick={() => setShowTransfer(false)} className="btn-ghost" style={{ padding: '6px 8px' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <label className="lbl">Move From</label>
                <div style={{
                  padding: '12px 14px', borderRadius: 12, background: 'var(--bg-1)', fontSize: '0.9rem',
                  color: 'var(--text-1)', border: '1px solid var(--border)', fontWeight: 500,
                }}>{asset.site || 'Unknown'}</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="lbl">Target Site</label>
                <select className="inp" value={transferTarget} onChange={e => setTransferTarget(e.target.value)}>
                  <option value="">Select site…</option>
                  {sites.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__NEW__">+ New Site…</option>
                </select>
                {transferTarget === '__NEW__' && <input placeholder="New site name" className="inp" style={{ marginTop: 10 }} onBlur={e => { if (e.target.value) setTransferTarget(e.target.value) }} />}
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="lbl">Transfer Notes</label>
                <textarea className="inp" rows={3} value={transferNotes} onChange={e => setTransferNotes(e.target.value)} placeholder="Reason for transfer…" style={{ resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setShowTransfer(false)} className="btn-ghost" style={{ flex: 1 }} disabled={transferring}>Cancel</button>
                <button onClick={handleTransfer} className="btn-primary" style={{ flex: 1.5 }} disabled={transferring}>
                  {transferring ? 'Processing…' : 'Confirm Transfer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PHOTO PREVIEW MODAL ── */}
      {photoPreview && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setPhotoPreview(null)}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPhotoPreview(null)} style={{
              position: 'absolute', top: -12, right: -12, width: 32, height: 32, borderRadius: '50%',
              background: 'var(--bg-2)', border: '2px solid var(--border)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-1)',
              boxShadow: 'var(--clay-shadow)', zIndex: 1,
            }}><X size={16} /></button>
            <img src={photoPreview} alt="Asset Photo" style={{
              maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16, objectFit: 'contain',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
