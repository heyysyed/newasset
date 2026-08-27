import React, { useState, useEffect, useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip } from 'recharts'
import { Shield, ShieldAlert, Activity, Search, Download, Radio, Users, Clock, Filter, CheckCircle2 } from 'lucide-react'
import { supabase, fetchActivityLogs } from '../../lib/supabase'
import * as XLSX from 'xlsx'

const ACTION_COLORS = {
  created: 'var(--accent)',
  updated: '#0891b2',
  deleted: 'var(--status-danger)',
  scrapped: 'var(--status-danger)',
  requested_scrap: 'var(--status-warning)',
  stock_reconciliation: '#059669',
  high_risk_audit_anomaly: 'var(--status-danger)',
  transfer: '#7c3aed',
  signed_in: '#059669'
}

export default function UserActivityAnalytics() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('ALL')
  const [flashNew, setFlashNew] = useState(false)

  useEffect(() => {
    loadLogs()

    // Realtime subscription to activity_logs table
    const channel = supabase.channel('realtime_security_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        handleNewLog(payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const res = await fetchActivityLogs(100, 0, {})
      setLogs(res.data || [])
    } catch (e) {
      console.error('Error fetching security logs:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleNewLog = (newLog) => {
    setFlashNew(true)
    setTimeout(() => setFlashNew(false), 1200)
    setLogs(prev => [newLog, ...prev.slice(0, 99)])
  }

  // Analytics Computation
  const userActionStats = useMemo(() => {
    const map = {}
    logs.forEach(l => {
      const name = l.profiles?.full_name || l.user_id || 'System User'
      map[name] = (map[name] || 0) + 1
    })
    return Object.entries(map).map(([name, count]) => ({ name: name.split(' ')[0], count })).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [logs])

  const actionTypeStats = useMemo(() => {
    const map = {}
    logs.forEach(l => {
      const act = l.action || 'other'
      map[act] = (map[act] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [logs])

  const highRiskEventsCount = useMemo(() => {
    return logs.filter(l => l.action === 'high_risk_audit_anomaly' || l.action === 'scrapped' || l.action === 'requested_scrap').length
  }, [logs])

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchAction = filterAction === 'ALL' || l.action === filterAction
      const userName = l.profiles?.full_name || ''
      const matchSearch = !search || (
        l.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.action?.toLowerCase().includes(search.toLowerCase()) ||
        userName.toLowerCase().includes(search.toLowerCase())
      )
      return matchAction && matchSearch
    })
  }, [logs, filterAction, search])

  const exportLogsToExcel = () => {
    const rows = filteredLogs.map(l => ({
      Timestamp: new Date(l.created_at).toLocaleString('en-IN'),
      User: l.profiles?.full_name || l.user_id,
      Action: l.action?.toUpperCase(),
      Entity: `${l.entity_type}: ${l.entity_name}`,
      Details: JSON.stringify(l.details || {})
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Security Logs')
    XLSX.writeFile(wb, `Security_Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const formatRelativeTime = (isoStr) => {
    if (!isoStr) return ''
    const diff = Math.floor((new Date() - new Date(isoStr)) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(isoStr).toLocaleDateString('en-IN')
  }

  return (
    <div className="card" style={{ padding: 20, background: '#ffffff', border: flashNew ? '1px solid #059669' : '1px solid #e2e8f0', borderRadius: 12, marginBottom: 16 }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} color='var(--accent)' /> Security & Activity Command Center
          </h3>
          <p style={{ margin: 0, color: '#64748b', }}>
            Real-time security audit log, user action telemetry, and high-risk anomaly tracking
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={exportLogsToExcel} className="btn-ghost" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} color="#059669" /> Export Excel
          </button>
        </div>
      </div>

      {/* 2-Column Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        
        {/* LEFT COLUMN: ANALYTICS & HIGH-RISK COUNTER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* High-Risk Event Banner */}
          <div style={{ padding: 14, background: highRiskEventsCount > 0 ? 'var(--status-danger-soft)' : '#f8fafc', borderRadius: 10, border: highRiskEventsCount > 0 ? '1px solid var(--status-danger-soft)' : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldAlert size={20} color={highRiskEventsCount > 0 ? 'var(--status-danger)' : '#64748b'} />
              <div>
                <div style={{ color: highRiskEventsCount > 0 ? 'var(--status-danger)' : '#0f172a' }}>
                  High-Risk Security Events
                </div>
                <div style={{ color: '#64748b' }}>Includes stock anomalies {'>'}10% & scrap requests</div>
              </div>
            </div>
            <span style={{ color: highRiskEventsCount > 0 ? 'var(--status-danger)' : '#0f172a' }}>
              {highRiskEventsCount}
            </span>
          </div>

          {/* User Activity Bar Chart */}
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#0f172a', marginBottom: 10, textTransform: 'uppercase' }}>
              User Actions Telemetry
            </div>
            <div style={{ height: 160, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userActionStats}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill='var(--accent)' radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action Types Donut Chart */}
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#0f172a', marginBottom: 10, textTransform: 'uppercase' }}>
              Action Type Distribution
            </div>
            <div style={{ height: 150, width: '100%', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={actionTypeStats} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" stroke="#ffffff">
                    {actionTypeStats.map((entry, idx) => (
                      <Cell key={idx} fill={ACTION_COLORS[entry.name] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: REALTIME LOG STREAM & FILTERS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          {/* Controls Bar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
              <input 
                type="text" 
                className="inp" 
                placeholder="Search logs by user, action, asset..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                style={{ paddingLeft: 30, minHeight: 38 }}
              />
            </div>
            <select className="sel" value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ width: 'auto', minHeight: 38 }}>
              <option value="ALL">All Actions</option>
              <option value="high_risk_audit_anomaly">High Risk Anomalies</option>
              <option value="stock_reconciliation">Audits</option>
              <option value="scrapped">Scrapped Assets</option>
              <option value="created">Created</option>
            </select>
          </div>

          {/* Realtime Stream List */}
          <div style={{ overflowY: 'auto', maxHeight: 420, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredLogs.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', }}>No activity logs recorded.</div>
            )}
            {filteredLogs.map(l => {
              const act = l.action || ''
              const isAnomaly = act === 'high_risk_anomaly' || act === 'scrapped' || act === 'high_risk_audit_anomaly'
              const color = ACTION_COLORS[act] || 'var(--accent)'

              return (
                <div key={l.id} style={{ padding: 12, background: isAnomaly ? 'var(--status-danger-soft)' : '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#ffffff', background: color, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                        {act.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: '#0f172a' }}>
                        {l.profiles?.full_name || l.user_id || 'System'}
                      </span>
                    </div>
                    <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} /> {formatRelativeTime(l.created_at)}
                    </span>
                  </div>

                  <div style={{ color: '#334155', }}>
                    {l.entity_type?.toUpperCase()}: {l.entity_name}
                  </div>

                  {l.details && Object.keys(l.details).length > 0 && (
                    <div style={{ color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: 6, }}>
                      {l.details.variance !== undefined && `Variance: ${l.details.variance > 0 ? '+' : ''}${l.details.variance} units `}
                      {l.details.reasoning && `• Reason: ${l.details.reasoning}`}
                      {l.details.scrapValue && `• Scrap Value: ₹${l.details.scrapValue}`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>

      </div>
    </div>
  )
}


