import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { workOrderService } from '../../services/workOrderService'
import { useAuth } from '../../../../context/AuthContext'
import { supabase } from '../../../../lib/supabase'
import { nextWorkOrderNumber } from '../../../../services/partsService'
import toast from 'react-hot-toast'

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

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles_list_lite'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
      return data || []
    }
  })

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors_list_lite'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id, name').order('name')
      return data || []
    }
  })

  const { data: openTickets = [] } = useQuery({
    queryKey: ['open_tickets_lite'],
    queryFn: async () => {
      const { data } = await supabase.from('maintenance_tickets').select('id, ticket_no, title').in('status', ['OPEN', 'IN_PROGRESS']).order('created_at', { ascending: false })
      return data || []
    }
  })

  const [form, setForm] = useState({
    work_order_number: '',
    asset_id: '',
    ticket_id: '',
    assigned_to: '',
    vendor_id: '',
    priority: 'normal',
    description: '',
    estimated_hours: '',
    scheduled_start: '',
    scheduled_end: ''
  })

  useEffect(() => {
    if (!isOpen || form.work_order_number) return
    let active = true
    nextWorkOrderNumber().then(number => {
      if (active && number) setForm(current => ({ ...current, work_order_number: number }))
    })
    return () => { active = false }
  }, [isOpen, form.work_order_number])

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await workOrderService.create(payload, user?.id)
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_work_orders'] })
      onClose()
    },
    onError: (err) => toast.error(err.message)
  })

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    createMutation.mutate({
      ...form,
      work_order_number: form.work_order_number || undefined,
      asset_id: form.asset_id || null,
      ticket_id: form.ticket_id || null,
      assigned_to: form.assigned_to || null,
      vendor_id: form.vendor_id || null,
      scheduled_start: form.scheduled_start || null,
      scheduled_end: form.scheduled_end || null,
      status: 'DRAFT',
      created_by: user?.id,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null
    })
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--bg-1)', borderRadius: '16px', width: '90%', maxWidth: '550px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--clay-shadow)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-1)' }}>New Work Order</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4, display: 'flex' }}><X size={20} /></button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <form id="wo-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="lbl">Work Order #</label>
                <input className="inp" value={form.work_order_number || 'Assigned when saved'} readOnly style={{ background: 'var(--bg-2)' }} />
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

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="lbl">Asset</label>
                <select className="inp" value={form.asset_id} onChange={e => setForm({...form, asset_id: e.target.value})}>
                  <option value="">-- Select Asset --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.asset_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="lbl">Linked Ticket</label>
                <select className="inp" value={form.ticket_id} onChange={e => setForm({...form, ticket_id: e.target.value})}>
                  <option value="">-- No Ticket --</option>
                  {openTickets.map(t => (
                    <option key={t.id} value={t.id}>{t.ticket_no} - {t.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="lbl">Assign To Employee</label>
                <select className="inp" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                  <option value="">-- Unassigned --</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="lbl">Or Assign Vendor</label>
                <select className="inp" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})}>
                  <option value="">-- Internal Maintenance --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="lbl">Scheduled Start</label>
                <input type="datetime-local" className="inp" value={form.scheduled_start} onChange={e => setForm({...form, scheduled_start: e.target.value})} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="lbl">Scheduled End</label>
                <input type="datetime-local" className="inp" value={form.scheduled_end} onChange={e => setForm({...form, scheduled_end: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="lbl">Description</label>
              <textarea className="inp" rows={4} required value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>

            <div>
              <label className="lbl">Estimated Hours</label>
              <input type="number" className="inp" step="0.5" value={form.estimated_hours} onChange={e => setForm({...form, estimated_hours: e.target.value})} />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-0)', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" form="wo-form" disabled={createMutation.isPending} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {createMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Create Work Order
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}


