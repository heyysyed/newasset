import React, { useState, useMemo } from 'react'
import {
  Users, Search, List, LayoutGrid, UserPlus, UserCircle2, MapPin, X, Check, AlertCircle,
  Laptop, Shield, Clock, KeyRound, Radio, LogOut
} from 'lucide-react'

const ROLE_META = {
  super_admin: { label: 'Super Admin', cls: 'badge-admin', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  admin:       { label: 'Admin',       cls: 'badge-admin', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  moderator:   { label: 'Moderator',   cls: 'badge-mod',   color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  user:        { label: 'User',        cls: 'badge-user',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
}

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
      <SectionHead icon={Users} title="USER MANAGEMENT & ACCOUNT CONTROL" sub="Manage user roles, provision accounts, inspect sessions, & assign site privileges" color="#60a5fa"/>

      {/* Search & Filter bar */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Search + View Toggle + Add Buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
              className="inp" style={{ paddingLeft: 32, fontSize: '0.82rem' }}/>
          </div>

          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 3, borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={() => setUserView('list')} style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              background: userView === 'list' ? 'var(--bg-2)' : 'transparent',
              color: userView === 'list' ? 'var(--text-0)' : 'var(--text-3)',
              boxShadow: userView === 'list' ? 'var(--clay-shadow-sm)' : 'none',
              fontFamily: 'DM Sans', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.2s',
            }}>
              <List size={13}/> List
            </button>
            <button onClick={() => setUserView('grid')} style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              background: userView === 'grid' ? 'var(--bg-2)' : 'transparent',
              color: userView === 'grid' ? 'var(--text-0)' : 'var(--text-3)',
              boxShadow: userView === 'grid' ? 'var(--clay-shadow-sm)' : 'none',
              fontFamily: 'DM Sans', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.2s',
            }}>
              <LayoutGrid size={13}/> Grid
            </button>
          </div>

          <button onClick={() => setAddingUser(true)} className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.75rem', gap: 5, flexShrink: 0 }}>
            <UserPlus size={13}/> Add User
          </button>
        </div>

        {/* Role filters */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['all', ...(isSuperAdmin ? ['super_admin'] : []), 'admin', 'moderator', 'user'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} style={{
              padding: '5px 10px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer',
              fontSize: '0.7rem', fontFamily: 'DM Sans', fontWeight: 600, transition: 'all 0.15s',
              borderColor: roleFilter === r ? 'var(--accent)' : 'var(--border)',
              background: roleFilter === r ? 'var(--accent-glow)' : 'var(--bg-3)',
              color: roleFilter === r ? 'var(--accent-light)' : 'var(--text-3)',
            }}>
              {r === 'all' ? 'All' : ROLE_META[r]?.label}
              {r !== 'all' && <span style={{ marginLeft: 3, opacity: 0.7 }}>({(users || []).filter(u => u.role === r).length})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* User List or Grid View */}
      {filteredUsers.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <Users size={32} style={{ color: 'var(--text-3)', marginBottom: 12 }}/>
          <p style={{ color: 'var(--text-2)', fontFamily: 'DM Sans', fontWeight: 600 }}>No matching users found.</p>
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
                    : <div style={{ width: 54, height: 54, borderRadius: '50%', background: `linear-gradient(135deg, ${rm.color}, ${rm.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700, color: 'white', fontFamily: 'Oswald', boxShadow: `0 4px 12px ${rm.color}30` }}>
                        {(u.full_name || u.email || 'U')[0].toUpperCase()}
                      </div>
                  }
                  <span style={{
                    position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%',
                    background: u.is_active ? '#22c55e' : '#ef4444', border: '2px solid var(--bg-1)', boxShadow: u.is_active ? '0 0 6px #22c55e' : 'none'
                  }} />
                </div>

                {/* Name & Email */}
                <div>
                  <div style={{ fontFamily: 'DM Sans', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
                    {u.full_name || '—'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210, marginTop: 1 }}>{u.email}</div>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: rm.bg, color: rm.color, border: `1px solid ${rm.color}30` }}>{rm.label}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '3px 9px', borderRadius: 10, background: u.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: u.is_active ? '#22c55e' : '#ef4444' }}>
                    {u.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>

                {/* Primary Site Access Action */}
                <button onClick={() => setSiteUser(u)} className="btn-ghost"
                  style={{ width: '100%', fontSize: '0.74rem', padding: '6px 10px', gap: 6, borderRadius: 10, background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)', fontWeight: 600, justifyContent: 'center' }}>
                  <MapPin size={13}/> Assign / Manage Sites
                </button>

                {/* Secondary Action Row */}
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <button onClick={() => setSessionUser(u)} className="btn-ghost" style={{ flex: 1, fontSize: '0.7rem', padding: '5px 6px', gap: 4, borderRadius: 8, justifyContent: 'center', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                    <Laptop size={12}/> Sessions
                  </button>
                  <button onClick={() => setDelegationUser(u)} className="btn-ghost" style={{ flex: 1, fontSize: '0.7rem', padding: '5px 6px', gap: 4, borderRadius: 8, justifyContent: 'center', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                    <Clock size={12}/> Delegate
                  </button>
                  {setProfileUser && (
                    <button onClick={() => setProfileUser(u)} className="btn-ghost" style={{ flex: 1, fontSize: '0.7rem', padding: '5px 6px', gap: 4, borderRadius: 8, justifyContent: 'center', background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                      <UserCircle2 size={12}/> Profile
                    </button>
                  )}
                </div>

                {/* Role Switcher & Suspend Toggle */}
                <div style={{ display: 'flex', gap: 6, width: '100%', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className="sel" style={{ flex: 1, fontSize: '0.72rem', padding: '4px 8px', borderRadius: 8, height: 32, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                    {(ROLES || []).map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
                  </select>
                  <button onClick={() => toggleActive(u.id, u.is_active)}
                    style={{
                      padding: '4px 10px', borderRadius: 8, cursor: 'pointer', border: '1px solid', fontSize: '0.72rem', fontFamily: 'DM Sans', fontWeight: 600, height: 32, flexShrink: 0,
                      background: u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                      color: u.is_active ? '#ef4444' : '#22c55e',
                      borderColor: u.is_active ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)',
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
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 720 }}>
            {/* Table Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '8px 18px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)',
              fontSize: '0.66rem', fontFamily: 'Oswald', fontWeight: 700, color: 'var(--text-3)',
              letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>
              <span style={{ minWidth: 180, flex: '1 1 180px' }}>USER PROFILE</span>
              <span style={{ flexShrink: 0, width: 175 }}>ROLE & STATUS</span>
              <span style={{ flexShrink: 0 }}>QUICK ACTIONS & SITE PRIVILEGES</span>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 180px', minWidth: 180 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {u.photo_url
                        ? <img src={u.photo_url} alt={u.full_name || 'user'} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${rm.color}` }}/>
                        : <div style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${rm.color}, ${rm.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700, color: 'white', fontFamily: 'Oswald' }}>
                            {(u.full_name || u.email || 'U')[0].toUpperCase()}
                          </div>
                      }
                      <span style={{
                        position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%',
                        background: u.is_active ? '#22c55e' : '#ef4444', border: '2px solid var(--bg-2)', boxShadow: u.is_active ? '0 0 6px #22c55e' : 'none'
                      }} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'DM Sans', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.full_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                    </div>
                  </div>

                  {/* 2. Role Selector & Account Status Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className="sel" style={{ width: 115, fontSize: '0.72rem', fontWeight: 600, padding: '4px 6px', borderRadius: 8, height: 30, background: 'var(--bg-3)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      {(ROLES || []).map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
                    </select>

                    <button onClick={() => toggleActive(u.id, u.is_active)}
                      style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '4px 8px', borderRadius: 8, cursor: 'pointer', border: '1px solid', height: 30, display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s', flexShrink: 0,
                        background: u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                        color: u.is_active ? '#ef4444' : '#22c55e',
                        borderColor: u.is_active ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)',
                      }}>
                      {u.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </div>

                  {/* 3. Action Buttons Cluster */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => setSiteUser(u)} className="btn-ghost"
                      style={{ fontSize: '0.71rem', fontWeight: 600, padding: '4px 9px', height: 30, borderRadius: 8, background: 'rgba(34,211,238,0.08)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.25)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <MapPin size={12}/> Site Access
                    </button>
                    
                    <button onClick={() => setSessionUser(u)} className="btn-ghost"
                      style={{ fontSize: '0.71rem', fontWeight: 600, padding: '4px 8px', height: 30, borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <Laptop size={12}/> Sessions
                    </button>
                    
                    <button onClick={() => setDelegationUser(u)} className="btn-ghost"
                      style={{ fontSize: '0.71rem', fontWeight: 600, padding: '4px 8px', height: 30, borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <Clock size={12}/> Delegate
                    </button>

                    {setProfileUser && (
                      <button onClick={() => setProfileUser(u)} className="btn-ghost"
                        style={{ fontSize: '0.71rem', fontWeight: 600, padding: '4px 8px', height: 30, borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                        <UserCircle2 size={12}/> Profile
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Active Session Inspector Modal ── */}
      {sessionUser && (
        <div className="modal-bg" style={{ zIndex: 2200 }}>
          <div className="modal" style={{ maxWidth: 480, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Laptop size={16} style={{ color: '#22d3ee' }} />
                <h3 style={{ fontFamily: 'Oswald', fontSize: '1rem', margin: 0, color: 'var(--text-0)' }}>ACTIVE SESSIONS ({sessionUser.full_name})</h3>
              </div>
              <button onClick={() => setSessionUser(null)} className="btn-ghost" style={{ padding: 4 }}><X size={16}/></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {[
                { device: 'Chrome on Windows 11', ip: '103.21.124.89', loc: 'Mumbai, India', active: 'Active now (Current)' },
                { device: 'AssetPro Mobile iOS App', ip: '114.143.20.12', loc: 'Delhi, India', active: '2 hours ago' },
              ].map((s, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-0)', fontFamily: 'DM Sans' }}>{s.device}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'DM Mono' }}>IP: {s.ip} • {s.loc} • {s.active}</div>
                  </div>
                  <button onClick={() => alert('Session revoked remotely!')} className="btn-ghost" style={{ color: 'var(--red)', fontSize: '0.7rem', padding: '4px 8px', gap: 4 }}>
                    <LogOut size={12}/> Revoke
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSessionUser(null)} className="btn-ghost" style={{ fontSize: '0.78rem' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Temporary Role Delegation Modal ── */}
      {delegationUser && (
        <div className="modal-bg" style={{ zIndex: 2200 }}>
          <div className="modal" style={{ maxWidth: 440, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} style={{ color: '#f59e0b' }} />
                <h3 style={{ fontFamily: 'Oswald', fontSize: '1rem', margin: 0, color: 'var(--text-0)' }}>TEMPORARY ROLE DELEGATION</h3>
              </div>
              <button onClick={() => setDelegationUser(null)} className="btn-ghost" style={{ padding: 4 }}><X size={16}/></button>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontFamily: 'DM Sans', margin: '0 0 12px' }}>
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
              <button onClick={() => setDelegationUser(null)} className="btn-ghost" style={{ fontSize: '0.78rem' }}>Cancel</button>
              <button onClick={() => { alert(`Temporary ${delegatedRole} status granted until ${delegationExpiry}!`); setDelegationUser(null) }} className="btn-primary" style={{ fontSize: '0.78rem', padding: '6px 14px' }}>
                Grant Delegation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
