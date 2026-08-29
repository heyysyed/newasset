import React, { useState, useEffect } from 'react';
import { getAssetComponents, installComponent, removeComponent, replaceComponent } from '../../../../services/componentService';
import { fetchSerializedComponents } from '../../../../services/componentService';
import { Layers, Plus, Trash2, ArrowRightLeft, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { formatCurrency } from '../../../../lib/depreciation';

export default function TicketComponentsManager({ ticket }) {
  const { user } = useAuth();
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState(null); // 'install', 'remove', 'replace'
  const [selectedComp, setSelectedComp] = useState(null); // For remove/replace
  const [availableStock, setAvailableStock] = useState([]); // For install/replace

  useEffect(() => {
    if (ticket.asset_id) loadAssetComponents();
  }, [ticket.asset_id]);

  async function loadAssetComponents() {
    setLoading(true);
    try {
      const data = await getAssetComponents(ticket.asset_id);
      // Only active ones
      setComponents(data?.filter(c => !c.removed_at) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableStock() {
    try {
      const data = await fetchSerializedComponents({ status: 'AVAILABLE' });
      setAvailableStock(data || []);
    } catch (e) {
      console.error(e);
    }
  }

  const handleOpenAction = (type, comp = null) => {
    setActionType(type);
    setSelectedComp(comp);
    if (type === 'install' || type === 'replace') {
      loadAvailableStock();
    }
  };

  const handleCloseAction = () => {
    setActionType(null);
    setSelectedComp(null);
  };

  const executeAction = async (payload) => {
    try {
      if (actionType === 'install') {
        await installComponent(payload.newComponentId, ticket.asset_id, payload.position, ticket.id, user.id, ticket.asset.location || ticket.asset.site);
      } else if (actionType === 'remove') {
        await removeComponent(selectedComp.component_id, ticket.id, payload.reason, payload.disposition, user.id, payload.newStatus);
      } else if (actionType === 'replace') {
        await replaceComponent(selectedComp.component_id, payload.newComponentId, ticket.asset_id, selectedComp.position, ticket.id, payload.reason, payload.disposition, user.id, payload.newStatus);
      }
      handleCloseAction();
      loadAssetComponents();
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  if (!ticket.asset_id) return null;

  return (
    <div style={{ background: 'var(--bg-1)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} /> Components Management
        </h4>
        <button onClick={() => handleOpenAction('install')} className="btn-ghost" style={{ fontSize: '0.8rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={12} /> Install
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1rem' }}><Loader2 size={16} className="spin" /></div>
      ) : components.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>No components installed on this asset.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {components.map(ac => (
            <div key={ac.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: '0.9rem' }}>{ac.serialized_components.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>SN: {ac.serialized_components.serial_number} {ac.position ? `| Pos: ${ac.position}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => handleOpenAction('replace', ac)} title="Replace">
                  <ArrowRightLeft size={14} />
                </button>
                <button className="btn-ghost" style={{ padding: '4px 8px', color: 'var(--status-danger)' }} onClick={() => handleOpenAction('remove', ac)} title="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modals */}
      {actionType && (
        <ActionModal 
          type={actionType}
          selectedComp={selectedComp}
          availableStock={availableStock}
          onClose={handleCloseAction}
          onConfirm={executeAction}
        />
      )}
    </div>
  );
}

function ActionModal({ type, selectedComp, availableStock, onClose, onConfirm }) {
  const [newComponentId, setNewComponentId] = useState('');
  const [position, setPosition] = useState(selectedComp?.position || '');
  const [reason, setReason] = useState('');
  const [disposition, setDisposition] = useState('AVAILABLE'); // For remove/replace

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((type === 'install' || type === 'replace') && !newComponentId) return alert('Select a replacement component.');
    if ((type === 'remove' || type === 'replace') && !reason) return alert('Reason is required.');
    
    let newStatus = 'AVAILABLE';
    if (disposition === 'SCRAPPED') newStatus = 'SCRAPPED';
    else if (disposition === 'REPAIR') newStatus = 'UNDER_REPAIR';
    else if (disposition === 'VENDOR') newStatus = 'RETURNED_TO_VENDOR';

    onConfirm({ newComponentId, position, reason, disposition, newStatus });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-0)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400 }}>
        <h3 style={{ margin: '0 0 16px 0', textTransform: 'capitalize' }}>{type} Component</h3>
        
        {type !== 'install' && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-2)', borderRadius: 8 }}>
            <strong>Target:</strong> {selectedComp.serialized_components.name} (SN: {selectedComp.serialized_components.serial_number})
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(type === 'install' || type === 'replace') && (
            <div className="form-group">
              <label className="lbl">Select Component</label>
              <select className="sel" required value={newComponentId} onChange={e => setNewComponentId(e.target.value)}>
                <option value="">-- Select Available Component --</option>
                {availableStock.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (SN: {c.serial_number}) - {formatCurrency(c.purchase_cost, c.currency)}</option>
                ))}
              </select>
            </div>
          )}

          {(type === 'install' || type === 'replace') && (
            <div className="form-group">
              <label className="lbl">Position / Slot (Optional)</label>
              <input type="text" className="inp" value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Bay 1, Front Left" />
            </div>
          )}

          {(type === 'remove' || type === 'replace') && (
            <>
              <div className="form-group">
                <label className="lbl">Reason</label>
                <input type="text" className="inp" required value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Failed, Scheduled Maintenance" />
              </div>
              <div className="form-group">
                <label className="lbl">Disposition of old component</label>
                <select className="sel" value={disposition} onChange={e => setDisposition(e.target.value)}>
                  <option value="AVAILABLE">Return to Inventory (Available)</option>
                  <option value="REPAIR">Send for Repair</option>
                  <option value="VENDOR">Return to Vendor</option>
                  <option value="SCRAPPED">Scrap / Dispose</option>
                </select>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Confirm</button>
          </div>
        </form>
      </div>
    </div>
  );
}


