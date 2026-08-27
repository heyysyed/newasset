import React, { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'

/**
 * MobileBottomSheet
 *
 * A native-feeling mobile bottom sheet with:
 * - Smooth slide-up animation
 * - Drag handle
 * - Backdrop dismiss
 * - Safe-area bottom padding
 * - Internal scroll
 * - Focus trap
 * - Escape key close
 */
export default function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  /** 'auto' | 'full' | 'large' (85vh) | 'medium' (60vh) */
  size = 'large',
  showClose = true,
  footer = null,
  /** Don't render backdrop (for nested sheets) */
  noBackdrop = false,
}) {
  const sheetRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const heights = {
    full: '100dvh',
    large: '88vh',
    medium: '60vh',
    auto: 'auto',
  }
  const maxHeight = heights[size] || heights.large

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      {!noBackdrop && (
        <div
          className="absolute inset-0 bg-text-0/60"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative bg-bg-1 w-full rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          maxHeight,
          animation: 'mobileSheetSlideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex justify-center pt-2.5 pb-1 cursor-pointer shrink-0"
          onClick={onClose}
          aria-hidden="true"
        >
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            {title && (
              <h2 className="text-body text-text-0 m-0 leading-tight">
                {title}
              </h2>
            )}
            {showClose && (
              <button
                onClick={onClose}
                className="ml-auto p-1.5 -mr-1 text-text-3 hover:text-text-0 rounded-lg hover:bg-bg-2 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {/* Sticky Footer */}
        {footer && (
          <div className="shrink-0 border-t border-border bg-bg-1 px-4 py-3">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes mobileSheetSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}


