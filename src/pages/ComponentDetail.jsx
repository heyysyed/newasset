import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getComponentById, getComponentLifecycle } from '../services/componentService';
import { fetchPartsSites } from '../services/partsService';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Package, History, Info, Link as LinkIcon, Edit, ArrowDownToLine, Wrench, Repeat, Trash2 } from 'lucide-react';
import { formatCurrency } from '../lib/depreciation';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { 
  InstallComponentModal,
  RemoveComponentModal,
  ReplaceComponentModal,
  ScrapComponentModal,
  EditComponentModal
} from '../components/inventory/SerializedModals';

export default function ComponentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [component, setComponent] = useState(null);
  const [lifecycle, setLifecycle] = useState([]);
  const [replacements, setReplacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // { type }

  const { data: sites = [] } = useQuery({
    queryKey: ['parts-sites'],
    queryFn: fetchPartsSites,
  });

  useEffect(() => {
    loadComponentData();
  }, [id]);

  async function loadComponentData() {
    setLoading(true);
    try {
      const [compData, lifeData, replaceData] = await Promise.all([
        getComponentById(id),
        getComponentLifecycle(id),
        supabase.from('component_replacements').select(`
          *,
          old_comp:old_component_id(name, serial_number),
          new_comp:new_component_id(name, serial_number)
        `).or(`old_component_id.eq.${id},new_component_id.eq.${id}`)
      ]);
      setComponent(compData);
      setLifecycle(lifeData || []);
      setReplacements(replaceData.data || []);
    } catch (e) {
      console.error(e);
      alert('Failed to load component details');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading component...</div>;
  if (!component) return <div style={{ padding: '3rem', textAlign: 'center' }}>Component not found</div>;

  return (
    <div className="container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Package size={28} style={{ color: 'var(--accent)' }} />
              {component.name}
            </h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--text-3)', marginTop: '0.25rem' }}>
              <span>SN: <strong style={{ color: 'var(--text-1)' }}>{component.serial_number}</strong></span>
              {component.part_number && <span>PN: <strong style={{ color: 'var(--text-1)' }}>{component.part_number}</strong></span>}
              <span className={`status-badge ${component.status.toLowerCase()}`}>{component.status}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {component.status === 'AVAILABLE' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveModal('install')}>
              <ArrowDownToLine size={14} /> Install
            </button>
          )}
          {component.status === 'INSTALLED' && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveModal('remove')}>
                <Wrench size={14} /> Remove
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveModal('replace')}>
                <Repeat size={14} /> Replace
              </button>
            </>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveModal('edit')}>
            <Edit size={14} /> Edit
          </button>
          {['AVAILABLE', 'UNDER_REPAIR'].includes(component.status) && (
            <button className="btn btn-sm btn-warning" onClick={() => setActiveModal('scrap')}>
              <Trash2 size={14} /> Scrap
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Identity & Procurement */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Info size={18} /> Identity & Procurement
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Manufacturer</div>
                <div style={{ fontWeight: 500 }}>{component.manufacturer || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Model</div>
                <div style={{ fontWeight: 500 }}>{component.model || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Category</div>
                <div style={{ fontWeight: 500 }}>{component.category || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Purchase Cost</div>
                <div style={{ fontWeight: 500, color: 'var(--status-success)' }}>
                  {formatCurrency(component.purchase_cost, component.currency)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase' }}>PO Number</div>
                <div style={{ fontWeight: 500 }}>{component.po_number || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Current Location</div>
                <div style={{ fontWeight: 500 }}>{component.current_location || '-'}</div>
              </div>
            </div>
          </div>

          {/* Replacement Chain */}
          {replacements.length > 0 && (
            <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-2)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <LinkIcon size={18} /> Replacement Chain
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {replacements.map(r => {
                  const isOld = r.old_component_id === id;
                  return (
                    <div key={r.id} style={{ padding: '1rem', background: 'var(--bg-1)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '0.5rem' }}>
                        {new Date(r.replaced_at).toLocaleString()}
                      </div>
                      {isOld ? (
                        <div>
                          Replaced by <Link to={`/inventory/components/${r.new_component_id}`} style={{ fontWeight: 500, color: 'var(--primary)' }}>{r.new_comp.name} (SN: {r.new_comp.serial_number})</Link>
                        </div>
                      ) : (
                        <div>
                          Replaced <Link to={`/inventory/components/${r.old_component_id}`} style={{ fontWeight: 500, color: 'var(--primary)' }}>{r.old_comp.name} (SN: {r.old_comp.serial_number})</Link>
                        </div>
                      )}
                      {r.reason && (
                        <div style={{ marginTop: '0.5rem', fontSize: '14px', color: 'var(--text-2)' }}>
                          <strong>Reason:</strong> {r.reason}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Current Asset */}
          {component.assets && (
            <div className="card" style={{ padding: '1.5rem', border: '2px solid var(--primary-light)' }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Installed In</h3>
              <Link to={`/assets/${component.current_asset_id}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-1)' }}>{component.assets.asset_code}</span>
                  <span style={{ color: 'var(--text-2)' }}>{component.assets.asset_name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{component.assets.site} - {component.assets.location}</span>
                </div>
              </Link>
            </div>
          )}

          {/* Lifecycle Timeline */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <History size={18} /> Lifecycle
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {lifecycle.map((event, i) => (
                <div key={event.id} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                  {i !== lifecycle.length - 1 && (
                    <div style={{ position: 'absolute', left: '7px', top: '20px', bottom: '-1.5rem', width: '2px', background: 'var(--border)' }} />
                  )}
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent)', marginTop: '4px', zIndex: 1, border: '3px solid var(--bg-1)' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-1)' }}>{event.event_type}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{new Date(event.event_time).toLocaleString()}</div>
                    {event.assets && (
                      <div style={{ fontSize: '13px', marginTop: '0.25rem' }}>
                        Asset: <Link to={`/assets/${event.asset_id}`}>{event.assets.asset_code}</Link>
                      </div>
                    )}
                    {event.reason && (
                      <div style={{ fontSize: '13px', marginTop: '0.25rem', color: 'var(--text-2)' }}>
                        "{event.reason}"
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                      By {event.profiles?.full_name || '-'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {activeModal === 'install' && (
        <InstallComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={component}
          userId={user?.id}
          onSaved={() => { loadComponentData(); }}
        />
      )}

      {activeModal === 'remove' && (
        <RemoveComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={component}
          userId={user?.id}
          onSaved={() => { loadComponentData(); }}
        />
      )}

      {activeModal === 'replace' && (
        <ReplaceComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={component}
          userId={user?.id}
          onSaved={() => { loadComponentData(); }}
        />
      )}

      {activeModal === 'scrap' && (
        <ScrapComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={component}
          userId={user?.id}
          onSaved={() => { loadComponentData(); }}
        />
      )}

      {activeModal === 'edit' && (
        <EditComponentModal
          open={true}
          onClose={() => setActiveModal(null)}
          component={component}
          sites={sites}
          onSaved={() => { loadComponentData(); }}
        />
      )}
    </div>
  );
}


