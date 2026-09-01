import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Ticket, Hammer, CalendarClock, History, Users, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MaintenanceNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, to: '/maintenance/overview', color: 'var(--accent)' },
    { id: 'tickets', label: 'Tickets', icon: Ticket, to: '/maintenance/tickets', color: '#0ea5e9' },
    { id: 'work-orders', label: 'Work Orders', icon: Hammer, to: '/maintenance/work-orders', color: '#f59e0b' },
    { id: 'preventive', label: 'Preventive', icon: CalendarClock, to: '/maintenance/preventive', color: '#8b5cf6' },
    { id: 'logs', label: 'Logs', icon: History, to: '/maintenance/logs', color: '#64748b' },
    { id: 'vendors', label: 'Vendors', icon: Users, to: '/maintenance/vendors', color: '#10b981' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, to: '/maintenance/analytics', color: '#ec4899' },
  ];

  const currentPath = location.pathname.split('/').pop();
  const activeIndex = navItems.findIndex(item => item.id === currentPath);
  // Default to overview if not found
  const index = activeIndex !== -1 ? activeIndex : 0;
  const currentItem = navItems[index];
  const Icon = currentItem.icon;

  return (
    <div className="pb-4 sticky top-0 z-10 w-full bg-transparent">
      {/* Pagination Dots */}
      <div className="flex justify-center gap-1.5 mb-4">
        {navItems.map((item, idx) => (
          <button 
            key={item.id}
            onClick={() => navigate(item.to)}
            className={`h-1.5 rounded-full transition-all duration-300 ${idx === index ? 'w-6' : 'w-1.5 bg-[var(--border)] hover:bg-[var(--text-3)]'}`}
            style={idx === index ? { backgroundColor: item.color } : {}}
            title={item.label}
          />
        ))}
      </div>

      {/* Dynamic Page Header */}
      <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-[var(--border)] shadow-sm bg-[var(--bg-1)]">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0" style={{ backgroundColor: currentItem.color }}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl font-bold text-[var(--text-0)] m-0 leading-tight truncate">{currentItem.label}</h2>
          <p className="text-xs text-[var(--text-3)] m-0 mt-0.5">Swipe or use arrows to navigate</p>
        </div>

        {/* Desktop Navigation Arrows */}
        <div className="hidden sm:flex items-center gap-1">
          <button 
            onClick={() => {
              if (index > 0) navigate(navItems[index - 1].to)
            }}
            disabled={index === 0}
            className="p-2 rounded-xl text-[var(--text-2)] hover:text-[var(--text-0)] hover:bg-[var(--bg-2)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => {
              if (index < navItems.length - 1) navigate(navItems[index + 1].to)
            }}
            disabled={index === navItems.length - 1}
            className="p-2 rounded-xl text-[var(--text-2)] hover:text-[var(--text-0)] hover:bg-[var(--bg-2)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}


