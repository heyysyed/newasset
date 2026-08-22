import React, { useState } from 'react'
import { X, Package, Tag, Ruler, IndianRupee, MapPin, Archive, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const CATEGORIES = ['Spares', 'Consumables', 'Safety Gear', 'Stationery', 'Tools', 'Chemicals', 'Cleaning Supplies', 'Office Supplies']
const UNITS = ['pcs', 'kg', 'ltr', 'mtr', 'box', 'set', 'roll', 'pkt', 'btl', 'can']

export default function InventoryItemForm({ isOpen, onClose, onSave, item = null, companyCode }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState(item || {
    item_code: '',
    item_name: '',
    category: 'Spares',
    unit: 'pcs',
    unit_cost: '',
    reorder_level: '',
    location: '',
    location_bin: '',
    notes: ''
  })

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // First attempt with all fields
      const submitData = { ...formData, ...(companyCode ? { company_code: companyCode } : {}) }
      let { error: err } = item?.id
        ? await supabase.from('inventory_items').update(submitData).eq('id', item.id)
        : await supabase.from('inventory_items').insert([submitData])

      // Fallback: If it's a schema error, retry without the new columns
      if (err && err.message?.includes('location_bin')) {
        console.warn('New columns missing in DB. Retrying with basic fields...')
        const basicData = { ...formData }
        delete basicData.location_bin
        delete basicData.preferred_vendor_id
        delete basicData.min_order_qty
        delete basicData.image_url
        
        const { error: retryError } = item?.id
          ? await supabase.from('inventory_items').update(basicData).eq('id', item.id)
          : await supabase.from('inventory_items').insert([basicData])
        
        if (retryError) throw retryError
      } else if (err) {
        throw err
      }

      onSave()
      onClose()
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
      zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div className="card" style={{ 
        maxWidth: 600, width: '100%', 
        background: 'var(--bg-1)', position: 'relative',
        animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 10 }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-0)' }}>
              {item ? 'EDIT ITEM' : 'NEW INVENTORY SKU'}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4, borderRadius: '50%' }}><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div style={{ background: 'var(--status-danger-soft)', color: 'var(--red)', padding: 12, borderRadius: 8, marginBottom: 20, }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Item Name</label>
              <div style={{ position: 'relative' }}>
                <Archive size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input 
                  className="inp" style={{ paddingLeft: 40 }}
                  placeholder="e.g. Copper Wire 2.5mm"
                  value={formData.item_name}
                  onChange={e => setFormData({...formData, item_name: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Item/SKU Code</label>
              <input 
                className="inp"
                placeholder="INV-XXXXX"
                value={formData.item_code}
                onChange={e => setFormData({...formData, item_code: e.target.value})}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Category</label>
              <select 
                className="inp"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Unit</label>
              <select 
                className="inp"
                value={formData.unit}
                onChange={e => setFormData({...formData, unit: e.target.value})}
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Unit Cost</label>
              <input 
                type="number" step="any" className="inp" placeholder="0.00"
                value={formData.unit_cost}
                onChange={e => setFormData({...formData, unit_cost: e.target.value})}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Min Stock Level</label>
              <input 
                type="number" step="any" className="inp" placeholder="0"
                value={formData.reorder_level}
                onChange={e => setFormData({...formData, reorder_level: e.target.value})}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Storage Location</label>
              <input 
                className="inp" placeholder="e.g. Warehouse 1"
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Bin / Shelf ID</label>
              <input 
                className="inp" placeholder="e.g. S4-B12"
                value={formData.location_bin}
                onChange={e => setFormData({...formData, location_bin: e.target.value})}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Notes & Specifications</label>
            <textarea 
              className="inp" style={{ minHeight: 80, resize: 'vertical' }}
              placeholder="Added details, material specs, or vendor preferences..."
              value={formData.notes || ''}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1 }} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : (item ? 'Update Item' : 'Create Inventory Item')}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
