/**
 * InventoryWorkspace.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The inventory module, in one responsive component. Phone, tablet and desktop
 * all render this — the `.pt-*` primitives in src/index.css swap the table for a
 * card list and the dialogs for bottom sheets, so there is no separate mobile
 * code path to drift out of sync.
 *
 * Two tracks, matching the schema exactly:
 *   · Serialized  `serialized_components`  — one row = one physical part
 *   · Bulk        `bulk_items` + `bulk_site_stock` — quantity-only SKUs
 *
 * `inventory_items` is retired (renamed `inventory_items_archive` by migration
 * 004) and is never read or written from here.
 */

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Cpu, Boxes, ClipboardList, FileText, Send, Package, RefreshCw, Lock,
} from 'lucide-react'
import {
  getPartsInventoryStats, fetchPartsSites, fetchBulkItems, fetchBulkSiteStockRows,
} from '../../services/partsService'
import { supabase, fetchGatePasses } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/depreciation'
import { PARTS_KEYS, Spinner, ErrorNote, usePartsInvalidator } from './partsUI'
import SerializedComponentsTab from './SerializedComponentsTab'
import BulkStockTab from './BulkStockTab'
import BulkCatalogueTab from './BulkCatalogueTab'
import GatePassTab from './GatePassTab'
import IssueSlipTab from '../materials/IssueSlipTab'

const TABS = [
  { key: 'serialized', label: 'Serialized Parts', icon: Cpu },
  { key: 'bulk', label: 'Bulk Stock', icon: Boxes },
  { key: 'catalogue', label: 'Item Catalogue', icon: ClipboardList },
  { key: 'gate_pass', label: 'Gate Pass', icon: FileText },
  { key: 'issue_slips', label: 'Issue Slips', icon: Send, writeOnly: true },
]

function Metric({ label, value, hint, tone }) {
  return (
    <div className="pt-metric">
      <div className="pt-metric-label">{label}</div>
      <div className="pt-metric-value" style={tone ? { color: tone } : undefined}>{value}</div>
      {hint && <div className="pt-metric-hint">{hint}</div>}
    </div>
  )
}

function MetricsStrip() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: PARTS_KEYS.stats,
    queryFn: getPartsInventoryStats,
  })

  if (error) return <ErrorNote error={error} />
  if (isLoading || !stats) {
    return (
      <div className="pt-metrics">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div className="pt-metric" key={i}>
            <div className="pt-metric-label">Loading</div>
            <div className="pt-metric-value" style={{ color: 'var(--text-3)' }}>—</div>
          </div>
        ))}
      </div>
    )
  }

  const s = stats.serialized
  const b = stats.bulk
  const needsReorder = b.outOfStock + b.lowStock

  return (
    <div className="pt-metrics">
      <Metric
        label="Serialized parts" value={s.total}
        hint={`${s.available} available · ${s.installed} installed`}
      />
      <Metric
        label="Stock value (serialized)" value={formatCurrency(s.stockValue)}
        hint="Available to install"
      />
      <Metric
        label="Installed value" value={formatCurrency(s.installedValue)}
        hint={`${s.installed} part${s.installed === 1 ? '' : 's'} in assets`}
      />
      <Metric
        label="Bulk stock value" value={formatCurrency(b.stockValue)}
        hint={`${b.lines} site record${b.lines === 1 ? '' : 's'}`}
      />
      <Metric
        label="Needs reordering" value={needsReorder}
        hint={`${b.outOfStock} out of stock · ${b.lowStock} low`}
        tone={needsReorder > 0 ? 'var(--status-warning)' : undefined}
      />
      <Metric
        label="Scrap book loss" value={formatCurrency(s.scrapLoss)}
        hint={`${s.scrapped} scrapped · ${s.underRepair} under repair`}
        tone={s.scrapLoss > 0 ? 'var(--status-danger)' : undefined}
      />
    </div>
  )
}

export default function InventoryWorkspace() {
  const { user, isAdmin, isMod, can, canAccessSite } = useAuth()
  // Real permission gate. Admins short-circuit inside can(), moderators are
  // checked against can_access_inventory, plain users get read-only.
  const canWrite = isAdmin || isMod || (typeof can === 'function' ? can('inventory') : false)

  const [tab, setTab] = useState('serialized')
  const invalidate = usePartsInvalidator()

  const visibleTabs = useMemo(
    () => TABS.filter(t => !t.writeOnly || canWrite),
    [canWrite],
  )

  const { data: allSites = [] } = useQuery({
    queryKey: ['parts-sites'],
    queryFn: fetchPartsSites,
  })

  // Moderators only see the sites they are assigned to.
  const sites = useMemo(
    () => (typeof canAccessSite === 'function' ? allSites.filter(s => canAccessSite(s)) : allSites),
    [allSites, canAccessSite],
  )

  /* ── data the older gate-pass / issue-slip tabs still expect ─────────────
     Loaded only while their tab is open so the two-track tabs stay fast.   */
  const legacyEnabled = tab === 'gate_pass' || tab === 'issue_slips'

  const { data: bulkItems = [] } = useQuery({
    queryKey: [...PARTS_KEYS.bulkItems, 'legacy'],
    queryFn: () => fetchBulkItems({}),
    enabled: legacyEnabled,
  })

  const { data: siteStock = [] } = useQuery({
    queryKey: [...PARTS_KEYS.bulkStock, 'legacy-rows'],
    queryFn: () => fetchBulkSiteStockRows({}),
    enabled: legacyEnabled,
  })

  const { data: gatePasses = [], isLoading: gpLoading } = useQuery({
    queryKey: ['gate-passes'],
    queryFn: () => fetchGatePasses(),
    enabled: tab === 'gate_pass',
  })

  const { data: assets = [] } = useQuery({
    queryKey: ['assets-for-gate-pass'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('id, asset_name, asset_code, category, status, site')
        .not('site', 'is', null)
        .order('asset_name')
      if (error) throw error
      return data || []
    },
    enabled: tab === 'gate_pass',
  })

  return (
    <div className="animate-fade-up">
      {/* ── header ──────────────────────────────────────────────────────── */}
      <div className="pt-section-head" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: 'var(--accent-soft)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Package size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 className="pt-section-title" style={{ margin: 0 }}>Inventory &amp; Parts</h2>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-3)' }}>
              Serialized parts with a lifecycle, plus quantity-only bulk stock per site
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {!canWrite && (
            <span className="pt-pill neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Lock size={11} /> Read only
            </span>
          )}
          <button
            type="button" className="btn-ghost" onClick={() => invalidate()}
            title="Refresh everything"
            style={{ padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> <span className="inv-btn-label">Refresh</span>
          </button>
        </div>
      </div>

      {/* ── KPI strip · covers both tracks ─────────────────────────────── */}
      <MetricsStrip />

      {/* ── tabs ────────────────────────────────────────────────────────── */}
      <div className="tab-container" style={{ marginTop: 18, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {visibleTabs.map(t => (
          <button
            key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            style={{ whiteSpace: 'nowrap' }}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        {tab === 'serialized' && (
          <SerializedComponentsTab sites={sites} canWrite={canWrite} userId={user?.id} />
        )}
        {tab === 'bulk' && (
          <BulkStockTab sites={sites} canWrite={canWrite} userId={user?.id} />
        )}
        {tab === 'catalogue' && (
          <BulkCatalogueTab canWrite={canWrite} />
        )}
        {tab === 'gate_pass' && (
          gpLoading ? <Spinner label="Loading gate passes…" /> : (
            <GatePassTab
              gatePasses={gatePasses}
              items={bulkItems}
              assets={assets}
              sites={sites}
              onRefresh={() => invalidate([['gate-passes']])}
            />
          )
        )}
        {tab === 'issue_slips' && canWrite && (
          <IssueSlipTab
            items={bulkItems}
            stock={siteStock}
            sites={sites}
            onRefresh={() => invalidate()}
          />
        )}
      </div>
    </div>
  )
}

export { MetricsStrip }
