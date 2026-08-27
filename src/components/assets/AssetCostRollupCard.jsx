/**
 * AssetCostRollupCard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The asset's money in one place, reading v_asset_total_cost through
 * getAssetCostSummary().
 *
 * The display rule is a product decision, not a preference: show the original
 * purchase value and the parts spend SEPARATELY, and also show a COMBINED
 * figure as the asset's value. All three stay visible; the combined one is the
 * headline. Depreciation deliberately keeps running off the original purchase
 * value — see src/lib/depreciation.js.
 */

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { IndianRupee, Info, RotateCcw } from 'lucide-react'
import { getAssetCostSummary } from '../../services/partsService'
import { ErrorNote, Spinner, money, num } from './PartsUIKit'

function CostRow({ label, value, hint, total, negative }) {
  return (
    <div className={`pt-cost-row${total ? ' total' : ''}`}>
      <span className="label" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {label}
        {hint && (
          <span style={{ display: 'block', color: 'var(--text-3)', fontSize: '0.72rem', marginTop: 2 }}>
            {hint}
          </span>
        )}
      </span>
      <span className={`value${negative ? ' negative' : ''}`}>{money(value)}</span>
    </div>
  )
}

/**
 * @param {string}  assetId
 * @param {number}  fallbackOriginalValue  assets.purchase_value, used only if the
 *                                         rollup view has no row for this asset.
 * @param {boolean} bare                   render rows only, no card chrome
 */
export default function AssetCostRollupCard({ assetId, fallbackOriginalValue, bare = false }) {
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ['asset-cost', assetId],
    queryFn: () => getAssetCostSummary(assetId),
    enabled: !!assetId,
  })

  const original = data ? num(data.original_value) : num(fallbackOriginalValue)
  const capitalised = num(data?.capitalized_parts)
  const expensed = num(data?.expensed_parts)
  const consumables = num(data?.consumables_spend)
  const labour = num(data?.labour_and_other_cost)
  const combined = data?.combined_value != null ? num(data.combined_value) : original + capitalised
  const tco = data?.total_cost_of_ownership != null
    ? num(data.total_cost_of_ownership)
    : original + capitalised + expensed + consumables + labour

  const body = (
    <>
      {error && (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote error={error} />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => refetch()}
            style={{ marginTop: 8 }}
          >
            <RotateCcw size={13} /> Retry
          </button>
        </div>
      )}

      {isPending && !!assetId ? (
        <Spinner label="Adding up parts and labour…" />
      ) : (
        <>
          <div className="pt-cost-rows">
            <CostRow label="Purchase value" value={original} />
            <CostRow label="Parts capitalised" value={capitalised} hint="Adds to the asset's value" />
            <CostRow label="Parts expensed" value={expensed} hint="Booked as repair expense" />
            <CostRow label="Consumables" value={consumables} />
            <CostRow label="Labour & other" value={labour} />
            <CostRow label="Asset value (combined)" value={combined} total />
            <CostRow label="Total cost of ownership" value={tco} />
          </div>

          {/* People who did not choose this rule still have to read it. */}
          <div
            style={{
              marginTop: 14, display: 'flex', gap: 9, alignItems: 'flex-start',
              padding: '11px 13px', borderRadius: 12,
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              color: 'var(--text-2)', fontSize: '0.78rem', lineHeight: 1.55,
            }}
          >
            <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong style={{ color: 'var(--text-1)' }}>Asset value (combined)</strong> is the
              purchase value plus the parts that were capitalised into this asset
              ({money(original)} + {money(capitalised)}). Expensed parts, consumables and labour
              are shown separately and are not added to the asset's value — they roll up into
              total cost of ownership.
            </span>
          </div>

          {data && num(data.scrapped_parts_count) > 0 && (
            <div
              style={{
                marginTop: 10, padding: '10px 13px', borderRadius: 12,
                background: 'var(--status-danger-soft)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)', fontSize: '0.78rem', lineHeight: 1.5,
              }}
            >
              {num(data.scrapped_parts_count)} part{num(data.scrapped_parts_count) === 1 ? '' : 's'} from
              this asset {num(data.scrapped_parts_count) === 1 ? 'has' : 'have'} been scrapped —
              {' '}{money(data.scrapped_parts_value)} written off,
              {' '}{money(data.scrap_recovery_value)} recovered.
            </div>
          )}
        </>
      )}
    </>
  )

  if (bare) return body

  return (
    <div
      style={{
        background: 'var(--bg-2)', border: '1.5px solid var(--border)',
        borderRadius: 16, padding: 16, boxShadow: 'var(--clay-shadow-sm)',
        minWidth: 0, overflow: 'hidden',
      }}
    >
      <div className="pt-section-head">
        <h3 className="pt-section-title">
          <IndianRupee size={15} style={{ color: 'var(--status-success)' }} />
          Asset value & parts spend
        </h3>
        {isFetching && !isPending && (
          <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>updating…</span>
        )}
      </div>
      {body}
    </div>
  )
}
