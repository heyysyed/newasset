import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Ticket, Hammer, CalendarClock, History, Users, BarChart3 } from 'lucide-react';

export default function MaintenanceNavigation() {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, to: '/maintenance/overview' },
    { id: 'tickets', label: 'Tickets', icon: Ticket, to: '/maintenance/tickets' },
    { id: 'work-orders', label: 'Work Orders', icon: Hammer, to: '/maintenance/work-orders' },
    { id: 'preventive', label: 'Preventive', icon: CalendarClock, to: '/maintenance/preventive' },
    { id: 'logs', label: 'Logs', icon: History, to: '/maintenance/logs' },
    { id: 'vendors', label: 'Vendors', icon: Users, to: '/maintenance/vendors' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, to: '/maintenance/analytics' },
  ];

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 8,
      padding: '0 24px', 
      background: 'var(--bg-0)',
      borderBottom: '1px solid var(--border)',
      overflowX: 'auto',
      whiteSpace: 'nowrap'
    }}>
      {navItems.map(item => (
        <NavLink
          key={item.id}
          to={item.to}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            color: isActive ? 'var(--accent)' : 'var(--text-2)',
            borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: '-1px',
            fontWeight: isActive ? 600 : 500,
            textDecoration: 'none',
            fontSize: '0.9rem',
            transition: 'all 0.2s ease',
            outline: 'none'
          })}
        >
          <item.icon size={16} />
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}


