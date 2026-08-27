import React from 'react'
import { Calendar, User, Wrench, AlertTriangle, ChevronRight, Eye, Tag } from 'lucide-react'

const PRIORITY_BADGES = {
  critical: { bg: 'bg-rose-50 text-rose-800 border-rose-200', text: 'Critical' },
  high: { bg: 'bg-orange-50 text-orange-800 border-orange-200', text: 'High' },
  medium: { bg: 'bg-amber-50 text-amber-800 border-amber-200', text: 'Medium' },
  normal: { bg: 'bg-blue-50 text-blue-800 border-blue-200', text: 'Normal' },
  low: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', text: 'Low' },
}

const STATUS_BADGES = {
  open: { bg: 'bg-red-50 text-red-800 border-red-200', label: 'Open' },
  assigned: { bg: 'bg-cyan-50 text-cyan-800 border-cyan-200', label: 'Assigned' },
  working: { bg: 'bg-blue-50 text-blue-800 border-blue-200', label: 'In Progress' },
  resolved: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: 'Resolved' },
  scheduled: { bg: 'bg-purple-50 text-purple-800 border-purple-200', label: 'Scheduled' },
}

export default function MobileMaintenanceCard({
  onClick,
  title,
  assetName,
  ticketNo,
  priority = 'normal',
  status = 'open',
  dueDate,
  technician,
  icon: Icon = Wrench
}) {
  const pBadge = PRIORITY_BADGES[priority.toLowerCase()] || PRIORITY_BADGES.normal
  const sBadge = STATUS_BADGES[status.toLowerCase()] || STATUS_BADGES.open

  return (
    <div
      onClick={onClick}
      className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm active:border-accent transition-colors flex flex-col gap-3 relative cursor-pointer"
    >
      {/* Top: Priority & Status Badges */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px]  border ${pBadge.bg}`}>
          {priority.toUpperCase()}
        </span>

        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px]  border ${sBadge.bg}`}>
          {sBadge.label}
        </span>
      </div>

      {/* Asset Name & Issue Title */}
      <div>
        <div className="font-mono text-caption text-text-3 tracking-wider mb-0.5">
          {ticketNo || 'TICKET'} • {assetName || 'Equipment'}
        </div>
        <h3 className="text-[15px] text-text-0 leading-snug m-0">
          {title}
        </h3>
      </div>

      {/* Metadata: Due Date & Technician */}
      <div className="grid grid-cols-2 gap-2 text-caption text-text-2 py-1.5 border-y border-border-light">
        <div className="flex items-center gap-1.5 truncate">
          <Calendar size={13} className="text-accent shrink-0" />
          <span className="truncate">{dueDate || 'No due date'}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <User size={13} className="text-text-3 shrink-0" />
          <span className="truncate">{technician || 'Unassigned'}</span>
        </div>
      </div>

      {/* Primary [ Open ] Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-bg-0 hover:bg-bg-2 border border-border rounded-lg text-caption text-text-0 active:bg-bg-3 transition-colors"
      >
        <Eye size={14} className="text-accent" />
        <span>Open Ticket</span>
      </button>
    </div>
  )
}


