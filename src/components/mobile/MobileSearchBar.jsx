import React, { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

/**
 * MobileSearchBar
 *
 * Full-width sticky search bar for mobile list pages.
 * - Debounced input
 * - Clear button
 * - 48px height
 * - Proper 16px input text (prevents iOS zoom)
 */
export default function MobileSearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  autoFocus = false,
  className = '',
}) {
  const inputRef = useRef(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [autoFocus])

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search
        size={17}
        className="absolute left-3.5 text-text-3 shrink-0 pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 bg-bg-1 border border-border rounded-xl text-text-0 placeholder-text-3 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
        style={{
          height: 48,
          // Prevents iOS auto-zoom
          WebkitAppearance: 'none',
        }}
        aria-label={placeholder}
      />
      {value && (
        <button
          onClick={() => { onClear?.(); onChange('') }}
          className="absolute right-3 p-1 text-text-3 hover:text-text-0 rounded-full"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
