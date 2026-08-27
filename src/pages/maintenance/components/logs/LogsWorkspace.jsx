import { useToast } from '../../../../hooks/useToast'
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { supabase, fetchMaintenanceLogsPaginated, approveMaintenanceLog } from '../../../../lib/supabase';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function LogsWorkspace() {
  const { toast } = useToast();
  const { user, isAdmin, currentCompany } = useAuth();
  const cc = currentCompany?.code;

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(0);
  const [logsHasMore, setLogsHasMore] = useState(false);

  useEffect(() => {
    fetchLogs(0, true);
  }, [cc]);

  async function fetchLogs(pageNum = 0, reset = false) {
    if (loadingLogs) return;
    setLoadingLogs(true);
    try {
      const filter = cc ? { company_code: cc } : {};
      const { data, count } = await fetchMaintenanceLogsPaginated(filter, pageNum, 50);
      if (reset) {
        setLogs(data);
      } else {
        setLogs(prev => {
          const newItems = data.filter(d => !prev.some(p => p.id === d.id));
          return [...prev, ...newItems];
        });
      }
      setLogsHasMore((pageNum + 1) * 50 < count);
      setLogsPage(pageNum);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleApproveLog(logId, status) {
    try {
      await approveMaintenanceLog(logId, status, user.id);
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, approval_status: status } : l));
    } catch (e) {
      toast.info(e.message);
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-0)', margin: '0 0 4px 0' }}>Maintenance Logs</h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem' }}>History of completed maintenance work and associated costs.</p>
        </div>
      </div>

      <div className="card desktop-table" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>Asset / Task</span><span>Type</span><span>Performed By</span><span>Cost</span><span>Approval</span><span style={{ textAlign: 'right' }}>Date</span>
        </div>
        {logs.map((l, idx) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, alignItems: 'center', padding: '12px 20px', borderBottom: idx < logs.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.assets?.asset_name}</div>
              <div style={{ color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.work_done}</div>
            </div>
            <div><span style={{ padding: '2px 6px', background: 'var(--bg-3)', borderRadius: 4 }}>{l.schedule_id ? 'Preventive' : 'Corrective'}</span></div>
            <div >{l.profiles?.full_name || 'System'}</div>
            <div style={{ color: 'var(--text-2)' }}>{formatCurrency(l.cost || 0)}</div>
            <div>
              {l.approval_status === 'pending' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  {isAdmin ? (
                    <>
                      <button className="btn-ghost" style={{ padding: 4, color: 'var(--green)' }} onClick={() => handleApproveLog(l.id, 'approved')} title="Approve"><CheckCircle2 size={14} /></button>
                      <button className="btn-ghost" style={{ padding: 4, color: 'var(--red)' }} onClick={() => handleApproveLog(l.id, 'rejected')} title="Reject"><XCircle size={14} /></button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--status-warning)' }}>Pending</span>
                  )}
                </div>
              ) : l.approval_status === 'rejected' ? (
                <span style={{ color: 'var(--red)' }}>Rejected</span>
              ) : (
                <span style={{ color: 'var(--green)' }}>Approved</span>
              )}
            </div>
            <div style={{ textAlign: 'right', color: 'var(--text-3)' }}>{new Date(l.performed_at).toLocaleDateString()}</div>
          </div>
        ))}
        {logs.length === 0 && !loadingLogs && <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>No history found.</div>}
        {loadingLogs && logs.length === 0 && <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>}
        {logsHasMore && (
          <div style={{ textAlign: 'center', padding: '16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn-ghost" onClick={() => fetchLogs(logsPage + 1)} disabled={loadingLogs} >
              {loadingLogs ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Load More Logs'}
            </button>
          </div>
        )}
      </div>

      <div className="mobile-cards">
        {logs.map(l => (
          <div key={l.id} className="asset-card-mobile">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-0)' }}>{l.assets?.asset_name}</span>
              <span style={{ padding: '2px 6px', background: 'var(--bg-3)', borderRadius: 4 }}>{l.schedule_id ? 'Preventive' : 'Corrective'}</span>
            </div>
            <div style={{ color: 'var(--text-2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.work_done}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-3)' }}>
              <span>{l.profiles?.full_name || 'System'}</span>
              <span style={{ color: 'var(--text-2)' }}>{formatCurrency(l.cost || 0)}</span>
              <span style={{ marginLeft: 'auto' }}>{new Date(l.performed_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {logs.length === 0 && !loadingLogs && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No history found.</div>}
      </div>
    </div>
  );
}
