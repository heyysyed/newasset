import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  X, LogOut, Shield, ClipboardCheck,
  Boxes, MapPin, BarChart2, Tag, FileSpreadsheet,
  ChevronRight, Settings, User
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { signOut } from '../../lib/supabase'

export default function MobileMoreMenu({ isOpen, onClose }) {
  const { profile, isAdmin, isMod, can } = useAuth()
  const navigate = useNavigate()

  if (!isOpen) return null

  async function handleSignOut() {
    await signOut()
    onClose()
    navigate('/login')
  }

  const MENU_GROUPS = [
    {
      label: 'Operations',
      items: [
        { to: '/sites', icon: MapPin, label: 'Sites & Locations', show: isAdmin || isMod },
        { to: '/inventory', icon: Boxes, label: 'Inventory', show: can('inventory') },
        { to: '/audit', icon: ClipboardCheck, label: 'Inspections', show: can('audit') || can('checklists') },
      ]
    },
    {
      label: 'Insights & Tools',
      items: [
        { to: '/reports', icon: BarChart2, label: 'Reports & Analytics', show: can('export') },
        { to: '/stickers', icon: Tag, label: 'Print QR Tags', show: can('print_stickers') },
        { to: '/import', icon: FileSpreadsheet, label: 'Import Excel Data', show: can('import') },
      ]
    },
    {
      label: 'System',
      items: [
        { to: '/admin', icon: Shield, label: 'Administration', show: isAdmin },
      ]
    }
  ]

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end lg:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-text-0/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sheet Content */}
      <div 
        className="relative bg-bg-1 w-full h-[88vh] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden" 
        style={{ animation: 'mobileSheetSlideUp 0.28s cubic-bezier(0.16,1,0.3,1)' }}
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
      >
        {/* Handle */}
        <div className="w-full flex justify-center pt-2.5 pb-1 shrink-0 cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-bg-0 shrink-0">
          <h2 className="text-section-title font-display text-text-0 m-0 leading-tight">Menu</h2>
          <button 
            onClick={onClose} 
            className="p-1.5 -mr-1.5 text-text-3 hover:text-text-0 hover:bg-bg-2 rounded-full transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 flex flex-col gap-8 pb-[100px]">
          
          {/* User Profile Summary */}
          <div className="flex items-center gap-4 p-4 bg-bg-0 border border-border rounded-2xl shadow-sm">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent text-section-title border border-accent/20 shrink-0">
              {(profile?.full_name || 'U')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-body text-text-0 truncate">{profile?.full_name || 'User'}</div>
              <div className="text-small text-text-3 truncate capitalize">{profile?.role || 'User'}</div>
            </div>
          </div>

          {MENU_GROUPS.map((group, idx) => {
            const visibleItems = group.items.filter(i => i.show)
            if (visibleItems.length === 0) return null
            return (
              <div key={idx}>
                <h4 className="text-[12px] tracking-wider text-text-3 uppercase mb-3 px-2">{group.label}</h4>
                <div className="flex flex-col gap-2.5">
                  {visibleItems.map(item => (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={onClose}
                      className="flex items-center gap-4 px-4 bg-bg-0 border border-border rounded-xl active:scale-[0.98] transition-transform text-text-0 no-underline shadow-sm"
                      style={{ minHeight: 56 }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-bg-2 flex items-center justify-center text-accent shrink-0">
                        <item.icon size={20} />
                      </div>
                      <span className="flex-1 text-[0.95rem]">{item.label}</span>
                      <ChevronRight size={18} className="text-text-3" />
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}

          <div className="mt-2 pt-6 border-t border-border">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-3 px-4 bg-danger-subtle border border-danger/20 rounded-xl text-danger active:scale-[0.98] transition-transform"
              style={{ minHeight: 56 }}
            >
              <LogOut size={20} />
              <span className="text-[0.95rem]">Sign Out</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}


