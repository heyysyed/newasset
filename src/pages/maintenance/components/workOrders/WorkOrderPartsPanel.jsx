/**
 * WorkOrderPartsPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The Parts tab of a work order. This is where a technician records what was
 * actually consumed on the job, and where a supervisor sees what it cost.
 *
 * Reads: getWorkOrderParts() → v_work_order_parts, so the numbers here are
 * byte-for-byte what the parts-consumption report shows.
 *
 * Writes: installComponent / replaceComponent / removeComponent /
 * consumeBulkPart / returnBulkPart. Each of those is one atomic SECURITY DEFINER
 * RPC — stock, the asset's component list, the cost ledger and the audit trail
 * all move together or not at all. There is deliberately no multi-step browser
 * mutation anywhere in this file.
 *
 * The `workOrderId` handed to those RPCs may be a work order id *or* a ticket
 * id; fn_resolve_work_order sorts it out server-side.
 */

import React, { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Package, PackageMinus, ArrowRightLeft, Boxes, Undo2, IndianRupee,
  ShieldAlert, RotateCcw, Plus,
} from 'lucide-react'
import {
  getWorkOrderParts, getTicketParts, summariseWorkOrderParts,
  getAssetComponents, splitAssetComponents,
  installComponent, removeComponent, replaceComponent,
  consumeBulkPart, returnBulkPart, DISPOSITIONS,
} from '../../../../services/partsService'
import {
  PARTS_KEYS, PtModal, ErrorNote, InfoNote, Spinner, EmptyState, fmtQty, fmtDateTime,
} from '../../../../components/inventory/partsUI'
import { useAuth } from '../../../../context/AuthContext'
import { useMaintenancePartsInvalidator } from '../../hooks/useMaintenancePartsInvalidator'
import {
  SerializedPartPicker, InstalledComponentPicker, BulkStockPicker,
  DispositionFields, QuantityOverrideFields, PartLineIdentity, money, num, dash,
} from '../parts/PartPickers'

/* ═════════════════════════════════════════════════════════════════════════════
   TRANSACTION TYPE → HOW THE LINE READS
   The RPCs write 'install' / 'return' / 'scrap' for serialized parts and
   'consume' / 'return' for bulk. A bulk 'return' carries a negative total_cost,
   which is what makes the running total self-correcting.
   ═══════════════════════════════════════════════════════════════════════════ */
const TX_META = {
  install: { label: 'Installed', tone: 'info' },
  remove: { label: 'Removed', tone: 'warning' },
  return: { label: 'Returned', tone: 'neutral' },
  scrap: { label: 'Scrapped', tone: 'danger' },
  consume: { label: 'Consumed', tone: 'success' },
  issue: { label: 'Issued', tone: 'success' },
  receipt: { label: 'Received', tone: 'neutral' },
}

function TxPill({ type }) {
  const meta = TX_META[type] || { label: type || '—', tone: 'neutral' }
  return <span className={`pt-pill ${meta.tone}`}>{meta.label}</span>
}

/* ═════════════════════════════════════════════════════════════════════════════
   RESPONSIVE LINE SET  ·  table from 768px, cards below — CSS picks one
   ═══════════════════════════════════════════════════════════════════════════ */
function LineSet({ rows, columns, renderCard, rowKey, emptyTitle, emptyHint, emptyIcon }) {
  if (!rows.length) return <EmptyState icon={emptyIcon} title={emptyTitle} hint={emptyHint} />
  return (
    <>
      <div className="pt-table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} style={{ textAlign: c.align || 'left', cursor: 'default' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={rowKey(row)}>
                {columns.map(c => (
                  <td
                    key={c.key}
                    style={{
                      textAlign: c.align || 'left',
                      fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : undefined,
                      whiteSpace: c.nowrap ? 'nowrap' : undefined,
                    }}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pt-card-list">
        {rows.map(row => (
          <div className="pt-card" key={rowKey(row)}>{renderCard(row)}</div>
        ))}
      </div>
    </>
  )
}

function CardField({ label, value, numeric }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="pt-field-label">{label}</div>
      <div className={numeric ? 'pt-field-value num' : 'pt-field-value'}>{value}</div>
    </div>
  )
}

function Section({ title, icon: Icon, count, hint, children, action }) {
  return (
    <section style={{ minWidth: 0 }}>
      <div className="pt-section-head">
        <h4 className="pt-section-title">
          {Icon && <Icon size={15} />} {title}
          <span style={{
            marginLeft: 6, fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-3)',
            background: 'var(--bg-3)', borderRadius: 20, padding: '1px 8px',
          }}>
            {count}
          </span>
        </h4>
        {action}
      </div>
      {hint && (
        <p style={{ margin: '0 0 10px', fontSize: '0.76rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
      {children}
    </section>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WorkOrderPartsPanel({
  /** A work order id. Leave blank and pass `ticketId` when working from a ticket. */
  workOrderId,
  /**
   * A ticket id. fn_resolve_work_order turns this into a work order server-side,
   * so writes are identical; only the read differs (a ticket can accumulate lines
   * across more than one work order).
   */
  ticketId,
  /** The asset serialized parts go in to / come out of. */
  assetId,
  /** Free-text site/location the install RPC records against the part. */
  location,
  /** Shown in modal subtitles so the technician knows what they are editing. */
  label,
  /** Rendered above the actions — e.g. an auto-created work order notice. */
  notice = null,
  canEdit = true,
  /**
   * Show what is currently fitted to the asset, with per-row Replace / Remove.
   * On by default: a technician standing at the machine needs to see the parts
   * that are on it, not only the ones that moved today.
   */
  showInstalled = true,
}) {
  const { user } = useAuth()
  const invalidate = useMaintenancePartsInvalidator()

  /** What the RPCs are handed. fn_resolve_work_order accepts either kind of id. */
  const writeTarget = workOrderId || ticketId

  const [modal, setModal] = useState(null) // { type, row }

  /* one set of form state, reset whenever a modal opens */
  const [pickedComponentId, setPickedComponentId] = useState('')
  const [outgoingId, setOutgoingId] = useState('')
  const [outgoingRow, setOutgoingRow] = useState(null)
  const [position, setPosition] = useState('')
  const [reason, setReason] = useState('')
  const [disposition, setDisposition] = useState(DISPOSITIONS[0].value)
  const [scrapValue, setScrapValue] = useState('')
  const [bulkRow, setBulkRow] = useState(null)
  const [bulkSite, setBulkSite] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [isOverride, setIsOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  const partsQ = useQuery({
    queryKey: workOrderId
      ? [...PARTS_KEYS.workOrderParts, workOrderId]
      : [...PARTS_KEYS.workOrderParts, 'ticket', ticketId],
    queryFn: () => (workOrderId ? getWorkOrderParts(workOrderId) : getTicketParts(ticketId)),
    enabled: !!writeTarget,
  })

  const installedQ = useQuery({
    queryKey: [...PARTS_KEYS.assetComponents, assetId],
    queryFn: () => getAssetComponents(assetId),
    enabled: !!assetId && showInstalled,
  })

  const installedParts = useMemo(
    () => splitAssetComponents(installedQ.data || []).installed,
    [installedQ.data],
  )

  const rows = partsQ.data || []
  const summary = useMemo(() => summariseWorkOrderParts(rows), [rows])

  const serializedRows = rows.filter(r => r.track === 'serialized')
  const bulkRows = rows.filter(r => r.track === 'bulk')
  const overrideCount = rows.filter(r => r.is_override).length

  /**
   * A bulk consumption already has a reversal on this work order if a 'return'
   * line exists for the same item with the same quantity, booked later. Used to
   * warn (never to block) before a second reversal drives stock up twice.
   */
  const reversalFor = tx => bulkRows.find(r =>
    r.transaction_type === 'return' &&
    r.bulk_item_id === tx.bulk_item_id &&
    num(r.quantity) === num(tx.quantity) &&
    new Date(r.transaction_at) >= new Date(tx.transaction_at))

  /* ── mutations ──────────────────────────────────────────────────────────── */
  const onDone = () => {
    invalidate({ assetId, workOrderId: writeTarget })
    closeModal()
  }

  const installM = useMutation({ mutationFn: installComponent, onSuccess: onDone })
  const removeM = useMutation({ mutationFn: removeComponent, onSuccess: onDone })
  const replaceM = useMutation({ mutationFn: replaceComponent, onSuccess: onDone })
  const consumeM = useMutation({ mutationFn: consumeBulkPart, onSuccess: onDone })
  const returnM = useMutation({ mutationFn: returnBulkPart, onSuccess: onDone })

  const busy = installM.isPending || removeM.isPending || replaceM.isPending
    || consumeM.isPending || returnM.isPending

  function closeModal() {
    setModal(null)
  }

  /**
   * @param {string} type   install | remove | replace | consume | return
   * @param {object} [opts]
   * @param {object} [opts.row]        a bulk transaction line (for `return`)
   * @param {object} [opts.component]  a fitted part to pre-select (remove/replace)
   */
  function openModal(type, opts = {}) {
    const { row = null, component = null } = opts
    installM.reset(); removeM.reset(); replaceM.reset(); consumeM.reset(); returnM.reset()
    setPickedComponentId('')
    setOutgoingId(component?.component_id || '')
    setOutgoingRow(component || null)
    setPosition(component?.position || '')
    setReason('')
    setDisposition(DISPOSITIONS[0].value)
    setScrapValue('')
    setBulkRow(null)
    setBulkSite(row?.site || '')
    setQuantity('1')
    setIsOverride(false)
    setOverrideReason('')
    setModal({ type, row })
  }

  /* ── submits ────────────────────────────────────────────────────────────── */
  function submitInstall(e) {
    e.preventDefault()
    installM.mutate({
      componentId: pickedComponentId,
      assetId,
      position: position.trim() || null,
      workOrderId: writeTarget,
      userId: user?.id,
      location: location || null,
    })
  }

  function submitRemove(e) {
    e.preventDefault()
    removeM.mutate({
      componentId: outgoingId,
      workOrderId: writeTarget,
      reason,
      disposition,
      userId: user?.id,
      scrapValue,
    })
  }

  function submitReplace(e) {
    e.preventDefault()
    replaceM.mutate({
      oldComponentId: outgoingId,
      newComponentId: pickedComponentId,
      assetId,
      position: position.trim() || outgoingRow?.position || null,
      workOrderId: writeTarget,
      reason,
      disposition,
      userId: user?.id,
      scrapValue,
    })
  }

  function submitConsume(e) {
    e.preventDefault()
    consumeM.mutate({
      itemId: bulkRow?.item_id,
      quantity,
      workOrderId: writeTarget,
      userId: user?.id,
      site: bulkRow?.site || bulkSite || null,
      isOverride,
      overrideReason,
    })
  }

  function submitReturn(e) {
    e.preventDefault()
    returnM.mutate({
      transactionId: modal.row.transaction_id,
      userId: user?.id,
      reason,
    })
  }

  /* ── guards ─────────────────────────────────────────────────────────────── */
  if (!writeTarget) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Save the work order first"
        hint="Parts are booked against a work order, so the work order has to exist before anything can be consumed on it."
      />
    )
  }

  if (partsQ.isPending) return <Spinner label="Loading parts booked to this job…" />

  const existingReversal = modal?.type === 'return' ? reversalFor(modal.row) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      {partsQ.error && (
        <div>
          <ErrorNote error={partsQ.error} />
          <button type="button" className="btn-ghost" onClick={() => partsQ.refetch()}>
            <RotateCcw size={13} /> Retry
          </button>
        </div>
      )}

      {notice}

      {/* ── cost strip ── */}
      <div className="pt-metrics">
        <div className="pt-metric">
          <div className="pt-metric-label"><IndianRupee size={12} /> Parts cost on this job</div>
          <div className="pt-metric-value">{money(summary.totalCost)}</div>
          <div className="pt-metric-hint">
            {summary.lineCount} {summary.lineCount === 1 ? 'line' : 'lines'} booked
          </div>
        </div>
        <div className="pt-metric">
          <div className="pt-metric-label"><Package size={12} /> Serialized parts</div>
          <div className="pt-metric-value">{summary.serializedCount}</div>
          <div className="pt-metric-hint">{money(summary.serializedCost)} of tracked parts</div>
        </div>
        <div className="pt-metric">
          <div className="pt-metric-label"><Boxes size={12} /> Consumables</div>
          <div className="pt-metric-value">{summary.bulkCount}</div>
          <div className="pt-metric-hint">{money(summary.bulkCost)} of bulk stock</div>
        </div>
        <div
          className="pt-metric"
          style={overrideCount ? { borderColor: 'var(--status-warning)' } : undefined}
        >
          <div
            className="pt-metric-label"
            style={overrideCount ? { color: 'var(--status-warning)' } : undefined}
          >
            <ShieldAlert size={12} /> Stock overrides
          </div>
          <div
            className="pt-metric-value"
            style={overrideCount ? { color: 'var(--status-warning)' } : undefined}
          >
            {overrideCount}
          </div>
          <div className="pt-metric-hint">
            {overrideCount ? 'consumed past the recorded count' : 'every line matched stock'}
          </div>
        </div>
      </div>

      {/* ── actions ── */}
      {canEdit && (
        <div className="pt-toolbar">
          <button
            type="button"
            className="btn-primary"
            onClick={() => openModal('consume')}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <Plus size={14} /> Consume a consumable
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => openModal('install')}
            disabled={!assetId}
            title={assetId ? 'Fit a serialized part from stock' : 'Link this work order to an asset first'}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <Package size={14} /> Install a part
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => openModal('replace')}
            disabled={!assetId}
            title={assetId ? 'Swap a fitted part for one from stock' : 'Link this work order to an asset first'}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <ArrowRightLeft size={14} /> Replace a part
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => openModal('remove')}
            disabled={!assetId}
            title={assetId ? 'Take a fitted part out' : 'Link this work order to an asset first'}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <PackageMinus size={14} /> Remove a part
          </button>
        </div>
      )}

      {!assetId && (
        <InfoNote>
          This work order is not linked to an asset, so serialized parts cannot be
          fitted or removed here. Consumables can still be booked against the job.
        </InfoNote>
      )}

      {/* ── 1. SERIALIZED LINES ── */}
      <Section
        title="Serialized parts"
        icon={Package}
        count={serializedRows.length}
        hint="Parts with their own serial number that were fitted to or taken off the asset on this job. Each line is one atomic lifecycle move."
      >
        <LineSet
          rows={serializedRows}
          rowKey={r => r.transaction_id}
          emptyIcon={Package}
          emptyTitle="No serialized parts on this job"
          emptyHint="Use Install, Replace or Remove above to record a tracked part against this work order."
          columns={[
            {
              key: 'part',
              label: 'Part / serial',
              render: r => <PartLineIdentity name={r.part_name} sub={r.serial_number} />,
            },
            { key: 'action', label: 'Action', nowrap: true, render: r => <TxPill type={r.transaction_type} /> },
            { key: 'cat', label: 'Category', render: r => dash(r.part_category) },
            { key: 'when', label: 'When', nowrap: true, render: r => fmtDateTime(r.transaction_at) },
            { key: 'by', label: 'By', render: r => dash(r.performed_by_name) },
            { key: 'cost', label: 'Value', align: 'right', render: r => money(r.total_cost) },
          ]}
          renderCard={r => (
            <>
              <div className="pt-card-head">
                <div style={{ minWidth: 0 }}>
                  <div className="pt-card-title">{dash(r.part_name)}</div>
                  <div className="pt-card-sub">{dash(r.serial_number)}</div>
                </div>
                <TxPill type={r.transaction_type} />
              </div>
              <div className="pt-card-grid">
                <CardField label="Category" value={dash(r.part_category)} />
                <CardField label="Value" value={money(r.total_cost)} numeric />
                <CardField label="When" value={fmtDateTime(r.transaction_at)} />
                <CardField label="By" value={dash(r.performed_by_name)} />
              </div>
            </>
          )}
        />
      </Section>

      {/* ── 2. BULK LINES ── */}
      <Section
        title="Consumables"
        icon={Boxes}
        count={bulkRows.length}
        hint="Quantity-only stock: cable, paste, screws, oil. Consuming decrements the site's stock; returning a line puts it back and books a negative cost."
      >
        <LineSet
          rows={bulkRows}
          rowKey={r => r.transaction_id}
          emptyIcon={Boxes}
          emptyTitle="No consumables booked"
          emptyHint="Use “Consume a consumable” above so the job carries the real cost of the bits and pieces it used."
          columns={[
            {
              key: 'item',
              label: 'Item',
              render: r => <PartLineIdentity name={r.part_name} sub={r.item_code} />,
            },
            { key: 'action', label: 'Action', nowrap: true, render: r => <TxPill type={r.transaction_type} /> },
            {
              key: 'qty',
              label: 'Qty',
              align: 'right',
              nowrap: true,
              render: r => `${fmtQty(r.quantity)} ${r.unit || ''}`.trim(),
            },
            { key: 'site', label: 'Site', render: r => dash(r.site) },
            { key: 'when', label: 'When', nowrap: true, render: r => fmtDateTime(r.transaction_at) },
            { key: 'unit', label: 'Unit cost', align: 'right', render: r => money(r.unit_cost) },
            {
              key: 'cost',
              label: 'Cost',
              align: 'right',
              render: r => (
                <strong style={num(r.total_cost) < 0 ? { color: 'var(--status-success)' } : undefined}>
                  {money(r.total_cost)}
                </strong>
              ),
            },
            {
              key: 'flag',
              label: '',
              render: r => (r.is_override ? (
                <span className="pt-pill warning" title={r.override_reason || 'Consumed past the recorded stock count'}>
                  Override
                </span>
              ) : null),
            },
            {
              key: 'act',
              label: '',
              render: r => (canEdit && r.transaction_type === 'consume' ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => openModal('return', { row: r })}
                  style={{ padding: '6px 10px', minHeight: 34, whiteSpace: 'nowrap' }}
                >
                  <Undo2 size={13} /> Return
                </button>
              ) : null),
            },
          ]}
          renderCard={r => (
            <>
              <div className="pt-card-head">
                <div style={{ minWidth: 0 }}>
                  <div className="pt-card-title">{dash(r.part_name)}</div>
                  <div className="pt-card-sub">{dash(r.item_code)}</div>
                </div>
                <TxPill type={r.transaction_type} />
              </div>
              <div className="pt-card-grid">
                <CardField label="Quantity" value={`${fmtQty(r.quantity)} ${r.unit || ''}`.trim()} numeric />
                <CardField label="Site" value={dash(r.site)} />
                <CardField label="Unit cost" value={money(r.unit_cost)} numeric />
                <CardField
                  label="Cost"
                  numeric
                  value={(
                    <strong style={num(r.total_cost) < 0 ? { color: 'var(--status-success)' } : undefined}>
                      {money(r.total_cost)}
                    </strong>
                  )}
                />
                <CardField label="When" value={fmtDateTime(r.transaction_at)} />
                <CardField label="By" value={dash(r.performed_by_name)} />
              </div>
              {r.is_override && (
                <div style={{ minWidth: 0 }}>
                  <div className="pt-field-label">Override reason</div>
                  <div className="pt-field-value" style={{ color: 'var(--status-warning)' }}>
                    {dash(r.override_reason)}
                  </div>
                </div>
              )}
              {canEdit && r.transaction_type === 'consume' && (
                <div className="pt-card-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => openModal('return', { row: r })}
                    style={{ padding: '6px 10px', minHeight: 40, width: '100%' }}
                  >
                    <Undo2 size={13} /> Return to stock
                  </button>
                </div>
              )}
            </>
          )}
        />
      </Section>

      {/* ── running total ── */}
      {rows.length > 0 && (
        <div className="pt-cost-rows">
          <div className="pt-cost-row">
            <span className="label">Serialized parts ({summary.serializedCount})</span>
            <span className="value">{money(summary.serializedCost)}</span>
          </div>
          <div className="pt-cost-row">
            <span className="label">Consumables ({summary.bulkCount})</span>
            <span className="value">{money(summary.bulkCost)}</span>
          </div>
          <div className="pt-cost-row total">
            <span className="label">Parts cost on this work order</span>
            <span className="value">{money(summary.totalCost)}</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════ MODALS ══════════════════════════ */}

      {modal?.type === 'install' && (
        <PtModal
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Package size={17} /> Install a part</span>}
          subtitle={label}
          onClose={closeModal}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn-ghost" onClick={closeModal} disabled={busy}>Cancel</button>
              <button
                type="submit"
                form="wo-install-form"
                className="btn-primary"
                disabled={busy || !pickedComponentId}
              >
                {installM.isPending ? 'Installing…' : 'Install part'}
              </button>
            </>
          )}
        >
          <form
            id="wo-install-form"
            onSubmit={submitInstall}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {installM.error && <ErrorNote error={installM.error} />}
            <InfoNote>
              The part's purchase cost is booked to this work order and, if the part
              is flagged as capitalised, added to the asset's combined value.
            </InfoNote>
            <div>
              <label className="lbl">
                Pick the part from available stock <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <SerializedPartPicker selectedId={pickedComponentId} onSelect={setPickedComponentId} />
            </div>
            <div>
              <label className="lbl">Slot / position</label>
              <input
                className="inp"
                value={position}
                onChange={e => setPosition(e.target.value)}
                placeholder="e.g. DIMM slot 2, Bay 1, Front-left"
                style={{ width: '100%' }}
              />
            </div>
          </form>
        </PtModal>
      )}

      {modal?.type === 'remove' && (
        <PtModal
          size="sm"
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><PackageMinus size={17} /> Remove a part</span>}
          subtitle={label}
          onClose={closeModal}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn-ghost" onClick={closeModal} disabled={busy}>Cancel</button>
              <button
                type="submit"
                form="wo-remove-form"
                className={disposition === 'SCRAPPED' ? 'btn-danger' : 'btn-primary'}
                disabled={busy || !outgoingId || !reason.trim()}
              >
                {removeM.isPending
                  ? 'Removing…'
                  : disposition === 'SCRAPPED' ? 'Remove & scrap' : 'Remove part'}
              </button>
            </>
          )}
        >
          <form
            id="wo-remove-form"
            onSubmit={submitRemove}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {removeM.error && <ErrorNote error={removeM.error} />}
            <div>
              <label className="lbl">
                Which part is coming out? <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <InstalledComponentPicker
                assetId={assetId}
                selectedId={outgoingId}
                onSelect={(id, row) => { setOutgoingId(id); setOutgoingRow(row) }}
              />
            </div>
            <div>
              <label className="lbl">
                Why is it coming out? <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <textarea
                className="inp"
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Failed, upgraded, preventive replacement…"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <DispositionFields
              disposition={disposition}
              setDisposition={setDisposition}
              scrapValue={scrapValue}
              setScrapValue={setScrapValue}
              purchaseCost={outgoingRow?.purchase_cost}
            />
          </form>
        </PtModal>
      )}

      {modal?.type === 'replace' && (
        <PtModal
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ArrowRightLeft size={17} /> Replace a part</span>}
          subtitle={label}
          onClose={closeModal}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn-ghost" onClick={closeModal} disabled={busy}>Cancel</button>
              <button
                type="submit"
                form="wo-replace-form"
                className="btn-primary"
                disabled={busy || !outgoingId || !pickedComponentId || !reason.trim()}
              >
                {replaceM.isPending ? 'Replacing…' : 'Replace part'}
              </button>
            </>
          )}
        >
          <form
            id="wo-replace-form"
            onSubmit={submitReplace}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {replaceM.error && <ErrorNote error={replaceM.error} />}
            <InfoNote>
              One transaction: the old part comes out and the new one goes in, both
              booked to this work order. The outgoing part keeps its whole history.
            </InfoNote>
            <div>
              <label className="lbl">
                Part coming out <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <InstalledComponentPicker
                assetId={assetId}
                selectedId={outgoingId}
                onSelect={(id, row) => {
                  setOutgoingId(id)
                  setOutgoingRow(row)
                  setPosition(row?.position || '')
                }}
              />
            </div>
            <div>
              <label className="lbl">
                Replacement part <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <SerializedPartPicker
                selectedId={pickedComponentId}
                onSelect={setPickedComponentId}
                defaultCategory={outgoingRow?.part_category || 'All'}
                excludeId={outgoingId}
              />
            </div>
            <div>
              <label className="lbl">
                Why is it being replaced? <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <textarea
                className="inp"
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Failed under load, end of life, warranty swap…"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div>
              <label className="lbl">Slot / position</label>
              <input
                className="inp"
                value={position}
                onChange={e => setPosition(e.target.value)}
                placeholder={outgoingRow?.position || 'Same slot as the old part'}
                style={{ width: '100%' }}
              />
            </div>
            <DispositionFields
              disposition={disposition}
              setDisposition={setDisposition}
              scrapValue={scrapValue}
              setScrapValue={setScrapValue}
              purchaseCost={outgoingRow?.purchase_cost}
            />
          </form>
        </PtModal>
      )}

      {modal?.type === 'consume' && (
        <PtModal
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Boxes size={17} /> Consume a consumable</span>}
          subtitle={label}
          onClose={closeModal}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn-ghost" onClick={closeModal} disabled={busy}>Cancel</button>
              <button
                type="submit"
                form="wo-consume-form"
                className="btn-primary"
                disabled={
                  busy
                  || !bulkRow
                  || !(num(quantity) > 0)
                  || (isOverride && !overrideReason.trim())
                }
              >
                {consumeM.isPending ? 'Booking…' : 'Book to this job'}
              </button>
            </>
          )}
        >
          <form
            id="wo-consume-form"
            onSubmit={submitConsume}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {consumeM.error && <ErrorNote error={consumeM.error} />}
            <div>
              <label className="lbl">
                Pick the consumable <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <BulkStockPicker
                selectedStockId={bulkRow?.stock_id}
                onSelect={row => { setBulkRow(row); setIsOverride(false); setOverrideReason('') }}
                site={bulkSite}
                onSiteChange={value => { setBulkSite(value); setBulkRow(null) }}
              />
            </div>

            {bulkRow && (
              <QuantityOverrideFields
                quantity={quantity}
                setQuantity={setQuantity}
                unit={bulkRow.unit}
                available={bulkRow.usable_qty}
                isOverride={isOverride}
                setIsOverride={setIsOverride}
                overrideReason={overrideReason}
                setOverrideReason={setOverrideReason}
              />
            )}

            {bulkRow && (
              <div className="pt-cost-rows">
                <div className="pt-cost-row">
                  <span className="label">Unit price at {dash(bulkRow.site)}</span>
                  <span className="value">{money(bulkRow.unit_price)}</span>
                </div>
                <div className="pt-cost-row total">
                  <span className="label">Booked to this job</span>
                  <span className="value">{money(num(bulkRow.unit_price) * num(quantity))}</span>
                </div>
              </div>
            )}
          </form>
        </PtModal>
      )}

      {modal?.type === 'return' && (
        <PtModal
          size="sm"
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Undo2 size={17} /> Return to stock</span>}
          subtitle={`${modal.row.part_name || 'Item'} · ${fmtQty(modal.row.quantity)} ${modal.row.unit || ''}`.trim()}
          onClose={closeModal}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn-ghost" onClick={closeModal} disabled={busy}>Cancel</button>
              <button
                type="submit"
                form="wo-return-form"
                className="btn-primary"
                disabled={busy}
              >
                {returnM.isPending ? 'Reversing…' : 'Reverse consumption'}
              </button>
            </>
          )}
        >
          <form
            id="wo-return-form"
            onSubmit={submitReturn}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {returnM.error && <ErrorNote error={returnM.error} />}
            <InfoNote>
              Puts {fmtQty(modal.row.quantity)} {modal.row.unit || ''} back into{' '}
              <strong>{dash(modal.row.site)}</strong> and books{' '}
              <strong>−{money(modal.row.total_cost)}</strong> against this work order,
              so the job's parts cost self-corrects. The original line is kept.
            </InfoNote>

            {existingReversal && (
              <div
                role="alert"
                style={{
                  border: '1px solid var(--status-warning)',
                  background: 'var(--status-warning-soft)',
                  color: 'var(--status-warning)',
                  borderRadius: 10, padding: '10px 12px',
                  fontSize: '0.82rem', lineHeight: 1.5,
                }}
              >
                A matching reversal for this item was already booked on{' '}
                {fmtDateTime(existingReversal.transaction_at)}. Reversing again will
                add the quantity back a second time.
              </div>
            )}

            <div>
              <label className="lbl">Reason</label>
              <textarea
                className="inp"
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Wrong item, wrong quantity, part came back unused…"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          </form>
        </PtModal>
      )}
    </div>
  )
}
