import React from 'react';
import { Ticket, Hammer, AlertTriangle, Clock, CalendarClock, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function KPIStrip({ kpis, slaBreachedCount, slaAtRiskCount, isLoading }) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={`skel-${i}`} className="skeleton" style={{ height: 90, borderRadius: 12 }}></div>
        ))}
      </div>
    );
  }

  const kpiData = [
    {
      id: 'open-tickets',
      label: 'OPEN TICKETS',
      value: kpis?.openTickets || 0,
      icon: Ticket,
      color: 'var(--text-1)',
      onClick: () => navigate('/maintenance/tickets?status=open')
    },
    {
      id: 'active-wos',
      label: 'ACTIVE WORK ORDERS',
      value: kpis?.activeWorkOrders || 0,
      icon: Hammer,
      color: 'var(--text-1)',
      onClick: () => navigate('/maintenance/work-orders?status=active')
    },
    {
      id: 'sla-at-risk',
      label: 'SLA AT RISK',
      value: slaAtRiskCount || 0,
      icon: AlertTriangle,
      color: slaAtRiskCount > 0 ? 'var(--status-warning)' : 'var(--text-3)',
      onClick: () => navigate('/maintenance/tickets?sla=risk')
    },
    {
      id: 'sla-breached',
      label: 'SLA BREACHED',
      value: slaBreachedCount || 0,
      icon: ShieldAlert,
      color: slaBreachedCount > 0 ? 'var(--status-danger)' : 'var(--text-3)',
      onClick: () => navigate('/maintenance/tickets?sla=breached')
    },
    {
      id: 'overdue-pm',
      label: 'OVERDUE PM',
      value: kpis?.overduePMs || 0,
      icon: CalendarClock,
      color: (kpis?.overduePMs || 0) > 0 ? 'var(--status-danger)' : 'var(--text-3)',
      onClick: () => navigate('/maintenance/preventive?status=overdue')
    },
    {
      id: 'pending-approvals',
      label: 'PENDING APPROVALS',
      value: kpis?.pendingApprovals || 0,
      icon: Clock,
      color: 'var(--text-1)',
      onClick: () => navigate('/maintenance/work-orders?status=awaiting_approval')
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
      {kpiData.map(item => (
        <div 
          key={item.id}
          onClick={item.onClick}
          style={{
            background: 'var(--bg-0)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em' }}>
              {item.label}
            </span>
            <item.icon size={16} color={item.color} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: item.value > 0 ? 'var(--text-0)' : 'var(--text-3)', lineHeight: 1 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}


