import React, { useState } from 'react';
import { X, Save, Building2 } from 'lucide-react';

export default function VendorForm({ initialData = null, onClose, onSubmit, isSubmitting }) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    contact_person: initialData?.contact_person || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    category: initialData?.category || '',
    notes: initialData?.notes || '',
    is_active: initialData ? initialData.is_active : true,
    rating: initialData?.rating || 0
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 500,
      background: 'var(--bg-0)', borderLeft: '1px solid var(--border)', zIndex: 1000,
      display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
      animation: 'slideIn 0.2s ease-out'
    }}>
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-0)' }}>
              {initialData ? 'Edit Vendor' : 'New Vendor'}
            </h2>
          </div>
        </div>
        <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}>
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        <div>
          <label className="form-label">Vendor Name *</label>
          <input
            type="text"
            name="name"
            className="form-input"
            value={formData.name}
            onChange={handleChange}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="form-label">Category / Service Type</label>
          <input
            type="text"
            name="category"
            className="form-input"
            placeholder="e.g. Electrical, HVAC, Plumbing"
            value={formData.category}
            onChange={handleChange}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="form-label">Contact Person</label>
            <input
              type="text"
              name="contact_person"
              className="form-input"
              value={formData.contact_person}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="form-label">Phone Number</label>
            <input
              type="text"
              name="phone"
              className="form-input"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>
        </div>

        <div>
          <label className="form-label">Email Address</label>
          <input
            type="email"
            name="email"
            className="form-input"
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="form-label">Notes</label>
          <textarea
            name="notes"
            className="form-input"
            rows={4}
            value={formData.notes}
            onChange={handleChange}
          />
        </div>

        {initialData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              style={{ width: 16, height: 16 }}
            />
            <label htmlFor="is_active" style={{ cursor: 'pointer', color: 'var(--text-1)' }}>Active Vendor</label>
          </div>
        )}
      </form>

      <div style={{ padding: 20, borderTop: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button type="button" onClick={onClose} className="btn-ghost" disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" onClick={handleSubmit} className="btn-primary" disabled={isSubmitting || !formData.name.trim()} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Save size={16} />
          {isSubmitting ? 'Saving...' : 'Save Vendor'}
        </button>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
