import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';

const TICKET_TYPES = [
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'fault', label: 'Fault / Issue' },
  { value: 'damage', label: 'Physical Damage' },
  { value: 'inspection', label: 'Inspection Required' },
  { value: 'scheduled', label: 'Scheduled Service' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function TicketForm({ initialData = null, onClose, onSubmit, isSubmitting }) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    ticket_type: initialData?.ticket_type || 'fault',
    priority: initialData?.priority || 'normal',
    asset_id: initialData?.asset_id || '',
  });

  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadAssets() {
      try {
        const { data, error } = await supabase
          .from('assets')
          .select('id, asset_name, asset_code, site')
          .order('asset_name');
        
        if (error) throw error;
        setAssets(data || []);
      } catch (err) {
        console.error("Failed to load assets", err);
      } finally {
        setLoadingAssets(false);
      }
    }
    loadAssets();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    
    // Auto-generate ticket_no if new
    const payload = { ...formData };
    if (!initialData) {
      payload.ticket_no = `TCK-${Date.now().toString().slice(-6)}`;
      payload.status = 'open';
    }
    
    onSubmit(payload);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: 'var(--bg-0)', borderRadius: 12, width: '100%', maxWidth: 500,
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-0)' }}>
            {initialData ? 'Edit Ticket' : 'Create New Ticket'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ background: 'var(--status-danger-subtle)', color: 'var(--status-danger)', padding: 12, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form id="ticket-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-1)', fontWeight: 500 }}>Ticket Title *</label>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Engine making unusual noise"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)' }}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-1)', fontWeight: 500 }}>Linked Asset</label>
              <select
                name="asset_id"
                value={formData.asset_id}
                onChange={handleChange}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)' }}
                disabled={loadingAssets || isSubmitting}
              >
                <option value="">-- No Asset Linked --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.asset_name} {a.asset_code ? `(${a.asset_code})` : ''} - {a.site || 'No Site'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-1)', fontWeight: 500 }}>Ticket Type</label>
                <select
                  name="ticket_type"
                  value={formData.ticket_type}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)' }}
                  disabled={isSubmitting}
                >
                  {TICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-1)', fontWeight: 500 }}>Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)' }}
                  disabled={isSubmitting}
                >
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: 'var(--text-1)', fontWeight: 500 }}>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Provide detailed information about the issue..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-0)', minHeight: 100, resize: 'vertical' }}
                disabled={isSubmitting}
              />
            </div>
          </form>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" form="ticket-form" className="btn-primary" disabled={isSubmitting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={16} /> {isSubmitting ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Ticket')}
          </button>
        </div>
      </div>
    </div>
  );
}


