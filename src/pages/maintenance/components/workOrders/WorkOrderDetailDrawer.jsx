import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Clock, CheckCircle2, FileText, User, ArrowRight, Truck, Wrench } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '../../../../lib/supabase'
import WorkOrderPartsPanel from './WorkOrderPartsPanel'
import WorkOrderHistoryPanel from './WorkOrderHistoryPanel'

export default function WorkOrderDetailDrawer({ workOrder, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('details')
  const [actualHours, setActualHours] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [notes, setNotes] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [priority, setPriority] = useState('normal')
  const [scheduledStart, setScheduledStart] = useState('')
  const [scheduledEnd, setScheduledEnd] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [actualCost, setActualCost] = useState('')
  const [status, setStatus] = useState('')
  
  const queryClient = useQueryClient()

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

  useEffect(() => {
    if (isOpen && workOrder) {
      setActualHours(workOrder.actual_hours || '')
      setEstimatedHours(workOrder.estimated_hours || '')
      setNotes(workOrder.description || '')
      setAssignedTo(workOrder.assigned_to || '')
      setVendorId(workOrder.vendor_id || '')
      setPriority(workOrder.priority || 'normal')
      setStatus(workOrder.status || 'DRAFT')
      setScheduledStart(workOrder.scheduled_start ? new Date(workOrder.scheduled_start).toISOString().slice(0,16) : '')
      setScheduledEnd(workOrder.scheduled_end ? new Date(workOrder.scheduled_end).toISOString().slice(0,16) : '')
      setEstimatedCost(workOrder.estimated_cost || '')
      setActualCost(workOrder.actual_cost || '')
    }
  }, [isOpen, workOrder])

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('maintenance_work_orders')
        .update(payload)
        .eq('id', workOrder.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_work_orders'] })
      onClose()
    },
    onError: (err) => {
      alert('Failed to update work order: ' + err.message)
    }
  })

  if (!isOpen || !workOrder) return null

  const handleSave = () => {
    updateMutation.mutate({
      actual_hours: actualHours ? Number(actualHours) : null,
      estimated_hours: estimatedHours ? Number(estimatedHours) : null,
      description: notes,
      assigned_to: assignedTo || null,
      vendor_id: vendorId || null,
      priority: priority || 'normal',
      status: status || 'DRAFT',
      scheduled_start: scheduledStart || null,
      scheduled_end: scheduledEnd || null,
      estimated_cost: estimatedCost ? Number(estimatedCost) : null,
      actual_cost: actualCost ? Number(actualCost) : null
    })
  }

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <div 
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto' }}
        onClick={onClose}
      />
      <div 
        style={{
          position: 'absolute', top: 10, bottom: 10, right: 10, width: '90%', maxWidth: '500px',
          background: 'var(--bg-1)', borderRadius: '24px', boxShadow: 'var(--clay-shadow)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', pointerEvents: 'auto',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-2)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {workOrder.work_order_number}
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: 12, background: 'var(--bg-3)', color: 'var(--text-2)', textTransform: 'uppercase' }}>
                {workOrder.status}
              </span>
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '0 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 24, overflowX: 'auto' }}>
          {['details', 'parts', 'history'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '16px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                color: activeTab === t ? 'var(--accent)' : 'var(--text-2)',
                fontWeight: activeTab === t ? 600 : 500,
                borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                textTransform: 'capitalize'
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ padding: 8, background: 'var(--bg-3)', borderRadius: 8, color: 'var(--text-2)' }}>
                    <Wrench size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Asset</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 500 }}>{workOrder.asset?.asset_name || 'N/A'}</div>
                  </div>
                </div>
                {workOrder.ticket && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ padding: 8, background: 'var(--bg-3)', borderRadius: 8, color: 'var(--text-2)' }}>
                      <FileText size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Linked Ticket</div>
                      <div style={{ fontSize: '14px', color: 'var(--text-1)', fontWeight: 500 }}>{workOrder.ticket.ticket_no}</div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="lbl">Notes / Description</label>
                <textarea 
                  className="inp" 
                  rows={4} 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Assign To Employee</label>
                  <select className="inp" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                    <option value="">-- Unassigned --</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Or Assign Vendor</label>
                  <select className="inp" value={vendorId} onChange={e => setVendorId(e.target.value)}>
                    <option value="">-- Internal Maintenance --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Status</label>
                  <select className="sel" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="DRAFT">Draft</option>
                    <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Priority</label>
                  <select className="sel" value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Scheduled Start</label>
                  <input type="datetime-local" className="inp" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Scheduled End</label>
                  <input type="datetime-local" className="inp" value={scheduledEnd} onChange={e => setScheduledEnd(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Estimated Hours</label>
                  <input type="number" step="0.5" className="inp" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Actual Hours</label>
                  <input type="number" step="0.5" className="inp" value={actualHours} onChange={e => setActualHours(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Estimated Cost</label>
                  <input type="number" step="0.01" className="inp" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="lbl">Actual Cost</label>
                  <input type="number" step="0.01" className="inp" value={actualCost} onChange={e => setActualCost(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button 
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}
                >
                  {updateMutation.isPending ? <Clock className="animate-spin" size={16} /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>
            </div>
          )}
          {activeTab === 'parts' && (
            <WorkOrderPartsPanel workOrder={workOrder} />
          )}
          {activeTab === 'history' && (
            <WorkOrderHistoryPanel workOrder={workOrder} />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}


