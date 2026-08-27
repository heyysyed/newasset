/**
 * PartsUIKit.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Small shared building blocks for the asset Parts surfaces.
 *
 * Everything here leans on the `.pt-*` primitives in src/index.css so the asset
 * Parts tab, the mobile asset detail page and the part-history drawer behave
 * identically on phone, tablet and desktop. No new CSS is introduced.
 */

import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  X, Loader2, History, Package, PackagePlus, PackageMinus, Wrench,
  Trash2, ArrowRightLeft, Ban, Circle, ExternalLink, AlertTriangle,
} from 'lucide-react'
import { STATUS_META } from '../../services/partsService'
import { getComponentLifecycle, getComponentWhereUsed } from '../../services/partsService'
import { formatCurrency } from '../../lib/depreciation'

/* ═══════════════════════════════════════════════════════════════════════════
   FORMATTERS
   ═══════════════════════════════════════════════════════════════════════════ */

export const DASH = '—'

export function dash(value) {
  if (value === null || value === undefined || value === '') return DASH
  return value
}

export function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function money(value) {
  if (value === null || value === undefined || value === '') return DASH
  return formatCurrency(value)
}

export function fmtDate(value) {
  if (!value) return DASH
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return DASH
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(value) {
  if (!value) return DASH
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return DASH
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function fmtDays(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DASH
  if (n < 1) return 'today'
  if (n === 1) return '1 day'
  if (n < 60) return `${n} days`
  const months = Math.floor(n / 30)
  if (months < 24) return `${months} mo`
  return `${Math.floor(n / 365)}y ${Math.floor((n % 365) / 30)}mo`
}

/**
 * Timestamp reader that tolerates the differing column names across the
 * lifecycle tables (component_lifecycle_events.event_time,
 * maintenance_logs.performed_at, asset_movements.moved_at, *.created_at).
 * Deliberately defensive: some shared readers in src/lib/supabase.js still
 * select the wrong column for these tables.
 */
export function rowTimestamp(row) {
  if (!row) return null
  return row.event_time ?? row.performed_at ?? row.moved_at ?? row.created_at ?? null
}

/* ═══════════════════════════════════════════════════════════════════════════
   PILLS / NOTES
   ═══════════════════════════════════════════════════════════════════════════ */

export function StatusPill({ status }) {
  if (!status) return <span className="pt-pill neutral">Unknown</span>
  const meta = STATUS_META[status] || { label: status, tone: 'neutral' }
  return <span className={`pt-pill ${meta.tone}`}>{meta.label}</span>
}

/** RPC error text is already cleaned up by partsService — show it verbatim. */
export function ErrorNote({ error }) {
  if (!error) return null
  const message = typeof error === 'string' ? error : (error.message || String(error))
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '10px 12px', borderRadius: 10,
        background: 'var(--status-danger-soft)',
        border: '1px solid var(--status-danger)',
        color: 'var(--status-danger)',
        fontSize: '0.82rem', lineHeight: 1.45, wordBreak: 'break-word',
      }}
    >
      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 10, padding: '36px 20px', color: 'var(--text-3)',
    }}>
      <Loader2 size={26} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }} />
      {label && <span style={{ fontSize: '0.82rem' }}>{label}</span>}
    </div>
  )
}

/** Label/value pair used inside `.pt-card` rows. */
export function CardField({ label, value, mono, numeric }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="pt-field-label">{label}</div>
      <div
        className={`pt-field-value${numeric ? ' num' : ''}`}
        style={mono ? { fontFamily: 'var(--font-mono)', wordBreak: 'break-all' } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL  ·  centred dialog on desktop, bottom sheet on phone (CSS does it)
   ═══════════════════════════════════════════════════════════════════════════ */

export function PtModal({ title, subtitle, onClose, size, children, footer }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="pt-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`pt-modal${size ? ` ${size}` : ''}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className="pt-modal-head">
          <div style={{ minWidth: 0 }}>
            <h3 className="pt-modal-title">{title}</h3>
            {subtitle && (
              <div style={{
                marginTop: 3, color: 'var(--text-3)', fontSize: '0.78rem',
                wordBreak: 'break-word',
              }}>{subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
            aria-label="Close"
            style={{ padding: '6px 8px', flexShrink: 0 }}
          >
            <X size={17} />
          </button>
        </div>
        <div className="pt-modal-body">{children}</div>
        {footer && <div className="pt-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION SHELL
   ═══════════════════════════════════════════════════════════════════════════ */

const TONE_COLOR = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  danger: 'var(--status-danger)',
  info: 'var(--status-info)',
  neutral: 'var(--text-3)',
}

export function PartsSection({ title, icon: Icon, tone = 'neutral', count, hint, actions, children }) {
  const color = TONE_COLOR[tone] || TONE_COLOR.neutral
  const isDanger = tone === 'danger'
  return (
    <section
      style={{
        background: 'var(--bg-2)',
        border: `1.5px solid ${isDanger ? 'var(--status-danger)' : 'var(--border)'}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: 'var(--clay-shadow-sm)',
        overflow: 'hidden',
      }}
    >
      <div className="pt-section-head">
        <h3 className="pt-section-title" style={{ color, minWidth: 0 }}>
          {Icon && <Icon size={16} style={{ flexShrink: 0 }} />}
          <span style={{ wordBreak: 'break-word' }}>{title}</span>
          {count !== undefined && count !== null && (
            <span className={`pt-pill ${isDanger ? 'danger' : 'neutral'}`}>{count}</span>
          )}
        </h3>
        {actions}
      </div>
      {hint && (
        <p style={{
          margin: '-4px 0 12px', color: 'var(--text-3)',
          fontSize: '0.78rem', lineHeight: 1.5,
        }}>{hint}</p>
      )}
      {children}
    </section>
  )
}

export function EmptyBlock({ title, hint }) {
  return (
    <div className="pt-empty">
      <Package size={22} style={{ opacity: 0.5 }} />
      <div className="pt-empty-title">{title}</div>
      {hint && <div className="pt-empty-hint">{hint}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   PART HISTORY  ·  "this part has been used in this laptop" trail
   ═══════════════════════════════════════════════════════════════════════════ */

const EVENT_META = {
  RECEIVED: { icon: PackagePlus, tone: 'success', label: 'Received into stock' },
  INSTALLED: { icon: Wrench, tone: 'info', label: 'Installed' },
  REMOVED: { icon: PackageMinus, tone: 'warning', label: 'Removed' },
  REPLACED: { icon: ArrowRightLeft, tone: 'info', label: 'Replaced' },
  SCRAPPED: { icon: Trash2, tone: 'danger', label: 'Scrapped' },
  DISPOSED: { icon: Trash2, tone: 'danger', label: 'Disposed' },
  LOST: { icon: Ban, tone: 'danger', label: 'Reported lost' },
  WRITTEN_OFF: { icon: Ban, tone: 'danger', label: 'Written off' },
  RESERVED: { icon: Package, tone: 'info', label: 'Reserved' },
  UPDATED: { icon: Circle, tone: 'neutral', label: 'Details updated' },
}

function eventMeta(type) {
  return EVENT_META[type] || { icon: Circle, tone: 'neutral', label: type || 'Event' }
}

/**
 * Full history for one serialized part: every asset it has lived in
 * (v_part_where_used) plus the immutable event trail
 * (component_lifecycle_events). Rendered with the `.pt-timeline` primitives.
 */
export function PartHistoryModal({ component, onClose }) {
  const componentId = component?.component_id || component?.id
  const serial = component?.serial_number
  const name = component?.part_name || component?.name

  const whereUsedQ = useQuery({
    queryKey: ['part-where-used', componentId],
    queryFn: () => getComponentWhereUsed(componentId),
    enabled: !!componentId,
  })

  const lifecycleQ = useQuery({
    queryKey: ['component-lifecycle', componentId],
    queryFn: () => getComponentLifecycle(componentId),
    enabled: !!componentId,
  })

  const episodes = whereUsedQ.data || []
  const events = lifecycleQ.data || []
  const loading = whereUsedQ.isPending || lifecycleQ.isPending
  const loadError = whereUsedQ.error || lifecycleQ.error

  return (
    <PtModal
      size="lg"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <History size={17} /> {name || 'Part history'}
        </span>
      }
      subtitle={serial ? `Serial ${serial}` : null}
      onClose={onClose}
      footer={<button type="button" className="btn-ghost" onClick={onClose}>Close</button>}
    >
      {loadError && <div style={{ marginBottom: 14 }}><ErrorNote error={loadError} /></div>}
      {loading && <Spinner label="Loading part history…" />}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* ── Where it has been used ── */}
          <div>
            <h4 className="pt-section-title" style={{ marginBottom: 10 }}>
              <Package size={15} /> Where this part has been used
              <span className="pt-pill neutral">{episodes.length}</span>
            </h4>
            {episodes.length === 0 ? (
              <EmptyBlock
                title="Never installed"
                hint="This part has not been fitted into an asset yet."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {episodes.map(ep => (
                  <div
                    key={ep.installation_id}
                    style={{
                      padding: '12px 14px', background: 'var(--bg-1)',
                      border: '1px solid var(--border)', borderRadius: 12,
                      display: 'flex', flexWrap: 'wrap', gap: 10,
                      alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        flexWrap: 'wrap', marginBottom: 3,
                      }}>
                        {ep.asset_id ? (
                          <Link
                            to={`/assets/${ep.asset_id}`}
                            style={{
                              color: 'var(--accent)', textDecoration: 'none',
                              fontWeight: 600, display: 'inline-flex',
                              alignItems: 'center', gap: 5, wordBreak: 'break-word',
                            }}
                          >
                            {ep.asset_name || ep.asset_code || 'Asset'}
                            <ExternalLink size={12} />
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>
                            {ep.asset_name || 'Unknown asset'}
                          </span>
                        )}
                        <span className={`pt-pill ${ep.is_currently_installed ? 'success' : 'neutral'}`}>
                          {ep.is_currently_installed ? 'Currently installed' : 'Removed'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-3)', fontSize: '0.76rem', lineHeight: 1.6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{dash(ep.asset_code)}</span>
                        {' · '}{fmtDate(ep.installed_at)} → {ep.removed_at ? fmtDate(ep.removed_at) : 'now'}
                        {' · '}{fmtDays(ep.days_installed)}
                        {ep.position ? ` · slot ${ep.position}` : ''}
                        {ep.removal_reason ? ` · ${ep.removal_reason}` : ''}
                        {ep.disposition ? ` · ${ep.disposition}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="pt-field-value num" style={{ fontWeight: 600 }}>
                        {money(ep.purchase_cost)}
                      </div>
                      {ep.book_loss_on_scrap !== null && ep.book_loss_on_scrap !== undefined && (
                        <div style={{ color: 'var(--status-danger)', fontSize: '0.72rem' }}>
                          book loss {money(ep.book_loss_on_scrap)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Immutable event trail ── */}
          <div>
            <h4 className="pt-section-title" style={{ marginBottom: 12 }}>
              <History size={15} /> Full event trail
              <span className="pt-pill neutral">{events.length}</span>
            </h4>
            {events.length === 0 ? (
              <EmptyBlock title="No lifecycle events recorded" />
            ) : (
              <div className="pt-timeline">
                {events.map(ev => {
                  const meta = eventMeta(ev.event_type)
                  const EvIcon = meta.icon
                  const bits = [
                    fmtDateTime(rowTimestamp(ev)),
                    ev.asset?.asset_code ? `Asset ${ev.asset.asset_code}` : null,
                    ev.work_order?.work_order_number ? `WO ${ev.work_order.work_order_number}` : null,
                    ev.performer?.full_name || null,
                  ].filter(Boolean)
                  return (
                    <div className="pt-tl-item" key={ev.id}>
                      <div
                        className="pt-tl-dot"
                        style={{
                          background: `var(--status-${meta.tone === 'neutral' ? 'info' : meta.tone}-soft, var(--bg-3))`,
                          color: TONE_COLOR[meta.tone] || 'var(--text-2)',
                        }}
                      >
                        <EvIcon size={14} />
                      </div>
                      <div className="pt-tl-body">
                        <div className="pt-tl-title">
                          {meta.label}
                          {ev.previous_status && ev.new_status && ev.previous_status !== ev.new_status && (
                            <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>
                              {' '}· {ev.previous_status} → {ev.new_status}
                            </span>
                          )}
                        </div>
                        <div className="pt-tl-meta">
                          {bits.join(' · ')}
                          {ev.reason && <><br />Reason: {ev.reason}</>}
                          {ev.disposition && <><br />Disposition: {ev.disposition}</>}
                          {ev.notes && <><br />{ev.notes}</>}
                          {ev.metadata?.scrap_value !== undefined && (
                            <><br />Scrap value: {money(ev.metadata.scrap_value)}
                              {ev.metadata?.book_loss !== undefined && ` · Book loss: ${money(ev.metadata.book_loss)}`}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </PtModal>
  )
}
