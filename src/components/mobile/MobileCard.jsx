import React from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * MobileCard
 *
 * Generic mobile card shell for list items.
 * Enforces correct touch targets, spacing, and styling.
 */
export default function MobileCard({
  children,
  onClick,
  actionIcon: ActionIcon = ChevronRight,
  className = '',
  statusDot, // Optional color for a status dot
  title, // Optional title, shown at the top
}) {
  const Component = onClick ? 'button' : 'div'
  
  return (
    <Component
      onClick={onClick}
      className={`relative w-full bg-bg-0 border border-border rounded-2xl p-4 text-left transition-colors
        ${onClick ? 'active:scale-[0.98] hover:bg-bg-1' : ''}
        ${className}
      `}
    >
      <div className="flex items-start gap-3 w-full">
        {statusDot && (
          <div className="mt-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusDot }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-body text-text-0 mb-1 leading-tight">{title}</h4>
          )}
          {children}
        </div>
        {onClick && ActionIcon && (
          <div className="shrink-0 text-text-3 pl-2 flex items-center justify-center self-center" style={{ minHeight: 44 }}>
            <ActionIcon size={20} />
          </div>
        )}
      </div>
    </Component>
  )
}
