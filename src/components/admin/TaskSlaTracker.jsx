import React, { useState } from 'react'
import {
  ClipboardCheck, Clock, AlertTriangle, CheckCircle2, XCircle, List, LayoutGrid,
  Filter, UserCheck, ShieldAlert, ArrowRight, Play
} from 'lucide-react'

const KANBAN_STAGES = [
  { id: 'pending_checker', label: 'Pending Checker', color: 'var(--status-warning)', bg: 'var(--status-warning-soft)' },
  { id: 'pending_hod',     label: 'Pending HOD',     color: 'var(--status-special)', bg: 'var(--status-special-soft)' },
  { id: 'approved',        label: 'Approved',        color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  { id: 'rejected',        label: 'Rejected',        color: 'var(--status-danger)', bg: 'var(--status-danger-soft)' },
  { id: 'completed',       label: 'Completed',       color: 'var(--status-info)', bg: 'var(--status-info-soft)' },
]

export default function TaskSlaTracker({
  auditAssignments = [],
  onRefresh
}) {
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' | 'list'
  const [selectedStage, setSelectedStage] = useState('all')

  // Sample enriched tasks mapping
  const tasks = auditAssignments.length > 0 ? auditAssignments.map(a => ({
    id: a.id,
    title: `Physical Audit - ${a.site || 'Site Yard'}`,
    stage: a.status === 'completed' ? 'completed' : a.status === 'in_progress' ? 'pending_hod' : 'pending_checker',
    assignedTo: a.assigned_to_profile?.full_name || 'Inspector',
    dueDate: a.due_date || '2026-08-31',
    slaBreached: new Date(a.due_date || '2026-08-31') < new Date(),
    priority: 'HIGH',
  })) : [
    { id: 't1', title: 'Main Yard Hydraulic Pump Audit', stage: 'pending_checker', assignedTo: 'John Doe', dueDate: '2026-08-25', slaBreached: false, priority: 'HIGH' },
    { id: 't2', title: 'North Plant Vehicle Inspection', stage: 'pending_hod', assignedTo: 'Sarah Smith', dueDate: '2026-08-15', slaBreached: true, priority: 'CRITICAL' },
    { id: 't3', title: 'Generator Maintenance Verification', stage: 'approved', assignedTo: 'Mike Taylor', dueDate: '2026-08-20', slaBreached: false, priority: 'MEDIUM' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header & Stats Banner */}
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
        boxShadow: 'var(--clay-shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--status-warning-soft)', border: '1px solid var(--status-warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-warning)' }}>
            <ClipboardCheck size={20} />
          </div>
          <div>
            <h2 style={{ color: 'var(--text-0)', margin: 0 }}>
              TASK & SLA TRACKING COMMAND BOARD
            </h2>
            <p style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>
              Multi-stage approval workflows, audit checking stages, and SLA breach warning automation.
            </p>
          </div>
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
            <button onClick={() => setViewMode('kanban')} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              background: viewMode === 'kanban' ? 'var(--bg-2)' : 'transparent',
              color: viewMode === 'kanban' ? 'var(--text-0)' : 'var(--text-3)',
              }}>
              <LayoutGrid size={13}/> Kanban Board
            </button>
            <button onClick={() => setViewMode('list')} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              background: viewMode === 'list' ? 'var(--bg-2)' : 'transparent',
              color: viewMode === 'list' ? 'var(--text-0)' : 'var(--text-3)',
              }}>
              <List size={13}/> List View
            </button>
          </div>
        </div>
      </div>

      {/* SLA Breach Alert Banner */}
      {tasks.some(t => t.slaBreached) && (
        <div style={{ padding: '10px 16px', borderRadius: 12, background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-soft)', color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: 10, }}>
          <AlertTriangle size={16} />
          <span><strong>SLA Breach Alert:</strong> {tasks.filter(t => t.slaBreached).length} task(s) have breached configured target SLA thresholds and escalated.</span>
        </div>
      )}

      {/* ── View Content ── */}
      {viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {KANBAN_STAGES.map(stage => {
            const stageTasks = tasks.filter(t => t.stage === stage.id)
            return (
              <div key={stage.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: stage.color, letterSpacing: '0.04em' }}>{stage.label.toUpperCase()}</span>
                  <span style={{ padding: '2px 7px', borderRadius: 8, background: stage.bg, color: stage.color }}>{stageTasks.length}</span>
                </div>

                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 280 }}>
                  {stageTasks.map(t => (
                    <div key={t.id} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--clay-shadow-sm)' }}>
                      <div style={{ color: 'var(--text-0)', }}>{t.title}</div>
                      <div style={{ color: 'var(--text-3)', }}>Assigned: <strong>{t.assignedTo}</strong></div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ color: t.slaBreached ? 'var(--red)' : 'var(--text-3)', background: t.slaBreached ? 'var(--status-danger-soft)' : 'var(--bg-3)', padding: '2px 6px', borderRadius: 6, border: t.slaBreached ? '1px solid var(--status-danger-soft)' : 'none' }}>
                          {t.slaBreached ? '⚠️ SLA Breached' : `Due ${t.dueDate}`}
                        </span>
                        <span style={{ color: stage.color, textTransform: 'uppercase' }}>{t.priority}</span>
                      </div>
                    </div>
                  ))}

                  {stageTasks.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-3)', }}>
                      No tasks in {stage.label}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {tasks.map((t, idx) => (
            <div key={t.id} style={{ padding: '14px 18px', borderBottom: idx < tasks.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ color: 'var(--text-0)', }}>{t.title}</div>
                <div style={{ color: 'var(--text-3)', marginTop: 2 }}>Assigned to <strong>{t.assignedTo}</strong> • Due: {t.dueDate}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t.slaBreached && (
                  <span style={{ color: 'var(--red)', background: 'var(--status-danger-soft)', border: '1px solid var(--status-danger-soft)', padding: '2px 8px', borderRadius: 8 }}>
                    SLA Breached
                  </span>
                )}
                <span style={{ padding: '3px 9px', borderRadius: 8, background: KANBAN_STAGES.find(s => s.id === t.stage)?.bg, color: KANBAN_STAGES.find(s => s.id === t.stage)?.color }}>
                  {KANBAN_STAGES.find(s => s.id === t.stage)?.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


