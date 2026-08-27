import React from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export const PageHeader = ({ 
  title, 
  description, 
  breadcrumbs = [], 
  actions, 
  status,
  contextualActions 
}) => {
  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center text-small text-text-3 text-body-medium">
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={idx}>
              {bc.to ? (
                <Link to={bc.to} className="hover:text-text-0 transition-colors">
                  {bc.label}
                </Link>
              ) : (
                <span className="text-text-1">{bc.label}</span>
              )}
              {idx < breadcrumbs.length - 1 && (
                <ChevronRight size={14} className="mx-2 opacity-50" />
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Main Header Content */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-page-title text-text-0 truncate font-display tracking-tight">
              {title}
            </h1>
            {status && (
              <div className="shrink-0">{status}</div>
            )}
          </div>
          {description && (
            <p className="text-small text-text-2 mt-1 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Actions Area */}
        {(actions || contextualActions) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
            {contextualActions && (
              <div className="flex items-center gap-2 pr-2 sm:border-r border-border">
                {contextualActions}
              </div>
            )}
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


