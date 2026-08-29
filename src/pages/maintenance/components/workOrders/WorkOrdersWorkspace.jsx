import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Loader2 } from 'lucide-react'
import { workOrderService } from '../../services/workOrderService'
import { useAuth } from '../../../../context/AuthContext'
import WorkOrderCard from './WorkOrderCard'
import WorkOrderDetailDrawer from './WorkOrderDetailDrawer'
import WorkOrderFormModal from './WorkOrderFormModal'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CLOSED', label: 'Closed' }
]

export default function WorkOrdersWorkspace() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedWO, setSelectedWO] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  
  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['maintenance_work_orders'],
    queryFn: async () => {
      const { data, error } = await workOrderService.getWorkOrders()
      if (error) throw error
      return data || []
    }
  })

  const filteredWOs = workOrders.filter(wo => {
    if (statusFilter !== 'ALL' && wo.status !== statusFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      wo.work_order_number?.toLowerCase().includes(s) ||
      wo.asset?.asset_name?.toLowerCase().includes(s) ||
      wo.description?.toLowerCase().includes(s) ||
      wo.ticket?.ticket_no?.toLowerCase().includes(s)
    )
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Loader2 className="animate-spin text-accent" size={24} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 16px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input 
              className="inp" 
              placeholder="Search work orders..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>
          <select className="sel" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 180 }}>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" onClick={() => setIsFormOpen(true)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> New Work Order
        </button>
      </div>

      {/* List View */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {filteredWOs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No work orders found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
            {filteredWOs.map((wo, i) => (
              <WorkOrderCard 
                key={wo.id} 
                workOrder={wo} 
                index={i}
                onClick={(wo) => setSelectedWO(wo)} 
              />
            ))}
          </div>
        )}
      </div>

      {selectedWO && (
        <WorkOrderDetailDrawer 
          workOrder={selectedWO} 
          isOpen={!!selectedWO} 
          onClose={() => setSelectedWO(null)} 
        />
      )}

      {isFormOpen && (
        <WorkOrderFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
        />
      )}
    </div>
  )
}


