/**
 * BulkCatalogueTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The bulk SKU master (`bulk_items`). Create, edit and deactivate items through
 * partsService.upsertBulkItem — no direct table writes, no hard deletes (stock
 * ledgers reference these rows, so retiring an item means `is_active = false`).
 */

import React, { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Search, Plus, Pencil, RefreshCw, Download, ClipboardList, Archive, RotateCcw,
} from 'lucide-react'
import { fetchBulkItems, fetchPartCategories, upsertBulkItem } from '../../services/partsService'
import { formatCurrency } from '../../lib/depreciation'
import {
  PARTS_KEYS, Spinner, EmptyState, ErrorNote, PtModal, ModalActions, InfoNote,
  usePartsInvalidator, fmtQty,
} from './partsUI'
import { BulkItemModal } from './BulkModals'

/** Retire / restore confirmation — a real modal, never window.confirm. */
function RetireItemModal({ open, onClose, item, restore }) {
  const invalidate = usePartsInvalidator()
  const mutation = useMutation({
    mutationFn: () => upsertBulkItem({ ...item, is_active: !!restore }),
    onSuccess: () => { invalidate(); onClose() },
  })
  if (!item) return null
  return (
    <PtModal
      open={open} onClose={() => !mutation.isPending && onClose()} size="sm"
      title={restore ? 'Restore this item?' : 'Retire this item?'}
      subtitle={`${item.item_name} · ${item.item_code}`}
      busy={mutation.isPending}
      formId="pt-retire-form"
      onSubmit={e => { e.preventDefault(); mutation.mutate() }}
      footer={<ModalActions onCancel={onClose} formId="pt-retire-form" pending={mutation.isPending} submitLabel={restore ? 'Restore item' : 'Retire item'} icon={restore ? <RotateCcw size={15} /> : <Archive size={15} />} danger={!restore} />}
    >
      <ErrorNote error={mutation.error} />
      <InfoNote>
        {restore
          ? 'The item returns to the catalogue and its stock records become visible again.'
          : 'Retiring hides the item from stock lists and pickers. Its history and stock ledger stay intact, and you can restore it at any time. Nothing is deleted.'}
      </InfoNote>
    </PtModal>
  )
}

export default function BulkCatalogueTab({ canWrite = false }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showRetired, setShowRetired] = useState(false)
  const [spareOnly, setSpareOnly] = useState(false)
  const [modal, setModal] = useState({ kind: null, item: null })

  const {
    data: items = [], isLoading, isFetching, error, refetch,
  } = useQuery({
    queryKey: [...PARTS_KEYS.bulkItems, { search: search.trim(), category, spareOnly, showRetired }],
    queryFn: () => fetchBulkItems({
      search: search.trim(), category, spareOnly, activeOnly: !showRetired,
    }),
  })

  const { data: categories = [] } = useQuery({
    queryKey: [...PARTS_KEYS.categories, 'bulk'],
    queryFn: () => fetchPartCategories('bulk'),
  })

  const totals = useMemo(() => ({
    count: items.length,
    retired: items.filter(i => i.is_active === false).length,
  }), [items])

  function exportCsv() {
    const head = ['Item code', 'Item name', 'Category', 'Part number', 'Manufacturer', 'Unit', 'Unit price', 'Reorder level', 'Min order qty', 'Bin', 'Spare part', 'Active']
    const lines = items.map(i => [
      i.item_code, i.item_name, i.category, i.part_number, i.manufacturer, i.unit,
      Number(i.unit_price || 0), Number(i.reorder_level || 0), Number(i.min_order_qty || 0),
      i.location_bin || '', i.is_spare_part ? 'Yes' : 'No', i.is_active === false ? 'No' : 'Yes',
    ])
    const csv = [head, ...lines]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `bulk-items-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const closeModal = () => setModal({ kind: null, item: null })

  return (
    <div>
      <div className="pt-toolbar">
        <div className="pt-grow" style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            className="inp" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search item code, name or part number…"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <div className="pt-toolbar-row">
          <select className="sel" value={category} onChange={e => setCategory(e.target.value)} style={{ minWidth: 0 }}>
            <option value="All">All categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <button type="button" className="btn-ghost" onClick={() => refetch()} title="Refresh" style={{ padding: '0 12px' }}>
            <RefreshCw size={14} style={isFetching ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button type="button" className="btn-ghost" onClick={exportCsv} disabled={!items.length} title="Export to CSV" style={{ padding: '0 12px' }}>
            <Download size={14} />
          </button>
          {canWrite && (
            <button type="button" className="btn-primary" onClick={() => setModal({ kind: 'item', item: null })} style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
              <Plus size={15} /> New item
            </button>
          )}
        </div>
      </div>

      <div className="pt-chips">
        <button type="button" className={`pt-chip ${spareOnly ? 'active' : ''}`} onClick={() => setSpareOnly(v => !v)}>
          Spare parts only
        </button>
        <button type="button" className={`pt-chip ${showRetired ? 'active' : ''}`} onClick={() => setShowRetired(v => !v)}>
          Include retired
        </button>
      </div>

      <ErrorNote error={error} />

      {isLoading ? <Spinner label="Loading item catalogue…" /> : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No items in the catalogue"
          hint="Create the SKU first, then receive stock into a site against it."
          action={canWrite ? (
            <button type="button" className="btn-primary" onClick={() => setModal({ kind: 'item', item: null })} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Plus size={15} /> New item
            </button>
          ) : null}
        />
      ) : (
        <>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', margin: '4px 0 10px' }}>
            {totals.count} item{totals.count === 1 ? '' : 's'}
            {totals.retired > 0 && ` · ${totals.retired} retired`}
          </div>

          <div className="pt-table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Unit price</th>
                  <th style={{ textAlign: 'right' }}>Reorder at</th>
                  <th>Bin</th>
                  <th>Flags</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} style={i.is_active === false ? { opacity: 0.55 } : undefined}>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>{i.item_name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--text-3)' }}>{i.item_code}</div>
                      {(i.manufacturer || i.part_number) && (
                        <div style={{ fontSize: '0.71rem', color: 'var(--text-3)' }}>
                          {[i.manufacturer, i.part_number].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{i.category || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{i.unit || '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(Number(i.unit_price || 0))}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-3)' }}>{fmtQty(i.reorder_level)}</td>
                    <td style={{ fontSize: '0.78rem' }}>{i.location_bin || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {i.is_spare_part && <span className="pt-pill info">Spare</span>}
                        {i.is_active === false && <span className="pt-pill neutral">Retired</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                        {canWrite && (
                          <>
                            <button type="button" className="btn-ghost" onClick={() => setModal({ kind: 'item', item: i })} style={{ padding: '0 9px', height: 30, minHeight: 30, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              type="button" className="btn-ghost"
                              onClick={() => setModal({ kind: i.is_active === false ? 'restore' : 'retire', item: i })}
                              style={{ padding: '0 9px', height: 30, minHeight: 30, fontSize: '0.75rem', color: i.is_active === false ? 'var(--text-2)' : 'var(--status-danger)' }}
                            >
                              {i.is_active === false ? <RotateCcw size={13} /> : <Archive size={13} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-card-list">
            {items.map(i => (
              <div className="pt-card" key={i.id} style={i.is_active === false ? { opacity: 0.6 } : undefined}>
                <div className="pt-card-head">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="pt-card-title">{i.item_name}</div>
                    <div className="pt-card-sub" style={{ fontFamily: 'var(--font-mono)' }}>{i.item_code}</div>
                  </div>
                  {i.is_active === false
                    ? <span className="pt-pill neutral">Retired</span>
                    : i.is_spare_part ? <span className="pt-pill info">Spare</span> : null}
                </div>
                <div className="pt-card-grid">
                  <div>
                    <div className="pt-field-label">Category</div>
                    <div className="pt-field-value">{i.category || '—'}</div>
                  </div>
                  <div>
                    <div className="pt-field-label">Unit</div>
                    <div className="pt-field-value">{i.unit || '—'}</div>
                  </div>
                  <div>
                    <div className="pt-field-label">Unit price</div>
                    <div className="pt-field-value num">{formatCurrency(Number(i.unit_price || 0))}</div>
                  </div>
                  <div>
                    <div className="pt-field-label">Reorder at</div>
                    <div className="pt-field-value num">{fmtQty(i.reorder_level)}</div>
                  </div>
                  <div className="cols-1">
                    <div className="pt-field-label">Bin</div>
                    <div className="pt-field-value">{i.location_bin || '—'}</div>
                  </div>
                </div>
                {canWrite && (
                  <div className="pt-card-actions">
                    <button type="button" className="btn-ghost" onClick={() => setModal({ kind: 'item', item: i })} style={{ padding: '0 12px', height: 38, minHeight: 38, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      type="button" className="btn-ghost"
                      onClick={() => setModal({ kind: i.is_active === false ? 'restore' : 'retire', item: i })}
                      style={{ padding: '0 12px', height: 38, minHeight: 38, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      {i.is_active === false ? <><RotateCcw size={14} /> Restore</> : <><Archive size={14} /> Retire</>}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <BulkItemModal open={modal.kind === 'item'} onClose={closeModal} item={modal.item} />
      <RetireItemModal open={modal.kind === 'retire'} onClose={closeModal} item={modal.item} />
      <RetireItemModal open={modal.kind === 'restore'} onClose={closeModal} item={modal.item} restore />
    </div>
  )
}
