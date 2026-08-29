import React from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { Clock, MapPin, User, AlertCircle, FileText, ChevronRight, Truck, Calendar } from 'lucide-react'

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
    vendor,
    description,
    estimated_hours,
    actual_hours,
    scheduled_end
  } = workOrder

  const pColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.normal

  return (
    <div
      onClick={() => onClick(workOrder)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '14px',
        boxShadow: 'var(--clay-shadow-sm)',
        cursor: 'pointer',
        position: 'relative'
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
          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ 
                width: 20, height: 20, borderRadius: '50%', background: vendor ? 'var(--status-warning-soft)' : 'var(--accent-soft)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: vendor ? 'var(--status-warning)' : 'var(--accent)', overflow: 'hidden'
              }}>
                {vendor ? (
                  <Truck size={12} />
                ) : assigned_to?.avatar_url ? (
                  <img src={assigned_to.avatar_url} alt="A" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={12} />
                )}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-2)', maxWidth: 80 }} className="truncate">
                {vendor ? vendor.name : (assigned_to?.full_name?.split(' ')[0] || 'Unassigned')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {scheduled_end && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-info)', fontSize: '11px' }}>
                  <Calendar size={12} />
                  <span>{new Date(scheduled_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </div>
              )}
              {(estimated_hours || actual_hours) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: '11px' }}>
                  <Clock size={12} />
                  <span>{actual_hours || 0} / {estimated_hours || '-'}h</span>
                </div>
              )}
            </div>
          </div>
    </div>
  )
}


