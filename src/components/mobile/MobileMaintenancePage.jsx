import React, { useState } from 'react'
import { Plus, Search, QrCode, Filter, AlertTriangle, Calendar, ClipboardCheck, ArrowRight, CheckCircle2, MapPin } from 'lucide-react'
import MobilePageHeader from './MobilePageHeader'
import MobileEmptyState from './MobileEmptyState'
import MobileCard from './MobileCard'
import MobileMaintenanceCard from './MobileMaintenanceCard'
import MobileSearchBar from './MobileSearchBar'
import MobileActionSheet from './MobileActionSheet'

const S = {
  open: { color: 'var(--status-danger)', label: 'Open' },
  assigned: { color: '#06b6d4', label: 'Assigned' },
  working: { color: '#0ea5e9', label: 'In Progress' },
  resolved: { color: '#22c55e', label: 'Resolved' },
  scheduled: { color: '#0ea5e9', label: 'Scheduled' },
}

const P = { 
  critical: { color: 'var(--status-danger)', label: 'Critical' }, 
  high: { color: 'var(--status-danger)', label: 'High' }, 
  medium: { color: '#0ea5e9', label: 'Medium' }, 
  normal: { color: '#0ea5e9', label: 'Normal' }, 
  low: { color: '#22c55e', label: 'Low' } 
}

const StatusDot = ({ status }) => (
  <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: S[status?.toLowerCase()]?.color || '#9AA0A6' }} />
)

export default function MobileMaintenancePage({
  activeTab, setActiveTab,
  loading,
  search, setSearch,
  filteredTickets, filteredSchedules, logs,
  openTicketDetail,
  setShowTicketForm, setShowScheduleForm,
  setLogForm, setShowLogForm,
  setShowQRScanner,
  isAdmin, isMod, can
}) {
  const [showFilters, setShowFilters] = useState(false)
  
  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center pt-20">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-text-3 text-body-medium">Loading maintenance...</p>
      </div>
    )
  }

  const now = new Date()
  const todayStr = now.toDateString()
  const criticalCount = filteredTickets.filter(t => t.priority?.toLowerCase() === 'critical' && t.status !== 'Resolved' && t.status !== 'Closed').length
  const overdueCount = filteredSchedules.filter(s => s.next_due && new Date(s.next_due) < now).length
  const dueTodayCount = filteredSchedules.filter(s => s.next_due && new Date(s.next_due).toDateString() === todayStr).length
  const upcomingCount = filteredSchedules.filter(s => s.next_due && new Date(s.next_due) > now).length

  return (
    <div className="flex flex-col min-h-screen bg-bg-0 pb-28">
      {/* ── Header & Search ── */}
      <div className="bg-bg-1 sticky top-0 z-30 shadow-sm border-b border-border">
        <div className="p-4 pb-2">
          <MobileSearchBar 
            value={search} 
            onChange={setSearch} 
            placeholder="Search tickets, assets, work orders..." 
          />
        </div>
        
        {/* Top Status Strip: CRITICAL, OVERDUE, DUE TODAY, UPCOMING */}
        <div className="px-4 py-2 grid grid-cols-4 gap-2">
          <div className="flex flex-col p-2 bg-rose-50 border border-rose-200 rounded-lg text-center">
            <span className="text-[9.5px] text-rose-800 uppercase tracking-tight">Critical</span>
            <span className="text-body font-mono text-rose-700 leading-tight mt-0.5">{criticalCount}</span>
          </div>
          <div className="flex flex-col p-2 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <span className="text-[9.5px] text-amber-800 uppercase tracking-tight">Overdue</span>
            <span className="text-body font-mono text-amber-700 leading-tight mt-0.5">{overdueCount}</span>
          </div>
          <div className="flex flex-col p-2 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <span className="text-[9.5px] text-blue-800 uppercase tracking-tight">Due Today</span>
            <span className="text-body font-mono text-blue-700 leading-tight mt-0.5">{dueTodayCount}</span>
          </div>
          <div className="flex flex-col p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
            <span className="text-[9.5px] text-emerald-800 uppercase tracking-tight">Upcoming</span>
            <span className="text-body font-mono text-emerald-700 leading-tight mt-0.5">{upcomingCount}</span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex w-full border-t border-border px-2">
          {[
            { id: 'tickets', label: `Tickets (${filteredTickets.length})` },
            { id: 'schedules', label: `Schedules (${filteredSchedules.length})` },
            { id: 'logs', label: `History Logs (${logs.length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 text-caption  text-center transition-colors border-b-2 ${
                activeTab === t.id ? 'border-accent text-accent' : 'border-transparent text-text-3'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── List Content ── */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {activeTab === 'tickets' && (
          filteredTickets.length === 0 ? (
            <MobileEmptyState icon={AlertTriangle} title="No Tickets" description="No maintenance tickets found." action={() => setShowTicketForm(true)} actionLabel="Create Ticket" />
          ) : (
            filteredTickets.map(t => (
              <MobileMaintenanceCard 
                key={t.id} 
                onClick={() => openTicketDetail(t)} 
                title={t.title}
                assetName={t.assets?.asset_name || 'Equipment'} 
                ticketNo={t.ticket_no}
                priority={t.priority || 'Normal'}
                status={t.status || 'Open'}
                dueDate={t.sla_due_at ? new Date(t.sla_due_at).toLocaleDateString() : 'No SLA'}
                technician={t.profiles?.full_name || t.assigned_to || 'Field Staff'}
              />
            ))
          )
        )}

        {activeTab === 'schedules' && (
          filteredSchedules.length === 0 ? (
            <MobileEmptyState icon={Calendar} title="No Schedules" description="No preventive schedules found." action={() => setShowScheduleForm(true)} actionLabel="Create Schedule" />
          ) : (
            filteredSchedules.map(s => {
              const isOverdue = s.next_due && new Date(s.next_due) < new Date()
              return (
                <MobileMaintenanceCard 
                  key={s.id} 
                  title={s.title} 
                  assetName={s.assets?.asset_name || 'Scheduled Service'} 
                  ticketNo={`PM-${s.frequency || 'SCHED'}`}
                  priority={isOverdue ? 'Critical' : 'Normal'}
                  status={isOverdue ? 'Overdue' : 'Scheduled'}
                  dueDate={s.next_due ? new Date(s.next_due).toLocaleDateString() : 'TBD'}
                  technician={s.assigned_to || 'Auto-assigned'}
                  onClick={() => setShowScheduleForm(s)}
                />
              )
            })
          )
        )}

        {activeTab === 'logs' && (
          logs.length === 0 ? (
            <MobileEmptyState icon={ClipboardCheck} title="No Logs" description="No maintenance logs found." />
          ) : (
            logs.map(l => (
              <MobileCard key={l.id} title={l.assets?.asset_name || 'Asset'}>
                 <div className="flex flex-col gap-1.5 mt-1">
                   <p className="text-small text-text-2 line-clamp-2">{l.work_done}</p>
                   <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                     <span className="text-caption text-text-3 text-body-medium">{new Date(l.performed_at).toLocaleDateString()}</span>
                     <span className="text-small text-text-0 font-mono">${Number(l.cost || 0).toLocaleString()}</span>
                   </div>
                 </div>
              </MobileCard>
            ))
          )
        )}
      </div>

      {/* ── FAB Add Button ── */}
      {(isAdmin || isMod || can('add')) && activeTab !== 'logs' && (
        <button
          onClick={() => activeTab === 'tickets' ? setShowTicketForm(true) : setShowScheduleForm(true)}
          className="fixed bottom-[88px] right-4 w-14 h-14 bg-accent text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform z-40"
          aria-label="Add"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Simple Action Sheet for Filters placeholder */}
      <MobileActionSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filter"
        groups={[
          { items: [{ icon: CheckCircle2, label: 'Clear Filters', onClick: () => {} }] }
        ]}
      />
    </div>
  )
}


