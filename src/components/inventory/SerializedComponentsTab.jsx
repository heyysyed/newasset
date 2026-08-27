import React, { useState, useEffect } from 'react';
import { fetchSerializedComponents } from '../../services/componentService';
import { Package, Search, Plus, Filter, Loader2, Wrench, Edit, ArrowDownToLine, Repeat, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/depreciation';
import { Link } from 'react-router-dom';
import { usePartsInvalidator } from './partsUI';
import { 
  ReceiveComponentModal,
  InstallComponentModal,
  RemoveComponentModal,
  ReplaceComponentModal,
  ScrapComponentModal,
  EditComponentModal
} from './SerializedModals';

export default function SerializedComponentsTab({ sites }) {
  const { user } = useAuth();
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const invalidate = usePartsInvalidator();

  // Modals
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // { type, component }

  useEffect(() => {
    loadComponents();
  }, [statusFilter, categoryFilter]);

  async function loadComponents() {
    setLoading(true);
    try {
      const data = await fetchSerializedComponents({
        status: statusFilter,
        category: categoryFilter
      });
      setComponents(data || []);
    } catch (e) {
      console.error(e);
      alert('Failed to load components: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredComponents = components.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.serial_number?.toLowerCase().includes(s) ||
      c.name?.toLowerCase().includes(s) ||
      c.part_number?.toLowerCase().includes(s) ||
      c.assets?.asset_code?.toLowerCase().includes(s)
    );
  });

  const uniqueCategories = ['All', ...new Set(components.map(c => c.category).filter(Boolean))].sort();

  return (
    <div className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px' }}>
          <div className="search-box" style={{ flex: 1, maxWidth: '400px' }}>
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search serial, name, part, or asset..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="sel" 
            style={{ width: '150px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="INSTALLED">Installed</option>
            <option value="UNDER_REPAIR">Under Repair</option>
            <option value="RETURNED_TO_VENDOR">Returned to Vendor</option>
            <option value="SCRAPPED">Scrapped</option>
          </select>
          <select 
            className="sel" 
            style={{ width: '180px' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setShowReceiveModal(true)}>
          <Plus size={16} /> Receive Component
        </button>
      </div>

      {/* Data Table */}
      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="table-responsive" style={{ flex: 1, overflowY: 'auto' }}>
          <table className="tbl">
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-1)' }}>
              <tr>
                <th>Component / Serial</th>
                <th>Category</th>
                <th>Manufacturer / Part</th>
                <th>Status</th>
                <th>Current Asset</th>
                <th>Location</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Loader2 size={24} className="spin" style={{ margin: '0 auto', color: 'var(--text-3)' }} />
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-2)' }}>Loading components...</div>
                  </td>
                </tr>
              ) : filteredComponents.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                    No serialized components found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredComponents.map(comp => {
                  const isAvail = comp.status === 'AVAILABLE';
                  const isInst = comp.status === 'INSTALLED';
                  const isRepair = comp.status === 'UNDER_REPAIR';

                  return (
                  <tr key={comp.id}>
                    <td>
                      <Link to={`/inventory/components/${comp.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontWeight: 500, color: 'var(--accent)' }}>{comp.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>SN: {comp.serial_number}</div>
                      </Link>
                    </td>
                    <td>{comp.category || '-'}</td>
                    <td>
                      <div style={{ color: 'var(--text-1)' }}>{comp.manufacturer || '-'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{comp.part_number ? `PN: ${comp.part_number}` : ''}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${comp.status.toLowerCase()}`}>
                        {comp.status}
                      </span>
                    </td>
                    <td>
                      {comp.assets ? (
                        <a href={`/assets/${comp.current_asset_id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                          {comp.assets.asset_code}
                        </a>
                      ) : '-'}
                    </td>
                    <td>{comp.current_location || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                      {formatCurrency(comp.purchase_cost, comp.currency)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {isAvail && (
                          <button className="btn-icon btn-secondary btn-sm" title="Install" onClick={() => setActiveModal({ type: 'install', component: comp })}>
                            <ArrowDownToLine size={14} />
                          </button>
                        )}
                        {isInst && (
                          <>
                            <button className="btn-icon btn-secondary btn-sm" title="Remove" onClick={() => setActiveModal({ type: 'remove', component: comp })}>
                              <Wrench size={14} />
                            </button>
                            <button className="btn-icon btn-secondary btn-sm" title="Replace" onClick={() => setActiveModal({ type: 'replace', component: comp })}>
                              <Repeat size={14} />
                            </button>
                          </>
                        )}
                        <button className="btn-icon btn-secondary btn-sm" title="Edit details" onClick={() => setActiveModal({ type: 'edit', component: comp })}>
                          <Edit size={14} />
                        </button>
                        {(isAvail || isRepair) && (
                          <button className="btn-icon btn-secondary btn-sm" style={{ color: 'var(--status-danger)' }} title="Scrap" onClick={() => setActiveModal({ type: 'scrap', component: comp })}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showReceiveModal && (
        <ReceiveComponentModal 
          open={true}
          onClose={() => setShowReceiveModal(false)}
          onSaved={() => {
            invalidate();
            loadComponents();
          }}
          sites={sites}
          userId={user?.id}
        />
      )}

      {activeModal && activeModal.type === 'install' && (
        <InstallComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={activeModal.component}
          userId={user?.id}
          onSaved={() => { invalidate(); loadComponents(); }}
        />
      )}

      {activeModal && activeModal.type === 'remove' && (
        <RemoveComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={activeModal.component}
          userId={user?.id}
          onSaved={() => { invalidate(); loadComponents(); }}
        />
      )}

      {activeModal && activeModal.type === 'replace' && (
        <ReplaceComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={activeModal.component}
          userId={user?.id}
          onSaved={() => { invalidate(); loadComponents(); }}
        />
      )}

      {activeModal && activeModal.type === 'scrap' && (
        <ScrapComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={activeModal.component}
          userId={user?.id}
          onSaved={() => { invalidate(); loadComponents(); }}
        />
      )}

      {activeModal && activeModal.type === 'edit' && (
        <EditComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={activeModal.component}
          sites={sites}
          onSaved={() => { invalidate(); loadComponents(); }}
        />
      )}
    </div>
  );
}


