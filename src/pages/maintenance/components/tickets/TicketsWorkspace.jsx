import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import TicketsList from './TicketsList';
import TicketDetail from './TicketDetail';
import TicketForm from './TicketForm';
import { useTickets, useCreateTicket, useUpdateTicket } from '../../hooks/useTickets';

export default function TicketsWorkspace() {
  const { data: tickets, isLoading } = useTickets();
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);

  const handleCreateSubmit = (payload) => {
    createTicket.mutate(payload, {
      onSuccess: () => setShowForm(false)
    });
  };

  const handleUpdateSubmit = (payload) => {
    updateTicket.mutate({ id: editingTicket.id, updates: payload }, {
      onSuccess: () => {
        setShowForm(false);
        setEditingTicket(null);
        if (selectedTicket && selectedTicket.id === editingTicket.id) {
          // Optimistically update the selected ticket view
          setSelectedTicket({ ...selectedTicket, ...payload });
        }
      }
    });
  };

  const handleStatusUpdate = (id, updates) => {
    updateTicket.mutate({ id, updates }, {
      onSuccess: () => {
        if (selectedTicket && selectedTicket.id === id) {
          setSelectedTicket({ ...selectedTicket, ...updates });
        }
      }
    });
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, height: '100%', position: 'relative' }}>
      
      {/* Workspace Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-0)', margin: '0 0 4px 0' }}>Tickets Workspace</h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem' }}>Manage corrective maintenance requests, breakdowns, and issues.</p>
        </div>
        <button 
          onClick={() => { setEditingTicket(null); setShowForm(true); }}
          className="btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={18} /> New Ticket
        </button>
      </div>

      {/* Main List */}
      <TicketsList 
        tickets={tickets} 
        isLoading={isLoading} 
        onRowClick={setSelectedTicket}
      />

      {/* Slide-over Detail View */}
      {selectedTicket && (
        <React.Fragment>
          <div 
            onClick={() => setSelectedTicket(null)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999, animation: 'fadeIn 0.2s ease' }} 
          />
          <TicketDetail 
            ticket={selectedTicket} 
            onClose={() => setSelectedTicket(null)}
            onEdit={(t) => { setEditingTicket(t); setShowForm(true); }}
            onUpdateStatus={handleStatusUpdate}
            isUpdating={updateTicket.isPending}
          />
        </React.Fragment>
      )}

      {/* Create / Edit Form Modal */}
      {showForm && (
        <TicketForm 
          initialData={editingTicket}
          onClose={() => { setShowForm(false); setEditingTicket(null); }}
          onSubmit={editingTicket ? handleUpdateSubmit : handleCreateSubmit}
          isSubmitting={createTicket.isPending || updateTicket.isPending}
        />
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}


