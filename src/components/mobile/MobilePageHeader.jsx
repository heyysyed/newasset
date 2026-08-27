import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

/**
 * MobilePageHeader
 *
 * Reusable sticky page header for mobile inner screens.
 * High-contrast, solid background, 44px touch targets.
 * Contains: [Back Button] [Page Title] [Primary Action (optional)]
 */
export default function MobilePageHeader({ title, action, actionLabel, onBack, actionIcon: ActionIcon }) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <div className="sticky top-0 z-40 bg-bg-0 border-b border-border px-3 flex items-center justify-between shadow-sm lg:hidden" style={{ minHeight: 56 }}>
      <div className="flex items-center flex-1 min-w-0">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 text-text-1 hover:text-text-0 active:bg-bg-3 rounded-lg transition-colors flex items-center justify-center"
          style={{ width: 44, height: 44 }}
          aria-label="Go back"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-section-title text-text-0 truncate ml-1">{title}</h1>
      </div>
      {action && (
        <button
          onClick={action}
          className="btn-primary flex items-center justify-center shrink-0 shadow-sm ml-2"
          style={{ padding: '0 16px', minHeight: 44, borderRadius: 8 }}
        >
          {ActionIcon && <ActionIcon size={18} className="mr-1.5" />}
          {actionLabel && <span className="text-small">{actionLabel}</span>}
        </button>
      )}
    </div>
  )
}


