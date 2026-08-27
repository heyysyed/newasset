import React, { useState } from 'react'
import {
  Shield, UserCog, ToggleLeft, Plus, Trash2, Settings2, MapPin,
  FileSpreadsheet, ClipboardCheck, Wrench, Boxes, Tag, UserCircle2,
  Clock, Copy, Check, Lock, WifiOff, RefreshCw
} from 'lucide-react'

const MOD_PERM_GROUPS = [
  {
    title: 'ASSET ACTIONS',
    sub: 'What moderators can do with assets',
    color: 'var(--status-info)',
    icon: PackageIcon,
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
  { key: 'can_view_assets',        label: 'Browse Assets',        desc: 'View the full asset list (beyond QR scan)', icon: PackageIcon },
  { key: 'can_access_checklists',  label: 'Submit Checklists',    desc: 'Access & submit inspection checklists',    icon: ClipboardCheck },
  { key: 'can_access_maintenance', label: 'Report Maintenance',   desc: 'Log faults and view maintenance tickets',  icon: Wrench },
  { key: 'can_offline_sync',       label: 'Offline App Sync',     desc: 'Enable local storage caching for offline mobile use', icon: WifiOff },
]

function PackageIcon(props) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" width={props.size||16} height={props.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></span>
}

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

export default function PermissionsGrid({
  tab,
  settings,
  setSettings
}) {
  const [subRoles, setSubRoles] = useState([
    { id: 'sr_1', name: 'Site Auditor Cluster', timeBound: true, businessHoursOnly: true, desc: 'Restricted to business hours (08:00 - 18:00)' },
    { id: 'sr_2', name: 'Inventory Storekeeper', timeBound: false, businessHoursOnly: false, desc: 'Stock room management permissions' },
  ])
  const [showSubRoleModal, setShowSubRoleModal] = useState(false)
  const [newSubRoleName, setNewSubRoleName] = useState('')
  const [timeBoundCheck, setTimeBoundCheck] = useState(true)

  function getModPerm(key) { return settings?.moderator_permissions?.[key] ?? false }
  function setModPerm(key, val) {
    setSettings(s => ({ ...s, moderator_permissions: { ...(s?.moderator_permissions || {}), [key]: val } }))
  }

  function getUserPerm(key) { return settings?.user_permissions?.[key] ?? false }
  function setUserPerm(key, val) {
    setSettings(s => ({ ...s, user_permissions: { ...(s?.user_permissions || {}), [key]: val } }))
  }

  const syncInterval = settings?.offline_sync_interval_mins || 30
  function setSyncInterval(val) {
    setSettings(s => ({ ...s, offline_sync_interval_mins: val }))
  }

  function handleCreateSubRole() {
    if (!newSubRoleName.trim()) return
    const nr = {
      id: `sr_${Date.now()}`,
      name: newSubRoleName,
      timeBound: timeBoundCheck,
      businessHoursOnly: timeBoundCheck,
      desc: timeBoundCheck ? 'Time-bound access enforcement (08:00 - 18:00)' : 'Standard 24/7 custom cluster',
    }
    setSubRoles([...subRoles, nr])
    setNewSubRoleName('')
    setShowSubRoleModal(false)
  }

  if (tab === 'modperms') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Custom Sub-Role Builder Header */}
        <div style={{ padding: 18, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, background: 'var(--status-special-soft)', borderRadius: 10, color: 'var(--status-special)', border: '1px solid var(--status-special-soft)' }}>
              <Copy size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: 'var(--text-0)' }}>
                CUSTOM SUB-ROLE CLUSTERS ({subRoles.length})
              </h3>
              <p style={{ color: 'var(--text-3)', margin: 0 }}>
                Clone moderator templates, enforce business-hours restrictions, or create custom clusters.
              </p>
            </div>
          </div>
          <button onClick={() => setShowSubRoleModal(true)} className="btn-primary" style={{ padding: '7px 14px', gap: 6 }}>
            <Plus size={14} /> Create Custom Sub-Role
          </button>
        </div>

        {/* Existing Sub-Roles Cluster Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {subRoles.map(sr => (
            <div key={sr.id} style={{ padding: 14, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--text-0)', }}>{sr.name}</div>
                <div style={{ color: 'var(--text-3)', marginTop: 2 }}>{sr.desc}</div>
              </div>
              {sr.timeBound && (
                <span style={{ padding: '2px 8px', borderRadius: 8, background: 'var(--status-warning-soft)', color: 'var(--status-warning)', border: '1px solid var(--status-warning-soft)', }}>
                  TIME-BOUND
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Standard Mod Perm Groups */}
        {MOD_PERM_GROUPS.map(group => {
          const enabledCount = group.perms.filter(p => getModPerm(p.key)).length
          return (
            <div key={group.title} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.12)' }}>
              <SectionHead icon={group.icon} title={group.title} sub={group.sub} color={group.color}/>
              <div>
                {group.perms.map((p, i) => {
                  const Icon = p.icon
                  const on = getModPerm(p.key)
                  return (
                    <div key={p.key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 20px', borderBottom: i < group.perms.length - 1 ? '1px solid var(--border)' : 'none',
                      background: on ? 'var(--accent-glow)' : 'transparent', transition: 'background 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={15} style={{ color: on ? 'var(--accent)' : 'var(--text-3)' }}/>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-0)' }}>{p.label}</div>
                          <div style={{ color: 'var(--text-3)' }}>{p.desc}</div>
                        </div>
                      </div>
                      <Toggle on={on} onChange={v => setModPerm(p.key, v)}/>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Modal for creating sub-role */}
        {showSubRoleModal && (
          <div className="modal-bg" style={{ zIndex: 2200 }} onClick={e => { if (e.target === e.currentTarget) setShowSubRoleModal(false) }}
               onKeyDown={e => { if (e.key === 'Escape') setShowSubRoleModal(false) }} tabIndex={-1} ref={el => el && el.focus()}>
            <div className="modal" style={{ maxWidth: 440, padding: 20 }}>
              <h3 style={{ margin: '0 0 12px', color: 'var(--text-0)' }}>CREATE CUSTOM SUB-ROLE</h3>
              <label className="lbl" style={{ marginBottom: 6 }}>Sub-Role Cluster Name</label>
              <input
                className="inp"
                value={newSubRoleName}
                onChange={e => setNewSubRoleName(e.target.value)}
                placeholder="e.g. Night Shift Site Auditor"
                style={{ width: '100%', marginBottom: 14 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <input
                  type="checkbox"
                  id="tbCheck"
                  checked={timeBoundCheck}
                  onChange={e => setTimeBoundCheck(e.target.checked)}
                />
                <label htmlFor="tbCheck" style={{ color: 'var(--text-1)', }}>
                  Enforce Time-Bound Business Hours Access (08:00 - 18:00)
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setShowSubRoleModal(false)} className="btn-ghost" >Cancel</button>
                <button onClick={handleCreateSubRole} className="btn-primary" style={{ padding: '6px 14px' }}>Create Cluster</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // User access tab
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.12)' }}>
      <SectionHead icon={UserCog} title="STANDARD USER ACCESS CONTROL" sub="Configure permissions and offline sync policies for standard user role" color='var(--status-info)'/>

      <div>
        {USER_PERMS.map((p, i) => {
          const Icon = p.icon
          const on = getUserPerm(p.key)
          return (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              background: on ? 'var(--accent-glow)' : 'transparent', transition: 'background 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} style={{ color: on ? 'var(--accent)' : 'var(--text-3)' }}/>
                </div>
                <div>
                  <div style={{ color: 'var(--text-0)' }}>{p.label}</div>
                  <div style={{ color: 'var(--text-3)' }}>{p.desc}</div>
                </div>
              </div>
              <Toggle on={on} onChange={v => setUserPerm(p.key, v)}/>
            </div>
          )
        })}
      </div>

      {/* Offline Sync Controls */}
      <div style={{ padding: '16px 20px', background: 'var(--bg-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RefreshCw size={16} style={{ color: 'var(--accent)' }} />
          <div>
            <div style={{ color: 'var(--text-0)', }}>Offline Local Storage Sync Interval</div>
            <div style={{ color: 'var(--text-3)', }}>Set maximum sync period for mobile field audits</div>
          </div>
        </div>

        <select
          value={syncInterval}
          onChange={e => setSyncInterval(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', outline: 'none' }}
        >
          <option value={15}>Sync every 15 Minutes</option>
          <option value={30}>Sync every 30 Minutes</option>
          <option value={60}>Sync every 1 Hour</option>
          <option value={0}>Manual Sync Only</option>
        </select>
      </div>
    </div>
  )
}


