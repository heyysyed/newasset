import React, { useState, useEffect } from 'react'
import { X, ArrowDownLeft, ArrowUpRight, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function StockMovementModal({ isOpen, onClose, items, user, onSave }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    item_id: '',
    transaction_type: 'issue',
    quantity: '',
    notes: '',
    reference: ''
  })
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const selectedItem = items.find(i => i.id === formData.item_id)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const qty = Number(formData.quantity)
    
    // Validation
    if (!formData.item_id) return setError('Please select an item.')
    if (qty <= 0) return setError('Quantity must be greater than zero.')
    
    // Check if issuing more than available
    if (['issue', 'transfer', 'adjustment_out'].includes(formData.transaction_type)) {
      if (qty > Number(selectedItem?.current_stock || 0)) {
        return setError(`Insufficient stock. Current balance is ${selectedItem.current_stock}.`)
      }
    }

    try {
      const { error: txError } = await supabase
        .from('inventory_transactions')
        .insert([{
          item_id: formData.item_id,
          transaction_type: formData.transaction_type,
          quantity: qty,
          notes: formData.notes,
          reference: formData.reference,
          performed_by: user.id
        }])

      if (txError) throw txError
      
      onSave() // Refresh data
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
        maxWidth: 500, width: '100%', 
        background: 'var(--bg-1)', position: 'relative',
        animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-0)' }}>STOCK MOVEMENT</h2>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manual Adjustment / Log</p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4, borderRadius: '50%' }}><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', padding: 12, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, fontSize: '0.85rem' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Item to Move</label>
            <select 
              className="inp"
              value={formData.item_id}
              onChange={e => setFormData({...formData, item_id: e.target.value})}
              required
            >
              <option value="">Select an Item...</option>
              {items.map(i => (
                <option key={i.id} value={i.id}>{i.item_name} ({i.item_code}) — Bal: {i.current_stock}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Movement Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, transaction_type: 'receipt'})}
                  style={{ 
                    padding: '10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
                    background: formData.transaction_type === 'receipt' ? 'var(--bg-3)' : 'none',
                    color: formData.transaction_type === 'receipt' ? 'var(--green)' : 'var(--text-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: '0.8rem'
                  }}
                >
                  <ArrowDownLeft size={14} /> IN
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, transaction_type: 'issue'})}
                  style={{ 
                    padding: '10px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
                    background: formData.transaction_type === 'issue' ? 'var(--bg-3)' : 'none',
                    color: formData.transaction_type === 'issue' ? 'var(--red)' : 'var(--text-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: '0.8rem'
                  }}
                >
                  <ArrowUpRight size={14} /> OUT
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Quantity ({selectedItem?.unit || 'pcs'})</label>
              <input 
                type="number" step="any" className="inp" placeholder="0.00"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: e.target.value})}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Reference (PO / Ticket #)</label>
            <input 
              type="text" className="inp" placeholder="e.g. PO-1020 or TKT-441"
              value={formData.reference}
              onChange={e => setFormData({...formData, reference: e.target.value})}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Movement Notes</label>
            <textarea 
              className="inp" style={{ minHeight: 80, resize: 'vertical' }}
              placeholder="Reason for movement or adjustment details..."
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1 }} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Confirm Movement'}
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
