import React from 'react';
import { Loader2 } from 'lucide-react';

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading = false, 
  icon: Icon,
  className = '',
  disabled,
  ...props 
}) {
  const baseStyles = "inline-flex items-center justify-center gap-2 text-body-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-hover border border-transparent shadow-sm",
    secondary: "bg-[var(--bg-surface)] text-text-0 border border-border-dark hover:bg-bg-3 shadow-sm",
    danger: "bg-danger text-white hover:bg-danger-subtle hover:text-danger-text border border-transparent shadow-sm",
    ghost: "bg-transparent text-text-1 hover:bg-bg-3 border border-transparent",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-caption rounded",
    md: "px-4 py-2 text-small rounded-md min-h-[38px]",
    lg: "px-5 py-2.5 text-body rounded-md min-h-[44px]",
    icon: "p-2 rounded-md min-h-[38px] min-w-[38px]",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
}


