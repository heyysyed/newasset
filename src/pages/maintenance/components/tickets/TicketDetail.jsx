import React, { useState } from 'react';
import { X, Edit2, Clock, MapPin, Tag, MessageSquare, Save, CheckCircle, Package } from 'lucide-react';
import TicketComponentsManager from './TicketComponentsManager';

const PRIORITIES = {
  low: { bg: 'var(--bg-2)', text: 'var(--text-1)', label: 'Low' },
  normal: { bg: 'var(--status-success-subtle)', text: 'var(--status-success)', label: 'Normal' },
  high: { bg: 'var(--status-warning-subtle)', text: 'var(--status-warning)', label: 'High' },
  critical: { bg: 'var(--status-danger-subtle)', text: 'var(--status-danger)', label: 'Critical' }
};

const STATUSES = {
  open: { bg: 'var(--bg-2)', text: 'var(--text-1)', label: 'Open' },
  assigned: { bg: 'var(--status-info-subtle)', text: 'var(--status-info)', label: 'Assigned' },
  working: { bg: 'var(--status-info-subtle)', text: 'var(--status-info)', label: 'Working' },
  in_progress: { bg: 'var(--status-info-subtle)', text: 'var(--status-info)', label: 'In Progress' },
  resolved: { bg: 'var(--status-success-subtle)', text: 'var(--status-success)', label: 'Resolved' },
  closed: { bg: 'var(--status-success-subtle)', text: 'var(--status-success)', label: 'Closed' },
  cancelled: { bg: 'var(--bg-2)', text: 'var(--text-3)', label: 'Cancelled' },
};

export default function TicketDetail({ ticket, onClose, onEdit, onUpdateStatus, isUpdating }) {
  const [statusDraft, setStatusDraft] = useState(ticket.status || 'open');
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolution_notes || '');
  const [isEditingStatus, setIsEditingStatus] = useState(false);

  if (!ticket) return null;

  const priorityColor = PRIORITIES[ticket.priority] || PRIORITIES.normal;
  const statusColor = STATUSES[ticket.status] || STATUSES.open;

  const handleSaveStatus = () => {
    if (statusDraft === ticket.status && resolutionNotes === (ticket.resolution_notes || '')) {
      setIsEditingStatus(false);
      return;
    }
    
    const updates = { status: statusDraft };
    if (statusDraft === 'resolved' || statusDraft === 'closed') {
      updates.resolution_notes = resolutionNotes;
      if (!ticket.resolved_at) {
        updates.resolved_at = new Date().toISOString();
      }
    }
    
    onUpdateStatus(ticket.id, updates);
    setIsEditingStatus(false);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 600,
      background: 'var(--bg-0)', zIndex: 1000, boxShadow: '-5px 0 25px rgba(0,0,0,0.1)',
      display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.3s ease'
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--bg-2)', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-1)' }}>
            {ticket.ticket_no}
          </div>
          <span style={{ 
            fontSize: '0.75rem', padding: '4px 10px', borderRadius: 20, fontWeight: 600, textTransform: 'uppercase',
            background: statusColor.bg, color: statusColor.text
          }}>
            {statusColor.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onEdit(ticket)} className="btn-ghost" style={{ padding: 8, color: 'var(--text-2)' }} title="Edit Ticket">
            <Edit2 size={18} />
          </button>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8, color: 'var(--text-2)' }} title="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Title & Basics */}
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-0)', margin: '0 0 16px 0', lineHeight: 1.3 }}>
            {ticket.title}
          </h2>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.85rem' }}>
              <Clock size={16} /> 
              Created {new Date(ticket.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.85rem' }}>
              <Tag size={16} /> 
              Type: <span style={{ textTransform: 'capitalize', color: 'var(--text-0)', fontWeight: 500 }}>{ticket.ticket_type}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.85rem' }}>
              Priority: 
              <span style={{ color: priorityColor.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColor.text }} />
                {priorityColor.label}
              </span>
            </div>
          </div>
        </div>

        {/* Linked Asset */}
        {ticket.asset ? (
          <div style={{ background: 'var(--bg-1)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px 0' }}>Linked Asset</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-1)' }}>
                <Package size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-0)' }}>{ticket.asset.asset_name}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  {ticket.asset.asset_code && <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>ID: {ticket.asset.asset_code}</span>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-1)', borderRadius: 12, padding: 16, border: '1px dashed var(--border)', color: 'var(--text-3)', textAlign: 'center', fontSize: '0.9rem' }}>
            No asset linked to this ticket.
          </div>
        )}

        {/* Component Management */}
        {ticket.asset && (
          <TicketComponentsManager ticket={ticket} />
        )}

        {/* Description */}
        <div>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px 0' }}>Description</h4>
          <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, color: 'var(--text-0)', fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {ticket.description || <span style={{ color: 'var(--text-3)' }}>No description provided.</span>}
          </div>
        </div>

        {/* Status & Resolution Update Area */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Resolution & Status</h4>
            {!isEditingStatus && (
              <button onClick={() => setIsEditingStatus(true)} className="btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                Update Status
              </button>
            )}
          </div>
          
          {isEditingStatus ? (
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-1)' }}>Status</label>
                <select 
                  value={statusDraft} 
                  onChange={(e) => setStatusDraft(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)' }}
                  disabled={isUpdating}
                >
                  {Object.entries(STATUSES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              {(statusDraft === 'resolved' || statusDraft === 'closed') && (
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-1)' }}>Resolution Notes (Optional)</label>
                  <textarea 
                    value={resolutionNotes} 
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe how the issue was resolved..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-0)', color: 'var(--text-0)', minHeight: 80, resize: 'vertical' }}
                    disabled={isUpdating}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button onClick={() => {
                  setIsEditingStatus(false);
                  setStatusDraft(ticket.status || 'open');
                  setResolutionNotes(ticket.resolution_notes || '');
                }} className="btn-secondary" disabled={isUpdating} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  Cancel
                </button>
                <button onClick={handleSaveStatus} className="btn-primary" disabled={isUpdating} style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Save size={14} /> Save Status
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              {ticket.resolution_notes ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ color: 'var(--status-success)', marginTop: 2 }}><CheckCircle size={20} /></div>
                  <div>
                    <div style={{ color: 'var(--text-0)', fontSize: '0.95rem', lineHeight: 1.5 }}>{ticket.resolution_notes}</div>
                    {ticket.resolved_at && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: 8 }}>
                        Resolved on {new Date(ticket.resolved_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-3)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={16} /> No resolution notes added yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Background Overlay (Mobile only or if we want to block interaction) */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}


