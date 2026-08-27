import React from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { Clock, MapPin, User, AlertCircle, FileText, ChevronRight } from 'lucide-react'

const PRIORITY_COLORS = {
  low: { bg: 'var(--bg-3)', text: 'var(--text-2)' },
  normal: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' },
  high: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' },
  critical: { bg: 'var(--status-danger-soft)', text: 'var(--status-danger)' }
}

export default function WorkOrderCard({ workOrder, index, onClick }) {
  const { 
    id, 
    work_order_number, 
    priority = 'normal', 
    asset,
    ticket,
    assigned_to,
    description,
    estimated_hours,
    actual_hours
  } = workOrder

  const pColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.normal

  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(workOrder)}
          style={{
            ...provided.draggableProps.style,
            background: 'var(--bg-1)',
            border: snapshot.isDragging ? '1.5px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '10px',
            boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.12)' : 'var(--clay-shadow-sm)',
            cursor: 'grab',
            position: 'relative',
            opacity: snapshot.isDragging ? 0.9 : 1
          }}
          className="wo-card"
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
              {work_order_number}
            </span>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 600, 
              padding: '2px 8px', 
              borderRadius: '20px', 
              background: pColor.bg, 
              color: pColor.text,
              textTransform: 'uppercase'
            }}>
              {priority}
            </span>
          </div>

          {/* Asset Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-1)', fontSize: '13px', fontWeight: 500 }}>
              <div style={{ background: 'var(--bg-3)', padding: 4, borderRadius: 6 }}><FileText size={12} /></div>
              <span className="truncate">{asset?.asset_name || 'No Asset Attached'}</span>
            </div>
            {asset?.site && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: '12px' }}>
                <MapPin size={12} />
                <span className="truncate">{asset.site}</span>
              </div>
            )}
          </div>

          {/* Description snippet */}
          {description && (
            <div style={{ fontSize: '12px', color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 12, lineHeight: 1.4 }}>
              {description}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ 
                width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-soft)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', overflow: 'hidden'
              }}>
                {assigned_to?.avatar_url ? (
                  <img src={assigned_to.avatar_url} alt="A" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={12} />
                )}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-2)', maxWidth: 80 }} className="truncate">
                {assigned_to?.full_name?.split(' ')[0] || 'Unassigned'}
              </span>
            </div>

            {(estimated_hours || actual_hours) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: '11px' }}>
                <Clock size={12} />
                <span>{actual_hours || 0} / {estimated_hours || '-'}h</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}


