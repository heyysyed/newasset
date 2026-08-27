import React, { useEffect, useState } from 'react'
import { X, Clock, Plus, Edit2, Activity, Ticket, PenTool, MapPin, Loader2 } from 'lucide-react'
import { fetchAssetFullTimeline } from '../lib/supabase'

export default function AssetHistoryDrawer({ assetId, onClose }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (assetId) loadTimeline()
  }, [assetId])

  async function loadTimeline() {
    setLoading(true)
    try {
      const data = await fetchAssetFullTimeline(assetId)
      setEvents(data)
    } catch (e) {
      console.error('Failed to load timeline:', e)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'plus': return <Plus size={16} />
      case 'edit': return <Edit2 size={16} />
      case 'activity': return <Activity size={16} />
      case 'ticket': return <Ticket size={16} />
      case 'tool': return <PenTool size={16} />
      case 'map-pin': return <MapPin size={16} />
      default: return <Clock size={16} />
    }
  }

  const getIconColor = (type) => {
    switch (type) {
      case 'audit': return 'var(--accent)'
      case 'ticket': return 'var(--amber)'
      case 'maintenance': return 'var(--green)'
      case 'movement': return 'var(--purple)'
      default: return 'var(--text-2)'
    }
  }

  return (
    <>
      <div 
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, backdropFilter: 'blur(3px)' }} 
        onClick={onClose} 
      />
      <div 
        className="card animate-fade-up" 
        style={{ 
          position: 'fixed', right: 0, top: 0, bottom: 0, width: '100%', maxWidth: 450, 
          zIndex: 10000, borderRadius: '24px 0 0 24px', display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.1)'
        }}
      >
        <div className="card-header" style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, letterSpacing: '0.04em', color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={20} style={{ color: 'var(--accent)' }} /> ASSET TIMELINE
            </h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-2)' }}>Complete history and audit trail</p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}><X size={18} /></button>
        </div>
        
        <div className="card-body" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)' }}>
              <Loader2 size={32} className="animate-spin" style={{ marginBottom: 16, color: 'var(--accent)' }} />
              <p>Reconstructing timeline...</p>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
              <Clock size={40} style={{ opacity: 0.2, marginBottom: 16, display: 'inline-block' }} />
              <p>No history found for this asset.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
              {/* Vertical line connecting the timeline */}
              <div style={{ position: 'absolute', left: 19, top: 20, bottom: 20, width: 2, background: 'var(--border)' }} />
              
              {events.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: i === events.length - 1 ? 0 : 24, position: 'relative' }}>
                  
                  {/* Timeline icon dot */}
                  <div style={{ 
                    width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-2)', border: `2px solid ${getIconColor(ev.type)}`, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: getIconColor(ev.type),
                    zIndex: 2, flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                  }}>
                    {getIcon(ev.icon)}
                  </div>
                  
                  {/* Event Content */}
                  <div style={{ flex: 1, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, boxShadow: 'var(--clay-inset)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <h4 style={{ margin: 0, color: 'var(--text-0)' }}>{ev.title}</h4>
                      <span style={{ color: 'var(--text-3)', }}>
                        {ev.date.toLocaleDateString()} {ev.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <p style={{ margin: '0 0 10px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                      By: {ev.user}
                    </p>
                    
                    {/* Render details if available */}
                    {ev.details && Object.keys(ev.details).length > 0 && (
                      <div style={{ background: 'var(--bg-2)', padding: '10px 14px', borderRadius: 10, color: 'var(--text-1)', border: '1px dashed var(--border)' }}>
                        {Object.entries(ev.details).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-3)', width: '35%', flexShrink: 0 }}>{k.replace(/_/g, ' ')}:</span>
                            <span >{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}


