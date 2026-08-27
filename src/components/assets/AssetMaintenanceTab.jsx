import React from 'react'
import { Wrench, Calendar, IndianRupee, AlertTriangle, CheckCircle2, History } from 'lucide-react'
import { formatCurrency } from '../../lib/depreciation'
import { StatMini, SectionCard, EmptyState } from '../../pages/AssetDetail'

export default function AssetMaintenanceTab({ maintenance, totalMaintenanceCost, asset360 }) {
  if (!maintenance) return null

  const openTickets = (maintenance.tickets || []).filter(t => t.status !== 'resolved')
  const overdue = (maintenance.schedules || []).filter(s => new Date(s.next_due) < new Date())
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Intelligence Summary */}
      {asset360?.maintenance?.data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', }}>Total Cost</span>
            <div style={{ color: 'var(--text-1)' }}>{formatCurrency(asset360.maintenance.data.totalCost)}</div>
          </div>
          <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', }}>MTBF (Days)</span>
            <div style={{ color: 'var(--accent)' }}>{asset360.maintenance.data.mtbfDays || 'N/A'}</div>
          </div>
          <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', }}>Breakdowns</span>
            <div style={{ color: asset360.maintenance.data.breakdownCount > 0 ? 'var(--amber)' : 'var(--green)' }}>{asset360.maintenance.data.breakdownCount}</div>
          </div>
        </div>
      )}

      {/* Maintenance Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <StatMini label="Total Cost" value={formatCurrency(totalMaintenanceCost)} icon={IndianRupee} color="var(--green)" sub={`${(maintenance.logs || []).length} service records`} />
        <StatMini label="Open Tickets" value={openTickets.length} icon={Wrench} color={openTickets.length > 0 ? 'var(--amber)' : 'var(--green)'} sub={openTickets.length > 0 ? 'Needs attention' : 'All clear'} />
        <StatMini label="PM Schedules" value={(maintenance.schedules || []).length} icon={Calendar} color="var(--accent)" sub={overdue.length > 0 ? `${overdue.length} overdue` : 'On track'} />
      </div>

      {/* Service History */}
      <SectionCard title={`Service History - ${formatCurrency(totalMaintenanceCost)} total`} icon={History} accentColor="var(--green)">
        {(maintenance.logs || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {maintenance.logs.map(l => (
              <div key={l.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: l.schedule_id ? 'var(--green-dim)' : 'var(--amber-dim)',
                  color: l.schedule_id ? 'var(--green)' : 'var(--amber)', flexShrink: 0,
                }}>
                  <Wrench size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-0)' }}>{l.work_done}</div>
                  <div style={{ color: 'var(--text-3)', display: 'flex', gap: 8 }}>
                    <span style={{ padding: '1px 6px', borderRadius: 4, background: l.schedule_id ? 'var(--green-dim)' : 'var(--amber-dim)', color: l.schedule_id ? 'var(--green)' : 'var(--amber)', }}>
                      {l.schedule_id ? 'PREVENTIVE' : 'CORRECTIVE'}
                    </span>
                    <span>{l.profiles?.full_name || 'System'}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: 'var(--text-0)' }}>{formatCurrency(l.cost || 0)}</div>
                  <div style={{ color: 'var(--text-3)' }}>{new Date(l.performed_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Wrench} title="No maintenance history" description="Service records and costs will be tracked here." />
        )}
      </SectionCard>

      {/* Open Tickets + PM Schedules side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        <SectionCard title={`Open Tickets (${openTickets.length})`} icon={AlertTriangle} accentColor="var(--amber)">
          {openTickets.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openTickets.map(t => (
                <div key={t.id} style={{
                  padding: '12px 14px', background: 'var(--bg-1)', borderRadius: 10, border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{t.title}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6,
                      background: t.priority === 'high' || t.priority === 'critical' ? 'var(--red-dim)' : 'var(--amber-dim)',
                      color: t.priority === 'high' || t.priority === 'critical' ? 'var(--red)' : 'var(--amber)',
                      textTransform: 'uppercase',
                    }}>{t.priority}</span>
                  </div>
                  <div style={{ color: 'var(--text-3)' }}>{new Date(t.created_at).toLocaleDateString()} · {t.profiles?.full_name}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="No open tickets" description="All maintenance issues resolved." />
          )}
        </SectionCard>

        <SectionCard title={`PM Schedules (${(maintenance.schedules || []).length})`} icon={Calendar} accentColor="var(--accent)">
          {(maintenance.schedules || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {maintenance.schedules.map(s => {
                const isOverdue = new Date(s.next_due) < new Date()
                return (
                  <div key={s.id} style={{
                    padding: '12px 14px', background: isOverdue ? 'var(--status-danger-soft)' : 'var(--bg-1)',
                    borderRadius: 10, border: `1px solid ${isOverdue ? 'var(--status-danger-soft)' : 'var(--border)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{s.title}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6,
                        background: 'var(--accent-glow)', color: 'var(--accent)', textTransform: 'uppercase',
                      }}>{s.frequency}</span>
                    </div>
                    <div style={{ color: isOverdue ? 'var(--red)' : 'var(--text-3)', fontWeight: isOverdue ? 600 : 400 }}>
                      {isOverdue ? '⚠ OVERDUE - ' : 'Next: '}{new Date(s.next_due).toLocaleDateString()}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={Calendar} title="No schedules" description="Add preventive maintenance schedules." />
          )}
        </SectionCard>
      </div>
    </div>
  )
}


