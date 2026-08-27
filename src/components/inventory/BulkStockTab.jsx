/**
 * BulkStockTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The bulk track: quantity-only SKUs held per site. Everything is read from
 * `v_bulk_stock_status` through partsService.fetchBulkStock, which means the
 * Low stock / Out of stock flag comes from each item's own `reorder_level`
 * (the view's `stock_status` column) — never a hardcoded number.
 */

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search, PackagePlus, Boxes, RefreshCw, Download, Plus, Pencil,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import { fetchBulkStock, fetchPartCategories } from '../../services/partsService'
import { formatCurrency } from '../../lib/depreciation'
import {
  PARTS_KEYS, StockStatusPill, STOCK_STATUS_META, Spinner, EmptyState,
  ErrorNote, fmtQty, fmtDate,
} from './partsUI'
import { BulkItemModal, ReceiveBulkStockModal } from './BulkModals'

const STATUS_FILTERS = [
  { value: 'All', label: 'All' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'IN_STOCK', label: 'In stock' },
]

/** OUT_OF_STOCK beats LOW_STOCK beats IN_STOCK when rolling sites up per item. */
const SEVERITY = { OUT_OF_STOCK: 3, LOW_STOCK: 2, IN_STOCK: 1 }

function worstStatus(rows) {
  return rows.reduce((worst, r) => (
    (SEVERITY[r.stock_status] || 0) > (SEVERITY[worst] || 0) ? r.stock_status : worst
  ), 'IN_STOCK')
}

export default function BulkStockTab({ sites = [], canWrite = false, userId }) {
  const [search, setSearch] = useState('')
  const [site, setSite] = useState('All')
  const [category, setCategory] = useState('All')
  const [status, setStatus] = useState('All')
  const [spareOnly, setSpareOnly] = useState(false)
  const [groupByItem, setGroupByItem] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [modal, setModal] = useState({ kind: null, row: null })

  const filters = useMemo(
    () => ({ site, search: search.trim(), category, status, spareOnly }),
    [site, search, category, status, spareOnly],
  )

  const {
    data: rows = [], isLoading, isFetching, error, refetch,
  } = useQuery({
    queryKey: [...PARTS_KEYS.bulkStock, filters],
    queryFn: () => fetchBulkStock(filters),
  })

  const { data: categories = [] } = useQuery({
    queryKey: [...PARTS_KEYS.categories, 'bulk'],
    queryFn: () => fetchPartCategories('bulk'),
  })

  /** One entry per SKU with its per-site rows attached. */
  const grouped = useMemo(() => {
    const map = new Map()
    rows.forEach(r => {
      const key = r.item_id || r.item_code
      if (!map.has(key)) {
        map.set(key, {
          item_id: r.item_id,
          item_code: r.item_code,
          item_name: r.item_name,
          category: r.category,
          part_number: r.part_number,
          manufacturer: r.manufacturer,
          unit: r.unit,
          unit_price: r.unit_price,
          reorder_level: r.reorder_level,
          is_spare_part: r.is_spare_part,
          usable_qty: 0, in_use_qty: 0, scrap_qty: 0, stock_value: 0,
          sites: [],
        })
      }
      const g = map.get(key)
      g.usable_qty += Number(r.usable_qty || 0)
      g.in_use_qty += Number(r.in_use_qty || 0)
      g.scrap_qty += Number(r.scrap_qty || 0)
      g.stock_value += Number(r.stock_value || 0)
      g.sites.push(r)
    })
    return [...map.values()]
      .map(g => ({ ...g, stock_status: worstStatus(g.sites) }))
      .sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''))
  }, [rows])

  const totals = useMemo(() => ({
    lines: rows.length,
    skus: grouped.length,
    value: rows.reduce((t, r) => t + Number(r.stock_value || 0), 0),
    lowStock: rows.filter(r => r.stock_status === 'LOW_STOCK').length,
    outOfStock: rows.filter(r => r.stock_status === 'OUT_OF_STOCK').length,
  }), [rows, grouped])

  function exportCsv() {
    const head = ['Item code', 'Item name', 'Category', 'Site', 'Usable qty', 'In use', 'Scrap', 'Unit', 'Unit price', 'Reorder level', 'Stock value', 'Stock status', 'Bin', 'Updated']
    const lines = rows.map(r => [
      r.item_code, r.item_name, r.category, r.site,
      Number(r.usable_qty || 0), Number(r.in_use_qty || 0), Number(r.scrap_qty || 0),
      r.unit, Number(r.unit_price || 0), Number(r.reorder_level || 0),
      Number(r.stock_value || 0),
      STOCK_STATUS_META[r.stock_status]?.label || r.stock_status,
      r.location_bin || '', r.updated_at || '',
    ])
    const csv = [head, ...lines]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `bulk-stock-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const closeModal = () => setModal({ kind: null, row: null })
  const toggle = key => setExpanded(e => ({ ...e, [key]: !e[key] }))

  /* A stock row already carries every bulk_items field the SKU modal needs, but
     `id` on the view row is the stock id — pass the item id explicitly. */
  const asItem = row => (row ? { ...row, id: row.item_id } : null)

  return (
    <div>
      {/* ── toolbar ─────────────────────────────────────────────────────── */}
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
          <select className="sel" value={site} onChange={e => setSite(e.target.value)} style={{ minWidth: 0 }}>
            <option value="All">All sites</option>
            {sites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="sel" value={category} onChange={e => setCategory(e.target.value)} style={{ minWidth: 0 }}>
            <option value="All">All categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <button type="button" className="btn-ghost" onClick={() => refetch()} title="Refresh" style={{ padding: '0 12px' }}>
            <RefreshCw size={14} style={isFetching ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button type="button" className="btn-ghost" onClick={exportCsv} disabled={!rows.length} title="Export to CSV" style={{ padding: '0 12px' }}>
            <Download size={14} />
          </button>
          {canWrite && (
            <>
              <button type="button" className="btn-ghost" onClick={() => setModal({ kind: 'item', row: null })} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <Plus size={15} /> New item
              </button>
              <button type="button" className="btn-primary" onClick={() => setModal({ kind: 'receive', row: null })} style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                <PackagePlus size={15} /> Receive stock
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── filters ─────────────────────────────────────────────────────── */}
      <div className="pt-chips">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value} type="button"
            className={`pt-chip ${status === f.value ? 'active' : ''}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button" className={`pt-chip ${spareOnly ? 'active' : ''}`}
          onClick={() => setSpareOnly(v => !v)}
        >
          Spare parts only
        </button>
        <button
          type="button" className={`pt-chip ${groupByItem ? 'active' : ''}`}
          onClick={() => setGroupByItem(v => !v)}
        >
          {groupByItem ? 'Grouped by item' : 'One row per site'}
        </button>
      </div>

      <ErrorNote error={error} />

      {isLoading ? <Spinner label="Loading stock levels…" /> : rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No stock records match"
          hint={
            search || site !== 'All' || category !== 'All' || status !== 'All' || spareOnly
              ? 'Try clearing the filters above.'
              : 'Bulk items are quantity-only consumables — cables, thermal paste, screws, oil, filters. Create an item, then receive stock into a site.'
          }
          action={canWrite ? (
            <button type="button" className="btn-primary" onClick={() => setModal({ kind: 'item', row: null })} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Plus size={15} /> New item
            </button>
          ) : null}
        />
      ) : (
        <>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', margin: '4px 0 10px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>{totals.skus} item{totals.skus === 1 ? '' : 's'} across {totals.lines} site record{totals.lines === 1 ? '' : 's'}</span>
            <span>{formatCurrency(totals.value)} stock value</span>
            {(totals.lowStock > 0 || totals.outOfStock > 0) && (
              <span style={{ color: 'var(--status-warning)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={13} />
                {totals.outOfStock} out of stock · {totals.lowStock} low
              </span>
            )}
          </div>

          {/* ── desktop / tablet table ────────────────────────────────── */}
          <div className="pt-table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  {!groupByItem && <th>Site</th>}
                  <th style={{ textAlign: 'right' }}>Usable</th>
                  <th style={{ textAlign: 'right' }}>In use</th>
                  <th style={{ textAlign: 'right' }}>Reorder at</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Stock value</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupByItem ? grouped.map(g => {
                  const key = g.item_id || g.item_code
                  const open = !!expanded[key]
                  return (
                    <React.Fragment key={key}>
                      <tr>
                        <td style={{ maxWidth: 260 }}>
                          <button
                            type="button" onClick={() => toggle(key)}
                            style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 7, alignItems: 'flex-start', width: '100%' }}
                          >
                            {open ? <ChevronUp size={14} style={{ marginTop: 3, flexShrink: 0, color: 'var(--text-3)' }} /> : <ChevronDown size={14} style={{ marginTop: 3, flexShrink: 0, color: 'var(--text-3)' }} />}
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>{g.item_name}</span>
                              <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--text-3)' }}>{g.item_code}</span>
                              <span style={{ display: 'block', fontSize: '0.71rem', color: 'var(--text-3)' }}>
                                {g.sites.length} site{g.sites.length === 1 ? '' : 's'}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{g.category || '—'}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {fmtQty(g.usable_qty)} <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{g.unit}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtQty(g.in_use_qty)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-3)' }}>{fmtQty(g.reorder_level)}</td>
                        <td><StockStatusPill status={g.stock_status} /></td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(g.stock_value)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                            {canWrite && (
                              <>
                                <button type="button" className="btn-primary" onClick={() => setModal({ kind: 'receive', row: asItem(g.sites[0]) })} style={{ padding: '0 9px', height: 30, minHeight: 30, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <PackagePlus size={13} /> Receive
                                </button>
                                <button type="button" className="btn-ghost" onClick={() => setModal({ kind: 'item', row: asItem(g.sites[0]) })} style={{ padding: '0 9px', height: 30, minHeight: 30 }} title="Edit item">
                                  <Pencil size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {open && g.sites.map(s => (
                        <tr key={s.stock_id} style={{ background: 'var(--bg-2)' }}>
                          <td style={{ paddingLeft: 34, fontSize: '0.8rem', color: 'var(--text-2)' }}>
                            {s.site || 'Unassigned site'}
                            {s.location_bin && <div style={{ fontSize: '0.71rem', color: 'var(--text-3)' }}>{s.location_bin}</div>}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Updated {fmtDate(s.updated_at)}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtQty(s.usable_qty)}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtQty(s.in_use_qty)}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-3)' }}>{fmtQty(s.reorder_level)}</td>
                          <td><StockStatusPill status={s.stock_status} /></td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(s.stock_value || 0))}</td>
                          <td>
                            {canWrite && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-ghost" onClick={() => setModal({ kind: 'receive', row: asItem(s) })} style={{ padding: '0 9px', height: 28, minHeight: 28, fontSize: '0.73rem' }}>
                                  Receive here
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                }) : rows.map(r => (
                  <tr key={r.stock_id}>
                    <td style={{ maxWidth: 250 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>{r.item_name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--text-3)' }}>{r.item_code}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{r.category || '—'}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {r.site || '—'}
                      {r.location_bin && <div style={{ fontSize: '0.71rem', color: 'var(--text-3)' }}>{r.location_bin}</div>}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {fmtQty(r.usable_qty)} <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{r.unit}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtQty(r.in_use_qty)}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-3)' }}>{fmtQty(r.reorder_level)}</td>
                    <td><StockStatusPill status={r.stock_status} /></td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(Number(r.stock_value || 0))}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                        {canWrite && (
                          <>
                            <button type="button" className="btn-primary" onClick={() => setModal({ kind: 'receive', row: asItem(r) })} style={{ padding: '0 9px', height: 30, minHeight: 30, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <PackagePlus size={13} /> Receive
                            </button>
                            <button type="button" className="btn-ghost" onClick={() => setModal({ kind: 'item', row: asItem(r) })} style={{ padding: '0 9px', height: 30, minHeight: 30 }} title="Edit item">
                              <Pencil size={13} />
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

          {/* ── phone cards ───────────────────────────────────────────── */}
          <div className="pt-card-list">
            {(groupByItem ? grouped : rows).map(r => {
              const key = groupByItem ? (r.item_id || r.item_code) : r.stock_id
              const siteLabel = groupByItem
                ? `${r.sites.length} site${r.sites.length === 1 ? '' : 's'}`
                : (r.site || 'Unassigned site')
              return (
                <div className="pt-card" key={key}>
                  <div className="pt-card-head">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="pt-card-title">{r.item_name}</div>
                      <div className="pt-card-sub" style={{ fontFamily: 'var(--font-mono)' }}>{r.item_code}</div>
                    </div>
                    <StockStatusPill status={r.stock_status} />
                  </div>
                  <div className="pt-card-grid">
                    <div>
                      <div className="pt-field-label">Usable</div>
                      <div className="pt-field-value num">{fmtQty(r.usable_qty)} {r.unit}</div>
                    </div>
                    <div>
                      <div className="pt-field-label">In use</div>
                      <div className="pt-field-value num">{fmtQty(r.in_use_qty)}</div>
                    </div>
                    <div>
                      <div className="pt-field-label">Reorder at</div>
                      <div className="pt-field-value num">{fmtQty(r.reorder_level)}</div>
                    </div>
                    <div>
                      <div className="pt-field-label">Stock value</div>
                      <div className="pt-field-value num">{formatCurrency(Number(r.stock_value || 0))}</div>
                    </div>
                    <div>
                      <div className="pt-field-label">{groupByItem ? 'Held at' : 'Site'}</div>
                      <div className="pt-field-value">{siteLabel}</div>
                    </div>
                    <div>
                      <div className="pt-field-label">Category</div>
                      <div className="pt-field-value">{r.category || '—'}</div>
                    </div>
                  </div>
                  {groupByItem && r.sites.length > 1 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                      {r.sites.map(s => (
                        <div key={s.stock_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.76rem', padding: '3px 0' }}>
                          <span style={{ color: 'var(--text-3)', minWidth: 0, wordBreak: 'break-word' }}>{s.site || 'Unassigned'}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)', flexShrink: 0 }}>
                            {fmtQty(s.usable_qty)} {s.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {canWrite && (
                    <div className="pt-card-actions">
                      <button
                        type="button" className="btn-primary"
                        onClick={() => setModal({ kind: 'receive', row: asItem(groupByItem ? r.sites[0] : r) })}
                        style={{ padding: '0 12px', height: 38, minHeight: 38, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <PackagePlus size={14} /> Receive
                      </button>
                      <button
                        type="button" className="btn-ghost"
                        onClick={() => setModal({ kind: 'item', row: asItem(groupByItem ? r.sites[0] : r) })}
                        style={{ padding: '0 12px', height: 38, minHeight: 38, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <BulkItemModal
        open={modal.kind === 'item'} onClose={closeModal} item={modal.row}
      />
      <ReceiveBulkStockModal
        open={modal.kind === 'receive'} onClose={closeModal} item={modal.row}
        defaultSite={site} sites={sites} userId={userId}
      />
    </div>
  )
}
