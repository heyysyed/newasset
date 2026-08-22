import React, { forwardRef } from 'react';

export const Input = forwardRef(({ className = '', error, ...props }, ref) => {
  return (
    <div className="w-full">
      <input
        ref={ref}
        className={`bg-bg-1 border ${error ? 'border-danger focus:ring-danger' : 'border-border-dark focus:border-accent focus:ring-1 focus:ring-accent'} text-text-0 rounded-md px-3 py-2 w-full text-small outline-none transition-all min-h-[38px] disabled:opacity-60 disabled:bg-bg-3 ${className}`}
        {...props}
      />
      {error && <p className="text-danger text-caption mt-1 text-body-medium">{error}</p>}
    </div>
  );
});

Input.displayName = 'Input';
