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
      label: 'Core',
      items: [
        { to: '/', label: 'Dashboard', exact: true, show: isAdmin || isMod },
        { to: '/assets', label: 'Assets', exact: false, show: isAdmin || isMod },
      ]
    },
    {
      label: 'Operations',
      items: [
        { to: '/maintenance', label: 'Maintenance', exact: false, show: isAdmin || can('maintenance') },
        { to: '/sites', label: 'Sites', exact: false, show: isAdmin || isMod },
      ]
    },
    {
      label: 'Inventory',
      items: [
        { to: '/inventory', label: 'Materials', exact: false, show: isAdmin || can('inventory') },
      ]
    },
    {
      label: 'Field',
      items: [
        { to: '/scan', label: 'Scan', exact: false, show: true },
        { to: '/audit', label: 'Audits', exact: false, show: can('audit') || can('checklists') },
      ]
    },
    {
      label: 'Analytics',
      items: [
        { to: '/reports', label: 'Reports', exact: false, show: can('export') },
      ]
    },
    {
      label: 'Settings',
      items: [
        { to: '/admin', label: 'Admin', exact: false, show: isAdmin },
        { to: '/categories', label: 'Categories', exact: false, show: isAdmin },
        { to: '/stickers', label: 'Stickers', exact: false, show: can('print_stickers') },
        { to: '/import', label: 'Import', exact: false, show: can('import') },
      ]
    }
  ]

  const isPathActive = (to, exact) => {
    if (exact) return location.pathname === to
    return location.pathname.startsWith(to)
  }

  // Mobile Bottom Nav (5 items)
  const BOTTOM_NAV = [
    { to: isAdmin || isMod ? '/' : '/field', icon: LayoutDashboard, label: 'Home', exact: true },
    { to: '/assets', icon: Package, label: 'Assets', exact: false, show: isAdmin || isMod },
    { to: '/scan', icon: ScanLine, label: 'Scan', exact: false, isAction: true },
    { to: '/maintenance', icon: Wrench, label: 'Maint.', exact: false, show: can('maintenance') },
    { to: '#more', icon: MoreHorizontal, label: 'More', exact: false, action: () => setShowMobileMore(true) },
  ].filter(item => item.show !== false)

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-bg-1 font-sans text-text-0 selection:bg-accent/20 transition-colors duration-300`} data-theme={darkMode ? 'dark' : 'light'}>

      {/* ── Sidebar (Tablet & Desktop) ── */}
      <aside
        className={`hidden md:flex flex-col border-r shadow-sm shrink-0 h-screen z-30 transition-all duration-200 ease-in-out ${
          sidebarCollapsed ? 'w-[64px] min-w-[64px]' : 'w-[240px] min-w-[240px]'
        }`}
        style={{ backgroundColor: '#142d3a', borderColor: '#1e3848' }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center h-14 px-5 border-b shrink-0" style={{ borderColor: '#1e3848' }}>
          <div className="flex items-center gap-2 overflow-hidden">
            {!sidebarCollapsed ? (
              <div className="font-bold text-lg tracking-wide whitespace-nowrap text-white">
                <span style={{ fontFamily: '"Stencil Becker Solid", "Stencil", sans-serif', letterSpacing: '0.05em' }}>STRONGBUILT</span> <span className="opacity-60 text-sm">/ EAM</span>
              </div>
            ) : (
              <div className="font-bold text-lg tracking-wide w-full text-center text-white">
                <span style={{ fontFamily: '"Stencil Becker Solid", "Stencil", sans-serif', letterSpacing: '0.05em' }}>S</span><span className="opacity-60">E</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar flex flex-col gap-6">
          {NAV_GROUPS.map((group, idx) => {
            const visibleItems = group.items.filter(i => i.show)
            if (visibleItems.length === 0) return null
            return (
              <div key={idx} className="flex flex-col">
                {!sidebarCollapsed && (
                  <h4 className="px-3 text-[11px] tracking-wider uppercase mb-1.5" style={{ color: '#647582' }}>
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
                      className={`flex items-center gap-2 px-3 py-[6px] rounded-[4px] text-[13px] font-medium transition-colors
                        ${active ? 'text-white' : 'text-[#9eb1bc] hover:bg-[#1b3b4b] hover:text-white'}
                      `}
                      style={active ? { backgroundColor: '#147d92' } : {}}
                    >
                      <span className="w-3 flex justify-center shrink-0">
                        {active ? '▸' : ''}
                      </span>
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t flex flex-col gap-1 shrink-0" style={{ borderColor: '#1e3848' }}>
          <button
            onClick={() => setSidebarCollapsed(value => !value)}
            className={`hidden lg:flex items-center gap-3 p-2 rounded text-[#9eb1bc] hover:bg-[#1b3b4b] hover:text-white transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!sidebarCollapsed && <span className="text-[12px]">Collapse sidebar</span>}
          </button>
          <button
            onClick={() => setEditingProfile(true)}
            className={`flex items-center gap-3 p-2 rounded text-[#9eb1bc] hover:bg-[#1b3b4b] hover:text-white transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <div className="w-7 h-7 rounded-full bg-[#147d92] text-white flex items-center justify-center text-xs shrink-0">{(profile?.full_name || 'U')[0].toUpperCase()}</div>
            {!sidebarCollapsed && <span className="text-[12px] truncate">{profile?.full_name || 'Profile'}</span>}
          </button>
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 p-2 rounded text-[#9eb1bc] hover:bg-[#1b3b4b] hover:text-white transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={18} />
            {!sidebarCollapsed && <span className="text-[12px]">Sign out</span>}
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
              <span className="font-bold text-[15px] tracking-wide text-text-0 shrink-0" style={{ fontFamily: '"Stencil Becker Solid", "Stencil", sans-serif', letterSpacing: '0.05em' }}>
                STRONGBUILT
              </span>
              <span className="text-[15px] font-medium text-text-2 truncate tracking-tight">{mobileTitle}</span>
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


