import React, { useEffect, useState } from 'react'
import { Activity, Radio, ArrowUpRight, Shield, Boxes } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function RealtimeTickerTile() {
  const [events, setEvents] = useState([])
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    // Initial fetch of latest transactions and audits
    fetchRecentStream()

    // Supabase Realtime subscription
    const channel = supabase.channel('realtime_dashboard_ticker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bulk_transactions' }, (payload) => {
        addLiveEvent({ type: 'transfer', title: `Stock Transfer: ${payload.new.quantity} units`, site: payload.new.to_site || payload.new.from_site })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bulk_audits' }, (payload) => {
        addLiveEvent({ type: 'audit', title: `Audit Reconciled: Variance ${payload.new.variance_qty}`, site: payload.new.site, isAnomaly: payload.new.is_high_risk_anomaly })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchRecentStream = async () => {
    try {
      const { data: txs } = await supabase.from('bulk_transactions').select('*').order('transaction_at', { ascending: false }).limit(5)
      if (txs) {
        setEvents(txs.map(t => ({ id: t.id, type: 'transfer', title: `Transfer: ${t.transaction_type} ${t.quantity} units`, site: t.to_site || t.from_site, time: t.transaction_at })))
      }
    } catch (e) { console.error(e) }
  }

  const addLiveEvent = (evt) => {
    setFlash(true)
    setTimeout(() => setFlash(false), 1200)
    setEvents(prev => [{ id: Date.now(), ...evt, time: new Date().toISOString() }, ...prev.slice(0, 5)])
  }

  return (
    <div className="card" style={{ padding: 16, background: '#ffffff', border: flash ? '1px solid #059669' : '1px solid #e2e8f0', borderRadius: 12, transition: 'border-color 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Radio size={15} color="#059669" className="spin" style={{ animationDuration: '3s' }} />
          <span style={{ color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Real-Time Stream Ticker
          </span>
        </div>
        <span style={{ color: '#059669', background: 'rgba(5,150,105,0.1)', padding: '2px 8px', borderRadius: 12 }}>
          LIVE FEED
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.length === 0 && (
          <div style={{ color: '#94a3b8', padding: '6px 0' }}>Listening for live transactions & audits...</div>
        )}
        {events.map(ev => (
          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: ev.isAnomaly ? 'var(--status-danger-soft)' : '#f8fafc', borderRadius: 6, border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {ev.type === 'audit' ? <Shield size={12} color={ev.isAnomaly ? 'var(--status-danger)' : 'var(--accent)'} /> : <Boxes size={12} color="#059669" />}
              <span style={{ color: ev.isAnomaly ? 'var(--status-danger)' : '#0f172a' }}>{ev.title}</span>
            </div>
            <span style={{ color: '#64748b', }}>{ev.site}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
