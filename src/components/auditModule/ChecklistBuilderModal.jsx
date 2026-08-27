import React, { useState } from 'react'
import { X, Plus, Trash2, GripVertical, Save, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react'

export default function ChecklistBuilderModal({ onClose, onSave, assetNames }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [items, setItems] = useState([
    { id: Date.now().toString(), section: 'General', question: '', type: 'pass_fail_na' }
  ])

  const [saving, setSaving] = useState(false)

  // Handlers
  const handleAddItem = () => {
    const lastSection = items.length > 0 ? items[items.length - 1].section : 'General'
    setItems([...items, { id: Date.now().toString(), section: lastSection, question: '', type: 'pass_fail_na' }])
  }

  const handleUpdateItem = (idx, field, val) => {
    const newItems = [...items]
    newItems[idx][field] = val
    setItems(newItems)
  }

  const handleRemoveItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const handleMoveUp = (idx) => {
    if (idx === 0) return
    const newItems = [...items]
    const temp = newItems[idx - 1]
    newItems[idx - 1] = newItems[idx]
    newItems[idx] = temp
    setItems(newItems)
  }

  const handleMoveDown = (idx) => {
    if (idx === items.length - 1) return
    const newItems = [...items]
    const temp = newItems[idx + 1]
    newItems[idx + 1] = newItems[idx]
    newItems[idx] = temp
    setItems(newItems)
  }

  const handleSubmit = async () => {
    if (!name.trim()) return alert('Checklist name is required.')
    const validItems = items.filter(i => i.question.trim() !== '')
    if (validItems.length === 0) return alert('At least one inspection item is required.')

    setSaving(true)
    const payload = {
      name: name.trim(),
      category: category || null,
      frequency,
      items: validItems.map((item, i) => ({
        id: `item_${i}`,
        section: item.section.trim() || 'General',
        question: item.question.trim(),
        type: 'pass_fail_na'
      })),
      linked_asset_names: category ? [category] : []
    }

    try {
      await onSave(payload)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-bg" style={{ zIndex: 3000 }} onClick={!saving ? onClose : undefined}>
      <div className="modal" style={{ maxWidth: 800, padding: 0, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="card-header" style={{ background: 'var(--bg-3)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="font-display" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interactive Checklist Builder</h2>
              <span style={{ color: 'var(--text-3)', }}>Design a custom Pass/Fail template</span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }} disabled={saving}><X size={16} /></button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: 'var(--bg-2)' }}>
          
          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <label className="lbl">Checklist Name *</label>
              <input className="inp" placeholder="e.g., Monthly Crane Inspection" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="lbl">Auto-Link to Asset Type</label>
              <select className="sel" value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%' }}>
                <option value="">None (Link manually later)</option>
                {assetNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">Frequency</label>
              <select className="sel" value={frequency} onChange={e => setFrequency(e.target.value)} style={{ width: '100%' }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <h3 style={{ textTransform: 'uppercase', color: 'var(--text-1)', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            Inspection Items
          </h3>

          {/* Builder Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((item, idx) => (
              <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--bg-1)', padding: 12, borderRadius: 10, border: '1px solid var(--border)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <button className="btn-ghost" style={{ padding: 4, height: 24, width: 24, minHeight: 0 }} onClick={() => handleMoveUp(idx)} disabled={idx === 0}>↑</button>
                  <button className="btn-ghost" style={{ padding: 4, height: 24, width: 24, minHeight: 0 }} onClick={() => handleMoveDown(idx)} disabled={idx === items.length - 1}>↓</button>
                </div>
                
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 12 }}>
                  <div>
                    <label style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Section Name</label>
                    <input className="inp" placeholder="e.g., Electrical" value={item.section} onChange={e => handleUpdateItem(idx, 'section', e.target.value)}  />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Question / Inspection Task</label>
                    <input className="inp" placeholder="e.g., Check main limit switches..." value={item.question} onChange={e => handleUpdateItem(idx, 'question', e.target.value)}  />
                  </div>
                </div>

                <button className="btn-ghost" style={{ padding: 6, color: 'var(--red)', marginTop: 22 }} onClick={() => handleRemoveItem(idx)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button className="btn-ghost" style={{ marginTop: 16, width: '100%', padding: '12px', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--accent)', }} onClick={handleAddItem}>
            <Plus size={16} /> Add Inspection Item
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', background: 'var(--bg-3)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} className="btn-ghost" disabled={saving}>Cancel</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving} style={{ padding: '8px 20px', }}>
            {saving ? 'Saving...' : <><Save size={16} /> Save Checklist</>}
          </button>
        </div>

      </div>
    </div>
  )
}


