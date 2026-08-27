import React from 'react';
import { Users } from 'lucide-react';

export default function TechnicianWorkload({ workOrders, isLoading }) {
  if (isLoading) {
    return <div className="skeleton" style={{ height: 250, borderRadius: 12 }}></div>;
  }

  // Calculate workload from active work orders for Phase 2.2
  // Real implementation might query an aggregation endpoint, but for now we aggregate the active work orders we fetched.
  const workloadMap = {};
  
  (workOrders || []).forEach(wo => {
    if (wo.profiles && wo.profiles.full_name) {
      const name = wo.profiles.full_name;
      if (!workloadMap[name]) workloadMap[name] = { name, assigned: 0, in_progress: 0, critical: 0 };
      
      if (wo.status === 'assigned') workloadMap[name].assigned++;
      if (wo.status === 'in_progress') workloadMap[name].in_progress++;
      if (wo.priority === 'critical') workloadMap[name].critical++;
    }
  });

  const workloads = Object.values(workloadMap).sort((a, b) => (b.assigned + b.in_progress) - (a.assigned + a.in_progress));

  return (
    <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Users size={20} color="var(--text-1)" />
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-0)' }}>
          Technician Workload
        </h3>
      </div>

      {workloads.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0' }}>
          No active workloads.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {workloads.map(w => {
            const total = w.assigned + w.in_progress;
            let status = 'Normal';
            let color = 'var(--status-success)';
            
            // Simple threshold rule for Phase 2.2
            if (total > 5) { status = 'Overloaded'; color = 'var(--status-danger)'; }
            else if (total > 3) { status = 'Busy'; color = 'var(--status-warning)'; }

            return (
              <div key={w.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{w.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 4 }}>
                    {w.assigned} Assigned • {w.in_progress} In Progress
                    {w.critical > 0 && <span style={{ color: 'var(--status-danger)', marginLeft: 8 }}>({w.critical} Critical)</span>}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, padding: '4px 8px', borderRadius: 12, background: 'var(--bg-1)', color }}>
                  {status}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


