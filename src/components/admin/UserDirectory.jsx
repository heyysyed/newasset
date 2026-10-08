import React, { useState, useMemo } from 'react'
import {
  Users, Search, List, LayoutGrid, UserPlus, UserCircle2, MapPin, X, Check, AlertCircle,
  Laptop, Shield, Clock, KeyRound, Radio, LogOut
} from 'lucide-react'

const ROLE_META = {
  super_admin: { label: 'Super Admin', cls: 'badge-admin', color: 'var(--status-danger)', bg: 'var(--status-danger-soft)' },
  admin:       { label: 'Admin',       cls: 'badge-admin', color: 'var(--status-warning)', bg: 'var(--status-warning-soft)' },
  moderator:   { label: 'Moderator',   cls: 'badge-mod',   color: 'var(--status-special)', bg: 'var(--status-special-soft)' },
  user:        { label: 'User',        cls: 'badge-user',  color: 'var(--status-info)', bg: 'var(--status-info-soft)'  },
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

export default function UserDirectory({
  users,
  isSuperAdmin,
  changeRole,
  toggleActive,
  setProfileUser,
  setSiteUser,
  setAddingUser,
  ROLES
}) {
  const [search, setSearch] = useState('')
  const [userView, setUserView] = useState('list') // 'list' or 'grid'
  const [roleFilter, setRoleFilter] = useState('all')

  const [sessionUser, setSessionUser] = useState(null)
  const [delegationUser, setDelegationUser] = useState(null)
  const [delegatedRole, setDelegatedRole] = useState('moderator')
  const [delegationExpiry, setDelegationExpiry] = useState('2026-08-31')

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => {
      const matchSearch = !search ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      return matchSearch && matchRole
    })
  }, [users, search, roleFilter])

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--clay-shadow)' }}>
      {/* Search & Filter bar */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Search + View Toggle + Add Buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
              className="inp" style={{ paddingLeft: 32, }}/>
          </div>

          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 3, borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={() => setUserView('list')} style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              background: userView === 'list' ? 'var(--bg-2)' : 'transparent',
              color: userView === 'list' ? 'var(--text-0)' : 'var(--text-3)',
              boxShadow: userView === 'list' ? 'var(--clay-shadow-sm)' : 'none',
              transition: 'all 0.2s',
            }}>
              <List size={13}/> List
            </button>
            <button onClick={() => setUserView('grid')} style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              background: userView === 'grid' ? 'var(--bg-2)' : 'transparent',
              color: userView === 'grid' ? 'var(--text-0)' : 'var(--text-3)',
              boxShadow: userView === 'grid' ? 'var(--clay-shadow-sm)' : 'none',
              transition: 'all 0.2s',
            }}>
              <LayoutGrid size={13}/> Grid
            </button>
          </div>

          <button onClick={() => setAddingUser(true)} className="btn-primary"
            style={{ padding: '8px 14px', gap: 5, flexShrink: 0 }}>
            <UserPlus size={13}/> Add User
          </button>
        </div>

        {/* Role filters */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
          {['all', ...(isSuperAdmin ? ['super_admin'] : []), 'admin', 'moderator', 'user'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} style={{
              padding: '4px 0', border: 'none', background: 'transparent', cursor: 'pointer',
              transition: 'all 0.15s',
              fontWeight: roleFilter === r ? 600 : 500,
              color: roleFilter === r ? 'var(--accent)' : 'var(--text-2)',
              borderBottom: roleFilter === r ? '2px solid var(--accent)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {r === 'all' ? 'All' : ROLE_META[r]?.label}
              <span style={{ fontSize: 10, opacity: roleFilter === r ? 1 : 0.6, background: roleFilter === r ? 'var(--accent-glow)' : 'var(--bg-3)', padding: '2px 6px', borderRadius: 10 }}>
                {(users || []).filter(u => u.role === r || r === 'all').length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* User List or Grid View */}
      {filteredUsers.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <Users size={32} style={{ color: 'var(--text-3)', marginBottom: 12 }}/>
          <p style={{ color: 'var(--text-2)', }}>No matching users found.</p>
        </div>
      ) : userView === 'grid' ? (
        /* ── Grid View ── */
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {filteredUsers.map(u => {
            const rm = ROLE_META[u.role] || ROLE_META.user
            return (
              <div key={u.id} style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 16,
                padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 12, textAlign: 'center', boxShadow: 'var(--clay-shadow-sm)', transition: 'all 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {/* Avatar with Status indicator */}
                <div style={{ position: 'relative' }}>
                  {u.photo_url
                    ? <img src={u.photo_url} alt={u.full_name || 'user'} style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${rm.color}` }}/>
                    : <div style={{ width: 54, height: 54, borderRadius: '50%', background: `linear-gradient(135deg, ${rm.color}, ${rm.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: `0 4px 12px ${rm.color}30` }}>
                        {(u.full_name || u.email || 'U')[0].toUpperCase()}
                      </div>
                  }
                  <span style={{
                    position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%',
                    background: u.is_active ? '#22c55e' : 'var(--status-danger)', border: '2px solid var(--bg-1)', boxShadow: u.is_active ? '0 0 6px #22c55e' : 'none'
                  }} />
                </div>

                {/* Name & Email */}
                <div>
                  <div style={{ color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
                    {u.full_name || '-'}
                  </div>
                  <div style={{ color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210, marginTop: 1 }}>{u.email}</div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ padding: '3px 9px', borderRadius: 10, background: rm.bg, color: rm.color, border: `1px solid ${rm.color}30` }}>{rm.label}</span>
                  <span style={{ padding: '3px 9px', borderRadius: 10, background: u.is_active ? 'rgba(34,197,94,0.1)' : 'var(--status-danger-soft)', color: u.is_active ? '#22c55e' : 'var(--status-danger)' }}>
                    {u.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>

                {/* Primary Site Access Action */}
                <button onClick={() => setSiteUser(u)} className="btn-ghost"
                  style={{ width: '100%', padding: '6px 10px', gap: 6, borderRadius: 10, background: 'var(--status-info-soft)', color: 'var(--status-info)', border: '1px solid var(--status-info-soft)', justifyContent: 'center' }}>
                  <MapPin size={13}/> Assign / Manage Sites
                </button>

                {/* Secondary Action Row */}
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <button onClick={() => setSessionUser(u)} className="btn-ghost" style={{ flex: 1, padding: '5px 6px', gap: 4, borderRadius: 8, justifyContent: 'center', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                    <Laptop size={12}/> Sessions
                  </button>
                  <button onClick={() => setDelegationUser(u)} className="btn-ghost" style={{ flex: 1, padding: '5px 6px', gap: 4, borderRadius: 8, justifyContent: 'center', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                    <Clock size={12}/> Delegate
                  </button>
                  {setProfileUser && (
                    <button onClick={() => setProfileUser(u)} className="btn-ghost" style={{ flex: 1, padding: '5px 6px', gap: 4, borderRadius: 8, justifyContent: 'center', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                      <UserCircle2 size={12}/> Profile
                    </button>
                  )}
                </div>

                {/* Role Switcher & Suspend Toggle */}
                <div style={{ display: 'flex', gap: 6, width: '100%', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className="sel" style={{ flex: 1, padding: '4px 8px', borderRadius: 8, height: 32, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                    {(ROLES || []).map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
                  </select>
                  <button onClick={() => toggleActive(u.id, u.is_active)}
                    style={{
                      padding: '4px 10px', borderRadius: 8, cursor: 'pointer', border: '1px solid', height: 32, flexShrink: 0,
                      background: u.is_active ? 'var(--status-danger-soft)' : 'rgba(34,197,94,0.08)',
                      color: u.is_active ? 'var(--status-danger)' : '#22c55e',
                      borderColor: u.is_active ? 'var(--status-danger-soft)' : 'rgba(34,197,94,0.25)',
                    }}>
                    {u.is_active ? 'Suspend' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── List View (Responsive Single-Row Layout with Table Header) ── */
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 'max-content', padding: '0 4px' }}>
            {/* Table Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '10px 18px', borderBottom: '1px solid var(--border)',
              color: 'var(--text-3)', fontSize: '11px',
              letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600
            }}>
              <span style={{ minWidth: 200, flex: '1 1 200px' }}>User</span>
              <span style={{ width: 140, flexShrink: 0 }}>Role</span>
              <span style={{ width: 100, flexShrink: 0 }}>Status</span>
              <span style={{ width: 180, flexShrink: 0, textAlign: 'right' }}>Actions</span>
            </div>

            {filteredUsers.map((u, i) => {
              const rm = ROLE_META[u.role] || ROLE_META.user
              return (
                <div key={u.id} style={{
                  padding: '12px 18px', borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  transition: 'background 0.15s ease',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* 1. User Info (Avatar + Name + Email) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 200px', minWidth: 200 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {u.photo_url
                        ? <img src={u.photo_url} alt={u.full_name || 'user'} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}/>
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                            {(u.full_name || u.email || 'U')[0].toUpperCase()}
                          </div>
                      }
                      <span style={{
                        position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%',
                        background: u.is_active ? '#22c55e' : 'var(--status-danger)', border: '2px solid var(--bg-1)'
                      }} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--text-0)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.full_name || '-'}
                      </div>
                      <div style={{ color: 'var(--text-3)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                    </div>
                  </div>

                  {/* 2. Role Selector */}
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} style={{ 
                      width: '100%', padding: '4px 6px', borderRadius: 6, height: 28, 
                      background: 'transparent', border: '1px solid transparent', 
                      color: 'var(--text-1)', fontSize: '13px', cursor: 'pointer',
                      transition: 'border 0.2s', outline: 'none'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                    >
                      {(ROLES || []).map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
                    </select>
                  </div>

                  {/* 3. Account Status Button (Minimal) */}
                  <div style={{ width: 100, flexShrink: 0 }}>
                    <button onClick={() => toggleActive(u.id, u.is_active)}
                      style={{
                        padding: '2px 8px', borderRadius: 12, cursor: 'pointer', border: 'none', fontSize: '11px', fontWeight: 500,
                        background: u.is_active ? 'rgba(34,197,94,0.1)' : 'var(--status-danger-soft)',
                        color: u.is_active ? '#22c55e' : 'var(--status-danger)',
                      }}
                      title={u.is_active ? "Click to suspend" : "Click to activate"}
                    >
                      {u.is_active ? 'Active' : 'Suspended'}
                    </button>
                  </div>

                  {/* 4. Action Buttons Cluster (Icon Only) */}
                  <div style={{ width: 180, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexShrink: 0 }}>
                    {[
                      { icon: MapPin, action: () => setSiteUser(u), title: "Site Access", color: 'var(--status-info)' },
                      { icon: Laptop, action: () => setSessionUser(u), title: "Sessions", color: 'var(--text-2)' },
                      { icon: Clock, action: () => setDelegationUser(u), title: "Delegate", color: 'var(--text-2)' },
                      ...(setProfileUser ? [{ icon: UserCircle2, action: () => setProfileUser(u), title: "Profile", color: 'var(--text-2)' }] : [])
                    ].map((btn, idx) => (
                      <button 
                        key={idx}
                        onClick={btn.action}
                        title={btn.title}
                        className="flex items-center justify-center transition-colors"
                        style={{ 
                          width: 28, height: 28, borderRadius: 6, 
                          color: btn.color, background: 'transparent', border: 'none', cursor: 'pointer' 
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <btn.icon size={15}/>
                      </button>
                    ))}
                  </div>
                </div>

              )
            })}
          </div>
        </div>
      )}

      {/* ── Active Session Inspector Modal ── */}
      {sessionUser && (
        <div className="modal-bg" style={{ zIndex: 2200 }} onClick={e => { if (e.target === e.currentTarget) setSessionUser(null) }}
             onKeyDown={e => { if (e.key === 'Escape') setSessionUser(null) }} tabIndex={-1} ref={el => el && el.focus()}>
          <div className="modal" style={{ maxWidth: 480, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Laptop size={16} style={{ color: 'var(--status-info)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-0)' }}>ACTIVE SESSIONS ({sessionUser.full_name})</h3>
              </div>
              <button onClick={() => setSessionUser(null)} className="btn-ghost" style={{ padding: 4 }}><X size={16}/></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {[
                { device: 'Chrome on Windows 11', ip: '103.21.124.89', loc: 'Mumbai, India', active: 'Active now (Current)' },
                { device: 'AssetPro Mobile iOS App', ip: '114.143.20.12', loc: 'Delhi, India', active: '2 hours ago' },
              ].map((s, i) => (
                <div key={`skel2-${i}`} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'var(--text-0)', }}>{s.device}</div>
                    <div style={{ color: 'var(--text-3)', }}>IP: {s.ip} • {s.loc} • {s.active}</div>
                  </div>
                  <button onClick={() => alert('Session revoked remotely!')} className="btn-ghost" style={{ color: 'var(--red)', padding: '4px 8px', gap: 4 }}>
                    <LogOut size={12}/> Revoke
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSessionUser(null)} className="btn-ghost" >Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Temporary Role Delegation Modal ── */}
      {delegationUser && (
        <div className="modal-bg" style={{ zIndex: 2200 }} onClick={e => { if (e.target === e.currentTarget) setDelegationUser(null) }}
             onKeyDown={e => { if (e.key === 'Escape') setDelegationUser(null) }} tabIndex={-1} ref={el => el && el.focus()}>
          <div className="modal" style={{ maxWidth: 440, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} style={{ color: 'var(--status-warning)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-0)' }}>TEMPORARY ROLE DELEGATION</h3>
              </div>
              <button onClick={() => setDelegationUser(null)} className="btn-ghost" style={{ padding: 4 }}><X size={16}/></button>
            </div>

            <p style={{ color: 'var(--text-2)', margin: '0 0 12px' }}>
              Delegate elevated permissions to <strong>{delegationUser.full_name}</strong> with automatic expiration timestamp.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label className="lbl" style={{ marginBottom: 4 }}>Temporary Delegated Role</label>
                <select className="sel" value={delegatedRole} onChange={e => setDelegatedRole(e.target.value)} style={{ width: '100%' }}>
                  <option value="moderator">Moderator (Operational Access)</option>
                  <option value="admin">Admin (Site Control)</option>
                </select>
              </div>
              <div>
                <label className="lbl" style={{ marginBottom: 4 }}>Automatic Expiration Date</label>
                <input type="date" className="inp" value={delegationExpiry} onChange={e => setDelegationExpiry(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDelegationUser(null)} className="btn-ghost" >Cancel</button>
              <button onClick={() => { alert(`Temporary ${delegatedRole} status granted until ${delegationExpiry}!`); setDelegationUser(null) }} className="btn-primary" style={{ padding: '6px 14px' }}>
                Grant Delegation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


