import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { supabase, fetchAllVendors, deleteVendor, createVendor, updateVendor } from '../../../../lib/supabase';
import { Building2, Edit2, Trash2, User, Mail, Phone, Loader2, Plus } from 'lucide-react';
import VendorForm from './VendorForm';

// Simple toast fallback
const toast = { success: (m) => console.log('✓', m), error: (m) => console.error('✗', m) };

export default function VendorsWorkspace() {
  const { isAdmin, currentCompany } = useAuth();
  const cc = currentCompany?.code;

  const [vendors, setVendors] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [cc]);

  async function fetchData() {
    setLoading(true);
    try {
      let q = supabase.from('maintenance_logs').select('cost, vendor_id');
      
      const [al, v] = await Promise.all([
        q,
        fetchAllVendors()
      ]);
      setAllLogs(al.data || []);
      setVendors(v || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveVendor(payload) {
    setIsSubmitting(true);
    try {
      if (editingVendor) {
        await updateVendor(editingVendor.id, payload);
      } else {
        await createVendor({ ...payload, company_code: cc });
      }
      setShowForm(false);
      setEditingVendor(null);
      fetchData();
    } catch (e) {
      toast.info(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteVendor(id) {
    if (!window.confirm('Are you sure?')) return
    try {
      await deleteVendor(id);
      const v = await fetchAllVendors();
      setVendors(v);
    } catch (e) {
      toast.info(e.message);
    }
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  };

  const vendorStats = vendors.map(v => {
    const vLogs = allLogs.filter(l => l.vendor_id === v.id);
    const totalSpend = vLogs.reduce((sum, l) => sum + (Number(l.cost) || 0), 0);
    const ticketCount = vLogs.length;
    const avgCost = ticketCount > 0 ? totalSpend / ticketCount : 0;
    return { ...v, totalSpend, ticketCount, avgCost };
  });

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} /></div>;
  }

  return (
    <div style={{ padding: 24, position: 'relative', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-0)', margin: '0 0 4px 0' }}>Vendors</h1>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '0.9rem' }}>Manage third-party contractors and service providers.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { setEditingVendor(null); setShowForm(true); }}
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={18} /> New Vendor
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {vendorStats.length > 0 && (
          <div>
            <h3 style={{ textTransform: 'uppercase', marginBottom: 12, color: 'var(--text-2)' }}>Vendor Scorecards</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {vendorStats.filter(v => v.ticketCount > 0).sort((a,b) => b.totalSpend - a.totalSpend).slice(0, 4).map(v => (
                <div key={`stat-${v.id}`} className="card" style={{ padding: '16px', background: 'linear-gradient(145deg, var(--bg-1), var(--bg-2))', borderLeft: '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ color: 'var(--text-0)' }}>{v.name}</div>
                    <div style={{ background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 12, color: 'var(--text-2)' }}>{v.ticketCount} Jobs</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 2 }}>Total Spend</div>
                      <div style={{ color: 'var(--accent)' }}>{formatCurrency(v.totalSpend)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 2 }}>Avg / Job</div>
                      <div style={{ color: 'var(--text-1)' }}>{formatCurrency(v.avgCost)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 style={{ textTransform: 'uppercase', marginBottom: 0, color: 'var(--text-2)' }}>Vendor Directory</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {vendors.map(v => (
            <div key={v.id} className="card" style={{ padding: '16px 20px', opacity: v.is_active ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-glow)', border: '1px solid var(--accent)20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={15} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                  {v.rating > 0 && <div style={{ color: 'var(--status-warning)', letterSpacing: 2 }}>{'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)}</div>}
                </div>
                {!v.is_active && <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--bg-3)', color: 'var(--text-3)' }}>INACTIVE</span>}
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn-ghost" style={{ padding: 6, minHeight: 'auto' }} onClick={() => { setEditingVendor(v); setShowForm(true); }}>
                      <Edit2 size={14} style={{ color: 'var(--text-2)' }} />
                    </button>
                    <button className="btn-ghost" style={{ padding: 6, color: 'var(--red)', minHeight: 'auto' }} onClick={() => handleDeleteVendor(v.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {v.contact_person && (
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <User size={10} />{v.contact_person}
                  </span>
                )}
                {v.email && (
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={10} />{v.email}
                  </span>
                )}
                {v.phone && (
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={10} />{v.phone}
                  </span>
                )}
                {v.category && (
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--accent-glow)', color: 'var(--accent)' }}>
                    {v.category}
                  </span>
                )}
              </div>
            </div>
          ))}
          {vendors.length === 0 && (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
              <Building2 size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>No vendors added yet.</p>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <React.Fragment>
          <div 
            onClick={() => setShowForm(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999, animation: 'fadeIn 0.2s ease' }} 
          />
          <VendorForm 
            initialData={editingVendor}
            onClose={() => { setShowForm(false); setEditingVendor(null); }}
            onSubmit={handleSaveVendor}
            isSubmitting={isSubmitting}
          />
        </React.Fragment>
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
