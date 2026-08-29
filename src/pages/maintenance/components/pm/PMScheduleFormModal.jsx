import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { scheduleService } from '../../services/scheduleService'
import { useAuth } from '../../../../context/AuthContext'
import { supabase } from '../../../../lib/supabase'

export default function PMScheduleFormModal({ isOpen, onClose, schedule }) {
  const { user, currentCompany } = useAuth()
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

  const [form, setForm] = useState({
    title: '',
    asset_id: '',
    frequency: 'monthly',
    next_due: '',
    assigned_to: '',
    status: 'active'
  })

  useEffect(() => {
    if (isOpen && schedule) {
      setForm({
        title: schedule.title || '',
        asset_id: schedule.asset_id || '',
        frequency: schedule.frequency || 'monthly',
        next_due: schedule.next_due ? new Date(schedule.next_due).toISOString().split('T')[0] : '',
        assigned_to: schedule.assigned_to || '',
        status: schedule.status || 'active'
      })
    } else if (isOpen && !schedule) {
      setForm({
        title: '',
        asset_id: '',
        frequency: 'monthly',
        next_due: '',
        assigned_to: '',
        status: 'active'
      })
    }
  }, [isOpen, schedule])

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      let res;
      if (schedule?.id) {
        res = await scheduleService.update(schedule.id, payload, user?.id)
      } else {
        res = await scheduleService.create(payload, user?.id)
      }
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_schedules'] })
      onClose()
    },
    onError: (err) => alert(err.message)
  })

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title || !form.asset_id) {
      alert('Title and Asset are required.')
      return
    }

    saveMutation.mutate({
      ...form,
      asset_id: form.asset_id || null,
      assigned_to: form.assigned_to || null,
      next_due: form.next_due || null,
      created_by: schedule?.id ? undefined : user?.id,
      company_code: schedule?.id ? undefined : currentCompany?.code
    })
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'var(--bg-1)', borderRadius: '16px', width: '90%', maxWidth: '550px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--clay-shadow)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-1)' }}>{schedule ? 'Edit Schedule' : 'New Schedule'}</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 4, display: 'flex' }}><X size={20} /></button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <form id="pm-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div>
              <label className="lbl">Schedule Title *</label>
              <input 
                className="inp" 
                placeholder="e.g. Monthly HVAC Inspection"
                value={form.title} 
                onChange={e => setForm({...form, title: e.target.value})} 
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="lbl">Asset *</label>
                <select className="sel" value={form.asset_id} onChange={e => setForm({...form, asset_id: e.target.value})} required>
                  <option value="">-- Select Asset --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.asset_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="lbl">Frequency *</label>
                <select className="sel" value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="lbl">Next Due Date</label>
                <input type="date" className="inp" value={form.next_due} onChange={e => setForm({...form, next_due: e.target.value})} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="lbl">Status</label>
                <select className="sel" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="lbl">Assign To (Default)</label>
                <select className="sel" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                  <option value="">-- Unassigned --</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                {/* Empty block to keep grid aligned */}
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
          <button type="button" onClick={onClose} className="btn-ghost" disabled={saveMutation.isPending}>Cancel</button>
          <button type="submit" form="pm-form" className="btn-primary" disabled={saveMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {schedule ? 'Save Changes' : 'Create Schedule'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
