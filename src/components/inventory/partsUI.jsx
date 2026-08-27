/**
 * partsUI.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared presentation primitives for the parts / inventory surfaces.
 *
 * Everything here is a thin wrapper over the `.pt-*` classes in src/index.css so
 * the Inventory page, the serialized track, the bulk track and the component
 * detail view behave identically on phone, tablet and desktop. No new CSS is
 * invented here on purpose — see docs/PARTS_INTEGRATION_CONTRACT.md §6.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Plus, AlertCircle, Search, Check } from 'lucide-react'
import {
  STATUS_META,
  fetchPartCategories,
  createPartCategory,
  fetchVendorsLite,
  fetchAssetsLite,
} from '../../services/partsService'

/* ═════════════════════════════════════════════════════════════════════════════
   QUERY KEYS  ·  stable prefixes so Asset + Maintenance pages refresh too
   ═══════════════════════════════════════════════════════════════════════════ */

export const PARTS_KEYS = {
  serialized: ['serialized-components'],
  bulkStock: ['bulk-stock'],
  bulkItems: ['bulk-items'],
  assetComponents: ['asset-components'],
  assetCost: ['asset-cost'],
  stats: ['parts-stats'],
  categories: ['part-categories'],
  whereUsed: ['part-where-used'],
  lifecycle: ['component-lifecycle'],
  workOrderParts: ['work-order-parts'],
}

/**
 * Invalidate every surface a parts mutation can touch. React Query v5 requires
 * the object form — `invalidateQueries(['x'])` silently no-ops.
 */
export function usePartsInvalidator() {
  const qc = useQueryClient()
  return function invalidateParts(extra = []) {
    const keys = [
      PARTS_KEYS.serialized,
      PARTS_KEYS.bulkStock,
      PARTS_KEYS.bulkItems,
      PARTS_KEYS.assetComponents,
      PARTS_KEYS.assetCost,
      PARTS_KEYS.stats,
      PARTS_KEYS.whereUsed,
      PARTS_KEYS.lifecycle,
      PARTS_KEYS.workOrderParts,
      ...extra,
    ]
    keys.forEach(queryKey => qc.invalidateQueries({ queryKey }))
  }
}

/* ═════════════════════════════════════════════════════════════════════════════
   FORMATTERS
   ═══════════════════════════════════════════════════════════════════════════ */

export const fmtQty = n =>
  Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })

export function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

/* ═════════════════════════════════════════════════════════════════════════════
   MODAL  ·  centred dialog on desktop, bottom sheet on phone (CSS does it)
   ═══════════════════════════════════════════════════════════════════════════ */

export function PtModal({
  open = true, title, subtitle, size = '', onClose, children, footer,
  busy = false, formId, onSubmit,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = e => { if (e.key === 'Escape' && !busy) onClose?.() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, busy, onClose])

  if (!open) return null

  const body = onSubmit
    ? <form id={formId} className="pt-modal-body" onSubmit={onSubmit} noValidate>{children}</form>
    : <div className="pt-modal-body">{children}</div>

  return createPortal(
    <div
      className="pt-modal-backdrop"
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose?.() }}
    >
      <div className={`pt-modal ${size}`} role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
        <div className="pt-modal-head">
          <div style={{ minWidth: 0 }}>
            <h3 className="pt-modal-title">{title}</h3>
            {subtitle && (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-3)', marginTop: 3, wordBreak: 'break-word' }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button" className="btn-icon btn-secondary" onClick={onClose} disabled={busy}
            aria-label="Close"
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
        {body}
        {footer && <div className="pt-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Standard modal footer pair. `pending` comes from a v5 mutation (`isPending`). */
export function ModalActions({ onCancel, formId, pending, submitLabel = 'Save', icon, disabled, danger }) {
  return (
    <>
      <button type="button" className="btn-ghost" onClick={onCancel} disabled={pending}>Cancel</button>
      <button
        type="submit" form={formId}
        className={danger ? 'btn-danger' : 'btn-primary'}
        disabled={pending || disabled}
        style={{ display: 'flex', alignItems: 'center', gap: 7 }}
      >
        {pending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
        {pending ? 'Working…' : submitLabel}
      </button>
    </>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   FEEDBACK
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * RPC errors are already cleaned up by partsService (the plpgsql CONTEXT noise is
 * stripped) and they are written to be read by a human. Show them verbatim.
 */
export function ErrorNote({ error }) {
  if (!error) return null
  const msg = typeof error === 'string' ? error : (error.message || String(error))
  return (
    <div
      role="alert"
      style={{
        display: 'flex', gap: 9, alignItems: 'flex-start',
        background: 'var(--status-danger-soft)', color: 'var(--status-danger)',
        border: '1px solid var(--status-danger)', borderRadius: 10,
        padding: '10px 12px', fontSize: '0.82rem', marginBottom: 14,
        lineHeight: 1.45, wordBreak: 'break-word',
      }}
    >
      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{msg}</span>
    </div>
  )
}

export function InfoNote({ children }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-2)',
      marginBottom: 14, lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

export function Spinner({ label = 'Loading…', pad = 60 }) {
  return (
    <div style={{ padding: pad, textAlign: 'center', color: 'var(--text-3)' }}>
      <Loader2 size={26} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      <div style={{ marginTop: 10, fontSize: '0.82rem' }}>{label}</div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="pt-empty">
      {Icon && <Icon size={26} style={{ opacity: 0.5 }} />}
      <div className="pt-empty-title">{title}</div>
      {hint && <div className="pt-empty-hint">{hint}</div>}
      {action}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   PILLS
   ═══════════════════════════════════════════════════════════════════════════ */

export function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status || '—', tone: 'neutral' }
  return <span className={`pt-pill ${meta.tone}`}>{meta.label}</span>
}

/** Tones for `v_bulk_stock_status.stock_status`. Never a hardcoded threshold. */
export const STOCK_STATUS_META = {
  OUT_OF_STOCK: { label: 'Out of stock', tone: 'danger' },
  LOW_STOCK: { label: 'Low stock', tone: 'warning' },
  IN_STOCK: { label: 'In stock', tone: 'success' },
}

export function StockStatusPill({ status }) {
  const meta = STOCK_STATUS_META[status] || { label: status || '—', tone: 'neutral' }
  return <span className={`pt-pill ${meta.tone}`}>{meta.label}</span>
}

/* ═════════════════════════════════════════════════════════════════════════════
   FORM BITS
   ═══════════════════════════════════════════════════════════════════════════ */

export function Field({ label, hint, required, span, children }) {
  return (
    <div className={span ? 'span-2' : undefined} style={{ minWidth: 0 }}>
      <label className="lbl">
        {label}{required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: '0.71rem', color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  )
}

export function LabelValue({ label, children, mono }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="pt-field-label">{label}</div>
      <div
        className="pt-field-value"
        style={mono ? { fontFamily: 'var(--font-mono)', wordBreak: 'break-all' } : undefined}
      >
        {children === null || children === undefined || children === '' ? '—' : children}
      </div>
    </div>
  )
}

/**
 * Category select backed by the `part_categories` table (never localStorage),
 * with an inline "add new" that writes straight through createPartCategory.
 */
export function CategoryPicker({ track = 'serialized', value, onChange, canCreate = true, required }) {
  const qc = useQueryClient()
  const { data: categories = [], isLoading } = useQuery({
    queryKey: [...PARTS_KEYS.categories, track],
    queryFn: () => fetchPartCategories(track),
  })
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Keep a category that exists on the record but not (yet) in the table visible.
  const options = useMemo(() => {
    const names = categories.map(c => c.name)
    if (value && !names.includes(value)) names.unshift(value)
    return names
  }, [categories, value])

  async function saveNew() {
    const clean = draft.trim()
    if (!clean) { setError('Category name is required.'); return }
    setSaving(true); setError(null)
    try {
      const row = await createPartCategory(clean, track)
      await qc.invalidateQueries({ queryKey: PARTS_KEYS.categories })
      onChange(row?.name || clean)
      setAdding(false); setDraft('')
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  if (adding) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="inp" autoFocus value={draft}
            placeholder="e.g. Storage / NVMe"
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNew() } }}
            style={{ flex: '1 1 150px', minWidth: 0 }}
          />
          <button type="button" className="btn-primary" onClick={saveNew} disabled={saving}
            style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />} Add
          </button>
          <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setError(null) }} disabled={saving}
            style={{ padding: '0 12px' }}>
            Cancel
          </button>
        </div>
        {error && (
          <div style={{ color: 'var(--status-danger)', fontSize: '0.75rem', marginTop: 6 }}>
            {typeof error === 'string' ? error : error.message}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select
        className="sel" value={value || ''} required={required}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 0 }}
      >
        <option value="">{isLoading ? 'Loading…' : '— Select category —'}</option>
        {options.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
      {canCreate && (
        <button
          type="button" className="btn-ghost" onClick={() => setAdding(true)}
          title="Add a new category"
          style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
        >
          <Plus size={14} /> New
        </button>
      )}
    </div>
  )
}

export function VendorSelect({ value, onChange, label = '— No vendor —' }) {
  const { data: vendors = [] } = useQuery({ queryKey: ['vendors-lite'], queryFn: fetchVendorsLite })
  return (
    <select className="sel" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">{label}</option>
      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
    </select>
  )
}

/** Site input: pick a known site or type a new one. Works on a 360px screen. */
export function SiteField({ value, onChange, sites = [], id = 'pt-site-list', placeholder = 'e.g. MAIN STORE' }) {
  return (
    <>
      <input
        className="inp" list={id} value={value || ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      <datalist id={id}>
        {sites.map(s => <option key={s} value={s} />)}
      </datalist>
    </>
  )
}

/**
 * Searchable asset picker. Calls fetchAssetsLite({ search }) with a debounce and
 * hands the whole asset row back so callers can inherit its site / location.
 */
export function AssetPicker({ value, onChange, autoFocus }) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  const { data: assets = [], isFetching } = useQuery({
    queryKey: ['assets-lite', debounced],
    queryFn: () => fetchAssetsLite({ search: debounced, limit: 40 }),
    enabled: !value,
  })

  if (value) {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
        border: '1px solid var(--accent)', background: 'var(--accent-soft)',
        borderRadius: 12, padding: '10px 12px',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>
            {value.asset_code} · {value.asset_name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>
            {[value.site, value.location].filter(Boolean).join(' · ') || 'No site recorded'}
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={() => onChange(null)} style={{ padding: '4px 10px', flexShrink: 0 }}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          className="inp" autoFocus={autoFocus} value={term}
          placeholder="Search asset code, name or serial…"
          onChange={e => setTerm(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>
      <div style={{
        marginTop: 8, maxHeight: 210, overflowY: 'auto',
        border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-1)',
        WebkitOverflowScrolling: 'touch',
      }}>
        {isFetching && <div style={{ padding: 14, fontSize: '0.8rem', color: 'var(--text-3)' }}>Searching…</div>}
        {!isFetching && assets.length === 0 && (
          <div style={{ padding: 14, fontSize: '0.8rem', color: 'var(--text-3)' }}>No assets matched.</div>
        )}
        {assets.map(a => (
          <button
            key={a.id} type="button" onClick={() => onChange(a)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
              background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer', minHeight: 44,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.85rem', wordBreak: 'break-word' }}>
              {a.asset_code} · {a.asset_name}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
              {[a.category, a.site, a.location].filter(Boolean).join(' · ')}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Serial / part identity cell shared by the tables and the phone cards. */
export function PartIdentity({ part, onClick }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        background: 'none', border: 'none', padding: 0, textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default', minWidth: 0, width: '100%',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>
        {part.name || 'Unnamed part'}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-3)', wordBreak: 'break-all' }}>
        SN {part.serial_number || '—'}
      </div>
    </button>
  )
}
