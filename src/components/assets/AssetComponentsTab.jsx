import React, { useState, useEffect } from 'react';
import { getAssetComponents, removeComponent } from '../../services/componentService';
import { Loader2, Package, History, Trash2, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../lib/depreciation';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Wrench, Repeat, Edit } from 'lucide-react';
import { RemoveComponentModal, ReplaceComponentModal, EditComponentModal } from '../inventory/SerializedModals';
import { usePartsInvalidator } from '../inventory/partsUI';

export default function AssetComponentsTab({ assetId }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [components, setComponents] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
  const invalidate = usePartsInvalidator();
  
  useEffect(() => {
    loadData();
  }, [assetId]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getAssetComponents(assetId);
      setComponents(data || []);
    } catch (err) {
      console.error(err);
      alert('Failed to load asset components');
    } finally {
      setLoading(false);
    }
  }

  const activeComponents = components.filter(c => !c.removed_at);
  const historicalComponents = components.filter(c => c.removed_at);

  // Lifecycle actions are now handled by SerializedModals components

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Active Configuration */}
      <div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-1)' }}>
          <CheckCircle2 size={18} style={{ color: 'var(--status-success)' }} />
          Current Configuration
        </h3>
        {activeComponents.length === 0 ? (
          <div className="alert alert-info" style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: 'var(--bg-2)', borderRadius: '8px' }}>
            <Package size={20} style={{ color: 'var(--text-3)' }} />
            <span style={{ color: 'var(--text-2)' }}>No active components installed on this asset.</span>
          </div>
        ) : (
          <div className="table-responsive card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Category</th>
                  <th>Position/Slot</th>
                  <th>Installed Date</th>
                  <th>Installed By</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeComponents.map(ac => (
                  <tr key={ac.id}>
                    <td>
                      <Link to={`/inventory/components/${ac.serialized_components?.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-1)' }}>{ac.serialized_components?.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>SN: {ac.serialized_components?.serial_number}</div>
                      </Link>
                    </td>
                    <td>{ac.serialized_components?.category || '-'}</td>
                    <td>{ac.position || '-'}</td>
                    <td>{new Date(ac.installed_at).toLocaleDateString()}</td>
                    <td>{ac.profiles?.full_name || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatCurrency(ac.serialized_components?.purchase_cost, ac.serialized_components?.currency)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon btn-secondary btn-sm" title="Remove" onClick={() => setActiveModal({ type: 'remove', component: { ...ac.serialized_components, current_asset_id: assetId } })}>
                          <Wrench size={14} />
                        </button>
                        <button className="btn-icon btn-secondary btn-sm" title="Replace" onClick={() => setActiveModal({ type: 'replace', component: { ...ac.serialized_components, current_asset_id: assetId } })}>
                          <Repeat size={14} />
                        </button>
                        <button className="btn-icon btn-secondary btn-sm" title="Edit details" onClick={() => setActiveModal({ type: 'edit', component: { ...ac.serialized_components, current_asset_id: assetId } })}>
                          <Edit size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historical Configuration */}
      {historicalComponents.length > 0 && (
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-2)' }}>
            <History size={18} />
            Historical Components
          </h3>
          <div className="table-responsive card" style={{ opacity: 0.8 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Timeline</th>
                  <th>Reason</th>
                  <th>Disposition</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {historicalComponents.map(ac => (
                  <tr key={ac.id}>
                    <td>
                      <Link to={`/inventory/components/${ac.serialized_components?.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-1)' }}>{ac.serialized_components?.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>SN: {ac.serialized_components?.serial_number}</div>
                      </Link>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>
                        <div><strong>In:</strong> {new Date(ac.installed_at).toLocaleDateString()}</div>
                        <div><strong>Out:</strong> {new Date(ac.removed_at).toLocaleDateString()}</div>
                      </div>
                    </td>
                    <td>{ac.removal_reason || '-'}</td>
                    <td>{ac.disposition || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatCurrency(ac.serialized_components?.purchase_cost, ac.serialized_components?.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeModal && activeModal.type === 'remove' && (
        <RemoveComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={activeModal.component}
          userId={user?.id}
          onSaved={() => { invalidate(); loadData(); }}
        />
      )}

      {activeModal && activeModal.type === 'replace' && (
        <ReplaceComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={activeModal.component}
          userId={user?.id}
          onSaved={() => { invalidate(); loadData(); }}
        />
      )}

      {activeModal && activeModal.type === 'edit' && (
        <EditComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={activeModal.component}
          userId={user?.id}
          onSaved={() => { invalidate(); loadData(); }}
        />
      )}
    </div>
  );
}


