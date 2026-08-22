import React, { useMemo, useState } from 'react'
import { PlusCircle, Search, Filter, MoreVertical, Edit2, ArrowRightLeft, Tag, History, Trash2, MapPin } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import MobileSearchBar from './MobileSearchBar'
import MobileFilterSheet, { FilterRow, MobileFilterTrigger, MobileChipFilter } from './MobileFilterSheet'
import MobileActionSheet from './MobileActionSheet'
import MobileCard from './MobileCard'
import MobileEmptyState from './MobileEmptyState'
import { calculateBookValue, formatCurrency } from '../../lib/depreciation'
import { STATUS_BADGE } from '../../pages/AssetList' // Re-export or redefine

import MobileAssetCard from './MobileAssetCard'

export default function MobileAssetList({
  assets,
  loading,
  searchQ,
  setLocalSearch,
  statusQ,
  setParam,
  categoryQ,
  siteQ,
  STATUSES,
  categories,
  sites,
  can,
  isAdmin,
  handleDelete,
  setShowHistoryAsset,
}) {
  const navigate = useNavigate()

  // Filter Sheet State
  const [showFilters, setShowFilters] = useState(false)
  const activeFilterCount = (statusQ && statusQ !== 'All' ? 1 : 0) + (categoryQ && categoryQ !== 'All' ? 1 : 0) + (siteQ && siteQ !== 'All' ? 1 : 0)

  const clearAllFilters = () => {
    setParam('status', '')
    setParam('category', '')
    setParam('site', '')
  }

  // Action Sheet State
  const [actionAsset, setActionAsset] = useState(null)

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'var(--status-success)'
      case 'Inactive': return 'var(--status-danger)'
      case 'Under Repair': return 'var(--status-warning)'
      case 'Disposed': return '#6b7280'
      case 'On Hire': return 'var(--accent)'
      default: return '#6b7280'
    }
  }

  return (
    <div className="flex flex-col min-h-full pb-20">
      
      {/* ── Sticky Top Bar: Search & Filter ── */}
      <div className="sticky top-0 z-30 bg-bg-1 pt-2 pb-3 px-4 border-b border-border shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <MobileSearchBar
            value={searchQ || ''}
            onChange={setLocalSearch}
            placeholder="Search assets, codes, sites..."
            className="flex-1"
          />
          <MobileFilterTrigger
            onClick={() => setShowFilters(true)}
            activeCount={activeFilterCount}
          />
        </div>

        {/* Quick Status Chips */}
        <MobileChipFilter
          options={[
            { label: 'All', value: '' },
            ...STATUSES.map(s => ({ label: s, value: s, dot: getStatusColor(s) }))
          ]}
          value={statusQ === 'All' ? '' : (statusQ || '')}
          onChange={(v) => setParam('status', v)}
        />
      </div>

      {/* ── Asset List ── */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-bg-1 border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <MobileEmptyState
            icon={Search}
            title="No assets found"
            description="Try adjusting your filters or search query."
            action={clearAllFilters}
            actionLabel="Clear Filters"
          />
        ) : (
          assets.map(asset => (
            <MobileAssetCard
              key={asset.id}
              asset={asset}
              onMoreClick={(a) => setActionAsset(a)}
            />
          ))
        )}
      </div>

      {/* ── FAB Add Button ── */}
      {can('add') && (
        <Link
          to="/assets/new"
          className="fixed bottom-[88px] right-4 w-14 h-14 bg-accent text-white rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform z-40"
          aria-label="Add Asset"
        >
          <PlusCircle size={24} />
        </Link>
      )}

      {/* ── Filter Sheet ── */}
      <MobileFilterSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        activeCount={activeFilterCount}
        onClear={clearAllFilters}
        onApply={() => setShowFilters(false)}
      >
        <FilterRow label="Status">
          <select
            className="w-full bg-bg-1 border border-border rounded-xl px-4 py-3 text-small focus:border-accent outline-none"
            value={statusQ || ''}
            onChange={(e) => setParam('status', e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FilterRow>
        
        <FilterRow label="Site">
          <select
            className="w-full bg-bg-1 border border-border rounded-xl px-4 py-3 text-small focus:border-accent outline-none"
            value={siteQ || ''}
            onChange={(e) => setParam('site', e.target.value)}
          >
            <option value="">All Sites</option>
            {sites.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </FilterRow>

        <FilterRow label="Category">
          <select
            className="w-full bg-bg-1 border border-border rounded-xl px-4 py-3 text-small focus:border-accent outline-none"
            value={categoryQ || ''}
            onChange={(e) => setParam('category', e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FilterRow>
      </MobileFilterSheet>

      {/* ── Action Sheet ── */}
      <MobileActionSheet
        isOpen={!!actionAsset}
        onClose={() => setActionAsset(null)}
        title={actionAsset?.asset_name || 'Asset Actions'}
        groups={[
          {
            items: [
              { icon: Edit2, label: 'Edit Asset', onClick: () => { if(can('edit')) navigate(`/assets/${actionAsset.id}/edit`) }, disabled: !can('edit') },
              { icon: ArrowRightLeft, label: 'Transfer Asset', onClick: () => { if(can('edit')) navigate(`/assets/${actionAsset.id}?tab=transfer`) }, disabled: !can('edit') },
              { icon: Tag, label: 'Print QR Tag', onClick: () => { if(can('print_stickers')) navigate(`/stickers?ids=${actionAsset.id}`) }, disabled: !can('print_stickers') },
              { icon: History, label: 'View History', onClick: () => setShowHistoryAsset(actionAsset) },
            ]
          },
          ...(can('delete') ? [{
            destructive: true,
            items: [
              { icon: Trash2, label: 'Delete Asset', danger: true, onClick: () => handleDelete([actionAsset.id]) },
            ]
          }] : [])
        ]}
      />
    </div>
  )
}
