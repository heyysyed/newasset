import React, { lazy, Suspense, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Ordered list of routes to match the tabs order
  const routes = ['overview', 'tickets', 'work-orders', 'preventive', 'logs', 'vendors', 'analytics'];
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe || isRightSwipe) {
      // Find current active route index based on URL
      const currentPath = location.pathname.split('/').pop();
      const currentIndex = routes.indexOf(currentPath);
      
      if (currentIndex === -1) return;

      if (isLeftSwipe && currentIndex < routes.length - 1) {
        // Swiped left, go to next tab
        navigate(`/maintenance/${routes[currentIndex + 1]}`);
      }
      if (isRightSwipe && currentIndex > 0) {
        // Swiped right, go to previous tab
        navigate(`/maintenance/${routes[currentIndex - 1]}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <MaintenanceHeader />
      <MaintenanceNavigation />
      
      <div 
        className="flex-1 overflow-auto overflow-x-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
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
