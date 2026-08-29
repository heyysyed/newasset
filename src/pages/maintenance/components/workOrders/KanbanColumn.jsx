import React from 'react'
import { Droppable } from '@hello-pangea/dnd'
import WorkOrderCard from './WorkOrderCard'

const STATUS_LABELS = {
  'DRAFT': 'Draft',
  'AWAITING_APPROVAL': 'Awaiting Approval',
  'SCHEDULED': 'Scheduled',
  'ASSIGNED': 'Assigned',
  'IN_PROGRESS': 'In Progress',
  'ON_HOLD': 'On Hold',
  'COMPLETED': 'Completed',
  'CLOSED': 'Closed'
}

const STATUS_COLORS = {
  'DRAFT': { bg: 'var(--bg-2)', text: 'var(--text-2)', border: 'var(--border)' },
  'AWAITING_APPROVAL': { bg: 'rgba(236, 72, 153, 0.05)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.2)' },
  'SCHEDULED': { bg: 'rgba(14, 165, 233, 0.05)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.2)' },
  'ASSIGNED': { bg: 'rgba(59, 130, 246, 0.05)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' },
  'IN_PROGRESS': { bg: 'rgba(139, 92, 246, 0.05)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.2)' },
  'ON_HOLD': { bg: 'rgba(245, 158, 11, 0.05)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.2)' },
  'COMPLETED': { bg: 'rgba(34, 197, 94, 0.05)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.2)' },
  'CLOSED': { bg: 'var(--bg-3)', text: 'var(--text-3)', border: 'var(--border)' }
}

export default function KanbanColumn({ status, workOrders, onCardClick }) {
  const config = STATUS_COLORS[status] || STATUS_COLORS['DRAFT']
  const label = STATUS_LABELS[status] || status

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '280px',
      minWidth: '280px',
      background: 'var(--bg-2)',
      borderRadius: '12px',
      borderTop: `4px solid ${config.border.replace('0.2', '1')}`, // Add a colored top bar
      borderLeft: '1px solid var(--border)',
      borderRight: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      height: '100%',
      maxHeight: '100%',
      overflow: 'hidden'
    }}>
      {/* Column Header */}
      <div style={{
        padding: '16px',
        borderBottom: `1px solid var(--border)`,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: config.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </h3>
        <span style={{
          background: 'var(--bg-1)',
          color: 'var(--text-2)',
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '12px',
          border: '1px solid var(--border)'
        }}>
          {workOrders.length}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              flex: 1,
              padding: '16px 12px',
              overflowY: 'auto',
              background: snapshot.isDraggingOver ? 'var(--bg-3)' : 'transparent',
              transition: 'background 0.2s ease',
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {workOrders.map((wo, index) => (
              <WorkOrderCard 
                key={wo.id} 
                workOrder={wo} 
                index={index} 
                onClick={onCardClick} 
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}


