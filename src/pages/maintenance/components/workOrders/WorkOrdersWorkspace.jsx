import React, { useState } from 'react'
import { DragDropContext } from '@hello-pangea/dnd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Loader2 } from 'lucide-react'
import { workOrderService } from '../../services/workOrderService'
import { useAuth } from '../../../../context/AuthContext'
import KanbanColumn from './KanbanColumn'
import WorkOrderDetailDrawer from './WorkOrderDetailDrawer'
import WorkOrderFormModal from './WorkOrderFormModal'

const COLUMNS = ['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED']

export default function WorkOrdersWorkspace() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedWO, setSelectedWO] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ['maintenance_work_orders'],
    queryFn: async () => {
      const { data, error } = await workOrderService.getWorkOrders()
      if (error) throw error
      return data || []
    }
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => workOrderService.changeStatus(id, status, user?.id),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['maintenance_work_orders'] })
      const previousWOs = queryClient.getQueryData(['maintenance_work_orders'])
      
      // Optimistically update to the new value
      queryClient.setQueryData(['maintenance_work_orders'], old => 
        old?.map(wo => wo.id === id ? { ...wo, status } : wo)
      )
      return { previousWOs }
    },
    onError: (err, newWO, context) => {
      queryClient.setQueryData(['maintenance_work_orders'], context.previousWOs)
      alert('Failed to update status: ' + err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_work_orders'] })
      // Invalidate overview as well to keep dashboard in sync
      queryClient.invalidateQueries({ queryKey: ['maintenance_overview'] })
    },
  })

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result
    
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStatus = destination.droppableId
    
    statusMutation.mutate({ id: draggableId, status: newStatus })
  }

  const filteredWOs = workOrders.filter(wo => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      wo.work_order_number?.toLowerCase().includes(s) ||
      wo.asset?.asset_name?.toLowerCase().includes(s) ||
      wo.description?.toLowerCase().includes(s) ||
      wo.ticket?.ticket_no?.toLowerCase().includes(s)
    )
  })

  // Group by status
  const groupedWOs = COLUMNS.reduce((acc, col) => {
    acc[col] = filteredWOs.filter(wo => wo.status === col)
    return acc
  }, {})

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px 20px', flexWrap: 'wrap', gap: '16px' }}>
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
        <button className="btn-primary" onClick={() => setIsFormOpen(true)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> New Work Order
        </button>
      </div>

      {/* Kanban Board */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '0 24px 24px' }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: 'flex', gap: '20px', height: '100%', paddingBottom: '10px' }}>
            {COLUMNS.map(status => (
              <KanbanColumn 
                key={status} 
                status={status} 
                workOrders={groupedWOs[status] || []}
                onCardClick={(wo) => setSelectedWO(wo)}
              />
            ))}
          </div>
        </DragDropContext>
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


