import React, { useEffect, useMemo, useState } from 'react';
import { Ticket, Search, Filter } from 'lucide-react';

const PRIORITY_COLORS = {
  low: { bg: 'var(--bg-2)', text: 'var(--text-1)' },
  normal: { bg: 'var(--status-success-subtle)', text: 'var(--status-success)' },
  high: { bg: 'var(--status-warning-subtle)', text: 'var(--status-warning)' },
  critical: { bg: 'var(--status-danger-subtle)', text: 'var(--status-danger)' }
};

const STATUS_COLORS = {
  open: { bg: 'var(--bg-2)', text: 'var(--text-1)' },
  assigned: { bg: 'var(--status-info-subtle)', text: 'var(--status-info)' },
  working: { bg: 'var(--status-info-subtle)', text: 'var(--status-info)' },
  in_progress: { bg: 'var(--status-info-subtle)', text: 'var(--status-info)' },
  resolved: { bg: 'var(--status-success-subtle)', text: 'var(--status-success)' },
  closed: { bg: 'var(--status-success-subtle)', text: 'var(--status-success)' },
  cancelled: { bg: 'var(--bg-2)', text: 'var(--text-3)' },
};

export default function TicketsList({ tickets, isLoading, onRowClick, initialSearch = '' }) {
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState('all')

  useEffect(() => setSearch(initialSearch), [initialSearch])

  const filteredTickets = useMemo(() => (tickets || []).filter(ticket => {
    if (status !== 'all' && String(ticket.status || '').toLowerCase() !== status) return false
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [ticket.ticket_no, ticket.title, ticket.asset?.asset_name, ticket.asset?.asset_code]
      .some(value => String(value || '').toLowerCase().includes(query))
  }), [tickets, search, status])
  if (isLoading) {
    return (
      <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
        <h3 className="skeleton" style={{ width: 200, height: 24, marginBottom: 16 }}></h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3,4,5,6].map(i => <div key={`skel-${i}`} className="skeleton" style={{ height: 60, borderRadius: 8 }}></div>)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ticket size={20} color="var(--text-1)" />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-0)' }}>
            All Tickets
          </h3>
          <span style={{ background: 'var(--bg-2)', color: 'var(--text-1)', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>
            {filteredTickets.length}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-3)" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input 
              type="text" 
              placeholder="Search tickets..." 
              value={search}
              onChange={event => setSearch(event.target.value)}
              style={{ padding: '8px 12px 8px 36px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', fontSize: '0.85rem' }} 
            />
          </div>
          <label className="sr-only" htmlFor="ticket-status-filter">Filter tickets by status</label>
          <select id="ticket-status-filter" value={status} onChange={event => setStatus(event.target.value)} className="sel" style={{ minWidth: 140 }}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {filteredTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-3)' }}>
            <Ticket size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>No matching tickets</div>
            <div style={{ fontSize: '0.9rem' }}>{tickets?.length ? 'Try changing the search or status filter.' : 'Create a new ticket to get started.'}</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Ticket / Title</th>
                <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Asset</th>
                <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Priority</th>
                <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 24px', fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map(ticket => {
                const priorityColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.normal;
                const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
                
                return (
                  <tr 
                    key={ticket.id} 
                    onClick={() => onRowClick(ticket)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--text-0)', fontWeight: 500 }}>
                      <div style={{ color: 'var(--text-1)', fontSize: '0.75rem', marginBottom: 4 }}>{ticket.ticket_no}</div>
                      {ticket.title}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--text-1)' }}>
                      {ticket.asset?.asset_name || 'No Asset Attached'}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>{ticket.asset?.asset_code || ''}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: 20, fontWeight: 600, textTransform: 'uppercase',
                        background: priorityColor.bg, color: priorityColor.text
                      }}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: 20, fontWeight: 600, textTransform: 'uppercase',
                        background: statusColor.bg, color: statusColor.text
                      }}>
                        {(ticket.status || 'open').replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                      {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


