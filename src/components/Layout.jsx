import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, PlusCircle, Tag, FileSpreadsheet,
  Settings, LogOut, Menu, X, ChevronRight, Shield, Users, ClipboardCheck,
  Wrench, Boxes, Pencil, CheckCircle2, XCircle, Upload, ShieldCheck, MapPin, BarChart2, Search, ShoppingCart,
  MoreHorizontal
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useImport } from '../context/ImportContext'
import { signOut, syncOfflineActionsQueue } from '../lib/supabase'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import companyLogo from '../assets/logo.png'
import UserProfileModal from './UserProfileModal'
import NotificationBell from './NotificationBell'
import CommandPalette from './CommandPalette'

const ROLE_BADGE = {
  super_admin: { label: 'Super Admin', cls: 'badge-admin' },
  admin:       { label: 'Admin',       cls: 'badge-admin' },
  moderator:   { label: 'Moderator',   cls: 'badge-mod' },
  user:        { label: 'User',        cls: 'badge-user' },
}

export default function Layout() {
  const { profile, isAdmin, isMod, can, refreshProfile, patchProfile } = useAuth()
  const { status: importStatus, progress: importProgress, result: importResult, total: importTotal, dismiss: dismissImport } = useImport()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Listen for Cmd+K or Ctrl+K to open the command palette
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const NAV = [
    { to: '/',            icon: LayoutDashboard, label: 'Dashboard',   exact: true,  show: isAdmin || isMod },
    { to: '/assets',      icon: Package,         label: 'Assets',      exact: false, show: isAdmin || isMod },
    { to: '/sites',       icon: MapPin,          label: 'Sites',       exact: false, show: isAdmin || isMod },
    { to: '/audit',       icon: ShieldCheck,     label: 'Audit & Maint.', exact: false, show: true },
    { to: '/maintenance', icon: Wrench,          label: 'Maintenance', exact: false, show: isAdmin || can('maintenance') },
    { to: '/inventory',   icon: Boxes,           label: 'Inventory',   exact: false, show: isAdmin || isMod || can('inventory') },
    { to: '/stickers',    icon: Tag,             label: 'Stickers',    exact: false, show: can('print_stickers') },
    { to: '/import',      icon: FileSpreadsheet, label: 'Import Excel',exact: false, show: can('import') },
    { to: '/reports',     icon: BarChart2,       label: 'Reports',     exact: false, show: true },
    { to: '/admin',       icon: Shield,          label: 'Admin Panel', exact: false, show: isAdmin, divider: true },
  ].filter(n => n.show)

  // Bottom nav: pick the 4 most important + "More" button
  const BOTTOM_NAV_KEYS = ['/', '/assets', '/inventory', '/audit']
  const bottomNav = NAV.filter(n => BOTTOM_NAV_KEYS.includes(n.to))

  const rb = ROLE_BADGE[profile?.role] || ROLE_BADGE.user

  const isPathActive = (to, exact) => {
    if (exact) return location.pathname === to
    return location.pathname.startsWith(to)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-0 font-sans" data-theme="light">

      {/* Mobile sidebar overlay backdrop */}
      {sidebarOpen && (
        <div className="modal-bg" style={{ zIndex: 1000 }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="flex items-center justify-between shrink-0 border-b border-border px-5 py-4">
          <img src={companyLogo} alt="Strongbuilt" className="h-[72px] max-w-[200px] object-contain" />
          <div className="lg:hidden">
            <button className="btn-ghost btn-icon btn-sm border-none" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Add new */}
        {can('add') && (
          <div className="px-4 pt-4 pb-2">
            <NavLink to="/assets/new" onClick={() => setSidebarOpen(false)}
              className="btn-primary w-full shadow-[4px_4px_14px_rgba(79,126,255,0.35)] no-underline text-[0.85rem]"
            >
              <PlusCircle size={15} /> Add New Asset
            </NavLink>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <p className="lbl px-3 py-2 mb-1">Menu</p>
          {NAV.map(({ to, icon: Icon, label, exact, divider }) => (
            <React.Fragment key={to}>
              {divider && <div className="mx-3 my-2 border-t border-border" />}
              <NavLink to={to} end={exact} onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-l-4 border-transparent no-underline font-sans text-sm transition-all mb-[1px] ${isActive ? 'nav-active text-text-0' : 'text-text-2'}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={17} className={isActive ? 'text-accent' : 'text-text-3'} />
                    {label}
                    <ChevronRight size={13} className="ml-auto opacity-30" />
                  </>
                )}
              </NavLink>
            </React.Fragment>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="p-4 border-t border-border shrink-0 bg-bg-0">
          
          <div className="flex flex-col p-3 rounded-xl bg-bg-1 border border-border shadow-[var(--clay-shadow-sm)] mb-3 relative overflow-hidden">
            <div className="flex items-center gap-3 relative z-10">
              {/* Avatar */}
              <div className="relative shrink-0">
                {profile?.photo_url
                  ? <img src={profile.photo_url} alt={profile.full_name || 'profile'}
                      className="w-[38px] h-[38px] rounded-full object-cover border-[1.5px] border-bg-1 shadow-sm" />
                  : <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-accent to-[#6b96ff] flex items-center justify-center text-[0.95rem] font-bold text-white font-display shadow-sm border-[1.5px] border-bg-1">
                      {(profile?.full_name || profile?.email || 'U')[0].toUpperCase()}
                    </div>
                }
                <div className="absolute -bottom-0.5 -right-0.5 w-[11px] h-[11px] bg-green rounded-full border-[2px] border-bg-1" title="Online" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[0.9rem] font-bold text-text-0 font-sans truncate leading-tight">
                  {profile?.full_name || 'User'}
                </div>
                <div className="text-[0.7rem] text-text-3 font-sans truncate mt-0.5">
                  {profile?.email || 'Logged in'}
                </div>
              </div>

              <div className="shrink-0 flex items-center">
                <NotificationBell />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/60 relative z-10">
              <span className={`badge ${rb.cls} text-[0.65rem] px-2 py-[2px] tracking-wide`}>{rb.label}</span>
              <button
                onClick={() => setEditingProfile(true)}
                className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-text-3 hover:text-text-0 transition-colors bg-transparent border-none cursor-pointer p-0"
                title="Edit Profile"
              >
                <Pencil size={12} /> Edit
              </button>
            </div>
          </div>
          
          <button onClick={handleSignOut} className="btn-ghost w-full justify-center text-[0.85rem] h-[40px] min-h-[40px] shadow-none hover:shadow-sm transition-all">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* My Profile modal */}
      {editingProfile && profile && (
        <UserProfileModal
          user={profile}
          onClose={() => setEditingProfile(false)}
          onSaved={(u) => { patchProfile(u); refreshProfile() }}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Mobile Header */}
        <header className="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="btn-ghost btn-icon border-none">
            <Menu size={22} />
          </button>
          <img src={companyLogo} alt="Strongbuilt" className="h-12 max-w-[180px] object-contain" />
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCommandPalette(true)} className="btn-ghost btn-icon border-none">
              <Search size={20} />
            </button>
            <NotificationBell />
          </div>
        </header>

        {/* Desktop Topbar for Command Palette Search & PWA Network Sync */}
        <div className="desktop-only flex items-center justify-between px-5 py-4 border-b border-border bg-bg-0">
          <div className="flex items-center gap-2">
            {!navigator.onLine ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20">
                <WifiOff size={13} /> Offline Mode (PWA Queue Active)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20">
                <Wifi size={13} /> Network Online
              </span>
            )}
          </div>

          <button 
            onClick={() => setShowCommandPalette(true)}
            className="flex items-center gap-3 px-4 py-2 bg-bg-1 border border-border rounded-full text-text-3 cursor-pointer font-sans text-sm min-w-[240px] transition-all duration-200"
          >
            <Search size={16} />
            <span className="flex-1 text-left">Search assets...</span>
            <span className="flex items-center gap-1 opacity-70">
              <kbd className="font-mono text-[0.7rem]">⌘</kbd>
              <kbd className="font-mono text-[0.7rem]">K</kbd>
            </span>
          </button>
        </div>

        <main className="flex-1 overflow-auto p-5 main-content mobile-main-content">
          <div className="w-full">
            <Outlet />
          </div>
        </main>

        {/* ── Mobile Bottom Navigation Bar ── */}
        <nav className="mobile-bottom-nav">
          {bottomNav.map(({ to, icon: Icon, label, exact }) => {
            const active = isPathActive(to, exact)
            return (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className="mobile-bottom-nav-item"
                style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}
              >
                <div className={`mobile-bottom-nav-icon ${active ? 'active' : ''}`}>
                  <Icon size={22} />
                </div>
                <span className="mobile-bottom-nav-label">{label}</span>
              </NavLink>
            )
          })}
          {/* "More" button opens the full sidebar */}
          <button
            className="mobile-bottom-nav-item"
            style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setSidebarOpen(true)}
          >
            <div className="mobile-bottom-nav-icon">
              <MoreHorizontal size={22} />
            </div>
            <span className="mobile-bottom-nav-label">More</span>
          </button>
        </nav>
      </div>

      {/* ── Background import indicator ── */}
      {importStatus !== 'idle' && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-bg-2 border border-border rounded-2xl p-4 w-[300px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] import-toast">
          {importStatus === 'running' && (
            <>
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0"/>
                <span className="font-sans font-bold text-[0.85rem] text-text-0 flex-1">
                  Importing {importTotal.toLocaleString()} assets…
                </span>
                <span className="font-mono text-[0.78rem] text-accent font-bold">{importProgress}%</span>
              </div>
              <div className="bg-bg-4 rounded-md h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent to-[#6b96ff] rounded-md transition-all duration-300" style={{ width: `${importProgress}%` }}/>
              </div>
              <p className="font-sans text-[0.68rem] text-text-3 m-0 mt-2">
                You can freely navigate — import continues in background
              </p>
            </>
          )}
          {importStatus === 'done' && (
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-[#34d399] shrink-0"/>
              <div className="flex-1">
              <p className="font-sans font-bold text-[0.85rem] text-text-0 m-0">Import complete</p>
                <p className="font-sans text-[0.72rem] text-[#34d399] m-0 mt-0.5">
                  {importResult?.count?.toLocaleString()} assets imported successfully
                </p>
              </div>
              <button onClick={dismissImport} className="bg-transparent border-none cursor-pointer text-text-3 p-1 shrink-0"><X size={14}/></button>
            </div>
          )}
          {importStatus === 'error' && (
            <div className="flex items-start gap-3">
              <XCircle size={20} className="text-red shrink-0 mt-[1px]"/>
              <div className="flex-1">
                <p className="font-sans font-bold text-[0.85rem] text-text-0 m-0">Import failed</p>
                <p className="font-sans text-[0.72rem] text-red m-0 mt-0.5">{importResult?.error}</p>
              </div>
              <button onClick={dismissImport} className="bg-transparent border-none cursor-pointer text-text-3 p-1 shrink-0"><X size={14}/></button>
            </div>
          )}
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
