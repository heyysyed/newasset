import React from 'react';

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`bg-bg-1 border border-border rounded-lg shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', actions }) {
  return (
    <div className={`px-5 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap ${className}`}>
      {children}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-body-medium text-text-0 text-body m-0 ${className}`}>
      {children}
    </h3>
  );
}

export function CardBody({ children, className = '', noPadding = false }) {
  return (
    <div className={`${noPadding ? '' : 'p-5'} ${className}`}>
      {children}
    </div>
  );
}
