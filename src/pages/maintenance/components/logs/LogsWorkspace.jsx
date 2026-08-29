import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../context/AuthContext';
import { supabase, fetchMaintenanceLogsPaginated } from '../../../../lib/supabase';
import { CheckCircle2, XCircle, Loader2, Search, Filter } from 'lucide-react';

export default function LogsWorkspace() {
  const { user, isAdmin, currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const cc = currentCompany?.code;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['maintenance_logs', cc],
    queryFn: async () => {
      const filter = cc ? { company_code: cc } : {};
      const { data } = await fetchMaintenanceLogsPaginated(filter, 0, 1000);
      return data;
    },
    enabled: !!cc
  });

  const approveMutation = useMutation({
    mutationFn: async ({ logId, status }) => {
      const { error } = await supabase
        .from('maintenance_logs')
        .update({ approval_status: status })
        .eq('id', logId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_logs'] });
    },
    onError: (err) => {
      alert(err.message);
    }
  });

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = !search || 
        l.assets?.asset_name?.toLowerCase().includes(search.toLowerCase()) || 
        l.work_done?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || l.approval_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [logs, search, statusFilter]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-0)', margin: '0 0 4px 0' }}>Maintenance Logs</h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem' }}>History of completed maintenance work and associated costs.</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-3)' }} />
          <input 
            type="text" 
            placeholder="Search assets or work done..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-1)' }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-1)', padding: '4px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <Filter size={14} style={{ color: 'var(--text-3)', marginLeft: 8 }} />
          {['all', 'pending', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: 'none',
                background: statusFilter === status ? 'var(--bg-3)' : 'transparent',
                color: statusFilter === status ? 'var(--text-0)' : 'var(--text-2)',
                cursor: 'pointer',
                fontWeight: statusFilter === status ? 500 : 400,
                textTransform: 'capitalize',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="card desktop-table" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>Asset / Task</span><span>Type</span><span>Performed By</span><span>Cost</span><span>Approval</span><span style={{ textAlign: 'right' }}>Date</span>
        </div>
        
        {isLoading && <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>}
        
        {!isLoading && filteredLogs.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>No history found matching your filters.</div>
        )}

        {filteredLogs.map((l, idx) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, alignItems: 'center', padding: '12px 20px', borderBottom: idx < filteredLogs.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.assets?.asset_name}</div>
              <div style={{ color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{l.work_done}</div>
            </div>
            <div>
              <span style={{ padding: '4px 8px', background: l.schedule_id ? 'rgba(59,130,246,0.1)' : 'var(--bg-3)', color: l.schedule_id ? '#3b82f6' : 'var(--text-2)', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
                {l.schedule_id ? 'Preventive' : 'Corrective'}
              </span>
            </div>
            <div style={{ color: 'var(--text-1)', fontSize: '0.9rem' }}>{l.profiles?.full_name || 'System'}</div>
            <div style={{ color: 'var(--text-1)', fontWeight: 500 }}>{formatCurrency(l.cost || 0)}</div>
            <div>
              {l.approval_status === 'pending' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isAdmin ? (
                    <>
                      <button className="btn-ghost" style={{ padding: 4, color: 'var(--green)' }} onClick={() => approveMutation.mutate({ logId: l.id, status: 'approved' })} title="Approve"><CheckCircle2 size={16} /></button>
                      <button className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }} onClick={() => approveMutation.mutate({ logId: l.id, status: 'rejected' })} title="Reject"><XCircle size={16} /></button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--orange)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}/> Pending</span>
                  )}
                </div>
              ) : l.approval_status === 'rejected' ? (
                <span style={{ color: 'var(--red)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={12}/> Rejected</span>
              ) : (
                <span style={{ color: 'var(--green)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12}/> Approved</span>
              )}
            </div>
            <div style={{ textAlign: 'right', color: 'var(--text-2)', fontSize: '0.9rem' }}>{new Date(l.performed_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>

      <div className="mobile-cards">
        {isLoading && <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>}
        
        {!isLoading && filteredLogs.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No history found.</div>
        )}

        {filteredLogs.map(l => (
          <div key={l.id} className="asset-card-mobile" style={{ background: 'var(--bg-1)', padding: 16, borderRadius: 12, marginBottom: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>{l.assets?.asset_name}</span>
              <span style={{ padding: '2px 8px', background: l.schedule_id ? 'rgba(59,130,246,0.1)' : 'var(--bg-3)', color: l.schedule_id ? '#3b82f6' : 'var(--text-2)', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
                {l.schedule_id ? 'Preventive' : 'Corrective'}
              </span>
            </div>
            <div style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.work_done}</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.85rem', marginBottom: 12 }}>
              <div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Performed By</div>
                <div style={{ color: 'var(--text-1)' }}>{l.profiles?.full_name || 'System'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Cost</div>
                <div style={{ color: 'var(--text-1)', fontWeight: 500 }}>{formatCurrency(l.cost || 0)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div>
                {l.approval_status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isAdmin ? (
                      <>
                        <button className="btn-ghost" style={{ padding: 4, color: 'var(--green)' }} onClick={() => approveMutation.mutate({ logId: l.id, status: 'approved' })}><CheckCircle2 size={16} /></button>
                        <button className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }} onClick={() => approveMutation.mutate({ logId: l.id, status: 'rejected' })}><XCircle size={16} /></button>
                      </>
                    ) : (
                      <span style={{ color: 'var(--orange)' }}>Pending</span>
                    )}
                  </div>
                ) : l.approval_status === 'rejected' ? (
                  <span style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={14}/> Rejected</span>
                ) : (
                  <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14}/> Approved</span>
                )}
              </div>
              <span style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>{new Date(l.performed_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
