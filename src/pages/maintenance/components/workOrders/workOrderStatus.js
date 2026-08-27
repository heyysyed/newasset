/**
 * workOrderStatus.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The work order status vocabulary, kept in one place.
 *
 * These nine values are the CHECK constraint on maintenance_work_orders.status
 * (see 002_maintenance_enterprise.sql). The Kanban board previously listed only
 * six of them, so any work order sitting at SCHEDULED, AWAITING_APPROVAL or
 * CANCELLED simply did not appear on the board — and since the dashboard
 * actively queries SCHEDULED and AWAITING_APPROVAL, those were real, live jobs
 * that had become invisible. Everything now reads from this list.
 */

export const WORK_ORDER_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'AWAITING_APPROVAL',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
]

export const STATUS_META = {
  DRAFT: {
    label: 'Draft',
    bg: 'var(--bg-2)', text: 'var(--text-2)', border: 'var(--border)',
  },
  SCHEDULED: {
    label: 'Scheduled',
    bg: 'rgba(8, 145, 178, 0.06)', text: 'var(--status-info)', border: 'rgba(8, 145, 178, 0.22)',
  },
  ASSIGNED: {
    label: 'Assigned',
    bg: 'rgba(59, 130, 246, 0.05)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'rgba(139, 92, 246, 0.05)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.2)',
  },
  ON_HOLD: {
    label: 'On Hold',
    bg: 'rgba(245, 158, 11, 0.05)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.2)',
  },
  AWAITING_APPROVAL: {
    label: 'Awaiting Approval',
    bg: 'rgba(217, 119, 6, 0.06)', text: 'var(--status-warning)', border: 'rgba(217, 119, 6, 0.22)',
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'rgba(34, 197, 94, 0.05)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.2)',
  },
  CLOSED: {
    label: 'Closed',
    bg: 'var(--bg-3)', text: 'var(--text-3)', border: 'var(--border)',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'rgba(220, 38, 38, 0.05)', text: 'var(--status-danger)', border: 'rgba(220, 38, 38, 0.2)',
  },
}

export const statusMeta = status => STATUS_META[status] || {
  label: String(status || 'Unknown').replace(/_/g, ' '),
  bg: 'var(--bg-2)', text: 'var(--text-2)', border: 'var(--border)',
}

/** A finished job. Parts should not keep moving against these. */
export const TERMINAL_STATUSES = ['CLOSED', 'CANCELLED']
