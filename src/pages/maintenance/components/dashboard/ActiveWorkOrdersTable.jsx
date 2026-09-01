import React from 'react';
import { Hammer, ArrowRight, User } from 'lucide-react';

export default function ActiveWorkOrdersTable({ workOrders, isLoading }) {
  if (isLoading) {
    return (
      <div className="bg-[var(--bg-0)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div className="skeleton w-48 h-6 mb-5 rounded"></div>
        <div className="flex flex-col gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-16 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-0)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-0)]">
        <div className="flex items-center gap-2.5">
          <Hammer size={20} className="text-[var(--text-1)]" />
          <h3 className="m-0 text-lg font-bold text-[var(--text-0)]">
            Active Work Orders
          </h3>
        </div>
        <button className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)] transition-colors text-[var(--text-1)]">
          View all <ArrowRight size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[500px]">
        {(!workOrders || workOrders.length === 0) ? (
          <div className="text-center py-12 text-[var(--text-3)] font-medium">
            No active maintenance work orders.
          </div>
        ) : (
          <div className="flex flex-col">
            {workOrders.map((wo, idx) => (
              <div 
                key={wo.id} 
                className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:bg-[var(--bg-1)] transition-colors cursor-pointer ${
                  idx !== workOrders.length - 1 ? 'border-b border-[var(--border)]' : ''
                }`}
              >
                {/* Mobile: Top Row with Title & Status */}
                <div className="flex items-start justify-between gap-4 md:hidden">
                  <div className="flex flex-col min-w-0">
                    <h4 className="font-semibold text-base text-[var(--text-0)] truncate m-0">{wo.title}</h4>
                    <span className="text-xs text-[var(--text-3)] font-mono mt-0.5">WO-{wo.id.substring(0, 8).toUpperCase()}</span>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--bg-2)] text-[var(--text-1)]">
                    {wo.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Desktop: Title */}
                <div className="hidden md:flex flex-col min-w-0 w-1/3 pr-4">
                  <h4 className="font-semibold text-[15px] text-[var(--text-0)] truncate m-0">{wo.title}</h4>
                  <span className="text-xs text-[var(--text-3)] font-mono mt-0.5">WO-{wo.id.substring(0, 8).toUpperCase()}</span>
                </div>

                {/* Asset Info */}
                <div className="flex flex-col min-w-0 md:w-1/4">
                  <span className="text-sm font-medium text-[var(--text-1)] truncate">{wo.assets?.name || 'Unassigned'}</span>
                  {wo.assets?.sites?.name && (
                    <span className="text-xs text-[var(--text-3)] truncate mt-0.5">{wo.assets.sites.name}</span>
                  )}
                </div>

                {/* Technician Info */}
                <div className="flex items-center justify-between md:justify-start gap-4 md:gap-3 mt-1 md:mt-0 md:w-1/4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[var(--bg-2)] flex items-center justify-center text-[var(--text-2)] shrink-0">
                      <User size={12} />
                    </div>
                    <span className="text-sm text-[var(--text-2)] truncate">
                      {wo.profiles?.full_name || 'Unassigned'}
                    </span>
                  </div>
                </div>

                {/* Desktop: Status */}
                <div className="hidden md:flex justify-end min-w-[120px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-[var(--bg-2)] text-[var(--text-1)]">
                    {wo.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


