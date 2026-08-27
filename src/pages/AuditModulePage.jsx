import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  ClipboardCheck, Plus, Search, CheckCircle2, XCircle, Circle, Loader2,
  QrCode, Camera, ChevronRight, X, Trash2, MapPin, Eye, Filter,
  FileSpreadsheet, Download, AlertTriangle, Shield, Clock, Users, Building2,
  CalendarDays, ChevronDown, RefreshCw, Settings, Link2, Boxes
} from 'lucide-react'
import StockReconciliationAuditView from '../components/auditModule/StockReconciliationAuditView'
import {
  supabase, logActivity, createNotification,
  fetchSites, createSite, updateSite, deleteSite,
  fetchAuditAssignments, fetchAuditAssignment, createAuditAssignment, updateAuditAssignment, deleteAuditAssignment,
  fetchAssignmentItems, populateAssignmentItems, updateAssignmentItem, scanAssignmentItem,
  fetchMaintenanceChecklists, createMaintenanceChecklist, deleteMaintenanceChecklist,
  linkChecklistToAssets, getChecklistsForAsset,
  fetchMaintenanceSubmissions, createMaintenanceSubmission,
  approveAsChecker, approveAsHOD, rejectSubmission,
  getAllProfiles,
} from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'
import QRScanner from '../components/checklist/QRScanner'
import SelfieCapture from '../components/checklist/SelfieCapture'
import ConditionModal from '../components/auditModule/ConditionModal'
import GeoStatusBadge from '../components/auditModule/GeoStatusBadge'
import MiniMap from '../components/auditModule/MiniMap'
import ChecklistImportModal from '../components/auditModule/ChecklistImportModal'
import MaintenanceChecklistForm from '../components/auditModule/MaintenanceChecklistForm'
import ApprovalModal from '../components/auditModule/ApprovalModal'
import ChecklistBuilderModal from '../components/auditModule/ChecklistBuilderModal'
import VoiceAuditInput from '../components/auditModule/VoiceAuditInput'
import BatchAuditActions from '../components/auditModule/BatchAuditActions'

// ── Helpers ─────────────────────────────────────────────────

const STATUS_COLORS = {
  pending:      { label: 'Pending',     color: 'var(--amber)',  bg: 'var(--status-warning-soft)' },
  in_progress:  { label: 'In Progress', color: 'var(--accent)', bg: 'rgba(14,165,233,0.1)' },
  completed:    { label: 'Completed',   color: 'var(--green)',  bg: 'rgba(34,197,94,0.1)' },
  cancelled:    { label: 'Cancelled',   color: 'var(--text-3)', bg: 'var(--bg-3)' },
}

const APPROVAL_COLORS = {
  pending_checker: { label: 'Pending Checker', color: 'var(--amber)',  bg: 'var(--status-warning-soft)' },
  pending_hod:     { label: 'Pending HOD',     color: 'var(--accent)', bg: 'rgba(14,165,233,0.1)' },
  approved:        { label: 'Approved',         color: 'var(--green)',  bg: 'rgba(34,197,94,0.1)' },
  rejected:        { label: 'Rejected',         color: 'var(--red)',    bg: 'var(--status-danger-soft)' },
}

const CONDITION_COLORS = {
  operational:    { label: 'Operational',    color: 'var(--green)',  bg: 'rgba(34,197,94,0.1)' },
  damaged:        { label: 'Damaged',        color: 'var(--amber)',  bg: 'var(--status-warning-soft)' },
  needs_repair:   { label: 'Needs Repair',   color: 'var(--accent)', bg: 'rgba(14,165,233,0.1)' },
  non_functional: { label: 'Non-Functional', color: 'var(--red)',    bg: 'var(--status-danger-soft)' },
  missing:        { label: 'Missing',        color: 'var(--text-3)', bg: 'var(--bg-3)' },
}

const FREQ_COLORS = {
  daily:   { label: 'Daily',   color: 'var(--red)',    bg: 'var(--status-danger-soft)' },
  weekly:  { label: 'Weekly',  color: 'var(--amber)',  bg: 'var(--status-warning-soft)' },
  monthly: { label: 'Monthly', color: 'var(--accent)', bg: 'rgba(14,165,233,0.1)' },
}

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function AuditModulePage() {
  const { profile, isAdmin, isMod } = useAuth()

  // Tab state
  const [tab, setTab] = useState('assignments')
  const [loading, setLoading] = useState(true)

  // Data
  const [assignments, setAssignments] = useState([])
  const [sites, setSites] = useState([])
  const [profiles, setProfiles] = useState([])
  const [checklists, setChecklists] = useState([])
  const [oldTemplates, setOldTemplates] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [assetSiteNames, setAssetSiteNames] = useState([])
  const [assetNames, setAssetNames] = useState([])

  // Assignment detail
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [assignmentItems, setAssignmentItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)

  // Modals
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showConditionModal, setShowConditionModal] = useState(null) // { item, asset }
  const [showSelfie, setShowSelfie] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingChecklist, setEditingChecklist] = useState(null) // { ...checklist, source }
  const [showChecklistForm, setShowChecklistForm] = useState(null) // { checklist, asset, assignment }
  const [showApproval, setShowApproval] = useState(null) // submission
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [showBuilderModal, setShowBuilderModal] = useState(false)
  const [noteModalItem, setNoteModalItem] = useState(null)
  const [noteInputText, setNoteInputText] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  // Site form
  const [siteForm, setSiteForm] = useState({ name: '', latitude: '', longitude: '', radius_meters: 200, address: '', checker_id: '', hod_id: '' })
  const [editingSite, setEditingSite] = useState(null)

  // Create assignment form
  const [assignForm, setAssignForm] = useState({ title: '', audit_type: 'asset_count', site_id: '', assigned_to: '', due_date: '', notes: '' })

  // 2.0 Features State
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [offlineQueue, setOfflineQueue] = useState([])
  const [selectedApprovalIds, setSelectedApprovalIds] = useState([])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── Load Data ─────────────────────────────────────────────
  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const safe = (fn) => fn.catch ? fn.catch(() => []) : fn.then ? fn.then(r => r).catch(() => []) : Promise.resolve([])
      const [a, s, p, c, sub, siteRes, assetNamesRes, oldTplRes] = await Promise.all([
        safe(fetchAuditAssignments()),
        safe(fetchSites()),
        getAllProfiles(),
        safe(fetchMaintenanceChecklists()),
        safe(fetchMaintenanceSubmissions()),
        supabase.from('assets').select('site').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%'),
        supabase.from('assets').select('asset_name').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%'),
        supabase.from('checklist_templates').select('*').eq('is_active', true).order('name'),
      ])
      setAssignments(a || [])
      setSites(s || [])
      setProfiles(p || [])
      setChecklists(c || [])
      setSubmissions(sub || [])
      const uniqueSites = [...new Set((siteRes.data || []).map(a => a.site).filter(Boolean))].sort()
      setAssetSiteNames(uniqueSites)
      const uniqueNames = [...new Set((assetNamesRes.data || []).map(a => a.asset_name).filter(Boolean))].sort()
      setAssetNames(uniqueNames)
      setOldTemplates(oldTplRes.data || [])
    } catch (err) {
      console.error('Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Derived State ─────────────────────────────────────────
  const myAssignments = useMemo(() => {
    let filtered = assignments || []
    if (!isAdmin && !isMod) {
      filtered = filtered.filter(a => a.assigned_to === profile?.id)
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === filterStatus)
    }
    if (search) {
      const s = search.toLowerCase()
      filtered = filtered.filter(a =>
        a.title?.toLowerCase().includes(s) ||
        a.auditor?.full_name?.toLowerCase().includes(s) ||
        a.site?.name?.toLowerCase().includes(s)
      )
    }
    return filtered
  }, [assignments, profile, isAdmin, isMod, filterStatus, search])

  const myPendingApprovals = useMemo(() => {
    return (submissions || []).filter(s => {
      const isChecker = s.approval_status === 'pending_checker' && (s.checker_id === profile?.id || isAdmin || isMod)
      const isHod = s.approval_status === 'pending_hod' && (s.hod_id === profile?.id || isAdmin || isMod)
      return isChecker || isHod
    })
  }, [submissions, profile, isAdmin, isMod])

  const stats = useMemo(() => {
    const total = assignments.length
    const pending = assignments.filter(a => a.status === 'pending').length
    const inProgress = assignments.filter(a => a.status === 'in_progress').length
    const completed = assignments.filter(a => a.status === 'completed').length
    return { total, pending, inProgress, completed }
  }, [assignments])

  const assignmentItemStats = useMemo(() => {
    const total = assignmentItems.length
    const verified = assignmentItems.filter(i => i.status === 'verified').length
    const unverified = assignmentItems.filter(i => i.status === 'unverified').length
    const pending = Math.max(0, total - (verified + unverified))
    return { total, verified, unverified, pending }
  }, [assignmentItems])

  // ── Assignment Items ──────────────────────────────────────
  const openAssignment = async (assignment) => {
    setSelectedAssignment(assignment)
    setItemsLoading(true)
    try {
      const items = await fetchAssignmentItems(assignment.id)
      setAssignmentItems(items)
    } catch (err) {
      console.error(err)
    } finally {
      setItemsLoading(false)
    }
  }

  const handlePopulateItems = async () => {
    if (!selectedAssignment) return
    try {
      setItemsLoading(true)
      await populateAssignmentItems(selectedAssignment.id, selectedAssignment.site_id)
      // Update status to in_progress
      await updateAuditAssignment(selectedAssignment.id, { status: 'in_progress' }, profile.id)
      const items = await fetchAssignmentItems(selectedAssignment.id)
      setAssignmentItems(items)
      await loadAll()
    } catch (err) {
      alert(err.message)
    } finally {
      setItemsLoading(false)
    }
  }

  // ── Create Assignment ─────────────────────────────────────
  const handleCreateAssignment = async () => {
    if (!assignForm.title || !assignForm.site_id || !assignForm.assigned_to) {
      return alert('Title, Site, and Auditor are required.')
    }
    try {
      let siteId = assignForm.site_id
      // If site_id is a name (not a UUID), find or auto-create a site record
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId)
      if (!isUUID) {
        // Check if site already exists by name
        const { data: existing } = await supabase.from('sites').select('id').eq('name', siteId).maybeSingle()
        if (existing) {
          siteId = existing.id
        } else {
          // Auto-create the site from asset data
          const newSite = await createSite({ name: siteId }, profile.id)
          siteId = newSite.id
        }
      }
      await createAuditAssignment({ ...assignForm, site_id: siteId }, profile.id)
      setShowCreateForm(false)
      setAssignForm({ title: '', audit_type: 'asset_count', site_id: '', assigned_to: '', due_date: '', notes: '' })
      await loadAll()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  // ── QR Scan Handler (Asset Count) ─────────────────────────
  const handleAssetCountScan = (decoded) => {
    setShowScanner(false)
    let scannedId = decoded
    if (decoded.includes('/scan/')) scannedId = decoded.split('/scan/')[1].split(/[/?]/)[0]
    else if (decoded.includes('/assets/')) scannedId = decoded.split('/assets/')[1].split(/[/?]/)[0]
    else if (decoded.includes('?id=')) scannedId = decoded.split('?id=')[1].split('&')[0]

    const item = assignmentItems.find(i =>
      i.asset_id === scannedId ||
      i.asset?.asset_code?.toLowerCase().trim() === scannedId.toLowerCase().trim()
    )
    if (!item) return alert('This asset is not part of this audit assignment.')
    if (item.status === 'verified') return alert('This asset has already been verified.')

    setShowConditionModal({ item, asset: item.asset })
  }

  // ── 1-Tap Audit & Note Update (Locked when submitted) ───────────────
  const handleQuickAudit = async (item, condition, customNotes = null) => {
    if (selectedAssignment?.status === 'completed' || selectedAssignment?.status === 'cancelled') {
      return alert('🔒 This audit has been submitted & finalized. It cannot be modified.')
    }
    const site = selectedAssignment?.site
    const notes = customNotes !== null ? customNotes : (item.condition_notes || '')
    try {
      await scanAssignmentItem(
        item.id, condition, notes,
        site?.latitude || 0, site?.longitude || 0,
        site?.latitude, site?.longitude, site?.radius_meters,
        profile.id
      )
      const items = await fetchAssignmentItems(selectedAssignment.id)
      setAssignmentItems(items)
    } catch (err) {
      alert('Audit update failed: ' + err.message)
    }
  }

  const handleOpenNoteModal = (item) => {
    if (selectedAssignment?.status === 'completed' || selectedAssignment?.status === 'cancelled') {
      return alert('🔒 This audit has been submitted & finalized. It cannot be modified.')
    }
    setNoteInputText(item.condition_notes || '')
    setNoteModalItem(item)
  }

  const handleSaveNoteModal = async () => {
    if (!noteModalItem) return
    await handleQuickAudit(noteModalItem, noteModalItem.condition || 'operational', noteInputText)
    setNoteModalItem(null)
  }

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return
    try {
      await deleteAuditAssignment(id)
      setSelectedAssignment(null)
      await loadAll()
    } catch (e) {
      alert('Delete failed: ' + e.message)
    }
  }

  const handleSaveSite = async () => {
    if (!siteForm.name.trim()) return alert('Please enter a site name')
    try {
      if (editingSite) {
        await updateSite(editingSite.id, siteForm, profile?.id)
      } else {
        await createSite(siteForm, profile?.id)
      }
      setShowSiteForm(false)
      setEditingSite(null)
      setSiteForm({ name: '', latitude: '', longitude: '', radius_meters: 200, address: '', checker_id: '', hod_id: '' })
      await loadAll()
    } catch (e) {
      alert('Site save failed: ' + e.message)
    }
  }

  const handleDeleteSite = async (siteId) => {
    if (!window.confirm('Delete this site?')) return
    try {
      await deleteSite(siteId, profile?.id)
      await loadAll()
    } catch (e) {
      alert('Delete failed: ' + e.message)
    }
  }

  const handleSelfieCapture = async (photoUrlData) => {
    if (!selectedAssignment) return
    const photoUrl = typeof photoUrlData === 'string' ? photoUrlData : (photoUrlData?.photoUrl || photoUrlData?.selfie_url)
    const lat = typeof photoUrlData === 'object' ? photoUrlData?.lat : null
    const lng = typeof photoUrlData === 'object' ? photoUrlData?.lng : null
    try {
      await updateAuditAssignment(selectedAssignment.id, {
        auditor_selfie_url: photoUrl,
        selfie_url: photoUrl,
        auditor_gps_lat: lat,
        auditor_gps_lng: lng,
        geofence_verified: true,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }, profile?.id)
      setShowSelfie(false)
      alert('Audit submitted and finalized!')
      setSelectedAssignment(null)
      await loadAll()
    } catch (e) {
      alert('Selfie submission failed: ' + e.message)
    }
  }

  // ── Batch Approval Action Handler ───────────────────────────
  const handleBatchApprove = async () => {
    if (selectedApprovalIds.length === 0) return
    if (!window.confirm(`Batch approve ${selectedApprovalIds.length} selected submission(s)?`)) return
    
    try {
      for (const subId of selectedApprovalIds) {
        const sub = submissions.find(s => s.id === subId)
        if (!sub) continue
        if (sub.approval_status === 'pending_checker') {
          await approveAsChecker(subId, 'System Batch Sign-off', profile.full_name, 'Batch Approved')
        } else if (sub.approval_status === 'pending_hod') {
          await approveAsHOD(subId, 'System Batch Sign-off', profile.full_name, 'Batch Approved')
        }
      }
      alert('⚡ Batch Approval Complete!')
      setSelectedApprovalIds([])
      await loadAll()
    } catch (e) {
      alert('Batch approval error: ' + e.message)
    }
  }
  const handleBatchVerify = async (unverifiedItems) => {
    if (selectedAssignment?.status === 'completed' || selectedAssignment?.status === 'cancelled') {
      return alert('🔒 This audit has been submitted & finalized. It cannot be modified.')
    }
    const site = selectedAssignment?.site
    for (const item of unverifiedItems) {
      await scanAssignmentItem(
        item.id, 'operational', 'Batch fast audit verified',
        site?.latitude || 0, site?.longitude || 0,
        site?.latitude, site?.longitude, site?.radius_meters,
        profile.id
      )
    }
    const items = await fetchAssignmentItems(selectedAssignment.id)
    setAssignmentItems(items)
  }

  // ── QR Scan Handler (Maintenance Checklist) ───────────────
  const handleMaintenanceScan = (decoded) => {
    setShowScanner(false)
    let scannedId = decoded
    if (decoded.includes('/scan/')) scannedId = decoded.split('/scan/')[1].split(/[/?]/)[0]
    else if (decoded.includes('/assets/')) scannedId = decoded.split('/assets/')[1].split(/[/?]/)[0]
    else if (decoded.includes('?id=')) scannedId = decoded.split('?id=')[1].split('&')[0]

    // Use async approach
    findAndOpenChecklist(scannedId)
  }

  const findAndOpenChecklist = async (scannedId) => {
    try {
      const { data: assets } = await supabase
        .from('assets')
        .select('*')
        .or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
        .or(`id.eq.${scannedId},asset_code.ilike.${scannedId}`)
      const asset = assets?.[0]
      if (!asset) return alert('Asset not found.')

      // 1. Check new maintenance_checklists (linked by asset or category)
      const assetChecklists = await getChecklistsForAsset(asset.id)
      const categoryChecklists = checklists.filter(cl =>
        cl.category && cl.category.toLowerCase() === (asset.category || '').toLowerCase() &&
        !assetChecklists.some(ac => ac.id === cl.id)
      )
      let allCl = [...assetChecklists, ...categoryChecklists]

      // 2. Check linked_asset_names on new maintenance_checklists
      if (!allCl.length) {
        const nameMatched = checklists.filter(cl =>
          (cl.linked_asset_names || []).some(n => n.toLowerCase() === (asset.asset_name || '').toLowerCase())
        )
        allCl = [...nameMatched]
      }

      // 3. Fallback: check old checklist_templates table
      if (!allCl.length) {
        const { data: allOld } = await supabase.from('checklist_templates').select('*').eq('is_active', true)
        let oldMatched = (allOld || []).filter(t =>
          // Match by linked_asset_names
          (t.linked_asset_names || []).some(n => n.toLowerCase() === (asset.asset_name || '').toLowerCase()) ||
          // Or by direct link
          (asset.checklist_template_id && t.id === asset.checklist_template_id) ||
          // Or by category
          (t.category && asset.category && t.category.toLowerCase() === asset.category.toLowerCase())
        )
        // Convert old format items to new format
        allCl = oldMatched.map(t => ({
          ...t,
          items: (t.items || []).map((item, idx) => ({
            id: item.id || `item_${idx}`,
            section: item.section || '',
            question: item.description || item.question || item.label || '',
            type: 'pass_fail_na',
          })),
        }))
      }

      if (!allCl.length) return alert(`No maintenance checklists linked to asset "${asset.asset_name}".\n\nLink a checklist via the Checklists tab or import from Excel.`)

      // If multiple, let user pick
      if (allCl.length > 1) {
        const names = allCl.map((cl, i) => `${i + 1}. ${cl.name}`).join('\n')
        const pick = prompt(`Multiple checklists found. Enter number:\n\n${names}`)
        const idx = parseInt(pick) - 1
        if (isNaN(idx) || idx < 0 || idx >= allCl.length) return
        setShowChecklistForm({ checklist: allCl[idx], asset, assignment: selectedAssignment })
      } else {
        setShowChecklistForm({ checklist: allCl[0], asset, assignment: selectedAssignment })
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  // ── Checklist Submit ──────────────────────────────────────
  const handleChecklistSubmit = async ({ results, notes, preparedSignature, preparedName, latitude, longitude }) => {
    const { checklist, asset, assignment } = showChecklistForm
    const site = assignment?.site || sites.find(s => s.name === asset?.site)
    try {
      const submission = await createMaintenanceSubmission({
        assignment_id: assignment?.id || null,
        checklist_id: checklist.id,
        asset_id: asset.id,
        results,
        notes,
        prepared_signature: preparedSignature,
        prepared_name: preparedName,
        submission_latitude: latitude,
        submission_longitude: longitude,
        checker_id: site?.checker_id || null,
        hod_id: site?.hod_id || null,
      }, profile.id)
      setShowChecklistForm(null)
      await loadAll()

      // Offer PDF download after successful submission
      const { default: generateAuditPDF } = await import('../components/auditModule/generateAuditPDF.js')
      const { default: companyLogo } = await import('../assets/logo.png')
      const fullSubmission = {
        ...submission,
        results,
        notes,
        prepared_name: preparedName,
        prepared_signature: preparedSignature,
        submission_latitude: latitude,
        submission_longitude: longitude,
        submitted_at: new Date().toISOString(),
        checklist: { name: checklist.name, category: checklist.category, frequency: checklist.frequency },
        asset: { asset_code: asset.asset_code, asset_name: asset.asset_name, site: asset.site },
      }
      if (window.confirm('Checklist submitted successfully!\n\nDownload the PDF report now?')) {
        const doc = await generateAuditPDF(fullSubmission, companyLogo)
        doc.save(`checklist-${asset.asset_code}-${new Date().toISOString().split('T')[0]}.pdf`)
      }
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  // ── Import Checklists from Excel ──────────────────────────
  const handleImportChecklists = async (parsedChecklists) => {
    for (const cl of parsedChecklists) {
      await createMaintenanceChecklist({
        name: cl.name,
        category: cl.category,
        frequency: cl.frequency,
        items: cl.items,
      }, profile.id)
    }
    await loadAll()
  }

  // ── Approval Handlers ────────────────────────────────────
  const handleApprove = async (submissionId, signature, name, notes) => {
    const sub = submissions.find(s => s.id === submissionId)
    if (!sub) return
    if (sub.approval_status === 'pending_checker') {
      await approveAsChecker(submissionId, profile.id, signature, name, notes)
    } else if (sub.approval_status === 'pending_hod') {
      await approveAsHOD(submissionId, profile.id, signature, name, notes)
    }
    setShowApproval(null)
    await loadAll()
  }

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={28} className="spin" style={{ color: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      {/* ── Header (matches AssetList) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="text-page-title m-0 mb-1 tracking-wide uppercase">
              AUDIT <span className="text-accent">&amp; MAINTENANCE</span>
            </h1>
          </div>
          <p style={{ color: 'var(--text-2)', }}>
            {stats.total} audit{stats.total !== 1 ? 's' : ''} · {stats.completed} completed · {myPendingApprovals.length} pending approvals
          </p>
        </div>
        {(isAdmin || isMod) && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowCreateForm(true)} className="btn-primary" style={{ textDecoration: 'none' }}>
              <Plus size={15} /> New Audit
            </button>
          </div>
        )}
      </div>

      {/* ── Tab Toggle ── */}
      <div className="tab-container">
        {[
          { id: 'assignments', icon: ClipboardCheck, label: 'Assignments', count: myAssignments.length },
          { id: 'stock_audit', icon: Boxes, label: 'Stock Reconciliation', count: 'Live' },
          { id: 'checklists', icon: FileSpreadsheet, label: 'Checklists', count: checklists.length },
          { id: 'approvals', icon: Shield, label: 'Approvals', count: myPendingApprovals.length },
        ].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'assignments') setSelectedAssignment(null) }}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}>
            <t.icon size={14} /> {t.label}
            <span className="tab-badge">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── Stats Cards (matches AssetList stat cards) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { icon: ClipboardCheck, label: 'Total Audits', val: stats.total, color: 'var(--accent)' },
          { icon: Clock, label: 'Pending', val: stats.pending, color: 'var(--amber)' },
          { icon: RefreshCw, label: 'In Progress', val: stats.inProgress, color: 'var(--accent)' },
          { icon: CheckCircle2, label: 'Completed', val: stats.completed, color: 'var(--green)' },
          { icon: Shield, label: 'My Approvals', val: myPendingApprovals.length, color: myPendingApprovals.length > 0 ? 'var(--red)' : 'var(--text-3)' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <s.icon size={16} style={{ color: s.color, flexShrink: 0 }} />
            <div>
              <div style={{ color: 'var(--text-0)' }}>{s.val}</div>
              <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── TAB: STOCK RECONCILIATION ── */}
      {tab === 'stock_audit' && (
        <StockReconciliationAuditView sites={sites} profile={profile} onAuditSubmitted={() => loadAll()} />
      )}

      {/* ════════════════════════════════════════════════════════
          TAB: ASSIGNMENTS
          ════════════════════════════════════════════════════════ */}
      {tab === 'assignments' && !selectedAssignment && (
        <div>
          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search audits..."
                style={{
                  width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg-1)',
                  color: 'var(--text-1)',
                }}
              />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-1)', color: 'var(--text-1)',
            }}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Assignment List */}
          {myAssignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
              <ClipboardCheck size={36} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p >No audit assignments found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myAssignments.map(a => {
                const sc = STATUS_COLORS[a.status] || STATUS_COLORS.pending
                return (
                  <div key={a.id} onClick={() => openAssignment(a)} style={{
                    padding: '14px 16px', borderRadius: 12, background: 'var(--bg-1)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 14,
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: a.audit_type === 'asset_count' ? 'rgba(14,165,233,0.1)' : 'rgba(34,197,94,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      color: a.audit_type === 'asset_count' ? 'var(--accent)' : 'var(--green)',
                    }}>
                      {a.audit_type === 'asset_count' ? <QrCode size={18} /> : <FileSpreadsheet size={18} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ color: 'var(--text-0)' }}>
                          {a.title}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10,
                          textTransform: 'uppercase',
                          background: sc.bg, color: sc.color,
                        }}>{sc.label}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10,
                          textTransform: 'uppercase',
                          background: 'var(--bg-3)', color: 'var(--text-3)',
                        }}>{a.audit_type === 'asset_count' ? 'Asset Count' : 'Maintenance'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, color: 'var(--text-3)', }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Building2 size={11} /> {a.site?.name || '-'}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users size={11} /> {a.auditor?.full_name || '-'}
                        </span>
                        {a.due_date && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CalendarDays size={11} /> {new Date(a.due_date).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ASSIGNMENT DETAIL VIEW
          ════════════════════════════════════════════════════════ */}
      {tab === 'assignments' && selectedAssignment && (
        <div>
          {/* Back button + title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSelectedAssignment(null)} className="btn-ghost" style={{ padding: '5px 8px' }}>
                <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back
              </button>
              <h2 className="font-display" style={{ margin: 0 }}>
                {selectedAssignment.title}
              </h2>
              <span style={{
                padding: '2px 10px', borderRadius: 10,
                textTransform: 'uppercase',
                background: (STATUS_COLORS[selectedAssignment.status] || STATUS_COLORS.pending).bg,
                color: (STATUS_COLORS[selectedAssignment.status] || STATUS_COLORS.pending).color,
              }}>{(STATUS_COLORS[selectedAssignment.status] || STATUS_COLORS.pending).label}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedAssignment.audit_type === 'asset_count' && assignmentItems.length > 0 && (
                <button onClick={async () => {
                  try {
                    const { default: generateAssetCountPDF } = await import('../components/auditModule/generateAssetCountPDF.js')
                    const { default: logo } = await import('../assets/logo.png')
                    const doc = await generateAssetCountPDF(selectedAssignment, assignmentItems, logo)
                    doc.save(`audit-report-${selectedAssignment.title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`)
                  } catch (e) { alert('PDF generation failed: ' + e.message); console.error(e) }
                }} className="btn-ghost" style={{ padding: '7px 14px' }}>
                  <Download size={14} /> Download Report
                </button>
              )}
              {selectedAssignment.status !== 'completed' && (
                <button onClick={() => setShowScanner(true)} className="btn-primary" style={{ padding: '7px 14px' }}>
                  <QrCode size={14} /> Scan QR
                </button>
              )}
              {isAdmin && (
                <button onClick={() => handleDeleteAssignment(selectedAssignment.id)} className="btn-ghost" style={{ color: 'var(--red)' }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Assignment meta */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16,
            padding: 14, borderRadius: 12, background: 'var(--bg-1)', border: '1px solid var(--border)',
          }}>
            <div>
              <span className="lbl" >Type</span>
              <p style={{ margin: '2px 0 0', }}>
                {selectedAssignment.audit_type === 'asset_count' ? 'Asset Count Audit' : 'Maintenance Checklist Audit'}
              </p>
            </div>
            <div>
              <span className="lbl" >Site</span>
              <p style={{ margin: '2px 0 0' }}>
                {selectedAssignment.site?.name || '-'}
                {selectedAssignment.site?.latitude && (
                  <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>
                    ({Number(selectedAssignment.site.latitude).toFixed(4)}, {Number(selectedAssignment.site.longitude).toFixed(4)})
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="lbl" >Auditor</span>
              <p style={{ margin: '2px 0 0' }}>{selectedAssignment.auditor?.full_name || '-'}</p>
            </div>
            <div>
              <span className="lbl" >Due Date</span>
              <p style={{ margin: '2px 0 0' }}>
                {selectedAssignment.due_date ? new Date(selectedAssignment.due_date).toLocaleDateString('en-GB') : '-'}
              </p>
            </div>
          </div>

          {selectedAssignment.site && (
            <div style={{ marginBottom: 16 }}>
              <MiniMap site={selectedAssignment.site} items={assignmentItems} />
            </div>
          )}

          {/* ASSET COUNT AUDIT ITEMS */}
          {selectedAssignment.audit_type === 'asset_count' && (
            <div>
              {/* Progress & Final Submit Bar */}
              {assignmentItems.length > 0 && (
                <div style={{
                  marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--bg-1)',
                  border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <span style={{ color: 'var(--text-0)', }}>
                        Audit Verification Progress
                      </span>
                      <div style={{ display: 'flex', gap: 12, marginTop: 4, }}>
                        <span style={{ color: 'var(--green)', }}>Verified: {assignmentItemStats.verified}</span>
                        <span style={{ color: 'var(--amber)', }}>Unverified: {assignmentItemStats.unverified}</span>
                        <span style={{ color: 'var(--text-3)' }}>Total: {assignmentItemStats.total}</span>
                      </div>
                    </div>

                    {selectedAssignment.status === 'completed' ? (
                      <span style={{
                        padding: '8px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#059669', border: '1px solid rgba(34,197,94,0.3)',
                        display: 'flex', alignItems: 'center', gap: 6
                      }}>
                        <CheckCircle2 size={16} /> Audit Finalized & Locked
                      </span>
                    ) : (
                      <button 
                        onClick={() => setShowSelfie(true)}
                        className="btn-primary"
                        style={{
                          padding: '10px 18px', borderRadius: 10,
                          background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                          display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(14,165,233,0.25)'
                        }}
                      >
                        <CheckCircle2 size={16} /> Complete & Submit Audit
                      </button>
                    )}
                  </div>

                  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3, transition: 'width 0.4s ease',
                      background: assignmentItemStats.verified === assignmentItemStats.total ? 'var(--green)' : 'var(--accent)',
                      width: `${assignmentItemStats.total > 0 ? (assignmentItemStats.verified / assignmentItemStats.total) * 100 : 0}%`,
                    }} />
                  </div>
                </div>
              )}

              {/* Voice Audit Assistant */}
              {selectedAssignment.status !== 'completed' && assignmentItems.length > 0 && (
                <VoiceAuditInput items={assignmentItems} onVoiceMatch={(item, cond) => handleQuickAudit(item, cond)} />
              )}

              {/* Batch Audit Fast Actions */}
              {selectedAssignment.status !== 'completed' && assignmentItems.length > 0 && (
                <BatchAuditActions 
                  unverifiedItems={assignmentItems.filter(i => i.status !== 'verified')}
                  onBatchVerify={handleBatchVerify}
                />
              )}

              {itemsLoading ? (
                <div style={{ textAlign: 'center', padding: 30 }}><Loader2 size={22} className="spin" style={{ color: 'var(--accent)' }} /></div>
              ) : assignmentItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <p style={{ color: 'var(--text-3)', marginBottom: 12 }}>
                    No assets loaded yet. Populate from the assigned site.
                  </p>
                  <button onClick={handlePopulateItems} className="btn-primary" >
                    <Plus size={14} /> Populate Assets from Site
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {assignmentItems.map(item => {
                    const isAuditLocked = selectedAssignment?.status === 'completed' || selectedAssignment?.status === 'cancelled'
                    const cond = item.condition ? CONDITION_COLORS[item.condition] : null
                    const statusIcon = item.status === 'verified' ? CheckCircle2 : item.status === 'unverified' ? AlertTriangle : Circle
                    const StatusIcon = statusIcon
                    const statusColor = item.status === 'verified' ? 'var(--green)' : item.status === 'unverified' ? 'var(--amber)' : 'var(--text-3)'
                    
                    const OPTION_STYLES = {
                      operational: { color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.3)' },
                      damaged: { color: 'var(--status-warning)', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.3)' },
                      needs_repair: { color: '#0891b2', bg: 'rgba(8,145,178,0.08)', border: 'rgba(8,145,178,0.3)' },
                      non_functional: { color: 'var(--status-danger)', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.3)' },
                      missing: { color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.3)' },
                    }
                    const optStyle = OPTION_STYLES[item.condition] || { color: 'var(--text-1)', bg: 'var(--bg-2)', border: 'var(--border)' }

                    return (
                      <div 
                        key={item.id} 
                        style={{
                          padding: '10px 14px', borderRadius: 10, background: 'var(--bg-1)',
                          border: `1px solid ${item.status === 'verified' ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s',
                          opacity: isAuditLocked ? 0.85 : 1
                        }}
                      >
                        <StatusIcon size={18} style={{ color: statusColor, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-0)' }}>
                              {item.asset?.asset_code}
                            </span>
                            <span style={{ color: 'var(--text-2)' }}>
                              {item.asset?.asset_name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                            {cond && (
                              <span style={{
                                padding: '1px 7px', borderRadius: 8,
                                background: cond.bg, color: cond.color, }}>{cond.label}</span>
                            )}
                            <GeoStatusBadge verified={item.geo_verified} latitude={item.scan_latitude} longitude={item.scan_longitude} />
                            {item.condition_notes && (
                              <span style={{ color: 'var(--accent)', fontStyle: 'italic', }}>
                                Note: "{item.condition_notes}"
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select
                            value={item.condition || ''}
                            disabled={isAuditLocked}
                            onChange={(e) => {
                              if (e.target.value) handleQuickAudit(item, e.target.value)
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: `1px solid ${optStyle.border}`,
                              background: optStyle.bg,
                              color: optStyle.color,
                              cursor: isAuditLocked ? 'not-allowed' : 'pointer',
                              outline: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                              opacity: isAuditLocked ? 0.75 : 1
                            }}
                          >
                            <option value="">Audit Condition...</option>
                            <option value="operational">Operational</option>
                            <option value="damaged">Damaged</option>
                            <option value="needs_repair">Needs Repair</option>
                            <option value="non_functional">Non-Functional</option>
                            <option value="missing">Missing</option>
                          </select>

                          {!isAuditLocked && (
                            <button 
                              onClick={() => handleOpenNoteModal(item)}
                              className="btn-ghost"
                              style={{
                                padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)',
                                display: 'flex', alignItems: 'center', gap: 4
                              }}
                              title="Add Observation Note"
                            >
                              + Note
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Selfie prompt when all done */}
              {selectedAssignment.selfie_url && (
                <div style={{
                  marginTop: 14, padding: 14, borderRadius: 12, background: 'rgba(34,197,94,0.06)',
                  border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <img src={selectedAssignment.selfie_url} alt="Completion selfie" style={{
                    width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--green)',
                  }} />
                  <div>
                    <p style={{ color: 'var(--green)', margin: 0 }}>
                      Audit Completed
                    </p>
                    <p style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>
                      Completed: {selectedAssignment.completed_at ? new Date(selectedAssignment.completed_at).toLocaleString('en-GB') : '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MAINTENANCE CHECKLIST AUDIT */}
          {selectedAssignment.audit_type === 'maintenance_checklist' && (
            <div>
              <div style={{
                padding: 16, borderRadius: 12, background: 'var(--bg-1)', border: '1px solid var(--border)',
                textAlign: 'center',
              }}>
                <p style={{ color: 'var(--text-2)', marginBottom: 14 }}>
                  Scan an asset's QR code to load its maintenance checklist.
                </p>
                <button onClick={() => setShowScanner(true)} className="btn-primary" style={{ padding: '10px 20px' }}>
                  <QrCode size={16} /> Scan Asset QR Code
                </button>
              </div>

              {/* Show related submissions */}
              {submissions.filter(s => s.assignment_id === selectedAssignment.id).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <label className="lbl" style={{ marginBottom: 8 }}>Completed Submissions</label>
                  {submissions.filter(s => s.assignment_id === selectedAssignment.id).map(sub => {
                    const asc = APPROVAL_COLORS[sub.approval_status] || APPROVAL_COLORS.pending_checker
                    return (
                      <div key={sub.id} onClick={() => setShowApproval(sub)} style={{
                        padding: '10px 14px', borderRadius: 10, background: 'var(--bg-1)',
                        border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 6,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <FileSpreadsheet size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <span >
                            {sub.asset?.asset_code} - {sub.checklist?.name}
                          </span>
                          <div style={{ color: 'var(--text-3)', }}>
                            {new Date(sub.submitted_at).toLocaleString('en-GB')}
                          </div>
                        </div>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10,
                          background: asc.bg, color: asc.color, }}>{asc.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB: CHECKLISTS
          ════════════════════════════════════════════════════════ */}
      {tab === 'checklists' && (
        <div>
          {/* Upload for specific asset type */}
          {(isAdmin || isMod) && (
            <div style={{
              padding: 14, borderRadius: 12, background: 'var(--bg-1)', border: '1px dashed var(--border)',
              marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ margin: '0 0 4px', color: 'var(--text-0)' }}>
                  UPLOAD CHECKLIST FOR ASSET TYPE
                </p>
                <p style={{ color: 'var(--text-3)', margin: 0 }}>
                  Select an asset type, then upload its Excel checklist. It will auto-link to all matching assets.
                </p>
              </div>
              <select
                id="upload-asset-type"
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-2)', color: 'var(--text-1)', minWidth: 180,
                }}
              >
                <option value="">Select asset type...</option>
                {assetNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                borderRadius: 8, background: 'var(--accent)', color: 'white', cursor: 'pointer',
                }}>
                <FileSpreadsheet size={14} /> Upload Excel
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={async (e) => {
                  const file = e.target.files?.[0]
                  const assetType = document.getElementById('upload-asset-type')?.value
                  if (!file) return
                  if (!assetType) { alert('Please select an asset type first.'); e.target.value = ''; return }

                  const reader = new FileReader()
                  reader.onload = async (evt) => {
                    try {
                      const wb = XLSX.read(evt.target.result, { type: 'binary' })
                      const ws = wb.Sheets[wb.SheetNames[0]]
                      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
                      if (!rows.length) { alert('Empty file'); return }

                      const header = rows[0].map(h => String(h).toLowerCase().trim().replace(/\s+/g, '_'))
                      const nameIdx = ['checklist_name', 'name'].map(k => header.indexOf(k)).find(i => i >= 0) ?? -1
                      const freqIdx = header.indexOf('frequency')
                      const sectionIdx = header.indexOf('section')
                      const itemIdx = ['inspection_item', 'checklist_item', 'item'].map(k => header.indexOf(k)).find(i => i >= 0) ?? -1

                      if (itemIdx < 0) { alert('Could not find "inspection_item" column. Check your Excel format.'); return }

                      const grouped = {}
                      for (let r = 1; r < rows.length; r++) {
                        const row = rows[r]
                        const clName = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : `${assetType} Checklist`
                        const itemText = String(row[itemIdx] || '').trim()
                        if (!itemText || clName.startsWith('──')) continue

                        if (!grouped[clName]) {
                          grouped[clName] = {
                            name: clName,
                            category: assetType,
                            frequency: freqIdx >= 0 ? String(row[freqIdx] || 'monthly').trim().toLowerCase() : 'monthly',
                            items: [],
                            linked_asset_names: [assetType],
                          }
                        }
                        grouped[clName].items.push({
                          id: `item_${r}`,
                          section: sectionIdx >= 0 ? String(row[sectionIdx] || '').trim() : '',
                          question: itemText,
                          type: 'pass_fail_na',
                        })
                      }

                      const results = Object.values(grouped).filter(cl => cl.items.length > 0)
                      if (!results.length) { alert('No valid checklist items found.'); return }

                      for (const cl of results) {
                        cl.frequency = ['daily', 'weekly', 'monthly'].includes(cl.frequency) ? cl.frequency : 'monthly'
                        await createMaintenanceChecklist(cl, profile.id)
                      }
                      alert(`Uploaded ${results.length} checklist(s) for "${assetType}" successfully!`)
                      await loadAll()
                    } catch (err) {
                      alert('Import failed: ' + err.message)
                    }
                  }
                  reader.readAsBinaryString(file)
                  e.target.value = ''
                }} />
              </label>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ color: 'var(--text-3)', margin: 0 }}>
              Maintenance checklist templates - upload per asset type or import bulk
            </p>
            {(isAdmin || isMod) && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  const ws = XLSX.utils.aoa_to_sheet([
                    ['checklist_name', 'frequency', 'section', 'inspection_item'],
                    ['Daily Pre-Start Check', 'daily', 'Pre-Start', 'Check wire ropes for kinks or damage'],
                    ['Daily Pre-Start Check', 'daily', 'Pre-Start', 'Inspect hook block and safety latch'],
                    ['Daily Pre-Start Check', 'daily', 'Operations', 'Test emergency stop buttons'],
                    ['Weekly Inspection', 'weekly', 'Structural', 'Inspect main structural bolts'],
                    ['Weekly Inspection', 'weekly', 'Electrical', 'Test all limit switches'],
                    ['Monthly Safety Audit', 'monthly', 'Structural', 'Full framework inspection for fatigue/cracks'],
                    ['Monthly Safety Audit', 'monthly', 'Safety', 'Calibrate Safety Load Indicator'],
                    ['Monthly Safety Audit', 'monthly', 'Safety', 'Verify operator logbook maintained'],
                  ])
                  ws['!cols'] = [{ wch: 32 }, { wch: 12 }, { wch: 24 }, { wch: 65 }]
                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'Checklists')
                  XLSX.writeFile(wb, 'checklist_template.xlsx')
                }} className="btn-ghost" style={{ padding: '7px 14px' }}>
                  <Download size={14} /> Download Template
                </button>
                <button onClick={() => setShowBuilderModal(true)} className="btn-primary" style={{ padding: '7px 14px' }}>
                  <Plus size={14} /> Build Checklist
                </button>
              </div>
            )}
          </div>

          {/* Merge new checklists + old templates into one display */}
          {(() => {
            const allChecklists = [
              ...checklists.map(cl => ({ ...cl, source: 'new' })),
              ...oldTemplates.map(t => ({
                ...t, source: 'old',
                items: (t.items || []).map((item, idx) => ({
                  id: item.id || `item_${idx}`, section: item.section || '', question: item.description || item.question || '', type: 'pass_fail_na',
                })),
              })),
            ]
            return allChecklists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
              <FileSpreadsheet size={36} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p >No maintenance checklists yet</p>
              <p >Import checklists from Excel to get started</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
              {allChecklists.map(cl => {
                const fc = FREQ_COLORS[cl.frequency] || FREQ_COLORS.monthly
                const linked = cl.linked_asset_names || []
                return (
                  <div key={cl.id} style={{
                    padding: '14px 16px', borderRadius: 12, background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span >{cl.name}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10,
                        background: fc.bg, color: fc.color, textTransform: 'uppercase',
                      }}>{cl.frequency || 'monthly'}</span>
                    </div>
                    {cl.category && (
                      <p style={{ color: 'var(--text-3)', margin: '0 0 4px' }}>
                        Category: {cl.category}
                      </p>
                    )}
                    <p style={{ color: 'var(--text-2)', margin: '0 0 8px' }}>
                      {(cl.items || []).length} inspection items
                    </p>

                    {/* Linked Assets */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Link2 size={11} style={{ color: 'var(--accent)' }} />
                        <span style={{ color: 'var(--accent)', letterSpacing: '0.03em' }}>
                          LINKED TO ({linked.length} asset type{linked.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      {linked.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                          {linked.map((name, i) => (
                            <span key={i} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6,
                              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                              color: 'var(--green)', }}>
                              {name}
                              {(isAdmin || isMod) && (
                                <X size={10} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={async () => {
                                  const updated = linked.filter((_, j) => j !== i)
                                  const table = cl.source === 'old' ? 'checklist_templates' : 'maintenance_checklists'
                                  await supabase.from(table).update({ linked_asset_names: updated }).eq('id', cl.id)
                                  await loadAll()
                                }} />
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {(isAdmin || isMod) && (
                        <select
                          value=""
                          onChange={async (e) => {
                            if (!e.target.value) return
                            const newLinked = [...linked, e.target.value]
                            const table = cl.source === 'old' ? 'checklist_templates' : 'maintenance_checklists'
                            await supabase.from(table).update({ linked_asset_names: newLinked }).eq('id', cl.id)
                            await loadAll()
                          }}
                          style={{
                            width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px dashed var(--border)',
                            background: 'var(--bg-2)', color: 'var(--text-2)',
                          }}
                        >
                          <option value="">+ Link to asset type...</option>
                          {assetNames.filter(n => !linked.some(l => l.toLowerCase() === n.toLowerCase())).map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {(isAdmin || isMod) && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                        <button onClick={() => setEditingChecklist(cl)} className="btn-ghost" style={{ padding: '3px 8px' }}>
                          <Settings size={11} /> Edit
                        </button>
                        <button onClick={async () => {
                          if (!window.confirm(`Delete "${cl.name}"? This cannot be undone.`)) return
                          const table = cl.source === 'old' ? 'checklist_templates' : 'maintenance_checklists'
                          await supabase.from(table).delete().eq('id', cl.id)
                          await loadAll()
                        }} className="btn-ghost" style={{ color: 'var(--red)', padding: '3px 8px' }}>
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
          })()}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TAB: APPROVALS
          ════════════════════════════════════════════════════════ */}
      {tab === 'approvals' && (
        <div>
          {/* Batch Approval Action Bar for HODs / Supervisors */}
          {myPendingApprovals.length > 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(34,197,94,0.08))',
              border: '1px solid rgba(14,165,233,0.3)', marginBottom: 14, display: 'flex', alignItems: 'center',
              justify: 'space-between', flexWrap: 'wrap', gap: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
                <span style={{ color: 'var(--text-0)', }}>
                  {myPendingApprovals.length} submission(s) awaiting your approval
                </span>
              </div>

              {selectedApprovalIds.length > 0 && (
                <button
                  onClick={handleBatchApprove}
                  className="btn-primary"
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none',
                    display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                  }}
                >
                  <CheckCircle2 size={14} /> ⚡ Batch Approve Selected ({selectedApprovalIds.length})
                </button>
              )}
            </div>
          )}

          {submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
              <Shield size={36} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p >No submissions yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {submissions.map(sub => {
                const asc = APPROVAL_COLORS[sub.approval_status] || APPROVAL_COLORS.pending_checker
                const isMyApproval = myPendingApprovals.some(p => p.id === sub.id)

                // SLA Calculation (12h Checker, 24h HOD)
                const slaHours = sub.approval_status === 'pending_checker' ? 12 : 24
                const createdTime = new Date(sub.created_at || Date.now()).getTime()
                const hoursElapsed = (Date.now() - createdTime) / (3600 * 1000)
                const hoursLeft = Math.max(0, Math.round(slaHours - hoursElapsed))
                const isSlaBreached = hoursElapsed > slaHours

                return (
                  <div key={sub.id} onClick={() => setShowApproval(sub)} style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: isMyApproval ? 'var(--status-warning-soft)' : 'var(--bg-1)',
                    border: `1px solid ${isMyApproval ? 'var(--status-warning-soft)' : 'var(--border)'}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'border-color 0.2s',
                  }}>
                    {isMyApproval && (
                      <input
                        type="checkbox"
                        checked={selectedApprovalIds.includes(sub.id)}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          if (e.target.checked) setSelectedApprovalIds(ids => [...ids, sub.id])
                          else setSelectedApprovalIds(ids => ids.filter(i => i !== sub.id))
                        }}
                      />
                    )}

                    <div style={{
                      width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: asc.bg, color: asc.color, flexShrink: 0,
                    }}>
                      <Shield size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span >
                          {sub.asset?.asset_code} - {sub.checklist?.name}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10,
                          background: asc.bg, color: asc.color, }}>{asc.label}</span>

                        {/* SLA Countdown Timer Badge */}
                        <span style={{
                          padding: '2px 8px', borderRadius: 10,
                          background: isSlaBreached ? 'var(--status-danger-soft)' : hoursLeft < 4 ? 'var(--status-warning-soft)' : 'rgba(34,197,94,0.1)',
                          color: isSlaBreached ? 'var(--status-danger)' : hoursLeft < 4 ? 'var(--status-warning)' : '#059669',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          <Clock size={10} /> {isSlaBreached ? '🚨 SLA Breached' : `⏰ SLA: ${hoursLeft}h left`}
                        </span>

                        {isMyApproval && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 10,
                            background: 'var(--status-danger-soft)', color: 'var(--red)',
                            }}>ACTION REQUIRED</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 14, color: 'var(--text-3)', }}>
                        <span>By: {sub.prepared_name || sub.preparer?.full_name}</span>
                        <span>{new Date(sub.submitted_at).toLocaleDateString('en-GB')}</span>
                        {sub.checklist?.frequency && (
                          <span style={{ textTransform: 'uppercase' }}>{sub.checklist.frequency}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODALS
          ════════════════════════════════════════════════════════ */}

      {/* CREATE ASSIGNMENT MODAL */}
      {showCreateForm && (
        <div className="modal-bg" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: 500, width: '95%', padding: 0, overflow: 'hidden' }}>
            <div className="card-header" style={{ background: 'var(--bg-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
                  <Plus size={18} />
                </div>
                <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0 }}>
                  CREATE AUDIT ASSIGNMENT
                </h2>
              </div>
              <button onClick={() => setShowCreateForm(false)} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="lbl">Audit Title</label>
                <input type="text" value={assignForm.title} onChange={e => setAssignForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Q2 Asset Count - Site A"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }} />
              </div>
              <div>
                <label className="lbl">Audit Type</label>
                <select value={assignForm.audit_type} onChange={e => setAssignForm(f => ({ ...f, audit_type: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }}>
                  <option value="asset_count">Asset Count Audit</option>
                  <option value="maintenance_checklist">Maintenance Checklist Audit</option>
                </select>
              </div>
              <div>
                <label className="lbl">Site</label>
                <select value={assignForm.site_id} onChange={e => {
                  const siteId = e.target.value
                  setAssignForm(f => ({ ...f, site_id: siteId }))
                }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }}>
                  <option value="">Select site...</option>
                  {sites.length > 0
                    ? sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                    : assetSiteNames.map(s => <option key={s} value={s}>{s}</option>)
                  }
                </select>
              </div>
              <div>
                <label className="lbl">Assign to (Auditor)</label>
                <select value={assignForm.assigned_to} onChange={e => setAssignForm(f => ({ ...f, assigned_to: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }}>
                  <option value="">Select auditor...</option>
                  {profiles.filter(p => p.is_active !== false).map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">Due Date</label>
                <input type="date" value={assignForm.due_date} onChange={e => setAssignForm(f => ({ ...f, due_date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }} />
              </div>
              <div>
                <label className="lbl">Notes</label>
                <textarea value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Instructions for the auditor..." rows={2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', resize: 'vertical', color: 'var(--text-1)' }} />
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateForm(false)} className="btn-ghost" >Cancel</button>
              <button onClick={handleCreateAssignment} className="btn-primary" >
                <Plus size={13} /> Create Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SITE FORM MODAL */}
      {showSiteForm && (
        <div className="modal-bg" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: 480, width: '95%', padding: 0, overflow: 'hidden' }}>
            <div className="card-header" style={{ background: 'var(--bg-3)' }}>
              <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0 }}>
                {editingSite ? 'EDIT SITE' : 'ADD SITE'}
              </h2>
              <button onClick={() => { setShowSiteForm(false); setEditingSite(null) }} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="lbl">Site Name</label>
                <select value={siteForm.name} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }}>
                  <option value="">Select site...</option>
                  {assetSiteNames.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="lbl">Latitude</label>
                  <input type="number" step="any" value={siteForm.latitude} onChange={e => setSiteForm(f => ({ ...f, latitude: e.target.value }))}
                    placeholder="25.2048" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }} />
                </div>
                <div>
                  <label className="lbl">Longitude</label>
                  <input type="number" step="any" value={siteForm.longitude} onChange={e => setSiteForm(f => ({ ...f, longitude: e.target.value }))}
                    placeholder="55.2708" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="lbl">Geo-Fence Radius (meters)</label>
                  <input type="number" value={siteForm.radius_meters} onChange={e => setSiteForm(f => ({ ...f, radius_meters: parseInt(e.target.value) || 200 }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }} />
                </div>
                <div>
                  <label className="lbl">Address</label>
                  <input type="text" value={siteForm.address} onChange={e => setSiteForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Optional" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }} />
                </div>
              </div>
              <div>
                <label className="lbl">Checker (Site Supervisor)</label>
                <select value={siteForm.checker_id} onChange={e => setSiteForm(f => ({ ...f, checker_id: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }}>
                  <option value="">Select checker...</option>
                  {profiles.filter(p => p.is_active !== false).map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">HOD (Head of Department)</label>
                <select value={siteForm.hod_id} onChange={e => setSiteForm(f => ({ ...f, hod_id: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }}>
                  <option value="">Select HOD...</option>
                  {profiles.filter(p => p.is_active !== false).map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
                </select>
              </div>
              {/* Get current location button */}
              <button onClick={() => {
                navigator.geolocation.getCurrentPosition(
                  pos => setSiteForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(7), longitude: pos.coords.longitude.toFixed(7) })),
                  () => alert('Could not get your location.')
                )
              }} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', border: '1px dashed var(--border)' }}>
                <MapPin size={13} /> Use My Current Location
              </button>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {editingSite && (
                <button onClick={async () => {
                  if (window.confirm('Delete this site?')) {
                    await deleteSite(editingSite.id)
                    setShowSiteForm(false); setEditingSite(null)
                    await loadAll()
                  }
                }} className="btn-ghost" style={{ color: 'var(--red)' }}>
                  <Trash2 size={12} /> Delete
                </button>
              )}
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button onClick={() => { setShowSiteForm(false); setEditingSite(null) }} className="btn-ghost" >Cancel</button>
                <button onClick={handleSaveSite} className="btn-primary" >
                  <CheckCircle2 size={13} /> {editingSite ? 'Update' : 'Create'} Site
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR SCANNER */}
      {showScanner && (
        <QRScanner
          onScan={selectedAssignment?.audit_type === 'asset_count' ? handleAssetCountScan : handleMaintenanceScan}
          onClose={() => setShowScanner(false)}
        />
      )}



      {/* SELFIE CAPTURE */}
      {showSelfie && (
        <div className="modal-bg" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: 420, width: '95%', padding: 0, overflow: 'hidden' }}>
            <div className="card-header" style={{ background: 'var(--bg-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 8, background: 'rgba(34,197,94,0.1)', borderRadius: 10, color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <Camera size={18} />
                </div>
                <div>
                  <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0 }}>COMPLETION SELFIE</h2>
                  <span style={{ color: 'var(--text-3)', }}>
                    All assets scanned! Take a selfie to finalize.
                  </span>
                </div>
              </div>
              <button onClick={() => setShowSelfie(false)} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <SelfieCapture userId={profile?.id} onCapture={handleSelfieCapture} onClear={() => {}} />
            </div>
          </div>
        </div>
      )}

      {/* CHECKLIST IMPORT MODAL */}
      {/* CHECKLIST EDITOR MODAL */}
      {editingChecklist && (() => {
        const ec = editingChecklist
        const items = ec.items || []
        const sections = [...new Set(items.map(it => it.section).filter(Boolean))]

        const updateField = (field, value) => setEditingChecklist(prev => ({ ...prev, [field]: value }))
        const updateItem = (idx, field, value) => {
          const newItems = [...items]
          newItems[idx] = { ...newItems[idx], [field]: value }
          updateField('items', newItems)
        }
        const removeItem = (idx) => updateField('items', items.filter((_, i) => i !== idx))
        const addItem = () => updateField('items', [...items, { id: `item_new_${Date.now()}`, section: sections[0] || '', question: '', type: 'pass_fail_na' }])

        const saveChecklist = async () => {
          const table = ec.source === 'old' ? 'checklist_templates' : 'maintenance_checklists'
          const payload = { name: ec.name, category: ec.category || null, frequency: ec.frequency || 'monthly', items: ec.items }
          if (ec.source === 'old') {
            // Old templates use 'description' instead of 'question'
            payload.items = ec.items.map(it => ({ ...it, description: it.question || it.description }))
          }
          await supabase.from(table).update(payload).eq('id', ec.id)
          setEditingChecklist(null)
          await loadAll()
        }

        return (
          <div className="modal-bg" style={{ zIndex: 2000 }}>
            <div className="modal" style={{ maxWidth: 700, width: '95%', padding: 0, overflow: 'hidden', maxHeight: '92vh' }}>
              <div className="card-header" style={{ background: 'var(--bg-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
                    <Settings size={18} />
                  </div>
                  <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0 }}>EDIT CHECKLIST</h2>
                </div>
                <button onClick={() => setEditingChecklist(null)} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
              </div>

              <div style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(92vh - 140px)' }}>
                {/* Name & meta */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="lbl">Checklist Name</label>
                    <input type="text" value={ec.name || ''} onChange={e => updateField('name', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }} />
                  </div>
                  <div>
                    <label className="lbl">Frequency</label>
                    <select value={ec.frequency || 'monthly'} onChange={e => updateField('frequency', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="lbl">Category</label>
                  <input type="text" value={ec.category || ''} onChange={e => updateField('category', e.target.value)}
                    placeholder="e.g. Tower Crane, Generator..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-1)' }} />
                </div>

                {/* Items */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label className="lbl" style={{ margin: 0 }}>Inspection Items ({items.length})</label>
                  <button onClick={addItem} className="btn-ghost" style={{ padding: '4px 10px' }}>
                    <Plus size={12} /> Add Item
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map((item, idx) => (
                    <div key={item.id || idx} style={{
                      padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--bg-2)', display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 5, background: 'var(--bg-3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-3)', flexShrink: 0, marginTop: 6,
                      }}>{idx + 1}</span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input type="text" value={item.section || ''} onChange={e => updateItem(idx, 'section', e.target.value)}
                          placeholder="Section (e.g. Structural, Safety...)"
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--accent)', }} />
                        <input type="text" value={item.question || item.description || ''} onChange={e => updateItem(idx, 'question', e.target.value)}
                          placeholder="Inspection item description..."
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-1)' }} />
                      </div>
                      <button onClick={() => removeItem(idx)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--red)', opacity: 0.6, marginTop: 4,
                      }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>

                {items.length === 0 && (
                  <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)', }}>
                    No items. Click "Add Item" to start building the checklist.
                  </p>
                )}
              </div>

              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-3)', alignSelf: 'center' }}>
                  {items.length} items · {[...new Set(items.map(i => i.section).filter(Boolean))].length} sections
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditingChecklist(null)} className="btn-ghost" >Cancel</button>
                  <button onClick={saveChecklist} className="btn-primary" >
                    <CheckCircle2 size={13} /> Save Checklist
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {showImportModal && (
        <ChecklistImportModal
          onImport={handleImportChecklists}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* MAINTENANCE CHECKLIST FORM */}
      {showChecklistForm && (
        <MaintenanceChecklistForm
          checklist={showChecklistForm.checklist}
          asset={showChecklistForm.asset}
          siteInfo={showChecklistForm.assignment?.site}
          onSubmit={handleChecklistSubmit}
          onClose={() => setShowChecklistForm(null)}
        />
      )}

      {/* APPROVAL MODAL */}
      {showApproval && (
        <ApprovalModal
          submission={showApproval}
          role={
            showApproval.approval_status === 'pending_checker' && showApproval.checker_id === profile?.id ? 'checker'
            : showApproval.approval_status === 'pending_hod' && showApproval.hod_id === profile?.id ? 'hod'
            : 'viewer'
          }
          userId={profile?.id}
          onApprove={handleApprove}
          onReject={handleRejectSubmission}
          onClose={() => setShowApproval(null)}
        />
      )}

      {showBuilderModal && (
        <ChecklistBuilderModal
          onClose={() => setShowBuilderModal(false)}
          onSave={async (payload) => {
            await createMaintenanceChecklist(payload, profile.id)
            setShowBuilderModal(false)
            await loadAll()
          }}
          assetNames={assetNames}
        />
      )}

      {/* OBSERVATION NOTE MODAL */}
      {noteModalItem && (
        <div className="modal-bg" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: 440, width: '95%', padding: 0, overflow: 'hidden' }}>
            <div className="card-header" style={{ background: 'var(--bg-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0 }}>
                    OBSERVATION NOTE
                  </h2>
                  <span style={{ color: 'var(--text-3)', }}>
                    {noteModalItem.asset?.asset_code} - {noteModalItem.asset?.asset_name}
                  </span>
                </div>
              </div>
              <button onClick={() => setNoteModalItem(null)} className="btn-ghost" style={{ padding: 6 }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <label className="lbl" style={{ marginBottom: 6 }}>Observation / Audit Notes</label>
              <textarea
                value={noteInputText}
                onChange={e => setNoteInputText(e.target.value)}
                placeholder="Enter observation notes (e.g. Oil leak observed, Belt tension loose, Missing safety guard)..."
                rows={4}
                autoFocus
                style={{
                  width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--bg-2)', color: 'var(--text-1)',
                  resize: 'vertical', outline: 'none'
                }}
              />
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setNoteModalItem(null)} className="btn-ghost" >
                Cancel
              </button>
              <button onClick={handleSaveNoteModal} className="btn-primary" style={{ padding: '8px 18px' }}>
                <CheckCircle2 size={14} /> Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spin animation */}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}


