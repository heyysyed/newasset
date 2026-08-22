import React from 'react';

const variantClasses = {
  success: 'bg-success-subtle text-success-text border-success-subtle',
  warning: 'bg-warning-subtle text-warning-text border-warning-subtle',
  danger: 'bg-danger-subtle text-danger-text border-danger-subtle',
  info: 'bg-info-subtle text-info-text border-info-subtle',
  neutral: 'bg-bg-3 text-text-2 border-border',
  primary: 'bg-accent-subtle text-accent-hover border-accent-subtle',
};

export function Badge({ children, variant = 'neutral', className = '' }) {
  const baseClasses = 'inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full text-caption text-body-medium border whitespace-nowrap';
  const vClass = variantClasses[variant] || variantClasses.neutral;
  
  return (
    <span className={`${baseClasses} ${vClass} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  let variant = 'neutral';
  switch (status) {
    case 'Active':
      variant = 'success';
      break;
    case 'Under Repair':
      variant = 'warning';
      break;
    case 'Disposed':
      variant = 'danger';
      break;
    case 'On Hire':
      variant = 'info';
      break;
    case 'Inactive':
    default:
      variant = 'neutral';
      break;
  }
  
  return <Badge variant={variant}>{status}</Badge>;
}
