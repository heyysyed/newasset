import React from 'react'
import { ChevronRight, Shield, Users, Briefcase, Eye, Database, Hash, ClipboardCheck, FileSpreadsheet, History, Trash2, LayoutGrid, UserCog } from 'lucide-react'

export default function MobileAdminMenu({ tabs, currentTab, setTab }) {
  const groups = [
    {
      title: 'Admin',
      items: tabs.filter(t => t.id === 'overview')
    },
    {
      title: 'People & Access',
      items: tabs.filter(t => ['users', 'employees', 'modperms', 'useraccess'].includes(t.id))
    },
    {
      title: 'Asset Configuration',
      items: tabs.filter(t => ['fields', 'custom', 'qrconfig'].includes(t.id))
    },
    {
      title: 'Operations & Security',
      items: tabs.filter(t => ['tracking', 'reports', 'logs', 'trash'].includes(t.id))
    }
  ]

  return (
    <div className="flex flex-col min-h-screen bg-bg-0 pb-28">
      {/* Header Banner */}
      <div className="p-4 bg-bg-1 border-b border-border mb-3">
        <h1 className="text-body text-text-0 m-0 tracking-tight">Admin Control Center</h1>
        <p className="text-caption text-text-3 m-0 mt-0.5 text-body-medium">Administration & system configuration</p>
      </div>

      <div className="px-4 flex flex-col gap-4">
        {groups.map((group, gIdx) => {
          if (group.items.length === 0) return null
          return (
            <div key={gIdx} className="flex flex-col gap-1.5">
              <h3 className="text-[11px] text-text-3 tracking-wider uppercase px-1 m-0">
                {group.title}
              </h3>
              <div className="bg-bg-1 border border-border rounded-xl divide-y divide-border overflow-hidden shadow-sm">
                {group.items.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className="w-full flex items-center justify-between p-3.5 bg-bg-1 hover:bg-bg-2 active:bg-bg-3 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 border border-accent/20">
                        <t.icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[13.5px] text-text-0 block leading-tight truncate">
                          {t.label}
                        </span>
                        <span className="text-[11px] text-text-3 block mt-0.5 truncate">
                          {t.desc || `Manage ${t.label.toLowerCase()}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.count !== null && t.count > 0 && (
                        <span className="text-[11px] font-mono text-text-1 bg-bg-0 px-2 py-0.5 rounded-md border border-border">
                          {t.count}
                        </span>
                      )}
                      <ChevronRight size={16} className="text-text-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


