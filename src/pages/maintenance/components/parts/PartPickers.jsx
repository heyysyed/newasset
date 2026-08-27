/**
 * PartPickers.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The pickers and shared form fragments every maintenance parts flow needs:
 * the work order Parts tab, and the parts manager inside a ticket.
 *
 * All reads come from partsService (which reads the migration-004 views), never
 * from a hand-rolled join, and never from the retired `inventory_items` table.
 * Everything is built out of the `.pt-*` primitives in src/index.css so the same
 * markup is a table on desktop and a stack of cards on a 360px phone.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Package, Boxes, AlertTriangle } from 'lucide-react'
import {
  fetchAvailableComponents, fetchPartCategories, fetchBulkStock, fetchPartsSites,
  getAssetComponents, splitAssetComponents, DISPOSITIONS,
} from '../../../../services/partsService'
import {
  PARTS_KEYS, ErrorNote, Spinner, EmptyState, StatusPill, StockStatusPill, fmtQty,
} from '../../../../components/inventory/partsUI'
import { formatCurrency } from '../../../../lib/depreciation'

/* ═════════════════════════════════════════════════════════════════════════════
   FORMATTERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** formatCurrency takes exactly one argument — never a currency code. */
export const money = value => formatCurrency(Number(value || 0))

export const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0)

export const dash = value =>
  value === null || value === undefined || value === '' ? '—' : value

/** Part name over its serial number, wrapping safely on a narrow screen. */
export function PartLineIdentity({ name, sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 600, color: 'var(--text-1)', wordBreak: 'break-word' }}>
        {dash(name)}
      </div>
      {sub ? (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
          color: 'var(--text-3)', wordBreak: 'break-all',
        }}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   SELECTABLE ROW  ·  ≥44px tall so it is a comfortable tap target
   ═══════════════════════════════════════════════════════════════════════════ */

function PickRow({ active, onClick, title, sub, right, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '11px 13px',
        borderRadius: 12,
        minHeight: 44,
        width: '100%',
        opacity: disabled ? 0.5 : 1,
        background: active ? 'var(--accent-glow)' : 'var(--bg-1)',
        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, color: 'var(--text-1)',
          fontSize: '0.875rem', wordBreak: 'break-word',
        }}>
          {title}
        </div>
        {sub ? (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
            color: 'var(--text-3)', wordBreak: 'break-all',
          }}>
            {sub}
          </div>
        ) : null}
      </div>
      {right ? <div style={{ flexShrink: 0, textAlign: 'right' }}>{right}</div> : null}
    </button>
  )
}

function PickList({ children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      maxHeight: 280, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {children}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="pt-grow" style={{ position: 'relative' }}>
      <Search
        size={14}
        style={{
          position: 'absolute', left: 12, top: '50%',
          transform: 'translateY(-50%)', color: 'var(--text-3)',
        }}
      />
      <input
        className="inp"
        style={{ paddingLeft: 34, width: '100%' }}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   SERIALIZED PART PICKER  ·  installable stock
   ═══════════════════════════════════════════════════════════════════════════ */

export function SerializedPartPicker({ selectedId, onSelect, defaultCategory, excludeId }) {
  const [category, setCategory] = useState(defaultCategory || 'All')
  const [search, setSearch] = useState('')

  const categoriesQ = useQuery({
    queryKey: [...PARTS_KEYS.categories, 'serialized'],
    queryFn: () => fetchPartCategories('serialized'),
  })

  const partsQ = useQuery({
    queryKey: [...PARTS_KEYS.serialized, 'available', category, search],
    queryFn: () => fetchAvailableComponents({ category, search, limit: 60 }),
  })

  const options = (partsQ.data || []).filter(p => p.id !== excludeId)

  return (
    <div>
      <div className="pt-toolbar" style={{ marginBottom: 10 }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search serial, name, part number…" />
        <select
          className="sel"
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ minWidth: 150 }}
        >
          <option value="All">All categories</option>
          {(categoriesQ.data || []).map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {partsQ.error && <ErrorNote error={partsQ.error} />}

      {partsQ.isPending ? (
        <Spinner label="Loading available stock…" pad={30} />
      ) : options.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No installable parts in stock"
          hint="Only parts sitting at Available or Reserved can be fitted. Receive stock in Inventory first, or widen the filters above."
        />
      ) : (
        <PickList>
          {options.map(p => (
            <PickRow
              key={p.id}
              active={p.id === selectedId}
              onClick={() => onSelect(p.id, p)}
              title={p.name || 'Unnamed part'}
              sub={[p.serial_number, p.category, p.site].filter(Boolean).join(' · ')}
              right={(
                <>
                  <div className="pt-field-value num" style={{ fontWeight: 600 }}>{money(p.purchase_cost)}</div>
                  <StatusPill status={p.status} />
                </>
              )}
            />
          ))}
        </PickList>
      )}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   INSTALLED PART PICKER  ·  what is currently fitted to the asset
   ═══════════════════════════════════════════════════════════════════════════ */

export function InstalledComponentPicker({ assetId, selectedId, onSelect }) {
  const [search, setSearch] = useState('')

  const componentsQ = useQuery({
    queryKey: [...PARTS_KEYS.assetComponents, assetId],
    queryFn: () => getAssetComponents(assetId),
    enabled: !!assetId,
  })

  const installed = useMemo(
    () => splitAssetComponents(componentsQ.data || []).installed,
    [componentsQ.data],
  )

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return installed
    return installed.filter(r => [r.part_name, r.serial_number, r.part_category, r.position]
      .some(v => v && String(v).toLowerCase().includes(q)))
  }, [installed, search])

  if (!assetId) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="This work order has no asset"
        hint="Serialized parts are fitted to an asset, so link the work order to one before installing or removing parts."
      />
    )
  }

  return (
    <div>
      {installed.length > 4 && (
        <div className="pt-toolbar" style={{ marginBottom: 10 }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search fitted parts…" />
        </div>
      )}

      {componentsQ.error && <ErrorNote error={componentsQ.error} />}

      {componentsQ.isPending ? (
        <Spinner label="Loading parts fitted to this asset…" pad={30} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Package}
          title={installed.length ? 'Nothing matches your search' : 'No serialized parts are fitted'}
          hint={installed.length
            ? 'Clear the search box to see everything fitted to this asset.'
            : 'Install a part first — only fitted parts can be removed or replaced.'}
        />
      ) : (
        <PickList>
          {shown.map(r => (
            <PickRow
              key={r.installation_id}
              active={r.component_id === selectedId}
              onClick={() => onSelect(r.component_id, r)}
              title={r.part_name || 'Unnamed part'}
              sub={[r.serial_number, r.part_category, r.position && `Slot ${r.position}`]
                .filter(Boolean).join(' · ')}
              right={(
                <div className="pt-field-value num" style={{ fontWeight: 600 }}>
                  {money(r.purchase_cost)}
                </div>
              )}
            />
          ))}
        </PickList>
      )}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   BULK ITEM PICKER  ·  quantity-only consumables, per site
   ═══════════════════════════════════════════════════════════════════════════ */

export function BulkStockPicker({ selectedStockId, onSelect, site, onSiteChange }) {
  const [search, setSearch] = useState('')

  const sitesQ = useQuery({
    queryKey: ['parts-sites'],
    queryFn: fetchPartsSites,
  })

  const stockQ = useQuery({
    queryKey: [...PARTS_KEYS.bulkStock, site || 'All', search],
    queryFn: () => fetchBulkStock({ site: site || 'All', search }),
  })

  const rows = stockQ.data || []

  return (
    <div>
      <div className="pt-toolbar" style={{ marginBottom: 10 }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search consumable, code, part number…" />
        <select
          className="sel"
          value={site || 'All'}
          onChange={e => onSiteChange(e.target.value === 'All' ? '' : e.target.value)}
          style={{ minWidth: 150 }}
        >
          <option value="All">All sites</option>
          {(sitesQ.data || []).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {stockQ.error && <ErrorNote error={stockQ.error} />}

      {stockQ.isPending ? (
        <Spinner label="Loading stock levels…" pad={30} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No consumables found"
          hint="Bulk stock is received per site in Inventory. Receive some stock, or widen the filters above."
        />
      ) : (
        <PickList>
          {rows.map(r => (
            <PickRow
              key={r.stock_id}
              active={r.stock_id === selectedStockId}
              onClick={() => onSelect(r)}
              title={r.item_name || 'Unnamed item'}
              sub={[r.item_code, r.category, r.site].filter(Boolean).join(' · ')}
              right={(
                <>
                  <div className="pt-field-value num" style={{ fontWeight: 600 }}>
                    {fmtQty(r.usable_qty)} {r.unit || ''}
                  </div>
                  <StockStatusPill status={r.stock_status} />
                </>
              )}
            />
          ))}
        </PickList>
      )}
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   DISPOSITION  ·  where the outgoing part goes
   ═══════════════════════════════════════════════════════════════════════════ */

export function DispositionFields({
  disposition, setDisposition, scrapValue, setScrapValue, purchaseCost,
}) {
  const meta = DISPOSITIONS.find(d => d.value === disposition)
  const needsScrapValue = !!meta?.needsScrapValue
  const bookLoss = num(purchaseCost) - num(scrapValue)

  return (
    <>
      <div>
        <label className="lbl">
          Where does the part go? <span style={{ color: 'var(--status-danger)' }}>*</span>
        </label>
        <select
          className="sel"
          value={disposition}
          onChange={e => setDisposition(e.target.value)}
          style={{ width: '100%' }}
        >
          {DISPOSITIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: '0.74rem', lineHeight: 1.5 }}>
          Lands the part at <strong>{meta?.status || 'AVAILABLE'}</strong>.
          {needsScrapValue && ' Scrapping is final — the part can never be installed again.'}
        </p>
      </div>

      {needsScrapValue && (
        <div>
          <label className="lbl">Scrap / salvage value recovered</label>
          <input
            className="inp"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={scrapValue}
            onChange={e => setScrapValue(e.target.value)}
            placeholder="0"
            style={{ width: '100%' }}
          />
          <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: '0.74rem' }}>
            Book loss on scrap:{' '}
            <strong style={{ color: 'var(--status-danger)' }}>{money(bookLoss)}</strong>
            {' '}({money(purchaseCost)} purchase − {money(scrapValue || 0)} recovered)
          </p>
        </div>
      )}
    </>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   QUANTITY + OVERRIDE  ·  the honest way to consume more than the books say
   ═══════════════════════════════════════════════════════════════════════════ */

export function QuantityOverrideFields({
  quantity, setQuantity, unit, available,
  isOverride, setIsOverride, overrideReason, setOverrideReason,
}) {
  const wanted = num(quantity)
  const short = available !== null && available !== undefined && wanted > num(available)

  // Asking for more than the books hold is the only case an override makes
  // sense in, so clear the flag the moment the quantity drops back inside stock.
  useEffect(() => {
    if (!short && isOverride) setIsOverride(false)
  }, [short, isOverride, setIsOverride])

  return (
    <>
      <div>
        <label className="lbl">
          Quantity used <span style={{ color: 'var(--status-danger)' }}>*</span>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            className="inp"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          {unit ? (
            <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', flexShrink: 0 }}>{unit}</span>
          ) : null}
        </div>
        {available !== null && available !== undefined && (
          <p style={{ margin: '6px 0 0', color: 'var(--text-3)', fontSize: '0.74rem' }}>
            Recorded at this site: <strong>{fmtQty(available)} {unit || ''}</strong>
          </p>
        )}
      </div>

      {short && (
        <div style={{
          border: '1px solid var(--status-warning)',
          background: 'var(--status-warning-soft)',
          borderRadius: 10, padding: '11px 13px',
        }}>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 9,
            cursor: 'pointer', minHeight: 42,
          }}>
            <input
              type="checkbox"
              checked={isOverride}
              onChange={e => setIsOverride(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
            />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-1)', lineHeight: 1.5 }}>
              <strong>Override — the stock count is wrong.</strong>{' '}
              You are booking {fmtQty(wanted)} {unit || ''} against{' '}
              {fmtQty(available)} {unit || ''} on record. Ticking this records the
              consumption anyway and drives the site's stock negative so the
              discrepancy is visible until someone counts it.
            </span>
          </label>

          {isOverride && (
            <div style={{ marginTop: 10 }}>
              <label className="lbl">
                Why is the count wrong? <span style={{ color: 'var(--status-danger)' }}>*</span>
              </label>
              <textarea
                className="inp"
                rows={2}
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="e.g. Stock was issued last week without a slip; physical count says 12"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}
