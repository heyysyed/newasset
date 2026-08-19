import React, { useEffect, useState } from 'react'
import {
  Shield, Users, Eye, EyeOff, Plus, Trash2, Save, RefreshCw, Download, Activity,
  Check, X, UserCircle2, Search, Settings2, ChevronRight,
  ToggleLeft, Database, Lock, AlertCircle, CheckCircle2, UserPlus, KeyRound,
  Package, MapPin, FileSpreadsheet, Wrench, Boxes, Tag, ClipboardCheck, UserCog,
  History, Filter, ChevronLeft, RotateCcw, Archive, Hash, LayoutGrid, List, Briefcase,
} from 'lucide-react'
import { supabase, getAllProfiles, updateProfile, getSettings, updateSettings, adminCreateUser, fetchActivityLogs, fetchDeletedAssets, restoreAsset, permanentlyDeleteAsset, fetchUserSiteAssignments, assignUserToSite, removeUserFromSite, fetchFilterOptions, getQrScanConfig, updateQrScanConfig, fetchAuditAssignments, fetchMaintenanceSubmissions, fetchEmployees } from '../lib/supabase'
import { formatCurrency } from '../lib/depreciation'
import { useAuth, DEFAULT_FIELDS } from '../context/AuthContext'
import UserProfileModal from '../components/UserProfileModal'
import UserDirectory from '../components/admin/UserDirectory'
import EmployeeDirectory from '../components/admin/EmployeeDirectory'
import PermissionsGrid from '../components/admin/PermissionsGrid'
import TrashBinManager from '../components/admin/TrashBinManager'
import SettingsManager from '../components/admin/SettingsManager'
import ScheduledReports from '../components/admin/ScheduledReports'
import ActivityLogsHub from '../components/admin/ActivityLogsHub'
import TaskSlaTracker from '../components/admin/TaskSlaTracker'
import QrStickerDesigner from '../components/admin/QrStickerDesigner'

const ROLE_META = {
  super_admin: { label: 'Super Admin', cls: 'badge-admin', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  admin:       { label: 'Admin',       cls: 'badge-admin', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  moderator:   { label: 'Moderator',   cls: 'badge-mod',   color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  user:        { label: 'User',        cls: 'badge-user',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
}

const MOD_PERM_GROUPS = [
  {
    title: 'ASSET ACTIONS',
    sub: 'What moderators can do with assets',
    color: '#60a5fa',
    icon: Package,
    perms: [
      { key: 'can_add',           label: 'Add Assets',        desc: 'Create new assets in the system',          icon: Plus },
      { key: 'can_edit_all',      label: 'Edit All Fields',   desc: 'Edit any field on any asset',              icon: Settings2 },
      { key: 'can_edit_location', label: 'Edit Location',     desc: 'Change the site / location of assets',     icon: MapPin },
      { key: 'can_edit_status',   label: 'Edit Status',       desc: 'Change active / inactive / disposed',      icon: ToggleLeft },
      { key: 'can_delete',        label: 'Delete Assets',     desc: 'Permanently remove assets',                icon: Trash2 },
      { key: 'can_export',        label: 'Export to Excel',   desc: 'Download asset list as Excel spreadsheet', icon: FileSpreadsheet },
      { key: 'can_import',        label: 'Import from Excel', desc: 'Bulk upload assets from Excel file',       icon: FileSpreadsheet },
    ],
  },
  {
    title: 'MODULE ACCESS',
    sub: 'Which sections moderators can navigate to',
    color: '#818cf8',
    icon: UserCog,
    perms: [
      { key: 'can_access_audit',       label: 'Audit Module',       desc: 'Run & view physical audit sessions',  icon: ClipboardCheck },
      { key: 'can_access_maintenance', label: 'Maintenance Module', desc: 'Tickets, schedules & work logs',      icon: Wrench },
      { key: 'can_access_inventory',   label: 'Inventory Module',   desc: 'Consumables, spares & stock control', icon: Boxes },
      { key: 'can_access_checklists',  label: 'Checklists Module',  desc: 'Inspection checklists & submissions', icon: ClipboardCheck },
      { key: 'can_print_stickers',     label: 'Sticker Designer',   desc: 'Design & print QR asset stickers',    icon: Tag },
    ],
  },
]

const USER_PERMS = [
  { key: 'can_view_assets',        label: 'Browse Assets',        desc: 'View the full asset list (beyond QR scan)', icon: Package },
  { key: 'can_access_checklists',  label: 'Submit Checklists',    desc: 'Access & submit inspection checklists',    icon: ClipboardCheck },
  { key: 'can_access_maintenance', label: 'Report Maintenance',   desc: 'Log faults and view maintenance tickets',  icon: Wrench },
]

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 2px 12px rgba(0,0,0,0.12)', flex: 1,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} style={{ color }}/>
      </div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-0)', fontFamily: 'Oswald', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'DM Sans', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.68rem', color, fontFamily: 'DM Mono', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Toggle Switch ─────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
      transition: 'background 0.2s', position: 'relative', flexShrink: 0,
      background: on ? 'var(--accent)' : 'var(--bg-4)',
      boxShadow: on ? '0 0 10px var(--accent)40' : 'none',
    }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 4, left: on ? 24 : 4, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}/>
    </button>
  )
}

// ── Section Header ────────────────────────────────────────────
function SectionHead({ icon: Icon, title, sub, color = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} style={{ color }}/>
      </div>
      <div>
        <h2 style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.06em', color: 'var(--text-0)', margin: 0 }}>{title}</h2>
        {sub && <p style={{ fontFamily: 'DM Sans', fontSize: '0.73rem', color: 'var(--text-3)', margin: 0, marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  )
}

// ── Site Assign Modal ──────────────���───────────────────────
function SiteAssignModal({ user, assignedById, onClose }) {
  const [assignments, setAssignments] = useState([])
  const [allSites, setAllSites] = useState([])
  const [selectedSite, setSelectedSite] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [asgn, opts] = await Promise.all([
          fetchUserSiteAssignments(user.id),
          fetchFilterOptions(),
        ])
        setAssignments(asgn)
        setAllSites(opts.sites || [])
      } catch (e) {
        setError('Failed to load site data.')
      }
    }
    load()
  }, [user.id])

  const assignedNames = assignments.map(a => a.site_name)
  const availableSites = allSites.filter(s => !assignedNames.includes(s))

  async function handleAssign() {
    if (!selectedSite) return
    setSaving(true)
    setError(null)
    try {
      const row = await assignUserToSite(user.id, selectedSite, assignedById)
      setAssignments(prev => [...prev, row])
      setSelectedSite('')
    } catch (e) {
      setError(e.message || 'Failed to assign site.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(assignmentId) {
    setError(null)
    try {
      await removeUserFromSite(assignmentId, assignedById)
      setAssignments(prev => prev.filter(a => a.id !== assignmentId))
    } catch (e) {
      setError(e.message || 'Failed to remove site.')
    }
  }

  return (
    <div className="modal-bg" style={{ zIndex: 2300 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="card-header" style={{ background: 'var(--bg-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 7, background: 'rgba(34,211,238,0.12)', borderRadius: 9, color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }}>
              <MapPin size={16} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-0)', margin: 0 }}>SITE ACCESS</h3>
              <p style={{ fontFamily: 'DM Sans', fontSize: '0.75rem', color: 'var(--text-3)', margin: 0 }}>{user.full_name || user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6, border: 'none' }}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: 'var(--red)', fontFamily: 'DM Sans', fontSize: '0.78rem' }}>
              {error}
            </div>
          )}

          {/* Current assignments */}
          <div>
            <p className="lbl" style={{ marginBottom: 8 }}>Assigned Sites</p>
            {assignments.length === 0 ? (
              <p style={{ color: 'var(--text-3)', fontFamily: 'DM Sans', fontSize: '0.8rem', padding: '10px 0' }}>No sites assigned yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {assignments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 20, fontFamily: 'DM Sans', fontSize: '0.78rem', color: '#22d3ee', fontWeight: 600 }}>
                    <MapPin size={11} />
                    {a.site_name}
                    <button onClick={() => handleRemove(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }} title="Remove">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add site */}
          <div>
            <p className="lbl" style={{ marginBottom: 8 }}>Add Site</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="sel" value={selectedSite} onChange={e => setSelectedSite(e.target.value)} style={{ flex: 1 }}>
                <option value="">Select a site…</option>
                {availableSites.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleAssign} disabled={!selectedSite || saving} className="btn-primary" style={{ gap: 6, opacity: !selectedSite ? 0.5 : 1, flexShrink: 0 }}>
                {saving
                  ? <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  : <><Plus size={13}/> Assign</>}
              </button>
            </div>
            {availableSites.length === 0 && allSites.length > 0 && (
              <p style={{ color: 'var(--text-3)', fontFamily: 'DM Sans', fontSize: '0.72rem', marginTop: 6 }}>All known sites are already assigned.</p>
            )}
            {allSites.length === 0 && (
              <p style={{ color: 'var(--text-3)', fontFamily: 'DM Sans', fontSize: '0.72rem', marginTop: 6 }}>No sites found. Sites are derived from assets and inventory items.</p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn-ghost">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { refreshSettings, profile: authProfile, isSuperAdmin } = useAuth()
  const [tab, setTab]           = useState('users')
  const [users, setUsers]       = useState([])
  const [employees, setEmployees] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  // Activity logs
  const [actLogs, setActLogs]         = useState([])
  const [actTotal, setActTotal]       = useState(0)
  const [actPage, setActPage]         = useState(0)
  const [actLoading, setActLoading]   = useState(false)
  const [actFilter, setActFilter]     = useState({ entity_type: '', search: '' })

  // Trash
  const [deletedAssets, setDeletedAssets] = useState([])
  const [trashLoading, setTrashLoading]   = useState(false)
  const [restoring, setRestoring]         = useState({})
  const [profileUser, setProfileUser] = useState(null)
  const [siteUser, setSiteUser] = useState(null)
  const [addingUser, setAddingUser] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'user' })
  const [addingUserLoading, setAddingUserLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // QR config (super_admin only)
  const [qrConfig, setQrConfig] = useState(null)

  // Task & Audit tracking
  const [auditAssignments, setAuditAssignments] = useState([])
  const [maintSubmissions, setMaintSubmissions] = useState([])

  // Available roles depends on who's logged in
  const ROLES = isSuperAdmin ? ['admin', 'moderator', 'user'] : ['admin', 'moderator', 'user']

  async function load() {
    setLoading(true)
    try {
      const [u, s] = await Promise.all([
        getAllProfiles(authProfile?.role).catch(() => []),
        getSettings().catch(() => ({})),
      ])
      setUsers(u || []); setSettings(s || {})
      // Load QR config for super admin
      if (authProfile?.role === 'super_admin') {
        try { const qr = await getQrScanConfig(); setQrConfig(qr) } catch {}
      }
      // Load employees
      try {
        const emp = await fetchEmployees()
        setEmployees(emp || [])
      } catch (err) {
        console.error('Error loading employees:', err)
      }
      // Load audit/task tracking data
      try {
        const [aa, ms] = await Promise.all([
          fetchAuditAssignments().catch(() => []),
          fetchMaintenanceSubmissions().catch(() => []),
        ])
        setAuditAssignments(aa || [])
        setMaintSubmissions(ms || [])
      } catch {}
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function refreshEmployees() {
    try {
      const emp = await fetchEmployees()
      setEmployees(emp || [])
    } catch (err) {
      console.error('Error refreshing employees:', err)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAddUser() {
    if (!newUser.email || !newUser.password) return
    setAddingUserLoading(true)
    try {
      await adminCreateUser(newUser)
      setAddingUser(false)
      setNewUser({ email: '', password: '', full_name: '', role: 'user' })
      await load()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setAddingUserLoading(false)
    }
  }

  async function changeRole(uid, role) {
    await updateProfile(uid, { role })
    setUsers(u => (u || []).map(p => p.id === uid ? { ...p, role } : p))
  }

  async function toggleActive(uid, is_active) {
    await updateProfile(uid, { is_active: !is_active })
    setUsers(u => (u || []).map(p => p.id === uid ? { ...p, is_active: !is_active } : p))
  }



  async function saveSettings() {
    setSaving(true)
    try {
      await updateSettings({
        hidden_fields:         settings?.hidden_fields,
        custom_fields:         settings?.custom_fields,
        moderator_permissions: settings?.moderator_permissions,
        user_permissions:      settings?.user_permissions,
        company_code:          settings?.company_code,
      })
      await refreshSettings()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }



  // Stats
  const totalUsers   = (users || []).length
  const activeUsers  = (users || []).filter(u => u?.is_active).length
  const adminCount   = (users || []).filter(u => u?.role === 'admin').length
  const modCount     = (users || []).filter(u => u?.role === 'moderator').length

  const TABS = [
    { id: 'users',      label: 'Users',           icon: Users,    count: (users || []).length },
    { id: 'employees',  label: 'Employees',       icon: Briefcase, count: (employees || []).length },
    { id: 'modperms',   label: 'Mod Permissions', icon: Shield,   count: null },
    { id: 'useraccess', label: 'User Access',      icon: UserCog,  count: null },
    { id: 'fields',     label: 'Field Visibility', icon: Eye,      count: null },
    { id: 'custom',     label: 'Custom Fields',   icon: Database, count: (settings?.custom_fields || []).length || null },
    { id: 'reports',    label: 'Scheduled Reports', icon: FileSpreadsheet, count: (settings?.scheduled_reports || []).length || null },
    { id: 'tracking',   label: 'Task Tracking',   icon: ClipboardCheck, count: (auditAssignments || []).length || null },
    ...(isSuperAdmin ? [{ id: 'qrconfig', label: 'QR Config', icon: Hash, count: null }] : []),
    { id: 'logs',       label: 'Activity Logs',   icon: History,  count: null },
    { id: 'trash',      label: 'Trash',           icon: Trash2,   count: (deletedAssets || []).length || null },
  ]

  async function loadLogs() {
    setActLoading(true)
    try {
      const { data, count } = await fetchActivityLogs(50, actPage * 50, actFilter)
      setActLogs(data); setActTotal(count)
    } catch (e) { console.error(e) }
    setActLoading(false)
  }

  useEffect(() => { if (tab === 'logs') loadLogs() }, [tab, actPage, actFilter])

  async function loadTrash() {
    setTrashLoading(true)
    try { setDeletedAssets(await fetchDeletedAssets()) } catch (e) { console.error(e) }
    setTrashLoading(false)
  }
  useEffect(() => { if (tab === 'trash') loadTrash() }, [tab])

  async function handleRestore(deletedId) {
    setRestoring(s => ({ ...s, [deletedId]: true }))
    try {
      await restoreAsset(deletedId)
      setDeletedAssets(prev => (prev || []).filter(d => d.id !== deletedId))
    } catch (e) { alert('Restore failed: ' + e.message) }
    setRestoring(s => { const n = { ...s }; delete n[deletedId]; return n })
  }

  async function handlePermanentDelete(deletedId) {
    if (!window.confirm('Permanently delete this asset from trash? This cannot be undone.')) return
    try {
      await permanentlyDeleteAsset(deletedId)
      setDeletedAssets(prev => (prev || []).filter(d => d.id !== deletedId))
    } catch (e) { alert(e.message) }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
      <p style={{ color: 'var(--text-3)', fontFamily: 'DM Sans', fontSize: '0.85rem' }}>Loading admin panel…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ width: '100%' }}>

      {/* ── Page Header ── */}
      <div className="animate-fade-up" style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(79,126,255,0.06))',
        border: '1px solid var(--border)', borderRadius: 18,
        padding: '20px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, boxShadow: 'var(--clay-shadow)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.08))', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 16px rgba(245,158,11,0.15)' }}>
            <Shield size={24} style={{ color: '#f59e0b' }}/>
          </div>
          <div>
            <h1 style={{ fontFamily: 'Oswald, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-0)', letterSpacing: '0.06em', margin: 0, lineHeight: 1.1 }}>
              ADMIN <span style={{ color: '#f59e0b' }}>PANEL</span>
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: '0.78rem', fontFamily: 'DM Sans', margin: 0, marginTop: 4 }}>
              Users, permissions, field settings & custom fields
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, animation: 'admin-fade-in 0.3s ease' }}>
              <CheckCircle2 size={14} style={{ color: 'var(--green)' }}/>
              <span style={{ color: 'var(--green)', fontSize: '0.78rem', fontFamily: 'DM Sans', fontWeight: 600 }}>Saved!</span>
            </div>
          )}
          <button onClick={() => {
            const csvContent = "data:text/csv;charset=utf-8,ID,Action,EntityType,EntityName,Timestamp\n" + actLogs.map(l => `"${l.id}","${l.action}","${l.entity_type}","${l.entity_name || ''}","${l.created_at}"`).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `system_activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }} className="btn-ghost" style={{ padding: '8px 12px', gap: 6, border: '1px solid var(--border)', fontSize: '0.78rem' }}>
            <Download size={14} style={{ color: 'var(--accent)' }}/> Download All Logs
          </button>
          <button onClick={load} className="btn-ghost" style={{ padding: '8px 12px', gap: 6 }}>
            <RefreshCw size={14}/>
          </button>
          <button onClick={saveSettings} disabled={saving} className="btn-primary" style={{ padding: '9px 18px', gap: 7, fontWeight: 700 }}>
            {saving
              ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/> Saving…</>
              : <><Save size={14}/> Save Settings</>}
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Users"   value={totalUsers}  icon={Users}   color="#60a5fa" sub={`${activeUsers} active`}/>
        <StatCard label="Admins"        value={adminCount}  icon={Shield}  color="#f59e0b" />
        <StatCard label="Moderators"    value={modCount}    icon={Lock}    color="#818cf8" />
        <StatCard label="Custom Fields" value={(settings?.custom_fields||[]).length} icon={Database} color="#34d399" />
      </div>

      {/* ── Sidebar + Content Layout ── */}
      <div className="admin-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Sidebar Navigation ── */}
        <div className="admin-sidebar" style={{
          width: 220, flexShrink: 0, position: 'sticky', top: 20,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 18,
          boxShadow: 'var(--clay-shadow)', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 14px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, var(--bg-3), var(--bg-2))' }}>
            <p style={{ fontFamily: 'Oswald', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-3)', margin: 0, textTransform: 'uppercase' }}>Navigation</p>
          </div>
          <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  border: 'none', cursor: 'pointer', borderRadius: 12, width: '100%',
                  background: active ? 'var(--accent-glow)' : 'transparent',
                  borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  fontFamily: 'DM Sans', fontWeight: active ? 700 : 500, fontSize: '0.78rem',
                  transition: 'all 0.2s', textAlign: 'left',
                }}>
                  <t.icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}/>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
                  {t.count !== null && (
                    <span style={{
                      fontSize: '0.6rem', fontFamily: 'DM Mono', fontWeight: 700,
                      color: active ? 'white' : 'var(--text-3)',
                      borderRadius: 8, padding: '1px 6px', flexShrink: 0,
                    }}>{t.count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Content Area ── */}
        <div key={tab} style={{ flex: 1, minWidth: 0, animation: 'admin-fade-in 0.35s ease' }}>

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <UserDirectory
          users={users}
          isSuperAdmin={isSuperAdmin}
          changeRole={changeRole}
          toggleActive={toggleActive}
          setProfileUser={setProfileUser}
          setSiteUser={setSiteUser}
          setAddingUser={setAddingUser}
          ROLES={ROLES}
        />
      )}

      {/* ── EMPLOYEES TAB ── */}
      {tab === 'employees' && (
        <EmployeeDirectory
          employees={employees}
          onRefresh={refreshEmployees}
        />
      )}

      {/* ── MOD PERMS TAB ── */}
      {tab === 'modperms' && (
        <PermissionsGrid
          tab={tab}
          settings={settings}
          setSettings={setSettings}
        />
      )}

      {/* ── USER ACCESS TAB ── */}
      {tab === 'useraccess' && (
        <PermissionsGrid
          tab={tab}
          settings={settings}
          setSettings={setSettings}
        />
      )}

      {/* ── FIELD VISIBILITY TAB ── */}
      {tab === 'fields' && (
        <SettingsManager
          tab={tab}
          settings={settings}
          setSettings={setSettings}
          qrConfig={qrConfig}
          setQrConfig={setQrConfig}
          isSuperAdmin={isSuperAdmin}
          saving={saving}
          setSaving={setSaving}
          setSaved={setSaved}
        />
      )}

      {/* ── CUSTOM FIELDS TAB ── */}
      {tab === 'custom' && (
        <SettingsManager
          tab={tab}
          settings={settings}
          setSettings={setSettings}
          qrConfig={qrConfig}
          setQrConfig={setQrConfig}
          isSuperAdmin={isSuperAdmin}
          saving={saving}
          setSaving={setSaving}
          setSaved={setSaved}
        />
      )}

      {/* ── Activity Logs Tab ── */}
      {tab === 'logs' && (
        <ActivityLogsHub
          actLogs={actLogs}
          actLoading={actLoading}
          actTotal={actTotal}
          actPage={actPage}
          setActPage={setActPage}
          actFilter={actFilter}
          setActFilter={setActFilter}
          onRefresh={loadLogs}
        />
      )}

      {/* ── Trash Tab ── */}
      {tab === 'trash' && (
        <TrashBinManager
          deletedAssets={deletedAssets}
          trashLoading={trashLoading}
          restoring={restoring}
          handleRestore={handleRestore}
          handlePermanentDelete={handlePermanentDelete}
        />
      )}

      {/* ── SCHEDULED REPORTS TAB ── */}
      {tab === 'reports' && (
        <ScheduledReports
          settings={settings}
          setSettings={setSettings}
        />
      )}

      {/* ── TASK TRACKING TAB ── */}
      {tab === 'tracking' && (
        <TaskSlaTracker
          auditAssignments={auditAssignments}
          onRefresh={load}
        />
      )}

      {/* ── QR CONFIG TAB (Super Admin Only) ── */}
      {tab === 'qrconfig' && isSuperAdmin && (
        <QrStickerDesigner
          qrConfig={qrConfig}
          setQrConfig={setQrConfig}
          saving={saving}
          setSaving={setSaving}
          setSaved={setSaved}
        />
      )}

      {/* Bottom save */}
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 9 }}>
            <CheckCircle2 size={14} style={{ color: 'var(--green)' }}/>
            <span style={{ color: 'var(--green)', fontSize: '0.78rem', fontFamily: 'DM Sans', fontWeight: 600 }}>Settings saved!</span>
          </div>
        )}
        <button onClick={saveSettings} disabled={saving} className="btn-primary" style={{ padding: '9px 20px', gap: 7, fontWeight: 700 }}>
          {saving ? 'Saving…' : <><Save size={15}/> Save All Settings</>}
        </button>
      </div>

        </div>{/* end Content Area */}
      </div>{/* end Sidebar + Content Layout */}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes admin-fade-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:900px){
          .admin-layout {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .admin-sidebar {
            width: 100% !important;
            position: static !important;
            margin-bottom: 20px;
          }
          .admin-sidebar button {
            padding: 8px 10px !important;
          }
        }
      `}</style>

      {profileUser && (
        <UserProfileModal
          user={profileUser}
          onClose={() => setProfileUser(null)}
          onSaved={updated => setUsers(u => u.map(p => p.id === updated.id ? { ...p, ...updated } : p))}
        />
      )}

      {siteUser && (
        <SiteAssignModal
          user={siteUser}
          assignedById={authProfile?.id}
          onClose={() => setSiteUser(null)}
        />
      )}

      {/* ── Add User Modal ── */}
      {addingUser && (
        <div className="modal-bg" style={{ zIndex: 2200 }}>
          <div className="modal" style={{ maxWidth: 460 }}>

            {/* Header */}
            <div className="card-header" style={{ background: 'var(--bg-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 7, background: 'rgba(79,126,255,0.12)', borderRadius: 9, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
                  <UserPlus size={16}/>
                </div>
                <h2 className="font-display" style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.04em', margin: 0, color: 'var(--text-0)' }}>
                  ADD NEW USER
                </h2>
              </div>
              <button onClick={() => setAddingUser(false)} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-2)' }}>

              {/* Full Name */}
              <div>
                <label className="lbl">Full Name</label>
                <input
                  className="inp"
                  placeholder="e.g. John Smith"
                  value={newUser.full_name}
                  onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))}
                />
              </div>

              {/* Email */}
              <div>
                <label className="lbl">Email Address *</label>
                <input
                  className="inp"
                  type="email"
                  placeholder="user@company.com"
                  value={newUser.email}
                  onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))}
                />
              </div>

              {/* Password */}
              <div>
                <label className="lbl">Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="inp"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={newUser.password}
                    style={{ paddingRight: 40 }}
                    onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}
                  >
                    <KeyRound size={14}/>
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="lbl">Role</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(ROLES || []).map(r => {
                    const rm = ROLE_META[r] || ROLE_META.user
                    const active = newUser.role === r
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setNewUser(u => ({ ...u, role: r }))}
                        style={{
                          flex: 1, padding: '10px 8px', borderRadius: 10, border: `1.5px solid`,
                          cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.8rem',
                          borderColor: active ? rm.color : 'var(--border)',
                          background: active ? rm.bg : 'var(--bg-3)',
                          color: active ? rm.color : 'var(--text-3)',
                          boxShadow: active ? `0 0 10px ${rm.color}20` : 'none',
                        }}
                      >
                        {rm.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Info note */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8, fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>
                <AlertCircle size={12} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}/>
                The account is created immediately and confirmed — the user can sign in right away.
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button type="button" onClick={() => setAddingUser(false)} className="btn-ghost">Cancel</button>
                <button
                  type="button"
                  onClick={handleAddUser}
                  disabled={addingUserLoading || !newUser.email || !newUser.password}
                  className="btn-primary"
                  style={{ gap: 7, opacity: (!newUser.email || !newUser.password) ? 0.5 : 1 }}
                >
                  {addingUserLoading
                    ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/> Creating…</>
                    : <><UserPlus size={14}/> Create User</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
