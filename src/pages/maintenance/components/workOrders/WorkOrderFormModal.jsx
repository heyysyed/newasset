import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { workOrderService } from '../../services/workOrderService'
import { useAuth } from '../../../../context/AuthContext'
import { supabase } from '../../../../lib/supabase'

export default function WorkOrderFormModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  const { data: assets = [] } = useQuery({
    queryKey: ['assets_list_lite'],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('id, asset_name').order('asset_name')
      return data || []
    }
  })

  const [form, setForm] = useState({
    work_order_number: `WO-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`,
    asset_id: '',
    priority: 'normal',
    description: '',
    estimated_hours: ''
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await workOrderService.create(payload, user?.id)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['maintenance_work_orders'])
      onClose()
    },
    onError: (err) => alert(err.message)
  })

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    createMutation.mutate({
      ...form,
      status: 'DRAFT',
      created_by: user?.id,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null
    })
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--bg-1)', borderRadius: '16px', width: '90%', maxWidth: '500px', boxShadow: 'var(--clay-shadow)' }}>
        
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-1)' }}>New Work Order</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label className="lbl">Work Order #</label>
              <input className="inp" value={form.work_order_number} readOnly style={{ background: 'var(--bg-2)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="lbl">Priority</label>
              <select className="inp" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="lbl">Asset (Optional)</label>
            <select className="inp" value={form.asset_id} onChange={e => setForm({...form, asset_id: e.target.value})}>
              <option value="">-- Select Asset --</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.asset_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="lbl">Description</label>
            <textarea className="inp" rows={4} required value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>

          <div>
            <label className="lbl">Estimated Hours</label>
            <input type="number" className="inp" step="0.5" value={form.estimated_hours} onChange={e => setForm({...form, estimated_hours: e.target.value})} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {createMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Create Work Order
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}


