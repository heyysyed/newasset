import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MaintenanceHeader from './components/layout/MaintenanceHeader';
import MaintenanceNavigation from './components/layout/MaintenanceNavigation';

import MaintenanceOverview from './components/dashboard/MaintenanceOverview';
import TicketsWorkspace from './components/tickets/TicketsWorkspace';
import WorkOrdersWorkspace from './components/workOrders/WorkOrdersWorkspace';

const AnalyticsWorkspace = lazy(() => import('./components/analytics/AnalyticsWorkspace'));
const VendorsWorkspace   = lazy(() => import('./components/vendors/VendorsWorkspace'));
const PMWorkspace        = lazy(() => import('./components/pm/PMWorkspace'));
const LogsWorkspace      = lazy(() => import('./components/logs/LogsWorkspace'));

const Loading         = () => <div style={{ padding: 24, color: 'var(--text-2)' }}>Loading…</div>;

export default function MaintenanceCommandCenter() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-1)' }}>
      <MaintenanceHeader />
      <MaintenanceNavigation />
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route index element={<Navigate to="/maintenance/overview" replace />} />
            <Route path="overview"     element={<MaintenanceOverview />} />
            <Route path="tickets"      element={<TicketsWorkspace />} />
            <Route path="work-orders"  element={<WorkOrdersWorkspace />} />
            <Route path="preventive"   element={<PMWorkspace />} />
            <Route path="logs"         element={<LogsWorkspace />} />
            <Route path="analytics"    element={<AnalyticsWorkspace />} />
            <Route path="vendors"      element={<VendorsWorkspace />} />
            <Route path="*"            element={<Navigate to="/maintenance/overview" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}
