import React, { useState } from 'react'
import { Plus, Trash2, FileSpreadsheet, Save, X, Type, List } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

export default function ChecklistTemplateForm({ onSave, onClose, initialData }) {
  const [name, setName] = useState(initialData?.name || '')
  const [category, setCategory] = useState(initialData?.category || '')
  const [assetType, setAssetType] = useState(initialData?.asset_type || 'Machinery')
  const [items, setItems] = useState(initialData?.items || [])
  const [loading, setLoading] = useState(false)

  const addItem = () => {
    setItems([...items, { section: '', description: '' }])
  }

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx, field, val) => {
    const n = [...items]
    n[idx][field] = val
    setItems(n)
  }

  const handleExcelImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
      
      // Expected: Column A = Section, Column B = Description
      // Skip header row if necessary
      const newItems = data.slice(1).map(row => ({
        section: row[0] || '',
        description: row[1] || ''
      })).filter(i => i.description)
      
      setItems([...items, ...newItems])
    }
    reader.readAsBinaryString(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || items.length === 0) return alert('Please provide a name and at least one checklist item.')
    setLoading(true)
    try {
      const payload = { 
        name, 
        category, 
        asset_type: assetType, 
        items 
      }
      
      let res
      if (initialData?.id) {
        res = await supabase.from('checklist_templates').update(payload).eq('id', initialData.id)
      } else {
        res = await supabase.from('checklist_templates').insert([payload])
      }
      
      if (res.error) throw res.error
      onSave()
    } catch (err) {
      console.error(err)
      alert('Error saving template: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-bg">
      <div className="modal" style={{ maxWidth: 800 }}>
        <div className="card-header" style={{ background: 'var(--bg-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, background: 'var(--accent-glow)', borderRadius: 10, color: 'var(--accent)', border: '1px solid var(--accent)30' }}>
              <List size={18} />
            </div>
            <div>
              <h2 className="font-display" style={{ letterSpacing: '0.04em', margin: 0, color: 'var(--text-0)' }}>
                {initialData ? 'EDIT TEMPLATE' : 'CREATE TEMPLATE'}
              </h2>
              <span style={{ color: 'var(--text-3)', }}>Define operational inspection points</span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
        </div>

        <form onSubmit={handleSubmit} className="card-body" style={{ background: 'var(--bg-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div>
              <label className="lbl">Template Name</label>
              <input
                className="inp"
                placeholder="e.g., Tower Crane Daily"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="lbl">Category</label>
              <input
                className="inp"
                placeholder="e.g., Heavy Equipment"
                value={category}
                onChange={e => setCategory(e.target.value)}
              />
            </div>
            <div>
              <label className="lbl">Asset Type</label>
              <select className="sel" value={assetType} onChange={e => setAssetType(e.target.value)}>
                <option value="Machinery">Machinery</option>
                <option value="Vehicle">Vehicle</option>
                <option value="Tools">Tools</option>
                <option value="Safety">Safety</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 className="font-display" style={{ color: 'var(--text-2)', letterSpacing: '0.08em', margin: 0 }}>
              CHECKLIST ITEMS ({items.length})
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <label className="btn-ghost" style={{ cursor: 'pointer', padding: '7px 12px' }}>
                <FileSpreadsheet size={14} /> Import Excel
                <input type="file" onChange={handleExcelImport} style={{ display: 'none' }} accept=".xlsx, .xls" />
              </label>
              <button type="button" onClick={addItem} className="btn-ghost" style={{ padding: '7px 12px' }}>
                <Plus size={14} /> Add Item
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-1)' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Section</th>
                  <th>Description</th>
                  <th style={{ width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        className="inp"
                        style={{ background: 'transparent', border: 'none', padding: 0, }}
                        placeholder="e.g., Lifting"
                        value={item.section}
                        onChange={e => updateItem(idx, 'section', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="inp"
                        style={{ background: 'transparent', border: 'none', padding: 0, }}
                        placeholder="Description of check…"
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        required
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" onClick={() => removeItem(idx)} className="btn-ghost" style={{ padding: 4, color: 'var(--red)', border: 'none' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)', }}>
                      No items yet - add manually or import from Excel.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              <Save size={15} /> {loading ? 'Saving…' : (initialData ? 'Update Template' : 'Save Template')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
