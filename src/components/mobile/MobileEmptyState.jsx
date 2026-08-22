import React from 'react'

/**
 * MobileEmptyState
 *
 * Professional empty / zero-data state for mobile list views.
 * Replaces broken-looking empty rectangles.
 */
export default function MobileEmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-8
        ${compact ? 'py-10' : 'py-16'}
      `}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-bg-2 border border-border flex items-center justify-center mb-4">
          <Icon size={28} className="text-text-3" />
        </div>
      )}
      <h3 className="text-body text-text-0 mb-1.5 m-0">{title}</h3>
      {description && (
        <p className="text-small text-text-3 leading-relaxed max-w-xs mb-5 m-0">
          {description}
        </p>
      )}
      {action && actionLabel && (
        <button
          onClick={action}
          className="btn-primary"
          style={{ minHeight: 44 }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
