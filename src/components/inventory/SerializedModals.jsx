/**
 * SerializedModals.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Every write on the serialized track. Each modal calls exactly one partsService
 * function, which calls exactly one atomic RPC. No multi-step browser mutations —
 * see docs/PARTS_INTEGRATION_CONTRACT.md §2.
 *
 * Receive · Install · Remove · Replace · Scrap · Edit purchase record
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  PackagePlus, Wrench, ArrowDownToLine, Repeat, Trash2, Save, Search,
} from 'lucide-react'
import {
  DISPOSITIONS,
  dispositionToStatus,
  isTerminal,
  receiveComponent,
  installComponent,
  removeComponent,
  replaceComponent,
  scrapComponent,
  updateComponentDetails,
  fetchAvailableComponents,
  fetchOpenWorkOrdersForAsset,
} from '../../services/partsService'
import { formatCurrency } from '../../lib/depreciation'
import {
  PtModal, ModalActions, ErrorNote, InfoNote, Field, StatusPill,
  CategoryPicker, VendorSelect, SiteField, AssetPicker, usePartsInvalidator,
  fmtDate,
} from './partsUI'

/* ═════════════════════════════════════════════════════════════════════════════
   SHARED
   ═══════════════════════════════════════════════════════════════════════════ */

const CONDITIONS = ['New', 'Refurbished', 'Used — good', 'Used — fair', 'Faulty']

/**
 * `serialized_components` has no `condition` column and rpc_receive_component
 * does not accept one, so the condition is recorded as the first line of the
 * part's notes rather than silently dropped.
 */
function composeNotes(condition, notes) {
  const parts = []
  if (condition) parts.push(`Condition on receipt: ${condition}`)
  if (notes && notes.trim()) parts.push(notes.trim())
  return parts.length ? parts.join('\n') : null
}

/** Work order / ticket selector. The RPC resolves a ticket id to its work order. */
function WorkOrderSelect({ assetId, value, onChange }) {
  const { data: workOrders = [] } = useQuery({
    queryKey: ['open-work-orders', assetId],
    queryFn: () => fetchOpenWorkOrdersForAsset(assetId),
    enabled: !!assetId,
  })
  if (!assetId) {
    return <select className="sel" disabled><option>Pick an asset first</option></select>
  }
  return (
    <select className="sel" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">— Not linked to a work order —</option>
      {workOrders.map(wo => (
        <option key={wo.id} value={wo.id}>
          {wo.work_order_number || 'WO'} · {wo.status}
          {wo.description ? ` · ${String(wo.description).slice(0, 40)}` : ''}
        </option>
      ))}
    </select>
  )
}

/** Disposition select + the scrap-value input it reveals. */
function DispositionFields({ disposition, onDisposition, scrapValue, onScrapValue, purchaseCost }) {
  const meta = DISPOSITIONS.find(d => d.value === disposition)
  const needsValue = !!meta?.needsScrapValue
  const loss = Number(purchaseCost || 0) - Number(scrapValue || 0)

  return (
    <>
      <Field label="What happens to this part?" required>
        <select className="sel" value={disposition} onChange={e => onDisposition(e.target.value)}>
          {DISPOSITIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </Field>
      {needsValue ? (
        <Field label="Scrap value recovered" hint="What the scrap dealer paid. Enter 0 if nothing was recovered.">
          <input
            className="inp" type="number" min="0" step="0.01" inputMode="decimal"
            value={scrapValue} onChange={e => onScrapValue(e.target.value)}
            placeholder="0.00"
          />
        </Field>
      ) : <div />}
      {needsValue && (
        <div className="span-2">
          <div className="pt-cost-rows">
            <div className="pt-cost-row">
              <span>Purchase cost</span><span>{formatCurrency(Number(purchaseCost || 0))}</span>
            </div>
            <div className="pt-cost-row">
              <span>Scrap value recovered</span><span>{formatCurrency(Number(scrapValue || 0))}</span>
            </div>
            <div className="pt-cost-row total">
              <span>Book loss</span><span>{formatCurrency(loss)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Radio-style picker over installable parts, filtered to a category by default. */
function AvailablePartPicker({ category, value, onChange, excludeId }) {
  const [onlySameCategory, setOnlySameCategory] = useState(!!category)
  const [term, setTerm] = useState('')

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['serialized-components', 'available', onlySameCategory ? category : 'All'],
    queryFn: () => fetchAvailableComponents({ category: onlySameCategory ? category : 'All' }),
  })

  const visible = useMemo(() => {
    const s = term.trim().toLowerCase()
    return parts
      .filter(p => p.id !== excludeId)
      .filter(p => !s
        || (p.serial_number || '').toLowerCase().includes(s)
        || (p.name || '').toLowerCase().includes(s)
        || (p.part_number || '').toLowerCase().includes(s))
  }, [parts, term, excludeId])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 0 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            className="inp" value={term} placeholder="Search available parts…"
            onChange={e => setTerm(e.target.value)} style={{ paddingLeft: 32 }}
          />
        </div>
        {category && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.78rem',
            color: 'var(--text-2)', whiteSpace: 'nowrap',
          }}>
            <input
              type="checkbox" checked={onlySameCategory}
              onChange={e => setOnlySameCategory(e.target.checked)}
            />
            Only {category}
          </label>
        )}
      </div>

      <div style={{
        maxHeight: 230, overflowY: 'auto', border: '1px solid var(--border)',
        borderRadius: 12, background: 'var(--bg-1)', WebkitOverflowScrolling: 'touch',
      }}>
        {isLoading && <div style={{ padding: 14, fontSize: '0.8rem', color: 'var(--text-3)' }}>Loading parts…</div>}
        {!isLoading && visible.length === 0 && (
          <div style={{ padding: 14, fontSize: '0.8rem', color: 'var(--text-3)' }}>
            No parts are available in stock{onlySameCategory && category ? ` under "${category}"` : ''}.
            Receive one into stock first.
          </div>
        )}
        {visible.map(p => {
          const active = value?.id === p.id
          return (
            <button
              key={p.id} type="button" onClick={() => onChange(p)}
              style={{
                display: 'flex', width: '100%', gap: 10, textAlign: 'left',
                alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', minHeight: 46, cursor: 'pointer',
                border: 'none', borderBottom: '1px solid var(--border-subtle)',
                background: active ? 'var(--accent-soft)' : 'none',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-1)', wordBreak: 'break-word' }}>
                  {p.name}
                </span>
                <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-3)', wordBreak: 'break-all' }}>
                  SN {p.serial_number} {p.site ? `· ${p.site}` : ''}
                </span>
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-2)', flexShrink: 0 }}>
                {formatCurrency(Number(p.purchase_cost || 0))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   RECEIVE
   ═══════════════════════════════════════════════════════════════════════════ */

const EMPTY_RECEIVE = {
  serial_number: '', name: '', category: '', manufacturer: '', model: '',
  part_number: '', sku: '', purchase_date: '', purchase_cost: '', currency: 'INR',
  vendor_id: '', po_number: '', invoice_number: '', warranty_start: '', warranty_end: '',
  condition: 'New', site: '', unit: 'nos', current_location: '', notes: '',
  included_in_asset_cost: true,
}

export function ReceiveComponentModal({ open, onClose, userId, sites = [], onSaved }) {
  const [form, setForm] = useState(EMPTY_RECEIVE)
  const invalidate = usePartsInvalidator()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { if (open) setForm(EMPTY_RECEIVE) }, [open])

  const mutation = useMutation({
    mutationFn: () => receiveComponent({
      serial_number: form.serial_number,
      name: form.name,
      category: form.category,
      manufacturer: form.manufacturer,
      model: form.model,
      part_number: form.part_number,
      sku: form.sku,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost,
      currency: form.currency,
      vendor_id: form.vendor_id || null,
      po_number: form.po_number,
      invoice_number: form.invoice_number,
      warranty_start: form.warranty_start || null,
      warranty_end: form.warranty_end || null,
      site: form.site,
      unit: form.unit,
      current_location: form.current_location || form.site,
      notes: composeNotes(form.condition, form.notes),
      included_in_asset_cost: form.included_in_asset_cost,
    }, userId),
    onSuccess: data => { invalidate(); onSaved?.(data); onClose() },
  })

  return (
    <PtModal
      open={open} onClose={() => !mutation.isPending && onClose()}
      title="Receive a serialized part" size="lg" busy={mutation.isPending}
      subtitle="Parts with their own serial number: drives, RAM, boards, batteries, motors"
      formId="pt-receive-form"
      onSubmit={e => { e.preventDefault(); mutation.mutate() }}
      footer={<ModalActions onCancel={onClose} formId="pt-receive-form" pending={mutation.isPending} submitLabel="Receive into stock" icon={<PackagePlus size={15} />} />}
    >
      <ErrorNote error={mutation.error} />

      <div className="pt-section-head"><div className="pt-section-title">Identity</div></div>
      <div className="pt-form-grid">
        <Field label="Serial number" required hint="Must be unique across every part.">
          <input
            className="inp" required autoFocus value={form.serial_number}
            onChange={e => set('serial_number', e.target.value)}
            placeholder="e.g. WD-1A2B3C4D"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </Field>
        <Field label="Part name" required>
          <input
            className="inp" required value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. 1TB NVMe SSD"
          />
        </Field>
        <Field label="Category" required>
          <CategoryPicker track="serialized" value={form.category} onChange={v => set('category', v)} required />
        </Field>
        <Field label="Condition" hint="Recorded in the part's notes.">
          <select className="sel" value={form.condition} onChange={e => set('condition', e.target.value)}>
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Manufacturer">
          <input className="inp" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="e.g. Western Digital" />
        </Field>
        <Field label="Model">
          <input className="inp" value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g. SN770" />
        </Field>
        <Field label="Part number">
          <input className="inp" value={form.part_number} onChange={e => set('part_number', e.target.value)} />
        </Field>
        <Field label="SKU">
          <input className="inp" value={form.sku} onChange={e => set('sku', e.target.value)} />
        </Field>
      </div>

      <div className="pt-section-head" style={{ marginTop: 18 }}><div className="pt-section-title">Purchase</div></div>
      <div className="pt-form-grid">
        <Field label="Purchase date">
          <input className="inp" type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
        </Field>
        <Field label="Purchase cost">
          <input
            className="inp" type="number" min="0" step="0.01" inputMode="decimal"
            value={form.purchase_cost} onChange={e => set('purchase_cost', e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Currency">
          <select className="sel" value={form.currency} onChange={e => set('currency', e.target.value)}>
            <option value="INR">INR — Indian Rupee</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="AED">AED — UAE Dirham</option>
            <option value="GBP">GBP — Pound Sterling</option>
          </select>
        </Field>
        <Field label="Vendor">
          <VendorSelect value={form.vendor_id} onChange={v => set('vendor_id', v)} />
        </Field>
        <Field label="PO number">
          <input className="inp" value={form.po_number} onChange={e => set('po_number', e.target.value)} />
        </Field>
        <Field label="Invoice number">
          <input className="inp" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} />
        </Field>
        <Field label="Warranty start">
          <input className="inp" type="date" value={form.warranty_start} onChange={e => set('warranty_start', e.target.value)} />
        </Field>
        <Field label="Warranty expiry">
          <input className="inp" type="date" value={form.warranty_end} onChange={e => set('warranty_end', e.target.value)} />
        </Field>
      </div>

      <div className="pt-section-head" style={{ marginTop: 18 }}><div className="pt-section-title">Storage & costing</div></div>
      <div className="pt-form-grid">
        <Field label="Site">
          <SiteField value={form.site} onChange={v => set('site', v)} sites={sites} id="pt-receive-site" />
        </Field>
        <Field label="Unit">
          <input className="inp" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="nos" />
        </Field>
        <Field label="Location / bin" span>
          <input className="inp" value={form.current_location} onChange={e => set('current_location', e.target.value)} placeholder="e.g. Rack B · Shelf 3" />
        </Field>
        <Field label="Notes" span>
          <textarea className="inp" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', minHeight: 70 }} />
        </Field>
        <div className="span-2">
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-2)' }}>
            <input
              type="checkbox" checked={form.included_in_asset_cost}
              onChange={e => set('included_in_asset_cost', e.target.checked)}
              style={{ marginTop: 3, flexShrink: 0 }}
            />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.84rem', color: 'var(--text-1)' }}>
                Capitalise into the asset's value
              </span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2, lineHeight: 1.45 }}>
                On, this part's cost is added to the combined value of whichever asset it is installed
                into. Off, it is treated as a repair expense and only counts toward cost of ownership.
              </span>
            </span>
          </label>
        </div>
      </div>
    </PtModal>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   INSTALL
   ═══════════════════════════════════════════════════════════════════════════ */

export function InstallComponentModal({ open, onClose, component, userId, onSaved }) {
  const [asset, setAsset] = useState(null)
  const [position, setPosition] = useState('')
  const [workOrderId, setWorkOrderId] = useState('')
  const [location, setLocation] = useState('')
  const invalidate = usePartsInvalidator()

  useEffect(() => {
    if (open) { setAsset(null); setPosition(''); setWorkOrderId(''); setLocation('') }
  }, [open, component?.id])

  // Inherit the asset's own location so the part's whereabouts stay truthful.
  useEffect(() => { if (asset) setLocation(asset.location || asset.site || '') }, [asset])

  const mutation = useMutation({
    mutationFn: () => installComponent({
      componentId: component.id,
      assetId: asset?.id,
      position,
      workOrderId: workOrderId || null,
      userId,
      location,
    }),
    onSuccess: data => { invalidate(); onSaved?.(data); onClose() },
  })

  if (!component) return null
  const blocked = isTerminal(component.status)

  return (
    <PtModal
      open={open} onClose={() => !mutation.isPending && onClose()}
      title="Install part into an asset" busy={mutation.isPending}
      subtitle={`${component.name} · SN ${component.serial_number}`}
      formId="pt-install-form"
      onSubmit={e => { e.preventDefault(); mutation.mutate() }}
      footer={<ModalActions onCancel={onClose} formId="pt-install-form" pending={mutation.isPending} submitLabel="Install part" icon={<Wrench size={15} />} disabled={!asset || blocked} />}
    >
      <ErrorNote error={mutation.error} />
      {blocked && (
        <ErrorNote error={`This part is ${component.status.toLowerCase().replace(/_/g, ' ')} and can never be installed again.`} />
      )}

      <div className="pt-form-grid">
        <Field label="Install into asset" required span>
          <AssetPicker value={asset} onChange={setAsset} autoFocus />
        </Field>
        <Field label="Slot / position" hint="Where in the asset this part sits.">
          <input
            className="inp" value={position} onChange={e => setPosition(e.target.value)}
            placeholder="e.g. Bay 1 / DIMM A2 / Front-left"
          />
        </Field>
        <Field label="Physical location">
          <input className="inp" value={location} onChange={e => setLocation(e.target.value)} placeholder="Inherited from the asset" />
        </Field>
        <Field label="Link to work order" span hint="Optional. Attributes this install to a maintenance job.">
          <WorkOrderSelect assetId={asset?.id} value={workOrderId} onChange={setWorkOrderId} />
        </Field>
      </div>

      {component.included_in_asset_cost !== false && Number(component.purchase_cost || 0) > 0 && asset && (
        <InfoNote>
          {formatCurrency(Number(component.purchase_cost || 0))} will be capitalised into{' '}
          <strong>{asset.asset_code}</strong>&apos;s combined value.
        </InfoNote>
      )}
    </PtModal>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   REMOVE
   ═══════════════════════════════════════════════════════════════════════════ */

export function RemoveComponentModal({ open, onClose, component, userId, onSaved }) {
  const [reason, setReason] = useState('')
  const [disposition, setDisposition] = useState('AVAILABLE')
  const [scrapValue, setScrapValue] = useState('')
  const [workOrderId, setWorkOrderId] = useState('')
  const invalidate = usePartsInvalidator()

  useEffect(() => {
    if (open) { setReason(''); setDisposition('AVAILABLE'); setScrapValue(''); setWorkOrderId('') }
  }, [open, component?.id])

  const mutation = useMutation({
    mutationFn: () => removeComponent({
      componentId: component.id,
      workOrderId: workOrderId || null,
      reason,
      disposition,
      userId,
      newStatus: dispositionToStatus(disposition),
      scrapValue,
    }),
    onSuccess: data => { invalidate(); onSaved?.(data); onClose() },
  })

  if (!component) return null
  const assetId = component.current_asset_id || component.asset?.id

  return (
    <PtModal
      open={open} onClose={() => !mutation.isPending && onClose()}
      title="Remove part from asset" busy={mutation.isPending}
      subtitle={`${component.name} · SN ${component.serial_number}`}
      formId="pt-remove-form"
      onSubmit={e => { e.preventDefault(); mutation.mutate() }}
      footer={<ModalActions onCancel={onClose} formId="pt-remove-form" pending={mutation.isPending} submitLabel="Remove part" icon={<ArrowDownToLine size={15} />} danger={disposition === 'SCRAPPED'} />}
    >
      <ErrorNote error={mutation.error} />

      {component.asset && (
        <InfoNote>
          Currently installed in <strong>{component.asset.asset_code} · {component.asset.asset_name}</strong>
          {component.position ? ` at ${component.position}` : ''}.
        </InfoNote>
      )}

      <div className="pt-form-grid">
        <Field label="Why is it coming out?" required span>
          <textarea
            className="inp" required rows={3} autoFocus value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Drive failed SMART test, repeated read errors"
            style={{ resize: 'vertical', minHeight: 70 }}
          />
        </Field>
        <DispositionFields
          disposition={disposition} onDisposition={setDisposition}
          scrapValue={scrapValue} onScrapValue={setScrapValue}
          purchaseCost={component.purchase_cost}
        />
        <Field label="Link to work order" span>
          <WorkOrderSelect assetId={assetId} value={workOrderId} onChange={setWorkOrderId} />
        </Field>
      </div>
    </PtModal>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   REPLACE  ·  the headline flow: old part out (usually to scrap), new part in
   ═══════════════════════════════════════════════════════════════════════════ */

export function ReplaceComponentModal({ open, onClose, component, userId, onSaved }) {
  const [incoming, setIncoming] = useState(null)
  const [reason, setReason] = useState('')
  const [disposition, setDisposition] = useState('SCRAPPED')
  const [scrapValue, setScrapValue] = useState('')
  const [position, setPosition] = useState('')
  const [workOrderId, setWorkOrderId] = useState('')
  const invalidate = usePartsInvalidator()

  useEffect(() => {
    if (open) {
      setIncoming(null); setReason(''); setDisposition('SCRAPPED')
      setScrapValue(''); setWorkOrderId('')
      setPosition(component?.position || '')
    }
  }, [open, component?.id, component?.position])

  const assetId = component?.current_asset_id || component?.asset?.id || null

  const mutation = useMutation({
    mutationFn: () => replaceComponent({
      oldComponentId: component.id,
      newComponentId: incoming?.id,
      assetId,
      position,
      workOrderId: workOrderId || null,
      reason,
      disposition,
      userId,
      oldNewStatus: dispositionToStatus(disposition),
      scrapValue,
    }),
    onSuccess: data => { invalidate(); onSaved?.(data); onClose() },
  })

  if (!component) return null

  return (
    <PtModal
      open={open} onClose={() => !mutation.isPending && onClose()}
      title="Replace this part" size="lg" busy={mutation.isPending}
      subtitle="The old part comes out and the new one takes its slot, in one atomic step"
      formId="pt-replace-form"
      onSubmit={e => { e.preventDefault(); mutation.mutate() }}
      footer={<ModalActions onCancel={onClose} formId="pt-replace-form" pending={mutation.isPending} submitLabel="Swap parts" icon={<Repeat size={15} />} disabled={!incoming} />}
    >
      <ErrorNote error={mutation.error} />

      {!assetId && (
        <ErrorNote error="This part is not installed in any asset, so there is nothing to replace it in. Install it first, or receive the new part into stock instead." />
      )}

      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', background: 'var(--bg-2)' }}>
          <div className="pt-field-label">Going out</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginTop: 4, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>{component.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-3)', wordBreak: 'break-all' }}>
                SN {component.serial_number}
              </div>
            </div>
            <StatusPill status={component.status} />
          </div>
          {component.asset && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 6 }}>
              In {component.asset.asset_code} · {component.asset.asset_name}
              {component.position ? ` · ${component.position}` : ''}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <Repeat size={17} />
        </div>

        <div style={{
          border: `1px solid ${incoming ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12, padding: '11px 13px',
          background: incoming ? 'var(--accent-soft)' : 'var(--bg-2)',
        }}>
          <div className="pt-field-label">Coming in</div>
          {incoming ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginTop: 4, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>{incoming.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-3)', wordBreak: 'break-all' }}>
                  SN {incoming.serial_number}
                </div>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setIncoming(null)} style={{ padding: '4px 10px', flexShrink: 0 }}>
                Change
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <AvailablePartPicker
                category={component.category} value={incoming}
                onChange={setIncoming} excludeId={component.id}
              />
            </div>
          )}
        </div>
      </div>

      <div className="pt-form-grid">
        <Field label="Why is it being replaced?" required span>
          <textarea
            className="inp" required rows={3} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Hard disk failed, replaced with new NVMe drive"
            style={{ resize: 'vertical', minHeight: 70 }}
          />
        </Field>
        <DispositionFields
          disposition={disposition} onDisposition={setDisposition}
          scrapValue={scrapValue} onScrapValue={setScrapValue}
          purchaseCost={component.purchase_cost}
        />
        <Field label="Slot / position" hint="Blank keeps the outgoing part's slot.">
          <input className="inp" value={position} onChange={e => setPosition(e.target.value)} placeholder={component.position || 'e.g. Bay 1'} />
        </Field>
        <Field label="Link to work order">
          <WorkOrderSelect assetId={assetId} value={workOrderId} onChange={setWorkOrderId} />
        </Field>
      </div>
    </PtModal>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   SCRAP  ·  for parts already out of an asset
   ═══════════════════════════════════════════════════════════════════════════ */

export function ScrapComponentModal({ open, onClose, component, userId, onSaved }) {
  const [reason, setReason] = useState('')
  const [scrapValue, setScrapValue] = useState('')
  const invalidate = usePartsInvalidator()

  useEffect(() => { if (open) { setReason(''); setScrapValue('') } }, [open, component?.id])

  const mutation = useMutation({
    mutationFn: () => scrapComponent({ componentId: component.id, reason, scrapValue, userId }),
    onSuccess: data => { invalidate(); onSaved?.(data); onClose() },
  })

  if (!component) return null
  const installed = component.status === 'INSTALLED'
  const loss = Number(component.purchase_cost || 0) - Number(scrapValue || 0)

  return (
    <PtModal
      open={open} onClose={() => !mutation.isPending && onClose()}
      title="Scrap this part" size="sm" busy={mutation.isPending}
      subtitle={`${component.name} · SN ${component.serial_number}`}
      formId="pt-scrap-form"
      onSubmit={e => { e.preventDefault(); mutation.mutate() }}
      footer={<ModalActions onCancel={onClose} formId="pt-scrap-form" pending={mutation.isPending} submitLabel="Scrap part" icon={<Trash2 size={15} />} danger disabled={installed} />}
    >
      <ErrorNote error={mutation.error} />
      {installed ? (
        <ErrorNote error="This part is still installed in an asset. Remove it first — the Remove dialog can scrap it in the same step." />
      ) : (
        <InfoNote>Scrapping is permanent. The part can never be installed again, and the book loss lands on the scrap register.</InfoNote>
      )}

      <div className="pt-form-grid">
        <Field label="Reason for scrapping" required span>
          <textarea
            className="inp" required rows={3} autoFocus value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Beyond economical repair"
            style={{ resize: 'vertical', minHeight: 70 }}
          />
        </Field>
        <Field label="Scrap value recovered" span>
          <input
            className="inp" type="number" min="0" step="0.01" inputMode="decimal"
            value={scrapValue} onChange={e => setScrapValue(e.target.value)} placeholder="0.00"
          />
        </Field>
      </div>

      <div className="pt-cost-rows">
        <div className="pt-cost-row"><span>Purchase cost</span><span>{formatCurrency(Number(component.purchase_cost || 0))}</span></div>
        <div className="pt-cost-row"><span>Scrap value recovered</span><span>{formatCurrency(Number(scrapValue || 0))}</span></div>
        <div className="pt-cost-row total"><span>Book loss</span><span>{formatCurrency(loss)}</span></div>
      </div>
    </PtModal>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   EDIT PURCHASE RECORD  ·  never touches status
   ═══════════════════════════════════════════════════════════════════════════ */

export function EditComponentModal({ open, onClose, component, sites = [], onSaved }) {
  const [form, setForm] = useState({})
  const invalidate = usePartsInvalidator()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!open || !component) return
    setForm({
      name: component.name || '',
      category: component.category || '',
      manufacturer: component.manufacturer || '',
      model: component.model || '',
      part_number: component.part_number || '',
      purchase_date: component.purchase_date || '',
      purchase_cost: component.purchase_cost ?? '',
      vendor_id: component.vendor_id || '',
      po_number: component.po_number || '',
      invoice_number: component.invoice_number || '',
      warranty_end: component.warranty_end || '',
      site: component.site || '',
      current_location: component.current_location || '',
      notes: component.notes || '',
      included_in_asset_cost: component.included_in_asset_cost !== false,
    })
  }, [open, component])

  const mutation = useMutation({
    mutationFn: () => updateComponentDetails(component.id, form),
    onSuccess: data => { invalidate(); onSaved?.(data); onClose() },
  })

  if (!component) return null

  return (
    <PtModal
      open={open} onClose={() => !mutation.isPending && onClose()}
      title="Edit part details" size="lg" busy={mutation.isPending}
      subtitle={`SN ${component.serial_number} · status is not changed here`}
      formId="pt-edit-form"
      onSubmit={e => { e.preventDefault(); mutation.mutate() }}
      footer={<ModalActions onCancel={onClose} formId="pt-edit-form" pending={mutation.isPending} submitLabel="Save changes" icon={<Save size={15} />} />}
    >
      <ErrorNote error={mutation.error} />
      <div className="pt-form-grid">
        <Field label="Part name" required>
          <input className="inp" required value={form.name || ''} onChange={e => set('name', e.target.value)} />
        </Field>
        <Field label="Category">
          <CategoryPicker track="serialized" value={form.category} onChange={v => set('category', v)} />
        </Field>
        <Field label="Manufacturer">
          <input className="inp" value={form.manufacturer || ''} onChange={e => set('manufacturer', e.target.value)} />
        </Field>
        <Field label="Model">
          <input className="inp" value={form.model || ''} onChange={e => set('model', e.target.value)} />
        </Field>
        <Field label="Part number">
          <input className="inp" value={form.part_number || ''} onChange={e => set('part_number', e.target.value)} />
        </Field>
        <Field label="Vendor">
          <VendorSelect value={form.vendor_id} onChange={v => set('vendor_id', v)} />
        </Field>
        <Field label="Purchase date">
          <input className="inp" type="date" value={form.purchase_date || ''} onChange={e => set('purchase_date', e.target.value)} />
        </Field>
        <Field label="Purchase cost">
          <input className="inp" type="number" min="0" step="0.01" inputMode="decimal" value={form.purchase_cost ?? ''} onChange={e => set('purchase_cost', e.target.value)} />
        </Field>
        <Field label="PO number">
          <input className="inp" value={form.po_number || ''} onChange={e => set('po_number', e.target.value)} />
        </Field>
        <Field label="Invoice number">
          <input className="inp" value={form.invoice_number || ''} onChange={e => set('invoice_number', e.target.value)} />
        </Field>
        <Field label="Warranty expiry" hint={component.warranty_end ? `Currently ${fmtDate(component.warranty_end)}` : undefined}>
          <input className="inp" type="date" value={form.warranty_end || ''} onChange={e => set('warranty_end', e.target.value)} />
        </Field>
        <Field label="Site">
          <SiteField value={form.site} onChange={v => set('site', v)} sites={sites} id="pt-edit-site" />
        </Field>
        <Field label="Location / bin" span>
          <input className="inp" value={form.current_location || ''} onChange={e => set('current_location', e.target.value)} />
        </Field>
        <Field label="Notes" span>
          <textarea className="inp" rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', minHeight: 70 }} />
        </Field>
        <div className="span-2">
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox" checked={form.included_in_asset_cost !== false}
              onChange={e => set('included_in_asset_cost', e.target.checked)}
            />
            <span style={{ fontSize: '0.84rem', color: 'var(--text-1)' }}>
              Capitalise into the asset&apos;s value
            </span>
          </label>
        </div>
      </div>
    </PtModal>
  )
}

export { AvailablePartPicker, WorkOrderSelect }
