import { writePrintDocument } from '../lib/printDocument'
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Wrench, Calendar, Ticket, History, Plus, Search, Filter, CheckCircle2, XCircle,
  Clock, Loader2, AlertTriangle, Hammer, ArrowRight, ClipboardCheck, Building2, X,
  ChevronDown, ChevronRight, Edit2, Trash2, MessageSquare, Camera, Image, Download,
  Shield, User, Star, Phone, Mail, MapPin, Send, BarChart2, Eye, QrCode
} from 'lucide-react'
import {
  supabase, createMaintenanceTicket, createMaintenanceSchedule, logMaintenanceWork,
  updateMaintenanceTicket, deleteMaintenanceTicket, updateMaintenanceSchedule, deleteMaintenanceSchedule,
  fetchTicketComments, addTicketComment, uploadMaintenancePhoto, fetchMaintenancePhotos, removeMaintenancePhoto,
  createNotification, fetchAllVendors, createVendor, updateVendor, deleteVendor, autoCreateOverdueTickets,
  getAllProfiles, approveMaintenanceLog, fetchMaintenanceLogsPaginated
} from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import QRScanner from '../components/checklist/QRScanner'
import { formatCurrency } from '../lib/depreciation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useIsMobile } from '../hooks/useBreakpoint'
import MobileMaintenancePage from '../components/mobile/MobileMaintenancePage'

// ── Constants ──────────────────────────────────────────────────────────────
const SLA_HOURS = { critical: 4, high: 24, normal: 72, low: 168 }
const CHART_COLORS = ['#4f7eff', '#34d399', 'var(--status-warning)', 'var(--status-danger)', 'var(--status-special)', '#06b6d4', '#ec4899', '#f97316']
const FREQ_MAP = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly', one_time: 'One-time' }

// ── Reusable Components ────────────────────────────────────────────────────

const TabBtn = ({ active, onClick, icon: Icon, label, count, badge }) => (
  <button onClick={onClick} className={`tab-btn ${active ? 'active' : ''}`} style={{ position: 'relative' }}>
    <Icon size={14} /> {label}
    {count !== undefined && <span className="tab-badge">{count}</span>}
    {badge > 0 && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', border: '2px solid white' }} />}
  </button>
)

const StatusBadge = ({ status }) => {
  const S = {
    open: { color: 'var(--red)', bg: 'var(--status-danger-soft)', label: 'Open' },
    assigned: { color: 'var(--cyan)', bg: 'rgba(6,182,212,0.1)', label: 'Assigned' },
    working: { color: 'var(--accent)', bg: 'rgba(14,165,233,0.1)', label: 'In Progress' },
    resolved: { color: 'var(--green)', bg: 'rgba(34,197,94,0.1)', label: 'Resolved' },
    scheduled: { color: 'var(--accent)', bg: 'rgba(14,165,233,0.1)', label: 'Scheduled' },
    overdue: { color: 'var(--red)', bg: 'var(--status-danger-soft)', label: 'Overdue' },
  }[status?.toLowerCase()] || { color: 'var(--text-3)', bg: 'var(--bg-3)', label: status }
  return <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: S.color, background: S.bg, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap', border: `1px solid ${S.color}20` }}>{S.label}</span>
}

const PriorityBadge = ({ level }) => {
  const P = { critical: { color: 'var(--status-danger)', label: 'Critical' }, high: { color: 'var(--red)', label: 'High' }, medium: { color: 'var(--accent)', label: 'Medium' }, normal: { color: 'var(--accent)', label: 'Normal' }, low: { color: 'var(--green)', label: 'Low' } }[level?.toLowerCase()] || { color: 'var(--text-3)', label: level }
  return <span style={{ color: P.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{P.label}</span>
}

const SLAIndicator = ({ sla_due_at, status, resolved_at }) => {
  if (!sla_due_at) return null
  const now = new Date()
  const due = new Date(sla_due_at)
  if (status === 'resolved') {
    const met = resolved_at ? new Date(resolved_at) <= due : false
    return <span style={{ padding: '2px 6px', borderRadius: 4, background: met ? 'rgba(34,197,94,0.1)' : 'var(--status-danger-soft)', color: met ? 'var(--green)' : 'var(--red)' }}>{met ? 'SLA MET' : 'SLA BREACHED'}</span>
  }
  const remaining = due - now
  if (remaining <= 0) return <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--status-danger-soft)', color: 'var(--red)', animation: 'pulse 2s infinite' }}>SLA BREACHED</span>
  const hrs = Math.floor(remaining / 3600000)
  const color = hrs < 4 ? 'var(--red)' : hrs < 12 ? 'var(--status-warning)' : 'var(--text-3)'
  return <span style={{ color }}>{hrs}h left</span>
}

const WarrantyBadge = ({ warrantyExpiry }) => {
  if (!warrantyExpiry) return null
  const active = new Date(warrantyExpiry) > new Date()
  return <span style={{ padding: '2px 6px', borderRadius: 4, background: active ? 'rgba(34,197,94,0.08)' : 'var(--status-danger-soft)', color: active ? 'var(--green)' : 'var(--text-3)', border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}30` }}>{active ? `Warranty until ${new Date(warrantyExpiry).toLocaleDateString()}` : 'Out of Warranty'}</span>
}

function formatDowntime(start, end) {
  if (!start) return '-'
  const ms = (end ? new Date(end) : new Date()) - new Date(start)
  const hrs = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  if (hrs > 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
  return `${hrs}h ${mins}m`
}

function Toast({ message, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [onDone])
  const bg = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : 'var(--accent)'
  return <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: bg, color: 'white', padding: '12px 20px', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10, animation: 'slideIn 0.3s ease' }}>
    {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{message}
  </div>
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const { user, isAdmin, currentCompany, isMod, can } = useAuth()
  const cc = currentCompany?.code
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)

  // Data
  const [schedules, setSchedules] = useState([])
  const [tickets, setTickets] = useState([])
  const [logs, setLogs] = useState([])
  const [allLogs, setAllLogs] = useState([]) // unlimited for analytics
  const [allAssets, setAllAssets] = useState([])
  const [vendors, setVendors] = useState([])
  const [inventory, setInventory] = useState([])
  const [profiles, setProfiles] = useState([])

  const [logsPage, setLogsPage] = useState(0)
  const [logsHasMore, setLogsHasMore] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Modals
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [showLogForm, setShowLogForm] = useState(null)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [editingTicket, setEditingTicket] = useState(null)
  const [editingSchedule, setEditingSchedule] = useState(null)

  // Vendor modal
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [vendorForm, setVendorForm] = useState({ name: '', contact_person: '', email: '', phone: '', address: '', category: '', notes: '' })
  const [editingVendor, setEditingVendor] = useState(null)

  // Filters
  const [fStatus, setFStatus] = useState('all')
  const [fPriority, setFPriority] = useState('all')
  const [fType, setFType] = useState('all')
  const [schedFilterStatus, setSchedFilterStatus] = useState('all')
  const [ticketView, setTicketView] = useState('list') // 'list' or 'kanban'

  // Forms
  const [ticketForm, setTicketForm] = useState({ asset_id: '', title: '', description: '', ticket_type: 'breakdown', priority: 'normal' })
  const [schedForm, setSchedForm] = useState({ asset_id: '', title: '', description: '', frequency: 'monthly', next_due: '' })
  const [logForm, setLogForm] = useState({ work_done: '', cost: 0, vendor_id: '', parts_used: [] })

  // Detail modal
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [photos, setPhotos] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)

  // ── Data Fetch ────────────────────────────────────────────────────────

  useEffect(() => { fetchData(); fetchLogs(0, true) }, [cc])

  async function fetchLogs(pageNum = 0, reset = false) {
    if (loadingLogs) return;
    setLoadingLogs(true);
    try {
      const { data, count } = await fetchMaintenanceLogsPaginated({ company_code: cc }, pageNum, 50);
      if (reset) {
        setLogs(data);
      } else {
        setLogs(prev => {
          const newItems = data.filter(d => !prev.some(p => p.id === d.id));
          return [...prev, ...newItems];
        });
      }
      setLogsHasMore((pageNum + 1) * 50 < count);
      setLogsPage(pageNum);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function fetchData() {
    setLoading(true)
    try {
      let sQ = supabase.from('maintenance_schedules').select('*, assets(asset_name, asset_code)').order('next_due')
      let tQ = supabase.from('maintenance_tickets').select('*, assets(asset_name, asset_code, warranty_expiry, site, category), profiles!reported_by(full_name), assignee:profiles!assigned_to(full_name)').order('created_at', { ascending: false })
      if (cc) tQ = tQ.eq('company_code', cc)
      let aQ = supabase.from('assets').select('id, asset_name, asset_code, warranty_expiry, site, category').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%').order('asset_name')
      if (cc) aQ = aQ.eq('company_code', cc)
      let iQ = supabase.from('bulk_items').select('id, item_name, unit').eq('is_active', true).order('item_name')
      const [s, t, al, a, v, i, p] = await Promise.all([
        sQ,
        tQ,
        supabase.from('maintenance_logs').select('cost, performed_at, asset_id, vendor_id, assets(asset_name, category)'),
        aQ,
        fetchAllVendors(),
        iQ,
        getAllProfiles(),
      ])
      setSchedules(s.data || [])
      setTickets(t.data || [])
      setAllLogs(al.data || [])
      setAllAssets(a.data || [])
      setVendors(v)
      setInventory(i.data || [])
      setProfiles(p)
      // Auto-create tickets from overdue schedules
      const count = await autoCreateOverdueTickets(user.id)
      if (count > 0) {
        setToast({ message: `${count} overdue ticket${count > 1 ? 's' : ''} auto-created`, type: 'success' })
        // Refresh tickets
        const { data: refreshed } = await supabase.from('maintenance_tickets').select('*, assets(asset_name, asset_code, warranty_expiry, site, category), profiles!reported_by(full_name), assignee:profiles!assigned_to(full_name)').order('created_at', { ascending: false })
        setTickets(refreshed || [])
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  // ── Ticket CRUD ───────────────────────────────────────────────────────

  async function handleCreateTicket() {
    if (!ticketForm.asset_id || !ticketForm.title) return alert("Asset and Title required")
    setCreating(true)
    try {
      await createMaintenanceTicket({ ...ticketForm, reported_by: user.id, ...(cc ? { company_code: cc } : {}) })
      setShowTicketForm(false); setEditingTicket(null)
      setTicketForm({ asset_id: '', title: '', description: '', ticket_type: 'breakdown', priority: 'normal' })
      fetchData()
    } catch (e) { alert(e.message) }
    finally { setCreating(false) }
  }

  async function handleUpdateTicket() {
    if (!editingTicket) return
    setCreating(true)
    try {
      await updateMaintenanceTicket(editingTicket.id, ticketForm)
      setShowTicketForm(false); setEditingTicket(null)
      setTicketForm({ asset_id: '', title: '', description: '', ticket_type: 'breakdown', priority: 'normal' })
      fetchData()
    } catch (e) { alert(e.message) }
    finally { setCreating(false) }
  }

  async function handleDeleteTicket(id) {
    if (!window.confirm('Delete this ticket permanently?')) return
    try { await deleteMaintenanceTicket(id); fetchData(); if (selectedTicket?.id === id) setSelectedTicket(null) }
    catch (e) { alert(e.message) }
  }

  // ── Schedule CRUD ─────────────────────────────────────────────────────

  async function handleCreateSchedule() {
    if (!schedForm.asset_id || !schedForm.title || !schedForm.next_due) return alert("Asset, Title, Due Date required")
    setCreating(true)
    try {
      if (editingSchedule) {
        await updateMaintenanceSchedule(editingSchedule.id, schedForm)
      } else {
        await createMaintenanceSchedule({ ...schedForm, created_by: user.id })
      }
      setShowScheduleForm(false); setEditingSchedule(null)
      setSchedForm({ asset_id: '', title: '', description: '', frequency: 'monthly', next_due: '' })
      fetchData()
    } catch (e) { alert(e.message) }
    finally { setCreating(false) }
  }

  async function handleDeleteSchedule(id) {
    if (!window.confirm('Delete this schedule?')) return
    try { await deleteMaintenanceSchedule(id); fetchData() }
    catch (e) { alert(e.message) }
  }

  // ── Log Work ──────────────────────────────────────────────────────────

  async function handleLogWork() {
    if (!logForm.work_done) return alert("Work details required")
    setCreating(true)
    try {
      const payload = {
        ...logForm, performed_by: user.id, asset_id: showLogForm.data.asset_id,
        performed_at: new Date().toISOString(),
      }
      if (Number(logForm.cost) > 500) {
        payload.approval_status = 'pending'
      }
      if (showLogForm.type === 'ticket') payload.ticket_id = showLogForm.data.id
      if (showLogForm.type === 'schedule') payload.schedule_id = showLogForm.data.id
      await logMaintenanceWork(payload, logForm.parts_used.map(p => ({ item_id: p, quantity: 1 })))
      setShowLogForm(null); setLogForm({ work_done: '', cost: 0, vendor_id: '', parts_used: [] })
      if (payload.approval_status === 'pending') {
        setToast({ message: 'Log submitted. Awaiting manager approval for cost > $500', type: 'success' })
      }
      fetchData()
      fetchLogs(0, true)
    } catch (e) { alert(e.message) }
    finally { setCreating(false) }
  }

  // ── Approval & QR Handlers ──────────────────────────────────────────────

  async function handleApproveLog(logId, status) {
    try {
      await approveMaintenanceLog(logId, status, user.id)
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, approval_status: status } : l))
      setToast({ message: `Log marked as ${status}`, type: 'success' })
    } catch(e) { alert(e.message) }
  }

  const handleQRScan = useCallback((decodedText) => {
    let assetId = decodedText
    if (decodedText.includes('/scan/')) {
      assetId = decodedText.split('/scan/')[1].split('?')[0].split('#')[0]
    }
    assetId = assetId.trim()

    const asset = allAssets.find(a => a.id === assetId || a.asset_code === assetId)
    if (asset) {
      setSearch(asset.asset_name)
      setActiveTab('tickets')
      setToast({ message: `Viewing tickets for ${asset.asset_name}`, type: 'success' })
    } else {
      setToast({ message: 'Asset not found', type: 'error' })
    }
    setShowQRScanner(false)
  }, [allAssets])

  // ── Ticket Detail ─────────────────────────────────────────────────────

  async function openTicketDetail(ticket) {
    setSelectedTicket(ticket)
    setDetailLoading(true)
    try {
      const [c, p] = await Promise.all([fetchTicketComments(ticket.id), fetchMaintenancePhotos(ticket.id)])
      setComments(c); setPhotos(p)
    } catch (e) { console.error(e) }
    setDetailLoading(false)
  }

  async function handleAddComment() {
    if (!commentText.trim() || !selectedTicket) return
    try {
      const c = await addTicketComment(selectedTicket.id, user.id, commentText.trim())
      setComments(prev => [...prev, c]); setCommentText('')
    } catch (e) { console.error(e) }
  }

  async function handleAssignTicket(ticketId, assigneeId) {
    try {
      await updateMaintenanceTicket(ticketId, { assigned_to: assigneeId, status: assigneeId ? 'assigned' : 'open' })
      if (assigneeId) await createNotification(assigneeId, 'Ticket Assigned', `You've been assigned ticket ${selectedTicket?.ticket_no}`, '/maintenance')
      fetchData()
      if (selectedTicket) {
        const assignee = profiles.find(p => p.id === assigneeId)
        setSelectedTicket(prev => ({ ...prev, assigned_to: assigneeId, status: assigneeId ? 'assigned' : 'open', assignee: assignee ? { full_name: assignee.full_name } : null }))
      }
      setToast({ message: assigneeId ? 'Ticket assigned' : 'Assignment removed', type: 'success' })
    } catch (e) { alert(e.message) }
  }

  async function handleChangeStatus(ticketId, newStatus) {
    const updates = { status: newStatus }
    if (newStatus === 'resolved') { updates.resolved_at = new Date().toISOString(); updates.downtime_end = new Date().toISOString() }
    try {
      await updateMaintenanceTicket(ticketId, updates)
      setSelectedTicket(prev => ({ ...prev, ...updates }))
      fetchData()
    } catch (e) { alert(e.message) }
  }

  async function handlePhotoUpload(file, type = 'evidence') {
    if (!file || !selectedTicket) return
    setPhotoUploading(true)
    try {
      const p = await uploadMaintenancePhoto(selectedTicket.id, null, file, type, user.id)
      setPhotos(prev => [...prev, p])
      setToast({ message: 'Photo uploaded', type: 'success' })
    } catch (e) { setToast({ message: `Upload failed: ${e.message}`, type: 'error' }) }
    setPhotoUploading(false)
  }

  async function handleRemovePhoto(photoId) {
    try { await removeMaintenancePhoto(photoId); setPhotos(prev => prev.filter(p => p.id !== photoId)) }
    catch (e) { console.error(e) }
  }

  // ── Vendor CRUD ───────────────────────────────────────────────────────

  async function handleSaveVendor() {
    if (!vendorForm.name.trim()) return alert('Vendor name required')
    setCreating(true)
    try {
      if (editingVendor) { await updateVendor(editingVendor.id, vendorForm) }
      else { await createVendor(vendorForm) }
      setShowVendorForm(false); setEditingVendor(null)
      setVendorForm({ name: '', contact_person: '', email: '', phone: '', address: '', category: '', notes: '' })
      const v = await fetchAllVendors(); setVendors(v)
    } catch (e) { alert(e.message) }
    finally { setCreating(false) }
  }

  async function handleDeleteVendor(id) {
    if (!window.confirm('Delete this vendor?')) return
    try { await deleteVendor(id); const v = await fetchAllVendors(); setVendors(v) }
    catch (e) { alert(e.message) }
  }

  // ── PDF Work Order ────────────────────────────────────────────────────

  function generateWorkOrder(t) {
    const asset = t.assets || {}
    const html = `<!DOCTYPE html><html><head><title>Work Order - ${t.ticket_no}</title>
    <style>body{padding:40px;color:#1a1a2e;max-width:800px;margin:0 auto}
    h1{font-size:1.5rem;margin-bottom:0}h2{font-size:1rem;margin-top:24px;border-bottom:2px solid #4f7eff;padding-bottom:4px;color:#4f7eff}
    .meta{color:#666;font-size:0.82rem}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
    .field{padding:8px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb}
    .field-label{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;color:#666;margin-bottom:2px}
    .field-value{font-weight:600;font-size:0.88rem}
    .sig-line{margin-top:60px;display:flex;gap:60px}.sig-box{flex:1;border-top:1px solid #333;padding-top:8px;font-size:0.78rem;color:#666}
    @media print{body{padding:20px}}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><h1>WORK ORDER</h1><p class="meta">${t.ticket_no} · Generated ${new Date().toLocaleDateString()}</p></div>
      <div style="text-align:right"><div style="font-size:0.72rem;color:#666">Priority</div><div style="font-size:1.2rem;font-weight:700;color:${t.priority === 'high' || t.priority === 'critical' ? 'var(--status-danger)' : '#4f7eff'}">${(t.priority || 'normal').toUpperCase()}</div></div>
    </div>
    <h2>Asset Details</h2>
    <div class="grid">
      <div class="field"><div class="field-label">Asset Name</div><div class="field-value">${asset.asset_name || '-'}</div></div>
      <div class="field"><div class="field-label">Asset Code</div><div class="field-value">${asset.asset_code || '-'}</div></div>
      <div class="field"><div class="field-label">Site</div><div class="field-value">${asset.site || '-'}</div></div>
      <div class="field"><div class="field-label">Category</div><div class="field-value">${asset.category || '-'}</div></div>
    </div>
    <h2>Issue Details</h2>
    <div class="grid">
      <div class="field"><div class="field-label">Type</div><div class="field-value">${t.ticket_type || '-'}</div></div>
      <div class="field"><div class="field-label">Status</div><div class="field-value">${t.status || '-'}</div></div>
    </div>
    <div class="field" style="margin-top:12px"><div class="field-label">Title</div><div class="field-value">${t.title}</div></div>
    <div class="field" style="margin-top:8px"><div class="field-label">Description</div><div class="field-value">${t.description || 'No description provided'}</div></div>
    ${t.assignee?.full_name ? `<div class="field" style="margin-top:8px"><div class="field-label">Assigned To</div><div class="field-value">${t.assignee.full_name}</div></div>` : ''}
    <h2>Completion</h2>
    <div class="field"><div class="field-label">Work Performed</div><div class="field-value" style="min-height:60px">&nbsp;</div></div>
    <div class="grid" style="margin-top:8px">
      <div class="field"><div class="field-label">Parts Used</div><div class="field-value" style="min-height:40px">&nbsp;</div></div>
      <div class="field"><div class="field-label">Total Cost</div><div class="field-value" style="min-height:40px">&nbsp;</div></div>
    </div>
    <div class="sig-line"><div class="sig-box">Assigned By: _______________<br/>Date:</div><div class="sig-box">Completed By: _______________<br/>Date:</div></div>
    <p style="margin-top:40px;text-align:center;color:#999;font-size:0.68rem">Strongbuilt Work Order · ${new Date().toLocaleString()}</p>
    </body></html>`
    const w = window.open('', '_blank'); if (!w) { alert('Allow pop-ups to open the print preview.'); return }; writePrintDocument(w, html); w.document.close(); setTimeout(() => w.print(), 500)
  }

  // ── Derived Data ──────────────────────────────────────────────────────

  const filteredTickets = useMemo(() => tickets.filter(t => {
    const matchSearch = !search || t.assets?.asset_name?.toLowerCase().includes(search.toLowerCase()) || t.title?.toLowerCase().includes(search.toLowerCase()) || t.ticket_no?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = fStatus === 'all' || t.status === fStatus
    const matchPriority = fPriority === 'all' || t.priority === fPriority
    const matchType = fType === 'all' || t.ticket_type === fType
    return matchSearch && matchStatus && matchPriority && matchType
  }), [tickets, search, fStatus, fPriority, fType])

  const filteredSchedules = useMemo(() => schedules.filter(s => {
    const matchSearch = !search || s.assets?.asset_name?.toLowerCase().includes(search.toLowerCase()) || s.title?.toLowerCase().includes(search.toLowerCase())
    const isOverdue = new Date(s.next_due) < new Date()
    const matchStatus = schedFilterStatus === 'all' || (schedFilterStatus === 'overdue' && isOverdue) || (schedFilterStatus === 'active' && s.status === 'active' && !isOverdue)
    return matchSearch && matchStatus
  }), [schedules, search, schedFilterStatus])

  const openTickets = tickets.filter(t => t.status !== 'resolved')
  const overdueSchedules = schedules.filter(s => s.status === 'active' && new Date(s.next_due) < new Date())
  const slaBreached = tickets.filter(t => t.sla_due_at && t.status !== 'resolved' && new Date(t.sla_due_at) < new Date())
  const totalCost = allLogs.reduce((a, l) => a + (Number(l.cost) || 0), 0)

  // Analytics data
  const monthlySpend = useMemo(() => {
    const map = {}
    allLogs.forEach(l => {
      if (!l.performed_at || !l.cost) return
      const m = new Date(l.performed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      map[m] = (map[m] || 0) + Number(l.cost)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).slice(-12)
  }, [allLogs])

  const spendByVendor = useMemo(() => {
    const map = {}
    allLogs.forEach(l => {
      if (!l.cost) return
      const vName = l.vendor_id ? vendors.find(v => v.id === l.vendor_id)?.name || 'Unknown' : 'In-house'
      map[vName] = (map[vName] || 0) + Number(l.cost)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [allLogs, vendors])

  const spendByAsset = useMemo(() => {
    const map = {}
    allLogs.forEach(l => {
      if (!l.cost) return
      const name = l.assets?.asset_name || 'Unknown'
      map[name] = (map[name] || 0) + Number(l.cost)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [allLogs])

  const selectedAssetWarranty = useMemo(() => {
    if (!ticketForm.asset_id) return null
    return allAssets.find(a => a.id === ticketForm.asset_id)?.warranty_expiry
  }, [ticketForm.asset_id, allAssets])

  // ── RENDER: Dashboard ─────────────────────────────────────────────────

  const renderDashboard = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
      {[
        { label: 'Open Tickets', val: openTickets.length, color: 'var(--red)' },
        { label: 'In Progress', val: tickets.filter(t => t.status === 'assigned' || t.status === 'working').length, color: 'var(--accent)' },
        { label: 'Overdue Tasks', val: overdueSchedules.length, color: 'var(--red)' },
        { label: 'SLA Breaches', val: slaBreached.length, color: slaBreached.length > 0 ? 'var(--red)' : 'var(--green)' },
        { label: 'Total Cost', val: formatCurrency(totalCost), color: 'var(--text-0)' },
        { label: 'Avg Downtime', val: (() => { const resolved = tickets.filter(t => t.downtime_start && t.downtime_end); if (!resolved.length) return '-'; const avg = resolved.reduce((a, t) => a + (new Date(t.downtime_end) - new Date(t.downtime_start)), 0) / resolved.length; return `${Math.round(avg / 3600000)}h` })(), color: 'var(--accent)' },
      ].map(stat => (
        <div key={stat.label} className="card" style={{ padding: 20 }}>
          <div style={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)' }}>{stat.label}</div>
          <div style={{ marginTop: 4, color: stat.color }}>{stat.val}</div>
        </div>
      ))}

      {/* Urgent tickets */}
      <div className="card" style={{ gridColumn: '1 / -1', padding: 20 }}>
        <h3 style={{ textTransform: 'uppercase', marginBottom: 16 }}>Urgent Tickets</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tickets.filter(t => (t.priority === 'high' || t.priority === 'critical') && t.status !== 'resolved').slice(0, 5).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--status-danger-soft)', borderRadius: 8, border: '1px solid var(--status-danger-soft)', cursor: 'pointer' }} onClick={() => openTicketDetail(t)}>
              <AlertTriangle size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.assets?.asset_name} - {t.title}</div>
                <div style={{ color: 'var(--text-3)', display: 'flex', gap: 10 }}>
                  <span>{t.ticket_no}</span>
                  <SLAIndicator sla_due_at={t.sla_due_at} status={t.status} resolved_at={t.resolved_at} />
                </div>
              </div>
              <StatusBadge status={t.status} />
            </div>
          ))}
          {tickets.filter(t => (t.priority === 'high' || t.priority === 'critical') && t.status !== 'resolved').length === 0 && <div style={{ color: 'var(--text-3)', }}>No urgent tickets!</div>}
        </div>
      </div>

      {/* Upcoming schedules */}
      <div className="card" style={{ gridColumn: '1 / -1', padding: 20 }}>
        <h3 style={{ textTransform: 'uppercase', marginBottom: 16 }}>Upcoming Schedules</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {schedules.slice(0, 5).map(s => {
            const overdue = new Date(s.next_due) < new Date()
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: overdue ? 'var(--status-danger-soft)' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={14} style={{ color: overdue ? 'var(--red)' : 'var(--text-3)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div >{s.assets?.asset_name}</div>
                  <div style={{ color: 'var(--text-3)' }}>{s.title}</div>
                </div>
                <div style={{ color: overdue ? 'var(--red)' : 'var(--text-3)' }}>{new Date(s.next_due).toLocaleDateString()}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ── RENDER: Tickets ───────────────────────────────────────────────────

  const renderTickets = () => (
    <div>
      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <select className="sel" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ height: 36, }}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option><option value="assigned">Assigned</option><option value="working">In Progress</option><option value="resolved">Resolved</option>
        </select>
        <select className="sel" value={fPriority} onChange={e => setFPriority(e.target.value)} style={{ height: 36, }}>
          <option value="all">All Priorities</option>
          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
        </select>
        <select className="sel" value={fType} onChange={e => setFType(e.target.value)} style={{ height: 36, }}>
          <option value="all">All Types</option>
          <option value="breakdown">Breakdown</option><option value="fault">Fault</option><option value="inspection">Inspection</option><option value="damage">Damage</option><option value="scheduled">Scheduled</option>
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: 4, borderRadius: 8 }}>
          <button onClick={() => setTicketView('list')} className={ticketView === 'list' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '6px 12px', }}>List View</button>
          <button onClick={() => setTicketView('kanban')} className={ticketView === 'kanban' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '6px 12px', }}>Kanban Board</button>
        </div>
        <div style={{ color: 'var(--text-3)' }}>{filteredTickets.length} tickets</div>
      </div>

      {ticketView === 'kanban' ? (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, minHeight: 600 }}>
          {['open', 'assigned', 'working', 'resolved'].map(colStatus => {
            const colTickets = filteredTickets.filter(t => t.status === colStatus);
            return (
              <div key={colStatus} style={{ flex: '0 0 320px', background: 'var(--bg-2)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border)' }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const ticketId = e.dataTransfer.getData('ticketId');
                  if (ticketId) handleChangeStatus(ticketId, colStatus);
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                  <h3 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {colStatus.replace('_', ' ')}
                    <span style={{ background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 10, }}>{colTickets.length}</span>
                  </h3>
                </div>
                {colTickets.map(t => (
                  <div key={t.id} draggable onDragStart={e => e.dataTransfer.setData('ticketId', t.id)}
                    onClick={() => openTicketDetail(t)}
                    style={{ background: 'white', padding: 16, borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.04)', border: '1px solid var(--border)', cursor: 'grab', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className="font-mono" style={{ color: 'var(--text-3)' }}>{t.ticket_no}</span>
                      <PriorityBadge level={t.priority} />
                    </div>
                    <div style={{ color: 'var(--text-0)', marginBottom: 4 }}>{t.assets?.asset_name}</div>
                    <div style={{ color: 'var(--text-2)', marginBottom: 12 }}>{t.title}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <SLAIndicator sla_due_at={t.sla_due_at} status={t.status} resolved_at={t.resolved_at} />
                      {t.assignee?.full_name ? (
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', }} title={t.assignee.full_name}>
                          {t.assignee.full_name[0].toUpperCase()}
                        </div>
                      ) : <span style={{ color: 'var(--text-3)' }}>Unassigned</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <>

      {/* Desktop table */}
      <div className="card desktop-table" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>Asset / Issue</span><span>Priority</span><span>SLA</span><span>Assigned</span><span>Status</span><span style={{ textAlign: 'right' }}>Actions</span>
        </div>
        {filteredTickets.map((t, idx) => (
          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', alignItems: 'center', padding: '14px 20px', borderBottom: idx < filteredTickets.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }} onClick={() => openTicketDetail(t)}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--text-1)', }}>{t.assets?.asset_name}</span>
                <WarrantyBadge warrantyExpiry={t.assets?.warranty_expiry} />
              </div>
              <div style={{ color: 'var(--text-3)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                <span className="font-mono" >{t.ticket_no}</span>
                <span>{t.title}</span>
              </div>
            </div>
            <div><PriorityBadge level={t.priority} /></div>
            <div><SLAIndicator sla_due_at={t.sla_due_at} status={t.status} resolved_at={t.resolved_at} /></div>
            <div style={{ color: 'var(--text-2)' }}>{t.assignee?.full_name || '-'}</div>
            <div><StatusBadge status={t.status} /></div>
            <div style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
              {t.status !== 'resolved' && <button className="btn-primary" style={{ padding: '4px 10px', }} onClick={() => { setLogForm({ work_done: '', cost: 0, vendor_id: '', parts_used: [] }); setShowLogForm({ type: 'ticket', data: t }) }}>Resolve</button>}
              <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => openTicketDetail(t)}><Eye size={13} /></button>
              {t.status !== 'resolved' && <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => { setEditingTicket(t); setTicketForm({ asset_id: t.asset_id, title: t.title, description: t.description || '', ticket_type: t.ticket_type || 'breakdown', priority: t.priority || 'normal' }); setShowTicketForm(true) }}><Edit2 size={13} /></button>}
              {isAdmin && <button className="btn-ghost" style={{ padding: '4px 8px', color: 'var(--red)' }} onClick={() => handleDeleteTicket(t.id)}><Trash2 size={13} /></button>}
            </div>
          </div>
        ))}
        {filteredTickets.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>No tickets found.</div>}
      </div>

      {/* Mobile cards */}
      <div className="mobile-cards">
        {filteredTickets.map(t => (
          <div key={t.id} className="asset-card-mobile" onClick={() => openTicketDetail(t)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="font-mono" style={{ color: 'var(--accent)', }}>{t.ticket_no}</span>
              <StatusBadge status={t.status} />
            </div>
            <div style={{ color: 'var(--text-0)', marginBottom: 4 }}>{t.assets?.asset_name}</div>
            <div style={{ color: 'var(--text-2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-3)' }}>
              <PriorityBadge level={t.priority} />
              <SLAIndicator sla_due_at={t.sla_due_at} status={t.status} resolved_at={t.resolved_at} />
              {t.assignee?.full_name && <span>→ {t.assignee.full_name}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
              {t.status !== 'resolved' && <button className="btn-primary" style={{ padding: '5px 12px', }} onClick={() => { setLogForm({ work_done: '', cost: 0, vendor_id: '', parts_used: [] }); setShowLogForm({ type: 'ticket', data: t }) }}>Resolve</button>}
              <button className="btn-ghost" style={{ padding: '5px 12px', }} onClick={() => openTicketDetail(t)}><Eye size={12} /> Details</button>
            </div>
          </div>
        ))}
        {filteredTickets.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No tickets found.</div>}
      </div>
      </>
      )}
    </div>
  )

  // ── RENDER: Schedules ─────────────────────────────────────────────────

  const renderSchedules = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);

    const groups = {
      Overdue: [],
      Upcoming: [], // next 30 days
      Later: []
    };

    filteredSchedules.forEach(s => {
      if (!s.next_due) return groups.Later.push(s);
      const due = new Date(s.next_due);
      due.setHours(0,0,0,0);
      if (due < today) groups.Overdue.push(s);
      else if (due <= in30Days) groups.Upcoming.push(s);
      else groups.Later.push(s);
    });

    const renderGroup = (title, items, color) => (
      items.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ textTransform: 'uppercase', marginBottom: 12, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            {title} ({items.length})
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {items.map(s => {
              const isOverdue = new Date(s.next_due) < today;
              return (
                <div key={s.id} className="card" style={{ padding: '16px', borderLeft: `3px solid ${color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: isOverdue ? 'var(--status-danger-soft)' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Calendar size={15} style={{ color: isOverdue ? 'var(--red)' : 'var(--accent)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.assets?.asset_name}</div>
                      <div style={{ color: 'var(--text-3)' }}>{s.title}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--bg-3)', color: 'var(--text-2)', }}>{FREQ_MAP[s.frequency] || s.frequency}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: isOverdue ? 'var(--status-danger-soft)' : 'var(--accent-glow)', color: isOverdue ? 'var(--red)' : 'var(--accent)', }}>
                      Due: {s.next_due ? new Date(s.next_due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-primary" style={{ padding: '6px', flex: 1, justifyContent: 'center', background: 'var(--green)', borderColor: 'var(--green)' }}
                      onClick={() => { setLogForm({ work_done: s.title, cost: 0, vendor_id: '', parts_used: [] }); setShowLogForm({ type: 'schedule', data: s }) }}>
                      <CheckCircle2 size={14} /> Done
                    </button>
                    <button className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => { setEditingSchedule(s); setSchedForm({ asset_id: s.asset_id, title: s.title, description: s.description || '', frequency: s.frequency, next_due: s.next_due || '' }); setShowScheduleForm(true) }}><Edit2 size={14} /></button>
                    {isAdmin && <button className="btn-ghost" style={{ padding: '6px 12px', color: 'var(--red)' }} onClick={() => handleDeleteSchedule(s.id)}><Trash2 size={14} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )
    );

    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {['all', 'active', 'overdue'].map(f => (
            <button key={f} onClick={() => setSchedFilterStatus(f)} className={schedFilterStatus === f ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '6px 14px', textTransform: 'capitalize', ...(f === 'overdue' && schedFilterStatus === f ? { background: 'var(--red)', borderColor: 'var(--red)' } : {}) }}>{f}</button>
          ))}
          <span style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>{filteredSchedules.length} schedules</span>
        </div>

        {filteredSchedules.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>No schedules found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderGroup('Overdue', groups.Overdue, 'var(--red)')}
            {renderGroup('Next 30 Days', groups.Upcoming, 'var(--status-warning)')}
            {renderGroup('Later', groups.Later, 'var(--text-3)')}
          </div>
        )}
      </div>
    );
  };

  // ── RENDER: History/Logs ──────────────────────────────────────────────

  const renderHistory = () => (
    <div>
      {/* Desktop table */}
      <div className="card desktop-table" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>Asset / Task</span><span>Type</span><span>Performed By</span><span>Cost</span><span>Approval</span><span style={{ textAlign: 'right' }}>Date</span>
        </div>
        {logs.map((l, idx) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, alignItems: 'center', padding: '12px 20px', borderBottom: idx < logs.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.assets?.asset_name}</div>
              <div style={{ color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.work_done}</div>
            </div>
            <div><span style={{ padding: '2px 6px', background: 'var(--bg-3)', borderRadius: 4 }}>{l.schedule_id ? 'Preventive' : 'Corrective'}</span></div>
            <div >{l.profiles?.full_name || 'System'}</div>
            <div style={{ color: 'var(--text-2)' }}>{formatCurrency(l.cost || 0)}</div>
            <div>
              {l.approval_status === 'pending' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  {isAdmin ? (
                    <>
                      <button className="btn-ghost" style={{ padding: 4, color: 'var(--green)' }} onClick={() => handleApproveLog(l.id, 'approved')} title="Approve"><CheckCircle2 size={14} /></button>
                      <button className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }} onClick={() => handleApproveLog(l.id, 'rejected')} title="Reject"><XCircle size={14} /></button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--status-warning)', }}>Pending</span>
                  )}
                </div>
              ) : l.approval_status === 'rejected' ? (
                <span style={{ color: 'var(--red)', }}>Rejected</span>
              ) : (
                <span style={{ color: 'var(--green)', }}>Approved</span>
              )}
            </div>
            <div style={{ textAlign: 'right', color: 'var(--text-3)' }}>{new Date(l.performed_at).toLocaleDateString()}</div>
          </div>
        ))}
        {logs.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>No history found.</div>}
        {logsHasMore && (
          <div style={{ textAlign: 'center', padding: '16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn-ghost" onClick={() => fetchLogs(logsPage + 1)} disabled={loadingLogs} >
              {loadingLogs ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Load More Logs'}
            </button>
          </div>
        )}
      </div>
      {/* Mobile cards */}
      <div className="mobile-cards">
        {logs.map(l => (
          <div key={l.id} className="asset-card-mobile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-0)' }}>{l.assets?.asset_name}</span>
              <span style={{ padding: '2px 6px', background: 'var(--bg-3)', borderRadius: 4 }}>{l.schedule_id ? 'Preventive' : 'Corrective'}</span>
            </div>
            <div style={{ color: 'var(--text-2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.work_done}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-3)' }}>
              <span>{l.profiles?.full_name || 'System'}</span>
              <span style={{ color: 'var(--text-2)' }}>{formatCurrency(l.cost || 0)}</span>
              <span style={{ marginLeft: 'auto', }}>{new Date(l.performed_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {logs.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No history found.</div>}
      </div>
    </div>
  )

  // ── RENDER: Analytics ─────────────────────────────────────────────────

  const renderAnalytics = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
      {/* Monthly Spend */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ textTransform: 'uppercase', marginBottom: 16 }}>Monthly Spend</h3>
        {monthlySpend.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySpend}><XAxis dataKey="name" tick={{ }} /><YAxis tick={{ }} /><Tooltip formatter={v => formatCurrency(v)} /><Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        ) : <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>No data yet</p>}
      </div>

      {/* By Vendor */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ textTransform: 'uppercase', marginBottom: 16 }}>Spend by Vendor</h3>
        {spendByVendor.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={spendByVendor} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} >
              {spendByVendor.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie><Tooltip formatter={v => formatCurrency(v)} /></PieChart>
          </ResponsiveContainer>
        ) : <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>No data yet</p>}
      </div>

      {/* Top Assets by Cost */}
      <div className="card" style={{ padding: 20, gridColumn: '1 / -1' }}>
        <h3 style={{ textTransform: 'uppercase', marginBottom: 16 }}>Top 10 Assets by Maintenance Cost</h3>
        {spendByAsset.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={spendByAsset} layout="vertical"><XAxis type="number" tick={{ }} /><YAxis type="category" dataKey="name" width={140} tick={{ }} /><Tooltip formatter={v => formatCurrency(v)} /><Bar dataKey="value" fill="#34d399" radius={[0, 4, 4, 0]} /></BarChart>
          </ResponsiveContainer>
        ) : <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 40 }}>No data yet</p>}
      </div>
    </div>
  )

  // ── RENDER: Vendors ───────────────────────────────────────────────────

  const renderVendors = () => {
    // Compute Vendor Stats
    const vendorStats = vendors.map(v => {
      const vLogs = allLogs.filter(l => l.vendor_id === v.id);
      const totalSpend = vLogs.reduce((sum, l) => sum + (Number(l.cost) || 0), 0);
      const ticketCount = vLogs.length;
      const avgCost = ticketCount > 0 ? totalSpend / ticketCount : 0;
      return { ...v, totalSpend, ticketCount, avgCost };
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Vendor Scorecards */}
        {vendorStats.length > 0 && (
          <div>
            <h3 style={{ textTransform: 'uppercase', marginBottom: 12, color: 'var(--text-2)' }}>Vendor Scorecards</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {vendorStats.filter(v => v.ticketCount > 0).sort((a,b) => b.totalSpend - a.totalSpend).slice(0, 4).map(v => (
                <div key={`stat-${v.id}`} className="card" style={{ padding: '16px', background: 'linear-gradient(145deg, var(--bg-1), var(--bg-2))', borderLeft: '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ color: 'var(--text-0)', }}>{v.name}</div>
                    <div style={{ background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 12, color: 'var(--text-2)' }}>{v.ticketCount} Jobs</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 2 }}>Total Spend</div>
                      <div style={{ color: 'var(--accent)' }}>{formatCurrency(v.totalSpend)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 2 }}>Avg / Job</div>
                      <div style={{ color: 'var(--text-1)' }}>{formatCurrency(v.avgCost)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vendor Directory */}
        <h3 style={{ textTransform: 'uppercase', marginBottom: 0, color: 'var(--text-2)' }}>Vendor Directory</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {vendors.map(v => (
            <div key={v.id} className="card" style={{ padding: '16px 20px', opacity: v.is_active ? 1 : 0.5 }}>
              {/* Row 1: Name + Rating + Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-glow)', border: '1px solid var(--accent)20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={15} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                  {v.rating > 0 && <div style={{ color: 'var(--status-warning)', letterSpacing: 2 }}>{'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)}</div>}
                </div>
                {!v.is_active && <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--bg-3)', color: 'var(--text-3)' }}>INACTIVE</span>}
                <button className="btn-ghost" style={{ padding: 6, minHeight: 'auto', flexShrink: 0 }} onClick={() => { setEditingVendor(v); setVendorForm({ name: v.name, contact_person: v.contact_person || '', email: v.email || '', phone: v.phone || '', address: v.address || '', category: v.category || '', notes: v.notes || '' }); setShowVendorForm(true) }}><Edit2 size={13} /></button>
                {isAdmin && <button className="btn-ghost" style={{ padding: 6, color: 'var(--red)', minHeight: 'auto', flexShrink: 0 }} onClick={() => handleDeleteVendor(v.id)}><Trash2 size={13} /></button>}
              </div>
              {/* Row 2: Meta pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {v.contact_person && (
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <User size={10} />{v.contact_person}
                  </span>
                )}
                {v.email && (
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={10} />{v.email}
                  </span>
                )}
                {v.phone && (
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={10} />{v.phone}
                  </span>
                )}
                {v.category && (
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--accent-glow)', color: 'var(--accent)', }}>
                    {v.category}
                  </span>
                )}
              </div>
            </div>
          ))}
          {vendors.length === 0 && (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
              <Building2 size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>No vendors added yet.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── RENDER: Ticket Detail Modal ───────────────────────────────────────

  const renderTicketDetail = () => {
    if (!selectedTicket) return null
    const t = selectedTicket
    return (
      <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setSelectedTicket(null)}>
        <div className="modal" style={{ maxWidth: 700, maxHeight: '90vh', overflow: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="card-header" style={{ position: 'sticky', top: 0, zIndex: 1, padding: '16px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <Wrench size={18} style={{ color: 'var(--accent)' }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 className="font-display" style={{ margin: 0, letterSpacing: '0.04em' }}>{t.ticket_no}</h2>
                  <StatusBadge status={t.status} />
                  <PriorityBadge level={t.priority} />
                </div>
                <span style={{ color: 'var(--text-3)' }}>{t.assets?.asset_name} · {t.assets?.asset_code}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-ghost" style={{ padding: '6px 10px', }} onClick={() => generateWorkOrder(t)}><Download size={12} /> Work Order</button>
              <button className="btn-ghost" style={{ padding: 6 }} onClick={() => setSelectedTicket(null)}><X size={16} /></button>
            </div>
          </div>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
                <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 2 }}>Type</div>
                <div style={{ textTransform: 'capitalize' }}>{t.ticket_type || '-'}</div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
                <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 2 }}>SLA</div>
                <SLAIndicator sla_due_at={t.sla_due_at} status={t.status} resolved_at={t.resolved_at} />
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
                <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 2 }}>Downtime</div>
                <div >{formatDowntime(t.downtime_start, t.downtime_end)}</div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
                <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 2 }}>Warranty</div>
                <WarrantyBadge warrantyExpiry={t.assets?.warranty_expiry} />
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
                <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 2 }}>Reported By</div>
                <div >{t.profiles?.full_name || '-'}</div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
                <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 2 }}>Created</div>
                <div >{new Date(t.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Title + Description */}
            <div>
              <h3 style={{ color: 'var(--text-0)', margin: '0 0 6px' }}>{t.title}</h3>
              <p style={{ color: 'var(--text-2)', margin: 0 }}>{t.description || 'No description provided.'}</p>
            </div>

            {/* Assign + Status Change */}
            {t.status !== 'resolved' && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-3)', borderRadius: 10 }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Assign To</label>
                  <select className="sel" value={t.assigned_to || ''} onChange={e => handleAssignTicket(t.id, e.target.value || null)} style={{ height: 34, width: '100%' }}>
                    <option value="">Unassigned</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Change Status</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {['open', 'assigned', 'working', 'resolved'].filter(s => s !== t.status).map(s => (
                      <button key={s} className="btn-ghost" style={{ padding: '5px 10px', textTransform: 'capitalize' }} onClick={() => handleChangeStatus(t.id, s)}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Photo Evidence */}
            <div>
              <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-0)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={14} style={{ color: 'var(--accent)' }} /> Photo Evidence ({photos.length})
              </h4>
              {detailLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} /> : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {photos.map(p => (
                    <div key={p.id} style={{ position: 'relative', width: 80, height: 80 }}>
                      <img src={p.photo_url} alt="evidence" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                      <span style={{ position: 'absolute', bottom: 2, left: 2, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,0,0,0.6)', color: 'white' }}>{p.photo_type}</span>
                      <button onClick={() => handleRemovePhoto(p.id)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--red)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={10} /></button>
                    </div>
                  ))}
                  {/* Upload buttons */}
                  {['before', 'after', 'evidence'].map(type => (
                    <label key={type} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 8, border: '2px dashed var(--border)', background: 'var(--bg-2)', cursor: 'pointer', gap: 4 }}>
                      {photoUploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} /> : <>
                        <Camera size={14} style={{ color: 'var(--text-3)' }} />
                        <span style={{ color: 'var(--text-3)', textTransform: 'capitalize' }}>{type}</span>
                      </>}
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handlePhotoUpload(f, type); e.target.value = '' }} />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Comments / Timeline */}
            <div>
              <h4 style={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-0)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={14} style={{ color: 'var(--accent)' }} /> Comments ({comments.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 250, overflowY: 'auto', marginBottom: 12 }}>
                {comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white' }}>
                      {(c.profiles?.full_name || 'U')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, background: 'var(--bg-3)', padding: '8px 12px', borderRadius: '4px 12px 12px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-0)' }}>{c.profiles?.full_name || 'User'}</span>
                        <span style={{ color: 'var(--text-3)' }}>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p style={{ color: 'var(--text-1)', margin: 0, }}>{c.comment}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 16 }}>No comments yet.</p>}
              </div>
              {/* Add comment */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="inp" placeholder="Add a comment…" value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()} style={{ flex: 1, height: 36 }} />
                <button className="btn-primary" style={{ padding: '0 16px', flexShrink: 0 }} onClick={handleAddComment} disabled={!commentText.trim()}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PAGE LAYOUT ───────────────────────────────────────────────────────

  return (
    <>
      {isMobile ? (
        <MobileMaintenancePage
          activeTab={activeTab} setActiveTab={setActiveTab}
          loading={loading}
          search={search} setSearch={setSearch}
          filteredTickets={filteredTickets}
          filteredSchedules={filteredSchedules}
          logs={logs}
          openTicketDetail={openTicketDetail}
          setShowTicketForm={setShowTicketForm}
          setShowScheduleForm={setShowScheduleForm}
          setLogForm={setLogForm}
          setShowLogForm={setShowLogForm}
          setShowQRScanner={setShowQRScanner}
          isAdmin={isAdmin}
          isMod={isMod}
          can={can}
        />
      ) : (
        <div style={{ width: '100%' }}>
          {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="text-page-title m-0 mb-1 tracking-wide uppercase">
              MAINTENANCE <span className="text-accent">MODULE</span>
            </h1>
            <p className="maint-subtitle hidden md:block" style={{ color: 'var(--text-2)', }}>Tickets, schedules, SLA tracking, vendor management &amp; cost analytics.</p>
          </div>
          {/* Desktop action buttons */}
          <div className="hidden md:flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowQRScanner(true)} className="btn-ghost" style={{ padding: '8px 12px', }}><QrCode size={14} /> Scan Asset</button>
            <button onClick={() => { setEditingVendor(null); setVendorForm({ name: '', contact_person: '', email: '', phone: '', address: '', category: '', notes: '' }); setShowVendorForm(true); setActiveTab('vendors') }} className="btn-ghost" style={{ padding: '8px 12px', }}><Building2 size={14} /> Add Vendor</button>
            <button onClick={() => { setEditingSchedule(null); setSchedForm({ asset_id: '', title: '', description: '', frequency: 'monthly', next_due: '' }); setShowScheduleForm(true) }} className="btn-ghost" style={{ padding: '8px 12px', }}><Calendar size={14} /> New Schedule</button>
            <button onClick={() => { setEditingTicket(null); setTicketForm({ asset_id: '', title: '', description: '', ticket_type: 'breakdown', priority: 'normal' }); setShowTicketForm(true) }} className="btn-primary" style={{ padding: '8px 16px', borderRadius: 8, }}><Plus size={16} /> Raise Ticket</button>
          </div>
        </div>

        {/* Mobile: icon-only compact action row */}
        <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button onClick={() => setShowQRScanner(true)} className="btn-ghost flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-bg-1 border border-border min-w-[58px]" >
            <QrCode size={18} /><span>Scan</span>
          </button>
          <button onClick={() => { setEditingVendor(null); setVendorForm({ name: '', contact_person: '', email: '', phone: '', address: '', category: '', notes: '' }); setShowVendorForm(true); setActiveTab('vendors') }} className="btn-ghost flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-bg-1 border border-border min-w-[58px]" >
            <Building2 size={18} /><span>Vendor</span>
          </button>
          <button onClick={() => { setEditingSchedule(null); setSchedForm({ asset_id: '', title: '', description: '', frequency: 'monthly', next_due: '' }); setShowScheduleForm(true) }} className="btn-ghost flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-bg-1 border border-border min-w-[58px]" >
            <Calendar size={18} /><span>Schedule</span>
          </button>
          <button onClick={() => { setEditingTicket(null); setTicketForm({ asset_id: '', title: '', description: '', ticket_type: 'breakdown', priority: 'normal' }); setShowTicketForm(true) }} className="btn-primary flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[70px]" style={{ border: 'none' }}>
            <Plus size={18} /><span>Raise Ticket</span>
          </button>
        </div>
      </div>

      {/* Tabs - scrollable on mobile */}
      <div className="tab-container" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>
        <TabBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={Wrench} label="Overview" />
        <TabBtn active={activeTab === 'tickets'} onClick={() => setActiveTab('tickets')} icon={Ticket} label="Tickets" count={openTickets.length} badge={slaBreached.length} />
        <TabBtn active={activeTab === 'schedules'} onClick={() => setActiveTab('schedules')} icon={Calendar} label="Schedules" count={schedules.length} badge={overdueSchedules.length} />
        <TabBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={History} label="Logs" />
        <TabBtn active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={BarChart2} label="Analytics" />
        <TabBtn active={activeTab === 'vendors'} onClick={() => setActiveTab('vendors')} icon={Building2} label="Vendors" count={vendors.length} />
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input type="text" className="inp" placeholder={`Search ${activeTab}...`} style={{ paddingLeft: 34, height: 38 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 100, textAlign: 'center' }}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', color: 'var(--accent)' }} /></div>
      ) : (
        <>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'tickets' && renderTickets()}
          {activeTab === 'schedules' && renderSchedules()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'analytics' && renderAnalytics()}
          {activeTab === 'vendors' && renderVendors()}
        </>
      )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Ticket Form (Create/Edit) */}
      {showTicketForm && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setShowTicketForm(false)}>
          <div className="modal" style={{ maxWidth: 500, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ textTransform: 'uppercase', margin: 0 }}>{editingTicket ? 'Edit Ticket' : 'Raise Repair Ticket'}</h2>
              <button className="btn-ghost" onClick={() => setShowTicketForm(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="lbl">Select Asset *</label>
                <select className="inp" value={ticketForm.asset_id} onChange={e => setTicketForm({ ...ticketForm, asset_id: e.target.value })}>
                  <option value="">Choose Asset…</option>
                  {allAssets.map(a => <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_code})</option>)}
                </select>
                {selectedAssetWarranty && <div style={{ marginTop: 6 }}><WarrantyBadge warrantyExpiry={selectedAssetWarranty} /></div>}
              </div>
              <div><label className="lbl">Title *</label><input className="inp" placeholder="Brief Title" value={ticketForm.title} onChange={e => setTicketForm({ ...ticketForm, title: e.target.value })} /></div>
              <div><label className="lbl">Description</label><textarea className="inp" placeholder="Detailed description…" style={{ height: 80 }} value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label className="lbl">Type</label><select className="inp" value={ticketForm.ticket_type} onChange={e => setTicketForm({ ...ticketForm, ticket_type: e.target.value })}>
                  <option value="breakdown">Breakdown</option><option value="fault">Fault</option><option value="inspection">Inspection</option><option value="damage">Damage</option>
                </select></div>
                <div><label className="lbl">Priority</label><select className="inp" value={ticketForm.priority} onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })}>
                  <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                </select></div>
              </div>
              <button className="btn-primary" style={{ marginTop: 8 }} onClick={editingTicket ? handleUpdateTicket : handleCreateTicket} disabled={creating}>
                {creating ? 'Saving…' : editingTicket ? 'Update Ticket' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Form */}
      {showScheduleForm && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setShowScheduleForm(false)}>
          <div className="modal" style={{ maxWidth: 500, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ textTransform: 'uppercase', margin: 0 }}>{editingSchedule ? 'Edit Schedule' : 'New PM Schedule'}</h2>
              <button className="btn-ghost" onClick={() => setShowScheduleForm(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><label className="lbl">Select Asset *</label><select className="inp" value={schedForm.asset_id} onChange={e => setSchedForm({ ...schedForm, asset_id: e.target.value })}>
                <option value="">Choose Asset…</option>
                {allAssets.map(a => <option key={a.id} value={a.id}>{a.asset_name} ({a.asset_code})</option>)}
              </select></div>
              <div><label className="lbl">Task Title *</label><input className="inp" placeholder="e.g. Monthly Filter Clean" value={schedForm.title} onChange={e => setSchedForm({ ...schedForm, title: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label className="lbl">Frequency</label><select className="inp" value={schedForm.frequency} onChange={e => setSchedForm({ ...schedForm, frequency: e.target.value })}>
                  {Object.entries(FREQ_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
                <div><label className="lbl">Next Due *</label><input type="date" className="inp" value={schedForm.next_due} onChange={e => setSchedForm({ ...schedForm, next_due: e.target.value })} /></div>
              </div>
              <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleCreateSchedule} disabled={creating}>{creating ? 'Saving…' : editingSchedule ? 'Update Schedule' : 'Save Schedule'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve / Log Work Modal */}
      {showLogForm && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setShowLogForm(null)}>
          <div className="modal" style={{ maxWidth: 550, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ textTransform: 'uppercase', margin: 0 }}>Resolve Task</h2>
                <div style={{ color: 'var(--text-3)' }}>Asset: {showLogForm.data.assets?.asset_name || 'Record'}</div>
              </div>
              <button className="btn-ghost" onClick={() => setShowLogForm(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <textarea className="inp" placeholder="What work was performed?" style={{ height: 80 }} value={logForm.work_done} onChange={e => setLogForm({ ...logForm, work_done: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label className="lbl">Vendor</label><select className="inp" value={logForm.vendor_id} onChange={e => setLogForm({ ...logForm, vendor_id: e.target.value })}>
                  <option value="">In-house</option>
                  {vendors.filter(v => v.is_active).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select></div>
                <div><label className="lbl">Total Cost</label><input type="number" className="inp" placeholder="0" value={logForm.cost} onChange={e => setLogForm({ ...logForm, cost: e.target.value })} /></div>
              </div>
              <div>
                <label className="lbl">Spare Parts Used</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, background: 'var(--bg-3)', borderRadius: 8, minHeight: 40 }}>
                  {inventory.map(i => (
                    <button key={i.id} onClick={() => setLogForm(f => ({ ...f, parts_used: f.parts_used.includes(i.id) ? f.parts_used.filter(x => x !== i.id) : [...f.parts_used, i.id] }))}
                      style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', background: logForm.parts_used.includes(i.id) ? 'var(--accent)' : 'var(--bg-2)', color: logForm.parts_used.includes(i.id) ? 'white' : 'var(--text-3)' }}>
                      {i.item_name} ({i.current_stock})
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleLogWork} disabled={creating}>{creating ? 'Logging…' : 'Complete Task'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Form */}
      {showVendorForm && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setShowVendorForm(false)}>
          <div className="modal" style={{ maxWidth: 500, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ textTransform: 'uppercase', margin: 0 }}>{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</h2>
              <button className="btn-ghost" onClick={() => setShowVendorForm(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="lbl">Name *</label><input className="inp" value={vendorForm.name} onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label className="lbl">Contact Person</label><input className="inp" value={vendorForm.contact_person} onChange={e => setVendorForm({ ...vendorForm, contact_person: e.target.value })} /></div>
                <div><label className="lbl">Category</label><input className="inp" placeholder="e.g. Electrical" value={vendorForm.category} onChange={e => setVendorForm({ ...vendorForm, category: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label className="lbl">Email</label><input className="inp" type="email" value={vendorForm.email} onChange={e => setVendorForm({ ...vendorForm, email: e.target.value })} /></div>
                <div><label className="lbl">Phone</label><input className="inp" value={vendorForm.phone} onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })} /></div>
              </div>
              <div><label className="lbl">Address</label><input className="inp" value={vendorForm.address} onChange={e => setVendorForm({ ...vendorForm, address: e.target.value })} /></div>
              <div><label className="lbl">Notes</label><textarea className="inp" style={{ height: 60 }} value={vendorForm.notes} onChange={e => setVendorForm({ ...vendorForm, notes: e.target.value })} /></div>
              <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleSaveVendor} disabled={creating}>{creating ? 'Saving…' : editingVendor ? 'Update Vendor' : 'Add Vendor'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail */}
      {renderTicketDetail()}

      {/* QR Scanner */}
      {showQRScanner && (
        <div className="modal-bg" style={{ zIndex: 3000 }}>
          <div className="modal" style={{ maxWidth: 400, padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, textTransform: 'uppercase' }}>Scan Asset QR</h3>
              <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setShowQRScanner(false)}><X size={18} /></button>
            </div>
            <QRScanner onScan={handleQRScan} onClose={() => setShowQRScanner(false)} />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}} />
    </>
  )
}


