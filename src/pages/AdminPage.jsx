import React, { useEffect, useState } from 'react'
import {
  Shield, Users, Eye, EyeOff, Plus, Trash2, Save, RefreshCw, Download, Activity,
  Check, X, UserCircle2, Search, Settings2, ChevronRight,
  ToggleLeft, Database, Lock, AlertCircle, CheckCircle2, UserPlus, KeyRound,
  Package, MapPin, FileSpreadsheet, Wrench, Boxes, Tag, ClipboardCheck, UserCog,
  History, Filter, ChevronLeft, RotateCcw, Archive, Hash, LayoutGrid, List, Briefcase,
} from 'lucide-react'
import { supabase, getAllProfiles, updateProfile, getSettings, updateSettings, adminCreateUser, fetchActivityLogs, fetchDeletedAssets, restoreAsset, fetchUserSiteAssignments, assignUserToSite, removeUserFromSite, fetchFilterOptions, getQrScanConfig, updateQrScanConfig, fetchAuditAssignments, fetchMaintenanceSubmissions, fetchEmployees } from '../lib/supabase'
import { formatCurrency } from '../lib/depreciation'
import { useAuth, DEFAULT_FIELDS } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useBreakpoint'
import MobileAdminMenu from '../components/mobile/MobileAdminMenu'
import MobilePageHeader from '../components/mobile/MobilePageHeader'
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
  super_admin: { label: 'Super Admin', cls: 'badge-admin', color: 'var(--status-danger)', bg: 'var(--status-danger-soft)' },
  admin:       { label: 'Admin',       cls: 'badge-admin', color: 'var(--status-warning)', bg: 'var(--status-warning-soft)' },
  moderator:   { label: 'Moderator',   cls: 'badge-mod',   color: 'var(--status-special)', bg: 'var(--status-special-soft)' },
  user:        { label: 'User',        cls: 'badge-user',  color: 'var(--status-info)', bg: 'var(--status-info-soft)'  },
}

const MOD_PERM_GROUPS = [
  {
    title: 'ASSET ACTIONS',
    sub: 'What moderators can do with assets',
    color: 'var(--status-info)',
    icon: Package,
    perms: [
      { key: 'can_add',           label: 'Add Assets',        desc: 'Create new assets in the system',          icon: Plus },
      { key: 'can_edit_all',      label: 'Edit All Fields',   desc: 'Edit any field on any asset',              icon: Settings2 },
      { key: 'can_edit_location', label: 'Edit Location',     desc: 'Change the site / location of assets',     icon: MapPin },
      { key: 'can_edit_status',   label: 'Edit Status',       desc: 'Change active / inactive / disposed',      icon: ToggleLeft },
      { key: 'can_delete',        label: 'Archive Assets',    desc: 'Archive assets while preserving history', icon: Trash2 },
      { key: 'can_export',        label: 'Export to Excel',   desc: 'Download asset list as Excel spreadsheet', icon: FileSpreadsheet },
      { key: 'can_import',        label: 'Import from Excel', desc: 'Bulk upload assets from Excel file',       icon: FileSpreadsheet },
    ],
  },
  {
    title: 'MODULE ACCESS',
    sub: 'Which sections moderators can navigate to',
    color: 'var(--status-special)',
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

// ── Compact Context Stat Indicator ────────────────────────────
function StatCard({ label, value, icon: Icon, tone, sub }) {
  const toneMap = {
    primary: 'var(--accent)',
    warning: 'var(--amber)',
    special: 'var(--purple)',
    success: 'var(--green)',
    danger:  'var(--red)'
  }
  const color = toneMap[tone] || toneMap.primary;

  return (
    <div className="bg-bg-1 border border-border rounded-xl px-4 py-3 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-shadow">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0 mb-0.5">
          <span className="text-[1.25rem] font-mono font-semibold text-text-0 leading-none truncate shrink-0 max-w-[60%]">{value}</span>
          <span className="text-[11px] font-semibold tracking-wide uppercase text-text-3 truncate">{label}</span>
        </div>
        {sub && <div className="text-[11px] text-text-2 font-medium truncate">{sub}</div>}
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
        <h2 style={{ letterSpacing: '0.06em', color: 'var(--text-0)', margin: 0 }}>{title}</h2>
        {sub && <p style={{ color: 'var(--text-3)', margin: 0, marginTop: 1 }}>{sub}</p>}
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
    <div className="modal-bg" style={{ zIndex: 2300 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}
         onKeyDown={e => { if (e.key === 'Escape') onClose() }} tabIndex={-1} ref={el => el && el.focus()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="card-header" style={{ background: 'var(--bg-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 7, background: 'var(--status-info-soft)', borderRadius: 9, color: 'var(--status-info)', border: '1px solid var(--status-info-soft)' }}>
              <MapPin size={16} />
            </div>
            <div>
              <h3 style={{ letterSpacing: '0.05em', color: 'var(--text-0)', margin: 0 }}>SITE ACCESS</h3>
              <p style={{ color: 'var(--text-3)', margin: 0 }}>{user.full_name || user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6, border: 'none' }} aria-label="Close site assignment modal"><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-soft)', borderRadius: 8, color: 'var(--red)', }}>
              {error}
            </div>
          )}

          {/* Current assignments */}
          <div>
            <p className="lbl" style={{ marginBottom: 8 }}>Assigned Sites</p>
            {assignments.length === 0 ? (
              <p style={{ color: 'var(--text-3)', padding: '10px 0' }}>No sites assigned yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {assignments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--status-info-soft)', border: '1px solid var(--status-info-soft)', borderRadius: 20, color: 'var(--status-info)', }}>
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
              <p style={{ color: 'var(--text-3)', marginTop: 6 }}>All known sites are already assigned.</p>
            )}
            {allSites.length === 0 && (
              <p style={{ color: 'var(--text-3)', marginTop: 6 }}>No sites found. Sites are derived from assets and inventory items.</p>
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
  const isMobile = useIsMobile()
  const [tab, setTab]           = useState(isMobile ? 'menu' : 'overview')
  const [users, setUsers]       = useState([])
  const [employees, setEmployees] = useState([])
  const [settings, setSettings] = useState(null)
  const [originalSettings, setOriginalSettings] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [saveError, setSaveError] = useState(null)

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
  const [originalQrConfig, setOriginalQrConfig] = useState(null)

  // Task & Audit tracking
  const [auditAssignments, setAuditAssignments] = useState([])
  const [maintSubmissions, setMaintSubmissions] = useState([])

  // Available roles depends on who's logged in
  const ROLES = isSuperAdmin ? ['admin', 'moderator', 'user'] : ['admin', 'moderator', 'user']

  // Utility for dirty checking
  const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const isSettingsDirty = !deepEqual(settings, originalSettings)
  const isQrDirty = !deepEqual(qrConfig, originalQrConfig)
  const isDirty = (['fields', 'custom', 'modperms', 'useraccess', 'reports'].includes(tab) && isSettingsDirty) || (tab === 'qrconfig' && isQrDirty)

  function handleTabChange(newTab) {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Leave without saving?')) {
        return;
      }
      // Revert changes if they discard
      if (tab === 'qrconfig') {
        setQrConfig(JSON.parse(JSON.stringify(originalQrConfig)));
      } else {
        setSettings(JSON.parse(JSON.stringify(originalSettings)));
      }
    }
    setTab(newTab)
  }

  async function load() {
    setLoading(true)
    try {
      const [u, s] = await Promise.all([
        getAllProfiles(authProfile?.role).catch(() => []),
        getSettings().catch(() => ({})),
      ])
      setUsers(u || []); 
      setSettings(s || {}); 
      setOriginalSettings(JSON.parse(JSON.stringify(s || {})));

      // Load QR config for super admin
      if (authProfile?.role === 'super_admin') {
        try { 
          const qr = await getQrScanConfig(); 
          setQrConfig(qr); 
          setOriginalQrConfig(JSON.parse(JSON.stringify(qr))); 
        } catch {}
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
      // Load initial activity logs
      try {
        const { data, count } = await fetchActivityLogs(20, 0, {})
        setActLogs(data || []); setActTotal(count || 0)
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
    setSaveError(null)
    try {
      if (tab === 'qrconfig') {
        await updateQrScanConfig(qrConfig)
        setOriginalQrConfig(JSON.parse(JSON.stringify(qrConfig)))
      } else {
        await updateSettings({
          hidden_fields:         settings?.hidden_fields,
          custom_fields:         settings?.custom_fields,
          moderator_permissions: settings?.moderator_permissions,
          user_permissions:      settings?.user_permissions,
          company_code:          settings?.company_code,
          scheduled_reports:     settings?.scheduled_reports,
          offline_sync_interval_mins: settings?.offline_sync_interval_mins,
        })
        setOriginalSettings(JSON.parse(JSON.stringify(settings)))
      }
      await refreshSettings()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { 
      setSaveError(e.message || 'Unable to save changes. Please try again.')
    } finally { 
      setSaving(false) 
    }
  }



  // Stats
  const totalUsers   = (users || []).length
  const activeUsers  = (users || []).filter(u => u?.is_active).length
  const adminCount   = (users || []).filter(u => u?.role === 'admin').length
  const modCount     = (users || []).filter(u => u?.role === 'moderator').length

  const TABS = [
    { id: 'overview',   label: 'Admin Overview',     icon: LayoutGrid,     count: null, group: 'Admin', desc: 'System operational summary and administrative health' },
    { id: 'users',      label: 'User Directory',     icon: Users,          count: (users || []).length, group: 'People & Access', desc: 'Manage system accounts, assign roles, and configure site access' },
    { id: 'employees',  label: 'Employees',         icon: Briefcase,      count: (employees || []).length, group: 'People & Access', desc: 'Employee personnel directory, designations, and site allocations' },
    { id: 'modperms',   label: 'Mod Permissions',    icon: Shield,         count: null, group: 'People & Access', desc: 'Configure operational permission matrices and module capabilities' },
    { id: 'useraccess', label: 'User Access Rules',  icon: UserCog,        count: null, group: 'People & Access', desc: 'Set user-level browsing boundaries and inspection access' },
    { id: 'fields',     label: 'Field Visibility',   icon: Eye,            count: null, group: 'Asset Configuration', desc: 'Control visible asset fields across desktop and mobile forms' },
    { id: 'custom',     label: 'Custom Fields',     icon: Database,       count: (settings?.custom_fields || []).length || null, group: 'Asset Configuration', desc: 'Define dynamic user-defined attributes for assets' },
    { id: 'tracking',   label: 'Task SLA Tracking',  icon: ClipboardCheck, count: (auditAssignments || []).length || null, group: 'Operations & Security', desc: 'Track maintenance and inspection SLA resolution deadlines' },
    { id: 'reports',    label: 'Scheduled Reports', icon: FileSpreadsheet, count: (settings?.scheduled_reports || []).length || null, group: 'Operations & Security', desc: 'Configure automated scheduled report delivery' },
    { id: 'logs',       label: 'Activity Audit Logs', icon: History,       count: null, group: 'Operations & Security', desc: 'Complete chronological audit log of all system changes' },
    { id: 'trash',      label: 'Deleted Trash Bin', icon: Trash2,         count: (deletedAssets || []).length || null, group: 'Operations & Security', desc: 'Recovery center for deleted equipment with permanent purge' },
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

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
      <p style={{ color: 'var(--text-3)', }}>Loading admin panel…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (isMobile) {
    if (tab === 'menu') {
      return <MobileAdminMenu tabs={TABS} currentTab={tab} setTab={handleTabChange} />
    }
    
    const currentTabObj = TABS.find(t => t.id === tab)
    return (
      <div className="mobile-page-container">
        <MobilePageHeader 
          title={currentTabObj?.label || 'Admin'} 
          showBack={true} 
          onBack={() => handleTabChange('menu')} 
        />
        <div style={{ padding: '16px' }}>
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

          {tab === 'employees' && (
            <EmployeeDirectory
              employees={employees}
              onRefresh={refreshEmployees}
            />
          )}

          {tab === 'modperms' && (
            <PermissionsGrid
              tab={tab}
              settings={settings}
              setSettings={setSettings}
            />
          )}

          {tab === 'useraccess' && (
            <PermissionsGrid
              tab={tab}
              settings={settings}
              setSettings={setSettings}
            />
          )}

          {tab === 'fields' && (
            <SettingsManager
              tab={tab}
              settings={settings}
              setSettings={setSettings}
            />
          )}

          {tab === 'custom' && (
            <SettingsManager
              tab={tab}
              settings={settings}
              setSettings={setSettings}
            />
          )}

          {tab === 'reports' && (
            <ScheduledReports
              settings={settings}
              setSettings={setSettings}
            />
          )}

          {tab === 'tracking' && (
            <TaskSlaTracker
              auditAssignments={auditAssignments}
              maintSubmissions={maintSubmissions}
            />
          )}

          {isSuperAdmin && tab === 'qrconfig' && (
            <QrStickerDesigner
              config={qrConfig}
              setConfig={setQrConfig}
            />
          )}

          {tab === 'logs' && (
            <ActivityLogsHub
              logs={actLogs}
              total={actTotal}
              page={actPage}
              setPage={setActPage}
              filter={actFilter}
              setFilter={setActFilter}
              loading={actLoading}
            />
          )}

          {tab === 'trash' && (
            <TrashBinManager
              deletedAssets={deletedAssets}
              trashLoading={trashLoading}
              restoring={restoring}
              handleRestore={handleRestore}
            />
          )}
        </div>
        
        {/* Modals are appended here if any of them are open */}
        {profileUser && <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />}
        {siteUser && <SiteAssignModal user={siteUser} assignedById={authProfile?.id} onClose={() => setSiteUser(null)} />}
        {addingUser && (
          <div className="modal-bg" style={{ zIndex: 3000 }} onClick={e => { if (e.target === e.currentTarget) setAddingUser(false) }}
               onKeyDown={e => { if (e.key === 'Escape') setAddingUser(false) }} tabIndex={-1} ref={el => el && el.focus()}>
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="card-header" style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserPlus size={16} style={{ color: 'var(--accent)' }}/> ADD SYSTEM USER
                </h3>
                <button onClick={() => setAddingUser(false)} className="btn-ghost" style={{ padding: 6 }} aria-label="Close add user modal"><X size={16}/></button>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="lbl">Full Name</label>
                  <input type="text" className="inp" placeholder="e.g. John Doe" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}/>
                </div>
                <div>
                  <label className="lbl">Email Address</label>
                  <input type="email" className="inp" placeholder="name@company.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })}/>
                </div>
                <div>
                  <label className="lbl">Temporary Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPassword ? 'text' : 'password'} className="inp" style={{ paddingRight: 40 }} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}/>
                    <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
                      {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="lbl">System Role</label>
                  <select className="sel" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button onClick={handleAddUser} disabled={addingUserLoading || !newUser.email || !newUser.password} className="btn-primary" style={{ padding: '10px 20px', gap: 8 }}>
                    {addingUserLoading ? 'Creating…' : <><Check size={14}/> Create User</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-4">

      {/* ── Unified Top Navigation Tabs (Wrapped) ── */}
      <div className="flex flex-wrap gap-2 pb-3 w-full mb-2 border-b border-border">
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-lg transition-all border ${
                active 
                  ? 'bg-accent text-white border-accent shadow-sm' 
                  : 'bg-bg-1 text-text-2 border-border hover:bg-bg-2 hover:text-text-1 hover:border-text-3'
              }`}
            >
              <t.icon size={14} className={active ? 'text-white' : 'text-text-3'} />
              <span>{t.label}</span>
              {t.count !== null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-1 transition-colors ${
                  active ? 'bg-white/20 text-white' : 'bg-bg-2 text-text-3'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

        {/* ── Content Workspace ── */}
        <div key={tab} className="flex-1 min-w-0 w-full flex flex-col gap-4">

          {/* Contextual Workspace Header */}
          {(() => {
            const currentTabObj = TABS.find(t => t.id === tab)
            return (
              <div className="bg-bg-1 border border-border rounded-xl px-5 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden z-10">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-3 uppercase tracking-wider mb-1.5">
                    <span>Admin</span>
                    <span>/</span>
                    <span>{currentTabObj?.group || 'Settings'}</span>
                    <span>/</span>
                    <span className="text-accent">{currentTabObj?.label}</span>
                  </div>
                  <h2 className="text-[1.25rem] font-bold text-text-0 m-0 mb-1 tracking-tight">
                    {currentTabObj?.label}
                  </h2>
                  <p className="text-[0.9rem] text-text-2 m-0 truncate max-w-xl">
                    {currentTabObj?.desc}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {saved && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green/10 border border-green/30 rounded-lg text-caption text-green">
                      <CheckCircle2 size={13} />
                      <span>Saved</span>
                    </div>
                  )}

                  {tab === 'users' && (
                    <button 
                      onClick={() => setAddingUser(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white hover:bg-accent-hover rounded-lg text-caption shadow-sm transition-all"
                    >
                      <UserPlus size={13} />
                      <span>Add User</span>
                    </button>
                  )}

                  {saveError && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red/10 border border-red/30 rounded-lg text-caption text-red">
                      <AlertCircle size={13} />
                      <span>{saveError}</span>
                      <button onClick={() => setSaveError(null)} className="ml-2 hover:opacity-70"><X size={13}/></button>
                    </div>
                  )}
                  {isDirty && !saveError && !saving && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber/10 border border-amber/30 rounded-lg text-caption text-amber">
                      <AlertCircle size={13} />
                      <span>Unsaved changes</span>
                    </div>
                  )}

                  {['fields', 'custom', 'modperms', 'useraccess', 'reports', 'qrconfig'].includes(tab) && (
                    <button 
                      onClick={saveSettings} 
                      disabled={saving || !isDirty} 
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white hover:bg-accent-hover rounded-lg text-caption shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save size={13} />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  )}

                  {tab === 'logs' && (
                    <button 
                      onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8,ID,Action,EntityType,EntityName,Timestamp\n" + actLogs.map(l => `"${l.id}","${l.action}","${l.entity_type}","${l.entity_name || ''}","${l.created_at}"`).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `system_activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }} 
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-caption text-text-0 transition-colors shadow-sm"
                    >
                      <Download size={13} className="text-accent" />
                      <span>Export CSV</span>
                    </button>
                  )}

                  <button 
                    onClick={load} 
                    className="p-1.5 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-text-2 hover:text-text-0 transition-colors shadow-sm"
                    title="Reload data"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin text-accent' : ''} />
                  </button>
                </div>
              </div>
            )
          })()}

          {/* ── ADMIN OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <div className="flex flex-col gap-4">
              {/* Top 4 Key Admin Indicators */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total Users" value={totalUsers} icon={Users} tone="primary" sub={`${activeUsers} active accounts`} />
                <StatCard label="Admins" value={adminCount} icon={Shield} tone="warning" sub="Full system control" />
                <StatCard label="Moderators" value={modCount} icon={Lock} tone="special" sub="Field permissions" />
                <StatCard label="Employees" value={(employees || []).length} icon={Briefcase} tone="success" sub="Personnel records" />
              </div>

              {/* 2-Column Operational Health Panes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pane 1: Access & Configuration Posture */}
                <div className="bg-bg-1 border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <Shield size={16} className="text-accent" />
                      <h3 className="text-[11px] font-bold text-text-0 uppercase tracking-wider m-0">Configuration Posture</h3>
                    </div>
                    <span className="text-[10px] font-bold text-green bg-green/10 px-2.5 py-1 rounded-md border border-green/20 uppercase tracking-wide">
                      Active
                    </span>
                  </div>

                  <div className="flex flex-col divide-y divide-border text-[0.85rem] font-medium">
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-text-2">Custom Field Attributes</span>
                      <span className="font-mono text-text-0 font-semibold bg-bg-2 px-2 py-0.5 rounded border border-border">{(settings?.custom_fields || []).length} defined</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-text-2">Scheduled Automated Reports</span>
                      <span className="font-mono text-text-0 font-semibold bg-bg-2 px-2 py-0.5 rounded border border-border">{(settings?.scheduled_reports || []).length} configured</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-text-2">Deleted Equipment in Trash</span>
                      <span className="font-mono text-danger font-semibold bg-red/10 px-2 py-0.5 rounded border border-red/20">{(deletedAssets || []).length} items</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between">
                      <span className="text-text-2">Super Admin Configuration</span>
                      <span className="font-mono text-accent font-semibold bg-accent/10 px-2 py-0.5 rounded border border-accent/20">{isSuperAdmin ? 'Enabled (Master)' : 'Standard Admin'}</span>
                    </div>
                  </div>
                </div>

                {/* Pane 2: Recent Activity Audit Stream */}
                <div className="bg-bg-1 border border-border rounded-xl p-5 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <History size={16} className="text-accent" />
                      <h3 className="text-[11px] font-bold text-text-0 uppercase tracking-wider m-0">Recent Administrative Events</h3>
                    </div>
                    <button onClick={() => setTab('logs')} className="text-[11px] font-semibold text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
                      <span>View Logs</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {actLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 py-4">
                      <p className="text-[0.85rem] text-text-3 m-0 italic">No administrative activity recorded yet.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-border text-[0.85rem]">
                      {actLogs.slice(0, 4).map(log => (
                        <div key={log.id} className="py-2.5 flex items-center justify-between group">
                          <div className="min-w-0 pr-3">
                            <span className="text-text-0 font-semibold block truncate capitalize group-hover:text-accent transition-colors">{log.action || 'System Change'}</span>
                            <span className="text-[11px] text-text-3 font-mono block mt-0.5 truncate">
                              {log.entity_type || 'System'} <span className="opacity-50 mx-1">•</span> {log.profiles?.full_name || 'Administrator'}
                            </span>
                          </div>
                          <span className="text-[10px] text-text-3 font-mono shrink-0">
                            {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Jump Shortcuts Grid */}
              <div className="bg-bg-1 border border-border rounded-xl p-5 shadow-sm">
                <h3 className="text-[11px] font-bold text-text-3 uppercase tracking-wider mb-4 flex items-center gap-2 m-0">
                  <Settings2 size={15} className="text-text-3" />
                  <span>Administrative Control Shortcuts</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={() => setTab('users')} className="p-4 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-left transition-colors flex flex-col items-start">
                    <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center mb-3">
                      <Users size={16} className="text-accent" />
                    </div>
                    <div className="text-[0.9rem] font-semibold text-text-0">User Directory</div>
                    <div className="text-[11px] text-text-3 mt-0.5">{totalUsers} accounts</div>
                  </button>

                  <button onClick={() => setTab('employees')} className="p-4 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-left transition-colors flex flex-col items-start">
                    <div className="w-8 h-8 rounded bg-green/10 flex items-center justify-center mb-3">
                      <Briefcase size={16} className="text-green" />
                    </div>
                    <div className="text-[0.9rem] font-semibold text-text-0">Employees</div>
                    <div className="text-[11px] text-text-3 mt-0.5">{(employees || []).length} records</div>
                  </button>

                  <button onClick={() => setTab('custom')} className="p-4 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-left transition-colors flex flex-col items-start">
                    <div className="w-8 h-8 rounded bg-amber/10 flex items-center justify-center mb-3">
                      <Database size={16} className="text-amber" />
                    </div>
                    <div className="text-[0.9rem] font-semibold text-text-0">Custom Fields</div>
                    <div className="text-[11px] text-text-3 mt-0.5">{(settings?.custom_fields || []).length} attributes</div>
                  </button>

                  <button onClick={() => setTab('trash')} className="p-4 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-left transition-colors flex flex-col items-start">
                    <div className="w-8 h-8 rounded bg-red/10 flex items-center justify-center mb-3">
                      <Trash2 size={16} className="text-danger" />
                    </div>
                    <div className="text-[0.9rem] font-semibold text-text-0">Trash Recovery</div>
                    <div className="text-[11px] text-text-3 mt-0.5">{(deletedAssets || []).length} deleted</div>
                  </button>
                </div>
              </div>
            </div>
          )}

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

          {/* ── USER ACCESS RULES TAB ── */}
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
            />
          )}

          {/* ── CUSTOM FIELDS TAB ── */}
          {tab === 'custom' && (
            <SettingsManager
              tab={tab}
              settings={settings}
              setSettings={setSettings}
            />
          )}

          {/* ── SCHEDULED REPORTS TAB ── */}
          {tab === 'reports' && (
            <ScheduledReports
              settings={settings}
              setSettings={setSettings}
            />
          )}

          {/* ── TASK SLA TRACKING TAB ── */}
          {tab === 'tracking' && (
            <TaskSlaTracker
              auditAssignments={auditAssignments}
              maintSubmissions={maintSubmissions}
            />
          )}

          {/* ── ACTIVITY LOGS TAB ── */}
          {tab === 'logs' && (
            <ActivityLogsHub
              logs={actLogs}
              total={actTotal}
              page={actPage}
              setPage={setActPage}
              filter={actFilter}
              setFilter={setActFilter}
              loading={actLoading}
            />
          )}

          {/* ── TRASH TAB ── */}
          {tab === 'trash' && (
            <TrashBinManager
              deletedAssets={deletedAssets}
              trashLoading={trashLoading}
              restoring={restoring}
              handleRestore={handleRestore}
            />
          )}

        </div>{/* end Content Workspace */}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes admin-fade-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:767px){
          .admin-layout {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .admin-sidebar {
            display: none !important;
          }
        }
        @media(min-width:768px){
          .admin-layout > .md\\:hidden { display: none !important; }
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
                <div style={{ padding: 7, background: 'var(--accent-soft)', borderRadius: 9, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
                  <UserPlus size={16}/>
                </div>
                <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0, color: 'var(--text-0)' }}>
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
                          cursor: 'pointer', transition: 'all 0.15s', borderColor: active ? rm.color : 'var(--border)',
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
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8, color: 'var(--text-3)', }}>
                <AlertCircle size={12} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}/>
                The account is created immediately and confirmed - the user can sign in right away.
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


