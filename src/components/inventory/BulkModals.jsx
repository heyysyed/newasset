/**
 * BulkModals.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Writes on the bulk track: the SKU catalogue (`bulk_items`) and goods receipt
 * into per-site stock (`bulk_site_stock`, via rpc_receive_bulk_stock).
 *
 * Reorder level lives on the item, and `v_bulk_stock_status.stock_status` derives
 * low stock from it. Nothing here hardcodes a threshold.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Save, PackagePlus, Search } from 'lucide-react'
import {
  upsertBulkItem,
  receiveBulkStock,
  fetchBulkItems,
} from '../../services/partsService'
import { formatCurrency } from '../../lib/depreciation'
import {
  PtModal, ModalActions, ErrorNote, InfoNote, Field, CategoryPicker,
  VendorSelect, SiteField, usePartsInvalidator, fmtQty,
} from './partsUI'

const UNITS = ['pcs', 'nos', 'set', 'box', 'mtr', 'ft', 'kg', 'gm', 'ltr', 'ml', 'roll', 'pkt', 'pair', 'bag']

const EMPTY_ITEM = {
  item_code: '', item_name: '', category: '', part_number: '', manufacturer: '',
  unit: 'pcs', unit_price: '', unit_weight_kg: '', reorder_level: '', min_order_qty: '',
  location_bin: '', preferred_vendor_id: '', notes: '', is_spare_part: true, is_active: true,
}

/* ═════════════════════════════════════════════════════════════════════════════
   SKU CREATE / EDIT
   ═══════════════════════════════════════════════════════════════════════════ */

export function BulkItemModal({ open, onClose, item, onSaved }) {
  const [form, setForm] = useState(EMPTY_ITEM)
  const invalidate = usePartsInvalidator()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const editing = !!item?.item_code

  useEffect(() => {
    if (!open) return
    if (item) {
      setForm({
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        category: item.category || '',
        part_number: item.part_number || '',
        manufacturer: item.manufacturer || '',
        unit: item.unit || 'pcs',
        unit_price: item.unit_price ?? '',
        unit_weight_kg: item.unit_weight_kg ?? '',
        reorder_level: item.reorder_level ?? '',
        min_order_qty: item.min_order_qty ?? '',
        location_bin: item.location_bin || '',
        preferred_vendor_id: item.preferred_vendor_id || '',
        notes: item.notes || '',
        is_spare_part: item.is_spare_part !== false,
        is_active: item.is_active !== false,
      })
    } else {
      setForm(EMPTY_ITEM)
    }
  }, [open, item])

  const mutation = useMutation({
    mutationFn: () => upsertBulkItem(form),
    onSuccess: data => { invalidate(); onSaved?.(data); onClose() },
  })

  return (
    <PtModal
      open={open} onClose={() => !mutation.isPending && onClose()}
      title={editing ? 'Edit stock item' : 'New stock item'} size="lg"
      busy={mutation.isPending}
      subtitle="Quantity-only consumables: cables, thermal paste, screws, oil, filters"
      formId="pt-bulk-item-form"
      onSubmit={e => { e.preventDefault(); mutation.mutate() }}
      footer={<ModalActions onCancel={onClose} formId="pt-bulk-item-form" pending={mutation.isPending} submitLabel={editing ? 'Save changes' : 'Create item'} icon={<Save size={15} />} />}
    >
      <ErrorNote error={mutation.error} />

      <div className="pt-form-grid">
        <Field label="Item code" required hint={editing ? 'Changing this creates a new item.' : 'Unique. Upper-cased automatically.'}>
          <input
            className="inp" required value={form.item_code}
            onChange={e => set('item_code', e.target.value.toUpperCase())}
            placeholder="e.g. CBL-HDMI-2M"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </Field>
        <Field label="Item name" required>
          <input className="inp" required value={form.item_name} onChange={e => set('item_name', e.target.value)} placeholder="e.g. HDMI cable 2m" />
        </Field>
        <Field label="Category">
          <CategoryPicker track="bulk" value={form.category} onChange={v => set('category', v)} />
        </Field>
        <Field label="Unit of measure">
          <input className="inp" list="pt-bulk-units" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="pcs" />
          <datalist id="pt-bulk-units">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
        </Field>
        <Field label="Part number">
          <input className="inp" value={form.part_number} onChange={e => set('part_number', e.target.value)} />
        </Field>
        <Field label="Manufacturer">
          <input className="inp" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} />
        </Field>
        <Field label="Unit price">
          <input className="inp" type="number" min="0" step="0.01" inputMode="decimal" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="0.00" />
        </Field>
        <Field label="Unit weight (kg)">
          <input className="inp" type="number" min="0" step="0.001" inputMode="decimal" value={form.unit_weight_kg} onChange={e => set('unit_weight_kg', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Reorder level" hint="Drives the Low stock flag. Stock at or below this is flagged; zero means out of stock.">
          <input className="inp" type="number" min="0" step="1" inputMode="numeric" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Minimum order qty">
          <input className="inp" type="number" min="0" step="1" inputMode="numeric" value={form.min_order_qty} onChange={e => set('min_order_qty', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Default bin / shelf">
          <input className="inp" value={form.location_bin} onChange={e => set('location_bin', e.target.value)} placeholder="e.g. Rack A · Bin 12" />
        </Field>
        <Field label="Preferred vendor">
          <VendorSelect value={form.preferred_vendor_id} onChange={v => set('preferred_vendor_id', v)} />
        </Field>
        <Field label="Notes" span>
          <textarea className="inp" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', minHeight: 70 }} />
        </Field>
        <div className="span-2" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '0.84rem', color: 'var(--text-1)' }}>
            <input type="checkbox" checked={form.is_spare_part} onChange={e => set('is_spare_part', e.target.checked)} />
            Maintenance may consume this
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: '0.84rem', color: 'var(--text-1)' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Active
          </label>
        </div>
      </div>
    </PtModal>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   RECEIVE STOCK
   ═══════════════════════════════════════════════════════════════════════════ */

/** Item picker used when the receive modal is opened without a pre-chosen SKU. */
function BulkItemPicker({ value, onChange }) {
  const [term, setTerm] = useState('')
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['bulk-items', 'picker'],
    queryFn: () => fetchBulkItems({}),
  })

  const visible = useMemo(() => {
    const s = term.trim().toLowerCase()
    if (!s) return items.slice(0, 60)
    return items.filter(i =>
      (i.item_code || '').toLowerCase().includes(s)
      || (i.item_name || '').toLowerCase().includes(s)
      || (i.part_number || '').toLowerCase().includes(s)).slice(0, 60)
  }, [items, term])

  if (value) {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
        border: '1px solid var(--accent)', background: 'var(--accent-soft)',
        borderRadius: 12, padding: '10px 12px',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>{value.item_name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-3)', wordBreak: 'break-all' }}>
            {value.item_code} · per {value.unit || 'pcs'}
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
        <input className="inp" autoFocus value={term} placeholder="Search item code or name…" onChange={e => setTerm(e.target.value)} style={{ paddingLeft: 32 }} />
      </div>
      <div style={{
        marginTop: 8, maxHeight: 210, overflowY: 'auto', border: '1px solid var(--border)',
        borderRadius: 12, background: 'var(--bg-1)', WebkitOverflowScrolling: 'touch',
      }}>
        {isLoading && <div style={{ padding: 14, fontSize: '0.8rem', color: 'var(--text-3)' }}>Loading items…</div>}
        {!isLoading && visible.length === 0 && (
          <div style={{ padding: 14, fontSize: '0.8rem', color: 'var(--text-3)' }}>No items matched. Create the item first.</div>
        )}
        {visible.map(i => (
          <button
            key={i.id} type="button" onClick={() => onChange(i)}
            style={{
              display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10,
              textAlign: 'left', padding: '10px 12px', minHeight: 44, cursor: 'pointer',
              border: 'none', borderBottom: '1px solid var(--border-subtle)', background: 'none',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-1)', wordBreak: 'break-word' }}>{i.item_name}</span>
              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-3)' }}>{i.item_code}</span>
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', flexShrink: 0 }}>
              {formatCurrency(Number(i.unit_price || 0))}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function ReceiveBulkStockModal({
  open, onClose, item, defaultSite = '', sites = [], userId, onSaved,
}) {
  const [picked, setPicked] = useState(null)
  const [site, setSite] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const invalidate = usePartsInvalidator()

  useEffect(() => {
    if (!open) return
    setPicked(item || null)
    setSite(defaultSite && defaultSite !== 'All' ? defaultSite : '')
    setQuantity('')
    setUnitPrice(item?.unit_price != null ? String(item.unit_price) : '')
    setReference('')
    setNotes('')
  }, [open, item, defaultSite])

  // Pre-fill the price from the SKU when one is chosen inside the modal.
  useEffect(() => {
    if (picked && unitPrice === '' && picked.unit_price != null) setUnitPrice(String(picked.unit_price))
  }, [picked]) // eslint-disable-line react-hooks/exhaustive-deps

  const itemId = picked?.item_id || picked?.id || null

  const mutation = useMutation({
    mutationFn: () => receiveBulkStock({
      itemId, site, quantity, unitPrice, userId, reference, notes,
    }),
    onSuccess: data => { invalidate(); onSaved?.(data); onClose() },
  })

  const lineValue = Number(quantity || 0) * Number(unitPrice || 0)

  return (
    <PtModal
      open={open} onClose={() => !mutation.isPending && onClose()}
      title="Receive stock" busy={mutation.isPending}
      subtitle={picked ? `${picked.item_name} · ${picked.item_code}` : 'Book quantity into a site'}
      formId="pt-bulk-receive-form"
      onSubmit={e => { e.preventDefault(); mutation.mutate() }}
      footer={<ModalActions onCancel={onClose} formId="pt-bulk-receive-form" pending={mutation.isPending} submitLabel="Receive stock" icon={<PackagePlus size={15} />} disabled={!itemId} />}
    >
      <ErrorNote error={mutation.error} />

      <div className="pt-form-grid">
        {!item && (
          <Field label="Item" required span>
            <BulkItemPicker value={picked} onChange={setPicked} />
          </Field>
        )}
        <Field label="Site" required hint="Stock is held per site.">
          <SiteField value={site} onChange={setSite} sites={sites} id="pt-bulk-receive-site" />
        </Field>
        <Field label={`Quantity${picked?.unit ? ` (${picked.unit})` : ''}`} required>
          <input
            className="inp" required type="number" min="0.001" step="any" inputMode="decimal"
            value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0"
          />
        </Field>
        <Field label="Unit price" hint="Blank keeps the item's existing price.">
          <input
            className="inp" type="number" min="0" step="0.01" inputMode="decimal"
            value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00"
          />
        </Field>
        <Field label="Reference" hint="PO, GRN or invoice number.">
          <input className="inp" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. PO-2024-118" />
        </Field>
        <Field label="Notes" span>
          <textarea className="inp" rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical', minHeight: 60 }} />
        </Field>
      </div>

      {Number(quantity || 0) > 0 && (
        <InfoNote>
          Receiving <strong>{fmtQty(quantity)} {picked?.unit || 'pcs'}</strong>
          {site ? <> into <strong>{site}</strong></> : null} · line value {formatCurrency(lineValue)}
        </InfoNote>
      )}
    </PtModal>
  )
}

export { BulkItemPicker }
