import React from 'react'
import { Ticket, X, Loader2, MapPin, Layers, Search, Copy, Download, FileText, Package, IndianRupee, Activity } from 'lucide-react'
import AssetHistoryDrawer from '../../components/AssetHistoryDrawer'

export default function AssetRegisterModals({
  showHistoryAsset, setShowHistoryAsset,
  showBulkMaintenance, setShowBulkMaintenance, handleBulkMaintenance, bulkMaintenanceForm, setBulkMaintenanceForm, selectedSize,
  showPDFModal, setShowPDFModal, exportPDF, activeFilters,
  showBulkStatus, setShowBulkStatus, bulkStatusVal, setBulkStatusVal, STATUSES, handleBulkStatus, bulkLoading,
  showBulkTransfer, setShowBulkTransfer, bulkTransferSite, setBulkTransferSite, sites, handleBulkTransfer,
  showAssignGroup, setShowAssignGroup, assignGroupAssets, assignGroupTab, setAssignGroupTab, assignGroupSearch, setAssignGroupSearch, uniqueGroupNames, assignGroupSelected, setAssignGroupSelected, assignGroupNewName, setAssignGroupNewName, assignGroupLoading, handleAssignGroupSubmit,
  cloneAsset, setCloneAsset, handleClone, cloneLoading
}) {
  return (
    <>
      {/* History Drawer */}
      {showHistoryAsset && (
        <AssetHistoryDrawer assetId={showHistoryAsset} onClose={() => setShowHistoryAsset(null)} />
      )}

      {/* Bulk Maintenance Modal */}
      {showBulkMaintenance && (
        <div className="modal-backdrop">
          <div className="modal-content animate-fade-up">
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ticket size={20} color="var(--amber)" /> Schedule Bulk Maintenance</h3>
              <button onClick={() => setShowBulkMaintenance(false)} className="btn-ghost"><X size={18} /></button>
            </div>
            <form onSubmit={handleBulkMaintenance}>
              <div className="modal-body" style={{ padding: 20 }}>
                <p style={{ margin: '0 0 16px', color: 'var(--text-2)' }}>
                  Creating tickets for <strong>{selectedSize}</strong> selected assets.
                </p>
                <div style={{ marginBottom: 16 }}>
                  <label className="lbl">Ticket Title *</label>
                  <input required className="inp" placeholder="e.g. Quarterly Inspection" value={bulkMaintenanceForm.title} onChange={e => setBulkMaintenanceForm({ ...bulkMaintenanceForm, title: e.target.value })} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="lbl">Description</label>
                  <textarea className="inp" rows={3} value={bulkMaintenanceForm.description} onChange={e => setBulkMaintenanceForm({ ...bulkMaintenanceForm, description: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label className="lbl">Priority</label>
                    <select className="sel" value={bulkMaintenanceForm.priority} onChange={e => setBulkMaintenanceForm({ ...bulkMaintenanceForm, priority: e.target.value })}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Ticket Type</label>
                    <select className="sel" value={bulkMaintenanceForm.ticket_type} onChange={e => setBulkMaintenanceForm({ ...bulkMaintenanceForm, ticket_type: e.target.value })}>
                      <option value="preventive">Preventive</option>
                      <option value="breakdown">Breakdown</option>
                      <option value="inspection">Inspection</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowBulkMaintenance(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary" disabled={bulkLoading}>
                  {bulkLoading ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
                  Create Tickets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Report Modal */}
      {showPDFModal && (
        <PDFReportModal
          onClose={() => setShowPDFModal(false)}
          onExport={(type) => { setShowPDFModal(false); exportPDF(type) }}
          activeFilters={activeFilters}
        />
      )}

      {/* Bulk Status Change */}
      {showBulkStatus && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setShowBulkStatus(false)}>
          <div className="modal" style={{ maxWidth: 400, width: '95%', padding: 32 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px' }}>CHANGE STATUS ({selectedSize} assets)</h2>
            <select className="sel" value={bulkStatusVal} onChange={e => setBulkStatusVal(e.target.value)} style={{ width: '100%', marginBottom: 16 }}>
              <option value="">Select new status…</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowBulkStatus(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleBulkStatus} disabled={!bulkStatusVal || bulkLoading}>
                {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : null} Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Transfer */}
      {showBulkTransfer && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setShowBulkTransfer(false)}>
          <div className="modal" style={{ maxWidth: 400, width: '95%', padding: 32 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px' }}>TRANSFER {selectedSize} ASSETS</h2>
            <label className="lbl">Destination Site</label>
            <select className="sel" value={bulkTransferSite} onChange={e => setBulkTransferSite(e.target.value)} style={{ width: '100%', marginBottom: 16 }}>
              <option value="">Select site…</option>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowBulkTransfer(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleBulkTransfer} disabled={!bulkTransferSite || bulkLoading}>
                {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />} Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Group Modal */}
      {showAssignGroup && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setShowAssignGroup(false)}>
          <div className="modal" style={{ maxWidth: 460, width: '95%', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 16px' }}>
              <h2 style={{ margin: '0 0 8px', letterSpacing: '0.05em', color: 'var(--text-0)' }}>ASSIGN GROUP</h2>
              <p style={{ color: 'var(--text-2)', margin: 0 }}>
                Group <strong>{assignGroupAssets.length} asset{assignGroupAssets.length > 1 ? 's' : ''}</strong> under a common name.
              </p>
            </div>
            
            <div style={{ padding: '0 24px', marginBottom: 16 }}>
              <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 4, borderRadius: 12, gap: 4 }}>
                <button 
                  onClick={() => setAssignGroupTab('existing')}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, transition: 'all 0.2s', background: assignGroupTab === 'existing' ? 'var(--accent)' : 'transparent', color: assignGroupTab === 'existing' ? 'white' : 'var(--text-2)', border: 'none', cursor: 'pointer' }}
                >
                  Select Existing
                </button>
                <button 
                  onClick={() => setAssignGroupTab('new')}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, transition: 'all 0.2s', background: assignGroupTab === 'new' ? 'var(--accent)' : 'transparent', color: assignGroupTab === 'new' ? 'white' : 'var(--text-2)', border: 'none', cursor: 'pointer' }}
                >
                  Create New
                </button>
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', minHeight: 200 }}>
              {assignGroupTab === 'existing' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                    <input 
                      value={assignGroupSearch} 
                      onChange={e => setAssignGroupSearch(e.target.value)} 
                      placeholder="Search groups..." 
                      className="inp" 
                      style={{ paddingLeft: 34, width: '100%', borderRadius: 8, minHeight: 38 }} 
                    />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: 220, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-1)' }}>
                    {uniqueGroupNames.filter(n => n.toLowerCase().includes(assignGroupSearch.toLowerCase())).map(name => (
                      <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', margin: 0, transition: 'background 0.15s', background: assignGroupSelected === name ? 'rgba(59,110,245,0.05)' : 'transparent' }}>
                        <input 
                          type="radio" 
                          name="assign-group-radio" 
                          checked={assignGroupSelected === name} 
                          onChange={() => setAssignGroupSelected(name)} 
                          style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} 
                        />
                        <span style={{ fontWeight: assignGroupSelected === name ? 700 : 500, color: assignGroupSelected === name ? 'var(--accent)' : 'var(--text-0)' }}>
                          {name}
                        </span>
                      </label>
                    ))}
                    {uniqueGroupNames.filter(n => n.toLowerCase().includes(assignGroupSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', }}>No matching groups found.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 8 }}>
                  <label className="lbl">New Group Name</label>
                  <input 
                    autoFocus
                    value={assignGroupNewName} 
                    onChange={e => setAssignGroupNewName(e.target.value)} 
                    placeholder="Enter new common name..." 
                    className="inp" 
                    style={{ width: '100%', padding: '10px 14px' }} 
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
              <button className="btn-ghost" onClick={() => setShowAssignGroup(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAssignGroupSubmit} style={{ gap: 6 }} disabled={assignGroupLoading || (assignGroupTab === 'existing' && !assignGroupSelected) || (assignGroupTab === 'new' && !assignGroupNewName.trim())}>
                {assignGroupLoading ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />} Assign Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Asset */}
      {cloneAsset && (
        <div className="modal-bg" style={{ zIndex: 2000 }} onClick={() => setCloneAsset(null)}>
          <div className="modal" style={{ maxWidth: 420, width: '95%', padding: 32 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 16px' }}>CLONE ASSET</h2>
            <p style={{ color: 'var(--text-2)', marginBottom: 16, }}>
              Create a duplicate of <strong>{cloneAsset.asset_name}</strong> ({cloneAsset.asset_code}) with a new auto-generated asset code?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setCloneAsset(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleClone} disabled={cloneLoading}>
                {cloneLoading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} Clone
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PDFReportModal({ onClose, onExport, activeFilters }) {
  const [selected, setSelected] = React.useState('full')
  const [hoveredId, setHoveredId] = React.useState(null)

  const REPORTS = [
    { id: 'full', icon: FileText, title: 'Full Asset Register', desc: 'Complete asset list with make, model, site, purchase value, and book value.' },
    { id: 'summary', icon: Package, title: 'Summary Report', desc: 'Site-wise and category-wise breakdown with totals and status counts.' },
    { id: 'depreciation', icon: IndianRupee, title: 'Depreciation Report', desc: 'Financial analysis with purchase value, useful life, depreciation method, and book value.' },
    { id: 'status', icon: Activity, title: 'Status-Wise Report', desc: 'Assets grouped by status with per-status detail pages.' },
  ]

  const activeFiltersList = [
    activeFilters.site && activeFilters.site !== 'All' && `Site: ${activeFilters.site}`,
    activeFilters.category && activeFilters.category !== 'All' && `Category: ${activeFilters.category}`,
    activeFilters.status && activeFilters.status !== 'All' && `Status: ${activeFilters.status}`,
  ].filter(Boolean)

  return (
    <div className="modal-bg" style={{ zIndex: 2100 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-2)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.15)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ letterSpacing: '0.08em', color: 'var(--text-0)', margin: 0, textTransform: 'uppercase' }}>
              Export PDF Report
            </h2>
            <button onClick={onClose} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
          </div>
          <p style={{ color: 'var(--text-2)', margin: 0 }}>
            Select report type to generate
          </p>
          {activeFiltersList.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {activeFiltersList.map(f => (
                <span key={f} style={{ padding: '3px 10px', background: 'var(--bg-3)', borderRadius: 6, color: 'var(--text-1)', border: '1px solid var(--border)' }}>{f}</span>
              ))}
            </div>
          )}
        </div>

        {/* Report options */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {REPORTS.map(r => {
            const Icon = r.icon
            const isSelected = selected === r.id
            const isHovered = hoveredId === r.id
            return (
              <div
                key={r.id}
                onClick={() => setSelected(r.id)}
                onMouseEnter={() => setHoveredId(r.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 10, cursor: 'pointer', transition: 'all 0.12s',
                  border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                  background: isSelected ? 'rgba(59,110,245,0.05)' : isHovered ? 'var(--bg-3)' : 'transparent',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: isSelected ? 'var(--accent)' : 'var(--bg-3)', color: isSelected ? 'white' : 'var(--text-2)',
                  transition: 'all 0.12s',
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: isSelected ? 'var(--accent)' : 'var(--text-0)' }}>
                    {r.title}
                  </div>
                  <div style={{ color: 'var(--text-3)', marginTop: 2 }}>
                    {r.desc}
                  </div>
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, transition: 'all 0.12s',
                  border: isSelected ? '5px solid var(--accent)' : '2px solid var(--border)',
                  background: 'white',
                }} />
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '8px 16px' }}>Cancel</button>
          <button
            onClick={() => onExport(selected)}
            className="btn-primary"
            style={{ gap: 6, padding: '8px 20px', borderRadius: 8 }}
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
