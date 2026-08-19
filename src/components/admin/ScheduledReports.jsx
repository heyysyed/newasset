import React, { useState } from 'react'
import { FileSpreadsheet, Plus, Trash2, Mail, Clock, Save, Edit2 } from 'lucide-react'

function SectionHead({ icon: Icon, title, sub, color = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} style={{ color }}/>
      </div>
      <div>
        <h2 style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.06em', color: 'var(--text-0)', margin: 0 }}>{title}</h2>
        {sub && <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.73rem', color: 'var(--text-3)', margin: 0, marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  )
}

export default function ScheduledReports({ settings, setSettings }) {
  const reports = settings?.scheduled_reports || []
  
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({
    id: '', name: '', frequency: 'monthly', recipients: '', format: 'excel', module: 'assets'
  })

  function handleAddNew() {
    setDraft({
      id: Date.now().toString(),
      name: '', frequency: 'weekly', recipients: '', format: 'excel', module: 'assets'
    })
    setEditingId('new')
  }

  function handleEdit(r) {
    setDraft({ ...r, recipients: Array.isArray(r.recipients) ? r.recipients.join(', ') : r.recipients })
    setEditingId(r.id)
  }

  function handleSave() {
    if (!draft.name || !draft.recipients) return alert('Name and Recipients are required.')
    
    const newReport = {
      ...draft,
      recipients: draft.recipients.split(',').map(e => e.trim()).filter(Boolean)
    }

    let updated = []
    if (editingId === 'new') {
      updated = [...reports, newReport]
    } else {
      updated = reports.map(r => r.id === editingId ? newReport : r)
    }

    setSettings(prev => ({ ...prev, scheduled_reports: updated }))
    setEditingId(null)
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this scheduled report?')) return
    setSettings(prev => ({ ...prev, scheduled_reports: reports.filter(r => r.id !== id) }))
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <SectionHead icon={FileSpreadsheet} title="SCHEDULED REPORTING" sub="Configure automated reports to be emailed at set intervals" color="#8b5cf6" />
      
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button onClick={handleAddNew} disabled={editingId !== null} className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.78rem' }}>
            <Plus size={14} /> New Schedule
          </button>
        </div>

        {editingId && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 16px', fontFamily: "'Oswald', sans-serif", fontSize: '0.9rem', color: 'var(--text-0)' }}>
              {editingId === 'new' ? 'Create New Report' : 'Edit Report'}
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label className="lbl">Report Name</label>
                <input className="inp" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Weekly Asset Summary" />
              </div>
              <div>
                <label className="lbl">Module Data</label>
                <select className="sel" value={draft.module} onChange={e => setDraft(d => ({ ...d, module: e.target.value }))}>
                  <option value="assets">Asset Inventory</option>
                  <option value="maintenance">Maintenance Logs</option>
                  <option value="audit">Audit Sessions</option>
                </select>
              </div>
              <div>
                <label className="lbl">Frequency</label>
                <select className="sel" value={draft.frequency} onChange={e => setDraft(d => ({ ...d, frequency: e.target.value }))}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="lbl">Format</label>
                <select className="sel" value={draft.format} onChange={e => setDraft(d => ({ ...d, format: e.target.value }))}>
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="lbl">Recipients (comma separated emails)</label>
                <input className="inp" value={draft.recipients} onChange={e => setDraft(d => ({ ...d, recipients: e.target.value }))} placeholder="admin@example.com, manager@example.com" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="lbl">Slack / Teams Webhook Integration URL (Optional)</label>
                <input className="inp" value={draft.webhook_url || ''} onChange={e => setDraft(d => ({ ...d, webhook_url: e.target.value }))} placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingId(null)} className="btn-ghost" style={{ padding: '8px 16px' }}>Cancel</button>
              <button onClick={handleSave} className="btn-primary" style={{ padding: '8px 16px' }}><Save size={14} /> Save Schedule</button>
            </div>
          </div>
        )}

        {reports.length === 0 && !editingId ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
            <FileSpreadsheet size={32} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.88rem' }}>No automated reports scheduled yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {reports.map(r => (
              <div key={r.id} style={{ padding: 16, background: 'var(--bg-1)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-0)' }}>{r.name}</h5>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-3)' }}>Module: <strong style={{ color: 'var(--accent)' }}>{r.module.toUpperCase()}</strong></p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleEdit(r)} className="btn-ghost" style={{ padding: 6 }}><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(r.id)} className="btn-danger" style={{ padding: 6, background: 'transparent', color: 'var(--red)' }}><Trash2 size={13} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: 6 }}>
                  <Clock size={12} style={{ color: 'var(--cyan)' }} />
                  <span>Runs <strong style={{ textTransform: 'capitalize' }}>{r.frequency}</strong> as <strong>{r.format.toUpperCase()}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.75rem', color: 'var(--text-2)' }}>
                  <Mail size={12} style={{ color: 'var(--amber)', marginTop: 2 }} />
                  <span style={{ wordBreak: 'break-all' }}>{(r.recipients || []).join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
