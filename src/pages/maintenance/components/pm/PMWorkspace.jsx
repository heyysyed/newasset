import { useToast } from '../../../../hooks/useToast'
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { supabase, autoCreateOverdueTickets, deleteMaintenanceSchedule } from '../../../../lib/supabase';
import { Calendar, CheckCircle2, Edit2, Trash2 } from 'lucide-react';

const FREQ_MAP = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly'
};

export default function PMWorkspace() {
  const { toast } = useToast();
  const { user, isAdmin, currentCompany } = useAuth();
  const cc = currentCompany?.code;

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedFilterStatus, setSchedFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSchedules();
  }, [cc]);

  async function fetchSchedules() {
    setLoading(true);
    try {
      let sQ = supabase.from('maintenance_schedules').select('*, assets(asset_name, asset_code)').order('next_due');
      const { data } = await sQ;
      // Filter by cc if needed, but original didn't
      setSchedules(data || []);
      await autoCreateOverdueTickets(user.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSchedule(id) {
    if (!window.confirm('Are you sure?')) return
    try {
      await deleteMaintenanceSchedule(id);
      fetchSchedules();
    } catch (e) {
      toast.info(e.message);
    }
  }

  const filteredSchedules = useMemo(() => schedules.filter(s => {
    const matchSearch = !search || s.assets?.asset_name?.toLowerCase().includes(search.toLowerCase()) || s.title?.toLowerCase().includes(search.toLowerCase());
    const isOverdue = new Date(s.next_due) < new Date();
    const matchStatus = schedFilterStatus === 'all' || (schedFilterStatus === 'overdue' && isOverdue) || (schedFilterStatus === 'active' && s.status === 'active' && !isOverdue);
    return matchSearch && matchStatus;
  }), [schedules, search, schedFilterStatus]);

  const today = new Date();
  today.setHours(0,0,0,0);
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);

  const groups = { Overdue: [], Upcoming: [], Later: [] };

  filteredSchedules.forEach(s => {
    if (!s.next_due) return groups.Later.push(s);
    const due = new Date(s.next_due);
    due.setHours(0,0,0,0);
    if (due < today) groups.Overdue.push(s);
    else if (due <= in30Days) groups.Upcoming.push(s);
    else groups.Later.push(s);
  });

  const renderGroup = (title, items, color) => (
    items.length > 0 && (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ textTransform: 'uppercase', marginBottom: 12, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          {title} ({items.length})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {items.map(s => {
            const isOverdue = new Date(s.next_due) < today;
            return (
              <div key={s.id} className="card" style={{ padding: '16px', borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: isOverdue ? 'var(--status-danger-soft)' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar size={15} style={{ color: isOverdue ? 'var(--red)' : 'var(--accent)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.assets?.asset_name}</div>
                    <div style={{ color: 'var(--text-3)' }}>{s.title}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--bg-3)', color: 'var(--text-2)' }}>{FREQ_MAP[s.frequency] || s.frequency}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 12, background: isOverdue ? 'var(--status-danger-soft)' : 'var(--accent-glow)', color: isOverdue ? 'var(--red)' : 'var(--accent)' }}>
                    Due: {s.next_due ? new Date(s.next_due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isAdmin && <button className="btn-ghost" style={{ padding: '6px 12px', color: 'var(--red)' }} onClick={() => handleDeleteSchedule(s.id)}><Trash2 size={14} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-0)', margin: '0 0 4px 0' }}>Preventive Maintenance</h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem' }}>Manage recurring schedules and tasks.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'active', 'overdue'].map(f => (
          <button key={f} onClick={() => setSchedFilterStatus(f)} className={schedFilterStatus === f ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '6px 14px', textTransform: 'capitalize', ...(f === 'overdue' && schedFilterStatus === f ? { background: 'var(--red)', borderColor: 'var(--red)' } : {}) }}>{f}</button>
        ))}
        <span style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>{filteredSchedules.length} schedules</span>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>Loading schedules...</div>
      ) : filteredSchedules.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>No schedules found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {renderGroup('Overdue', groups.Overdue, 'var(--red)')}
          {renderGroup('Next 30 Days', groups.Upcoming, 'var(--status-warning)')}
          {renderGroup('Later', groups.Later, 'var(--text-3)')}
        </div>
      )}
    </div>
  );
}
