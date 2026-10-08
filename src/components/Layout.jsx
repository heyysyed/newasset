import React, { useState, useEffect, useMemo } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, Tag, FileSpreadsheet,
  Settings, LogOut, Menu, X, ChevronRight, Shield, ClipboardCheck,
  Wrench, Boxes, Search, HelpCircle, MapPin, BarChart2, ScanLine,
  PanelLeftClose, PanelLeftOpen, MoreHorizontal, FolderOpen, Moon, Sun
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useImport } from '../context/ImportContext'
import { signOut } from '../lib/supabase'
import { WifiOff } from 'lucide-react'
import companyLogo from '../assets/logo.png'
import UserProfileModal from './UserProfileModal'
import NotificationBell from './NotificationBell'

import MobileMoreMenu from './ui/MobileMoreMenu'

// Page title map - derived from route
const PAGE_TITLES = {
  '/': 'Dashboard',
  '/assets': 'Assets',
  '/sites': 'Sites',
  '/categories': 'Categories',
  '/maintenance': 'Maintenance',
  '/inventory': 'Inventory',
  '/reports': 'Reports',
  '/audit': 'Inspections',
  '/admin': 'Administration',
  '/stickers': 'QR & Tags',
  '/import': 'Import Data',
  '/scan': 'Scan QR',
}

function getMobileTitle(pathname) {
  if (pathname.startsWith('/assets/') && pathname !== '/assets/new') return 'Asset Detail'
  if (pathname === '/assets/new') return 'Add Asset'
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path === '/') {
      if (pathname === '/') return title
    } else if (pathname.startsWith(path)) {
      return title
    }
  }
  return 'AssetPro'
}

export default function Layout() {
  const { profile, isAdmin, isMod, can, refreshProfile, patchProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)

  const [showMobileMore, setShowMobileMore] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  const mobileTitle = useMemo(() => getMobileTitle(location.pathname), [location.pathname])



  // No mobile sidebar route change effect needed anymore

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const NAV_GROUPS = [
    {
      label: 'Overview',
      items: [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true, show: isAdmin || isMod },
      ]
    },
    {
      label: 'Operations',
      items: [
        { to: '/assets', icon: Package, label: 'Assets', exact: false, show: isAdmin || isMod },
        { to: '/sites', icon: MapPin, label: 'Sites', exact: false, show: isAdmin || isMod },
        { to: '/categories', icon: FolderOpen, label: 'Categories', exact: false, show: isAdmin },
      ]
    },
    {
      label: 'Maintenance & Inventory',
      items: [
        { to: '/maintenance', icon: Wrench, label: 'Maintenance', exact: false, show: isAdmin || can('maintenance') },
        { to: '/inventory', icon: Boxes, label: 'Inventory', exact: false, show: isAdmin || isMod || can('inventory') },
        { to: '/audit', icon: ClipboardCheck, label: 'Inspections', exact: false, show: true },
      ]
    },
    {
      label: 'Insights & Tools',
      items: [
        { to: '/reports', icon: BarChart2, label: 'Reports', exact: false, show: true },
        { to: '/stickers', icon: Tag, label: 'QR & Tags', exact: false, show: can('print_stickers') },
        { to: '/import', icon: FileSpreadsheet, label: 'Import Data', exact: false, show: can('import') },
      ]
    },
    {
      label: 'System',
      items: [
        { to: '/admin', icon: Shield, label: 'Administration', exact: false, show: isAdmin },
      ]
    }
  ]

  const isPathActive = (to, exact) => {
    if (exact) return location.pathname === to
    return location.pathname.startsWith(to)
  }

  // Mobile Bottom Nav (5 items)
  const BOTTOM_NAV = [
    { to: '/', icon: LayoutDashboard, label: 'Home', exact: true },
    { to: '/assets', icon: Package, label: 'Assets', exact: false },
    { to: '/scan', icon: ScanLine, label: 'Scan', exact: false, isAction: true },
    { to: '/maintenance', icon: Wrench, label: 'Maint.', exact: false },
    { to: '#more', icon: MoreHorizontal, label: 'More', exact: false, action: () => setShowMobileMore(true) },
  ]

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-bg-1 font-sans text-text-0 selection:bg-accent/20 transition-colors duration-300`} data-theme={darkMode ? 'dark' : 'light'}>

      {/* ── Sidebar (Tablet & Desktop) ── */}
      <aside
        className={`hidden md:flex flex-col bg-bg-0 border-r border-border shadow-sm shrink-0 h-screen z-30 transition-all duration-200 ease-in-out ${
          sidebarCollapsed ? 'w-[72px] min-w-[72px]' : 'w-[260px] min-w-[260px]'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <img
              src={companyLogo}
              alt="Strongbuilt"
              className={`object-contain transition-all duration-300 ${sidebarCollapsed ? 'w-8 scale-150 ml-1' : 'h-8 lg:h-9 w-auto'}`}
              style={{ filter: sidebarCollapsed ? 'drop-shadow(0 0 2px rgba(0,0,0,0.1))' : 'none' }}
            />
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar flex flex-col gap-6">
          {NAV_GROUPS.map((group, idx) => {
            const visibleItems = group.items.filter(i => i.show)
            if (visibleItems.length === 0) return null
            return (
              <div key={idx} className="flex flex-col gap-1">
                {!sidebarCollapsed && (
                  <h4 className="px-3 text-[11px] tracking-wider text-text-3 uppercase mb-1">
                    {group.label}
                  </h4>
                )}
                {visibleItems.map(item => {
                  const active = isPathActive(item.to, item.exact)
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-small text-body-medium transition-colors
                        ${active ? 'bg-accent/10 text-accent' : 'text-text-2 hover:bg-bg-1 hover:text-text-0'}
                      `}
                    >
                      <item.icon size={18} className={`shrink-0 ${active ? 'text-accent' : 'text-text-3'}`} />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border flex flex-col gap-1 shrink-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden lg:flex items-center gap-3 p-2 text-text-3 hover:text-text-0 hover:bg-bg-1 rounded-lg transition-colors w-full ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <div className="w-8 flex items-center justify-center shrink-0">
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </div>
            {!sidebarCollapsed && <span className="text-small font-medium">Collapse</span>}
          </button>

          <div className="relative group cursor-pointer" onClick={() => setEditingProfile(true)}>
            <div className={`flex items-center gap-3 p-2 rounded-lg hover:bg-bg-1 transition-colors ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-accent text-small shrink-0 font-medium" style={{ background: 'var(--accent-soft)' }}>
                {(profile?.full_name || 'U')[0]}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-small text-text-0 truncate font-medium">{profile?.full_name || 'User'}</div>
                  <div className="text-caption text-text-3 truncate capitalize">{profile?.role || 'User'}</div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 p-2 text-danger hover:bg-danger-subtle hover:text-danger rounded-lg transition-colors w-full ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
            style={{ '--tw-bg-opacity': 0.1 }}
          >
            <div className="w-8 flex items-center justify-center shrink-0">
              <LogOut size={18} />
            </div>
            {!sidebarCollapsed && <span className="text-small font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-0 relative">

        {/* ── Global Header (Mobile & Desktop) ── */}
        <header className="flex shrink-0 bg-bg-1 border-b border-border items-center justify-between px-4 lg:px-6 z-30 relative shadow-sm" style={{ height: 56 }}>

          {/* Left: Mobile Branding / Desktop Search */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Mobile only: logo + page title */}
            <div className="flex items-center gap-2.5 md:hidden min-w-0">
              <img src={companyLogo} alt="Strongbuilt" className="h-9 w-auto object-contain shrink-0" />
              <span className="text-[16px] font-medium text-text-0 truncate tracking-tight">{mobileTitle}</span>
            </div>


          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {!navigator.onLine && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-danger bg-danger-subtle border border-danger/20">
                <WifiOff size={11} /> Offline
              </span>
            )}



            {/* Notification Bell */}
            <div className="relative flex items-center justify-center p-2 text-text-2 hover:text-text-0 hover:bg-bg-2 rounded-lg transition-colors cursor-pointer">
              <NotificationBell />
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-text-2 hover:text-text-0 hover:bg-bg-2 rounded-lg transition-colors ml-1"
              title="Toggle Dark Mode"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Help (desktop & tablet) */}
            <button
              className="hidden md:flex p-2 text-text-2 hover:text-text-0 hover:bg-bg-2 rounded-lg transition-colors"
              title="Help"
              aria-label="Help"
            >
              <HelpCircle size={18} />
            </button>

            <div className="w-px h-5 bg-border mx-1 hidden md:block" />

            {/* Profile avatar */}
            <button
              onClick={() => setEditingProfile(true)}
              className="flex items-center justify-center rounded-full hover:ring-2 hover:ring-accent/30 transition-all ml-1"
              aria-label="Profile"
              style={{ width: 34, height: 34 }}
            >
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-caption shadow-sm">
                {(profile?.full_name || 'U')[0].toUpperCase()}
              </div>
            </button>
          </div>
        </header>

        {/* ── Scrollable Main ── */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden w-full relative"
          id="main-scroll-container"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="w-full p-4 lg:p-6 pb-20 md:pb-6 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ── Mobile Bottom Navigation ── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-1 border-t border-border z-50 flex items-stretch shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
          style={{
            height: 60,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          aria-label="Mobile navigation"
        >
          {BOTTOM_NAV.map(item => {
            const active = item.to !== '#more' && isPathActive(item.to, item.exact)

            if (item.isAction) {
              return (
                <div key="scan" className="flex-1 flex items-center justify-center px-1">
                  <NavLink
                    to="/scan"
                    className="flex items-center justify-center w-full h-[46px] bg-accent text-white rounded-xl shadow-sm hover:bg-accent-hover active:bg-accent-active transition-all gap-1.5 text-caption"
                    aria-label="Scan QR Code"
                  >
                    <ScanLine size={18} />
                    <span>Scan</span>
                  </NavLink>
                </div>
              )
            }

            if (item.action) {
              return (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors text-text-2 hover:text-text-0 active:text-accent"
                  style={{ minHeight: 60 }}
                  aria-label={item.label}
                >
                  <item.icon size={20} />
                  <span className="text-[10.5px] tracking-tight">{item.label}</span>
                </button>
              )
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors
                  ${active ? 'text-accent ' : 'text-text-2 hover:text-text-0'}
                `}
                style={{ minHeight: 60 }}
                aria-label={item.label}
              >
                <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-accent/10' : ''}`}>
                  <item.icon size={20} className={active ? 'text-accent' : ''} />
                </div>
                <span className="text-[10.5px] tracking-tight">
                  {item.label}
                </span>
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* ── Modals & Overlays ── */}
      {editingProfile && profile && (
        <UserProfileModal
          user={profile}
          onClose={() => setEditingProfile(false)}
          onSaved={(u) => { patchProfile(u); refreshProfile() }}
        />
      )}



      <MobileMoreMenu isOpen={showMobileMore} onClose={() => setShowMobileMore(false)} />
    </div>
  )
}


