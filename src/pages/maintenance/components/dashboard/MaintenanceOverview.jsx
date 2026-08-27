import React from 'react';
import { useMaintenanceOverview } from '../../hooks/useMaintenanceOverview';
import KPIStrip from './KPIStrip';
import MaintenanceHealthScore from './MaintenanceHealthScore';
import MaintenanceAlerts from './MaintenanceAlerts';
import ActiveWorkOrdersTable from './ActiveWorkOrdersTable';
import PMForecast from './PMForecast';
import CostSnapshot from './CostSnapshot';
import TechnicianWorkload from './TechnicianWorkload';

export default function MaintenanceOverview() {
  const overview = useMaintenanceOverview();

  if (overview.isError) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--status-danger)' }}>
        Unable to load overview data. 
        <button onClick={overview.refetchAll} className="btn-primary" style={{ margin: '12px auto', display: 'block' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1600, margin: '0 auto' }}>
      
      {/* 1. Context / Heading is handled by MaintenanceHeader, but we can add a small timestamp here if wanted, 
          though it's requested in the header. We'll leave it in header / rely on React Query cache for freshness. */}

      {/* 2. KPI Strip */}
      <KPIStrip 
        kpis={overview.kpis} 
        slaBreachedCount={overview.slaBreachedCount} 
        slaAtRiskCount={overview.slaAtRiskCount} 
        isLoading={overview.isLoading} 
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        {/* Left Column (Primary Operations) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 4. Attention Center */}
          <MaintenanceAlerts attentionQueue={overview.attentionQueue} isLoading={overview.isLoading} />
          
          {/* 6. Active Work Orders */}
          <ActiveWorkOrdersTable workOrders={overview.activeWorkOrders} isLoading={overview.isLoading} />
        </div>

        {/* Right Column (Secondary / Summaries) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 3. Maintenance Health */}
          <MaintenanceHealthScore kpis={overview.kpis} slaBreachedCount={overview.slaBreachedCount} isLoading={overview.isLoading} />
          
          {/* 7. PM Forecast */}
          <PMForecast schedules={overview.pmForecast} isLoading={overview.isLoading} />
          
          {/* 8. Technician Workload */}
          <TechnicianWorkload workOrders={overview.activeWorkOrders} isLoading={overview.isLoading} />
          
          {/* 9. Cost Snapshot */}
          <CostSnapshot costs={overview.costs} isLoading={overview.isLoading} />
        </div>
      </div>
    </div>
  );
}


