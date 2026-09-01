import React from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import MobileBottomSheet from './MobileBottomSheet'

/**
 * MobileFilterSheet
 *
 * A bottom-sheet filter panel. Children are the filter fields.
 * Has a sticky footer with [Clear All] [Apply] buttons.
 *
 * Usage:
 * <MobileFilterSheet
 *   isOpen={showFilters}
 *   onClose={() => setShowFilters(false)}
 *   activeCount={3}          // number of active filters
 *   onClear={clearAllFilters}
 *   onApply={() => setShowFilters(false)}
 * >
 *   <FilterField label="Status" ... />
 *   <FilterField label="Site" ... />
 * </MobileFilterSheet>
 *
 * Also exports <MobileFilterTrigger> - the button that opens the sheet.
 */
export default function MobileFilterSheet({
  isOpen,
  onClose,
  activeCount = 0,
  onClear,
  onApply,
  children,
}) {
  const footer = (
    <div className="flex gap-3">
      <button
        onClick={() => { onClear?.(); onClose() }}
        className="flex-1 btn-ghost"
        style={{ minHeight: 48 }}
      >
        Clear All
      </button>
      <button
        onClick={() => { onApply?.(); onClose() }}
        className="flex-1 btn-primary"
        style={{ minHeight: 48 }}
      >
        Apply Filters
        {activeCount > 0 && (
          <span className="ml-1.5 bg-[var(--bg-surface)]/20 text-white text-caption px-2 py-0.5 rounded-full">
            {activeCount}
          </span>
        )}
      </button>
    </div>
  )

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Filter"
      size="large"
      footer={footer}
    >
      <div className="px-4 py-4 flex flex-col gap-5">
        {children}
      </div>
    </MobileBottomSheet>
  )
}

/** FilterRow - a single labeled filter field inside the sheet */
export function FilterRow({ label, children }) {
  return (
    <div>
      <label className="block text-caption text-text-2 uppercase tracking-wider mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

/** MobileFilterTrigger - the "Filter" button with active indicator */
export function MobileFilterTrigger({ onClick, activeCount = 0, label = 'Filter' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 rounded-xl border text-body-medium text-small transition-all shrink-0 shadow-sm
        ${activeCount > 0
          ? 'bg-accent text-white border-accent shadow-accent/20'
          : 'bg-bg-0/60 backdrop-blur-md text-text-1 border-border/60 hover:border-accent/50 hover:bg-bg-1'
        }
      `}
      style={{ height: 48, minWidth: 80 }}
      aria-label={`${label}${activeCount > 0 ? `, ${activeCount} active` : ''}`}
    >
      <SlidersHorizontal size={15} />
      {label}
      {activeCount > 0 && (
        <span className="bg-[var(--bg-surface)] text-accent text-caption w-5 h-5 rounded-full flex items-center justify-center shrink-0">
          {activeCount}
        </span>
      )}
    </button>
  )
}

/** MobileChipFilter - horizontal scrollable chip row for quick status filters */
export function MobileChipFilter({ options, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(isActive ? '' : opt.value)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-small text-body-medium whitespace-nowrap shrink-0 transition-all shadow-sm
              ${isActive
                ? 'bg-accent text-white shadow-accent/30 border border-accent'
                : 'bg-bg-0/60 backdrop-blur-md text-text-1 border border-border/60 hover:border-accent/40 hover:bg-bg-1'
              }
            `}
            style={{ minHeight: 36 }}
          >
            {opt.dot && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: opt.dot }}
              />
            )}
            {opt.label}
            {opt.count !== undefined && (
              <span className={`text-caption ${isActive ? 'text-white/70' : 'text-text-3'}`}>
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}


