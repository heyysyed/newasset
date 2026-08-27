import React, { useMemo } from 'react'
import {
  History, Wrench, Shield, ArrowRight, CheckCircle2, FileText, Settings, Flag
} from 'lucide-react'

// Helper to get relative time
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + "y ago"
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + "mo ago"
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + "d ago"
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + "h ago"
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + "m ago"
  return Math.floor(seconds) + "s ago"
}

export default function AssetTimeline({ asset, movements = [], maintenance = {}, audit = [] }) {
  // Combine all events
  const timelineEvents = useMemo(() => {
    const events = []

    // 1. Asset Creation/Purchase
    if (asset?.created_at) {
      events.push({
        id: `created_${asset.id}`,
        type: 'creation',
        date: new Date(asset.created_at),
        title: 'Asset Registered',
        description: `Registered in system${asset.purchase_date ? ` (Purchased: ${new Date(asset.purchase_date).toLocaleDateString()})` : ''}`,
        icon: FileText,
        color: 'var(--green)'
      })
    }

    // 2. Movements
    movements.forEach(m => {
      events.push({
        id: `mov_${m.id}`,
        type: 'movement',
        date: new Date(m.moved_at),
        title: 'Asset Moved',
        description: `Moved from ${m.from_location || 'unknown'} to ${m.to_location}`,
        user: m.profiles?.full_name,
        icon: ArrowRight,
        color: 'var(--cyan)'
      })
    })

    // 3. Maintenance Tickets (Resolved/Created)
    if (maintenance.tickets) {
      maintenance.tickets.forEach(t => {
        events.push({
          id: `tkt_${t.id}`,
          type: 'ticket',
          date: new Date(t.created_at),
          title: `Ticket Created: ${t.title}`,
          description: t.description || 'Maintenance requested',
          user: t.profiles?.full_name,
          icon: Wrench,
          color: 'var(--amber)'
        })
        if (t.resolved_at) {
          events.push({
            id: `tkt_res_${t.id}`,
            type: 'ticket_resolved',
            date: new Date(t.resolved_at),
            title: `Ticket Resolved: ${t.title}`,
            description: 'Issue has been fixed',
            icon: CheckCircle2,
            color: 'var(--green)'
          })
        }
      })
    }

    // 4. Maintenance Logs
    if (maintenance.logs) {
      maintenance.logs.forEach(l => {
        events.push({
          id: `log_${l.id}`,
          type: 'maintenance_log',
          date: new Date(l.performed_at),
          title: 'Maintenance Performed',
          description: l.work_done,
          user: l.profiles?.full_name,
          icon: Settings,
          color: 'var(--accent)'
        })
      })
    }

    // 5. Audits
    audit.forEach(a => {
      events.push({
        id: `aud_${a.id}`,
        type: 'audit',
        date: new Date(a.created_at),
        title: 'Asset Audited',
        description: `Condition marked as ${a.condition}`,
        user: a.profiles?.full_name,
        icon: Shield,
        color: 'var(--purple)'
      })
    })

    // Sort by date descending (newest first)
    return events.sort((a, b) => b.date - a.date)
  }, [asset, movements, maintenance, audit])

  if (timelineEvents.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)' }}>No timeline events found.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 0', position: 'relative' }}>
      {/* Vertical line connecting timeline items */}
      <div style={{
        position: 'absolute', top: 20, bottom: 20, left: 24, width: 2,
        background: 'linear-gradient(to bottom, var(--accent) 0%, var(--bg-3) 100%)',
        zIndex: 0
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {timelineEvents.map((ev, index) => (
          <div key={ev.id} style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
            
            {/* Icon Bubble */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-1)',
              border: `2px solid ${ev.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: `0 0 10px ${ev.color}30`
            }}>
              <ev.icon size={20} style={{ color: ev.color }} />
            </div>

            {/* Content Card */}
            <div className="card animate-fade-up" style={{
              flex: 1, padding: '16px 20px', borderRadius: 16,
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              animationDelay: `${Math.min(index * 50, 500)}ms`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <h4 style={{ margin: 0, color: 'var(--text-0)', }}>{ev.title}</h4>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-2)' }}>
                    {ev.date.toLocaleDateString()} {ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ color: 'var(--text-3)', }}>{timeAgo(ev.date)}</div>
                </div>
              </div>
              
              <p style={{ margin: '0 0 10px 0', color: 'var(--text-2)', }}>
                {ev.description}
              </p>
              
              {ev.user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ev.user.charAt(0).toUpperCase()}
                  </div>
                  By {ev.user}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


