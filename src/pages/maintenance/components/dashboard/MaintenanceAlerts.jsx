import React from 'react';
import { AlertTriangle, Clock, Activity, ArrowRight } from 'lucide-react';

export default function MaintenanceAlerts({ attentionQueue, isLoading }) {
  if (isLoading) {
    return (
      <div className="bg-[var(--bg-0)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div className="skeleton w-36 h-6 mb-4 rounded"></div>
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => <div key={`skel-${i}`} className="skeleton h-20 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const items = (attentionQueue || []).slice(0, 8); // Max 8 items

  return (
    <div className="bg-[var(--bg-0)] border border-[var(--border)] rounded-2xl flex flex-col shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-0)]">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={20} className="text-[var(--status-danger)]" />
          <h3 className="m-0 text-lg font-bold text-[var(--text-0)]">
            Requires Attention
          </h3>
        </div>
        {items.length > 0 && (
          <span className="bg-[var(--status-danger)] text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">
            {attentionQueue.length}
          </span>
        )}
      </div>

      <div className="p-4 md:p-5 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[500px]">
        {items.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-3)] flex flex-col items-center">
            <CheckCircle2 size={48} className="mb-4 opacity-40 text-[var(--status-success)]" />
            <p className="m-0 font-semibold text-[var(--text-1)]">All clear!</p>
            <p className="mt-1 text-sm">No urgent items require attention.</p>
          </div>
        ) : (
          items.map((item, idx) => {
            const isBreached = item.slaStatus === 'BREACHED';
            const isCritical = item.priority === 'CRITICAL';
            
            return (
              <div 
                key={`${item.type}-${item.id}`} 
                className={`group flex items-center justify-between p-3.5 md:p-4 bg-[var(--bg-1)] rounded-xl border-l-4 shadow-sm hover:shadow transition-all cursor-pointer ${
                  isBreached ? 'border-[var(--status-danger)]' : isCritical ? 'border-[var(--status-warning)]' : 'border-[var(--accent)]'
                }`}
              >
                <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--bg-2)] text-[var(--text-2)]">
                      {item.type.replace('_', ' ')}
                    </span>
                    <h4 className="text-sm md:text-base font-semibold text-[var(--text-0)] truncate m-0">
                      {item.title}
                    </h4>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 mt-0.5">
                    <span className="text-xs md:text-sm text-[var(--text-2)] truncate max-w-full">
                      {item.assets?.name} {item.assets?.sites?.name ? `(${item.assets.sites.name})` : ''}
                    </span>
                    {isBreached ? (
                      <span className="text-[var(--status-danger)] text-xs font-medium flex items-center gap-1 shrink-0">
                        <Clock size={12} /> Breached SLA
                      </span>
                    ) : (
                      <span className="text-[var(--status-warning)] text-xs font-medium flex items-center gap-1 shrink-0">
                        <Clock size={12} /> SLA At Risk
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-2)] group-hover:bg-[var(--bg-3)] transition-colors">
                  <ArrowRight size={16} className="text-[var(--text-2)] group-hover:text-[var(--text-0)] transition-colors" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {attentionQueue?.length > 8 && (
        <div className="px-6 py-3 border-t border-[var(--border)] text-center bg-[var(--bg-0)]">
          <button className="text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text-0)] transition-colors">
            View all {attentionQueue.length} items
          </button>
        </div>
      )}
    </div>
  );
}

import { CheckCircle2 } from 'lucide-react';


