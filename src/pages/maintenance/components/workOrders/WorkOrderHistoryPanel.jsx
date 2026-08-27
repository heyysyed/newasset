/**
 * WorkOrderHistoryPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The audit trail for one work order, read from `maintenance_audit_events` via
 * getWorkOrderAudit(). This replaces the "Work Order audit log will appear here"
 * placeholder that shipped in the drawer.
 *
 * The table is append-only and protected by a trigger, so what is rendered here
 * is exactly what happened, in the order it happened. Nothing in this file
 * writes — it is a read-only record.
 */

import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Boxes, Package, PackageMinus, ArrowRightLeft, CheckCircle2, Clock,
  FileText, History, User, RotateCcw, ShieldAlert, Trash2, PlayCircle,
} from 'lucide-react'
import { getWorkOrderAudit } from '../../../../services/partsService'
import { PARTS_KEYS, ErrorNote, Spinner, EmptyState, fmtDateTime, fmtQty } from '../../../../components/inventory/partsUI'
import { money, num, dash } from '../parts/PartPickers'

/* ═════════════════════════════════════════════════════════════════════════════
   ACTION VOCABULARY
   Known actions get a human sentence and an icon. Anything the database starts
   writing later still renders — snake_case is humanised rather than dropped, so
   a new RPC never leaves a blank line in the history.
   ═══════════════════════════════════════════════════════════════════════════ */
const ACTION_META = {
  created: { label: 'Work order created', icon: FileText, tone: 'info' },
  status_change: { label: 'Status changed', icon: ArrowRightLeft, tone: 'info' },
  status_changed: { label: 'Status changed', icon: ArrowRightLeft, tone: 'info' },
  assigned: { label: 'Assigned', icon: User, tone: 'info' },
  reassigned: { label: 'Reassigned', icon: User, tone: 'info' },
  started: { label: 'Work started', icon: PlayCircle, tone: 'info' },
  completed: { label: 'Work completed', icon: CheckCircle2, tone: 'success' },
  closed: { label: 'Work order closed', icon: CheckCircle2, tone: 'success' },
  cancelled: { label: 'Work order cancelled', icon: Trash2, tone: 'danger' },
  approved: { label: 'Approved', icon: CheckCircle2, tone: 'success' },
  rejected: { label: 'Rejected', icon: ShieldAlert, tone: 'danger' },
  on_hold: { label: 'Put on hold', icon: Clock, tone: 'warning' },
  part_consumed: { label: 'Consumable booked', icon: Boxes, tone: 'success' },
  part_returned: { label: 'Consumable returned to stock', icon: RotateCcw, tone: 'neutral' },
  component_installed: { label: 'Part installed', icon: Package, tone: 'info' },
  component_removed: { label: 'Part removed', icon: PackageMinus, tone: 'warning' },
  component_replaced: { label: 'Part replaced', icon: ArrowRightLeft, tone: 'info' },
  work_logged: { label: 'Work logged', icon: FileText, tone: 'neutral' },
  cost_updated: { label: 'Cost updated', icon: FileText, tone: 'neutral' },
}

const humanise = action => String(action || 'Event')
  .replace(/_/g, ' ')
  .replace(/^./, ch => ch.toUpperCase())

const TONE_COLORS = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  danger: 'var(--status-danger)',
  info: 'var(--status-info)',
  neutral: 'var(--text-2)',
}

const TONE_BACKGROUNDS = {
  success: 'var(--status-success-soft)',
  warning: 'var(--status-warning-soft)',
  danger: 'var(--status-danger-soft)',
  info: 'var(--status-info-soft)',
  neutral: 'var(--bg-3)',
}

/* ═════════════════════════════════════════════════════════════════════════════
   PAYLOAD → SENTENCE
   The RPCs store their detail as jsonb. Rather than dumping raw JSON at the
   technician, pull out the fields that mean something and phrase them.
   ═══════════════════════════════════════════════════════════════════════════ */

function describe(event) {
  const nv = event.new_value || {}
  const ov = event.old_value || {}
  const md = event.metadata || {}

  switch (event.action) {
    case 'part_consumed': {
      const qty = `${fmtQty(nv.quantity)}${nv.unit ? ` ${nv.unit}` : ''}`
      const parts = [
        `${qty} of ${dash(nv.item_name)}`,
        nv.site ? `from ${nv.site}` : null,
        num(nv.total_cost) ? `· ${money(nv.total_cost)}` : null,
      ].filter(Boolean)
      return parts.join(' ')
    }
    case 'component_installed':
      return [dash(nv.part_name || nv.name), nv.serial_number, nv.position && `slot ${nv.position}`]
        .filter(Boolean).join(' · ')
    case 'component_removed':
    case 'component_replaced':
      return [
        dash(ov.part_name || ov.name || nv.part_name),
        nv.disposition && `→ ${nv.disposition}`,
        nv.reason,
      ].filter(Boolean).join(' · ')
    case 'status_change':
    case 'status_changed':
      if (ov.status || nv.status) return `${dash(ov.status)} → ${dash(nv.status)}`
      break
    default:
      break
  }

  /* Generic fallback: show whichever human-readable scalars we were given. */
  const bits = []
  const push = (label, value) => {
    if (value === null || value === undefined || value === '') return
    if (typeof value === 'object') return
    bits.push(`${label}: ${value}`)
  }
  Object.keys(nv).forEach(k => push(k.replace(/_/g, ' '), nv[k]))
  if (!bits.length) Object.keys(md).forEach(k => push(k.replace(/_/g, ' '), md[k]))
  return bits.slice(0, 4).join(' · ')
}

/* ═════════════════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WorkOrderHistoryPanel({ workOrderId, createdAt, createdByName }) {
  const auditQ = useQuery({
    // Prefixed with the parts keys so a parts write already refreshes the trail.
    queryKey: [...PARTS_KEYS.workOrderParts, workOrderId, 'audit'],
    queryFn: () => getWorkOrderAudit(workOrderId),
    enabled: !!workOrderId,
  })

  const events = auditQ.data || []

  /**
   * The RPCs only started writing audit rows in migration 004, so a work order
   * created before that has an empty trail. Synthesising the creation event from
   * the row's own created_at means the timeline is never completely blank.
   */
  const timeline = useMemo(() => {
    const list = events.map(e => ({
      id: e.id,
      action: e.action,
      at: e.created_at,
      actor: e.actor?.full_name,
      detail: describe(e),
    }))
    const hasCreation = list.some(e => e.action === 'created')
    if (!hasCreation && createdAt) {
      list.push({
        id: 'synthetic-created',
        action: 'created',
        at: createdAt,
        actor: createdByName,
        detail: 'Recorded from the work order itself — audit events began with the parts release.',
      })
    }
    return list
  }, [events, createdAt, createdByName])

  if (!workOrderId) {
    return (
      <EmptyState
        icon={History}
        title="No history yet"
        hint="The audit trail starts as soon as the work order is saved."
      />
    )
  }

  if (auditQ.isPending) return <Spinner label="Loading the audit trail…" />

  if (auditQ.error) {
    return (
      <div>
        <ErrorNote error={auditQ.error} />
        <button type="button" className="btn-ghost" onClick={() => auditQ.refetch()}>
          <RotateCcw size={13} /> Retry
        </button>
      </div>
    )
  }

  if (!timeline.length) {
    return (
      <EmptyState
        icon={History}
        title="Nothing recorded yet"
        hint="Status changes, parts consumption and approvals all land here automatically. The log is append-only — entries can never be edited or deleted."
      />
    )
  }

  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: '0 0 16px', fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.55 }}>
        Newest first. This log is append-only and enforced by the database, so it
        is the record of what actually happened on this job.
      </p>

      <div className="pt-timeline">
        {timeline.map(item => {
          const meta = ACTION_META[item.action] || { icon: History, tone: 'neutral' }
          const Icon = meta.icon
          return (
            <div className="pt-tl-item" key={item.id}>
              <div
                className="pt-tl-dot"
                style={{
                  background: TONE_BACKGROUNDS[meta.tone] || 'var(--bg-3)',
                  color: TONE_COLORS[meta.tone] || 'var(--text-2)',
                }}
              >
                <Icon size={14} />
              </div>
              <div className="pt-tl-body">
                <div className="pt-tl-title">{meta.label || humanise(item.action)}</div>
                {item.detail ? (
                  <div className="pt-tl-meta" style={{ color: 'var(--text-2)' }}>{item.detail}</div>
                ) : null}
                <div className="pt-tl-meta">
                  {fmtDateTime(item.at)}
                  {item.actor ? ` · ${item.actor}` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
