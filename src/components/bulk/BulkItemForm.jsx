import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader2, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function BulkItemForm({ isOpen, onClose, item, onSaved, availableCategories = [] }) {
  const [loading, setLoading] = useState(false)
  const defaultCats = ['Scaffolding', 'Materials', 'Tools', 'Hand Machines', 'Consumables', 'Safety Equipment', 'Shuttering', 'Electrical']
  const catOptions = Array.from(new Set([...defaultCats, ...(Array.isArray(availableCategories) ? availableCategories : [])])).sort()

  const [form, setForm] = useState({
    item_code: '',
    item_name: '',
    category: 'Scaffolding',
    unit: 'nos',
    unit_price: 0,
    unit_weight_kg: 0,
    notes: '',
    image_url: ''
  })

  useEffect(() => {
    if (isOpen && item) {
      setForm({
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        category: item.category || 'Scaffolding',
        unit: item.unit || 'nos',
        unit_price: item.unit_price || 0,
        unit_weight_kg: item.unit_weight_kg || 0,
        notes: item.notes || '',
        image_url: item.image_url || ''
      })
    } else if (isOpen) {
      setForm({ item_code:'', item_name:'', category:'Scaffolding', unit:'nos', unit_price: 0, unit_weight_kg:0, notes:'', image_url:'' })
    }
  }, [item, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...form,
        unit_price: Number(form.unit_price || 0),
        unit_weight_kg: Number(form.unit_weight_kg || 0)
      }
      if (item) {
        const { error } = await supabase.from('bulk_items').update(payload).eq('id', item.id)
        if (error) throw error
        // Sync unit_price to site stock
        await supabase.from('bulk_site_stock').update({ unit_price: payload.unit_price }).eq('item_id', item.id)
      } else {
        const { error } = await supabase.from('bulk_items').insert([payload])
        if (error) throw error
      }
      onSaved()
      onClose()
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="modal-bg" style={{ zIndex: 2200 }} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 7, background: 'var(--accent-soft)', borderRadius: 9, color: 'var(--accent)', border: '1px solid var(--accent-soft)' }}>
              <Package size={16} />
            </div>
            <div>
              <h3 style={{ letterSpacing: '0.05em', color: 'var(--text-0)', margin: 0, textTransform: 'uppercase' }}>
                {item ? 'Edit Master Item' : 'Add Master Item'}
              </h3>
              <p style={{ color: 'var(--text-3)', margin: 0 }}>Configure inventory item details, rates, and UOM</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '20px', display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label className="lbl">Item Name *</label>
              <input type="text" className="inp" required value={form.item_name} onChange={e => setForm({...form, item_name: e.target.value})} placeholder="e.g. Scaffolding Vertical 3m" />
            </div>
            <div>
              <label className="lbl">Item Code / SKU *</label>
              <input type="text" className="inp" required value={form.item_code} onChange={e => setForm({...form, item_code: e.target.value})}  placeholder="e.g. SCAF-VERT-01" />
            </div>
          </div>
          
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label className="lbl">Category *</label>
              <input 
                type="text" 
                className="inp" 
                required 
                value={form.category} 
                onChange={e => setForm({...form, category: e.target.value})} 
                placeholder="e.g. Scaffolding, Tools, Materials" 
                list="category-list" 
              />
              <datalist id="category-list">
                {catOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="lbl">Unit of Measure (UOM) *</label>
              <input 
                type="text" 
                className="inp" 
                required 
                value={form.unit} 
                onChange={e => setForm({...form, unit: e.target.value})} 
                placeholder="nos, mtrs, kg, sqft, sets, bags" 
                list="uom-list" 
              />
              <datalist id="uom-list">
                <option value="nos" label="Nos / Pieces" />
                <option value="mtrs" label="Meters" />
                <option value="kg" label="Kilograms" />
                <option value="sqft" label="Square Feet" />
                <option value="sets" label="Sets" />
                <option value="bags" label="Bags" />
                <option value="ltrs" label="Liters" />
                <option value="bundles" label="Bundles" />
                <option value="tons" label="Metric Tons" />
                <option value="boxes" label="Boxes" />
              </datalist>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label className="lbl">Unit Cost / Price (₹) *</label>
              <input 
                type="number" 
                step="any" 
                className="inp" 
                value={form.unit_price} 
                onChange={e => setForm({...form, unit_price: e.target.value})} 
                placeholder="e.g. 10 (₹10 per Vertical)" 
              />
            </div>
            <div>
              <label className="lbl">Unit Weight (kg)</label>
              <input 
                type="number" 
                step="0.001" 
                className="inp" 
                value={form.unit_weight_kg} 
                onChange={e => setForm({...form, unit_weight_kg: e.target.value})} 
                placeholder="e.g. 15.5" 
              />
            </div>
          </div>

          <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
            <div style={{ flex:1 }}>
              <label className="lbl">Notes</label>
              <textarea className="inp" rows={4} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
            <div>
              <label className="lbl">Image (Auto-compressed)</label>
              <div style={{ 
                width: 100, height: 100, borderRadius: 12, border: '1px dashed var(--border)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-2)',
                position: 'relative', overflow: 'hidden', cursor: 'pointer'
              }}>
                {form.image_url ? (
                  <img src={form.image_url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color:'var(--text-3)', }}>Upload</span>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer' }}
                  onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_SIZE = 400;
                        let width = img.width;
                        let height = img.height;
                        if (width > height && width > MAX_SIZE) {
                          height *= MAX_SIZE / width;
                          width = MAX_SIZE;
                        } else if (height > MAX_SIZE) {
                          width *= MAX_SIZE / height;
                          height = MAX_SIZE;
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const base64Str = canvas.toDataURL('image/jpeg', 0.8);
                        setForm({...form, image_url: base64Str});
                      };
                      img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
              {form.image_url && (
                <button type="button" onClick={() => setForm({...form, image_url: ''})} className="btn-ghost" style={{ padding: '2px 8px', color: 'var(--red)', width: '100%', marginTop: 4 }}>
                  Remove
                </button>
              )}
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:10 }}>
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite' }} /> : <Save size={16}/>}
              Save Item
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
