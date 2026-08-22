import React, { useState, useEffect, useMemo } from 'react'
import { Boxes, Search, AlertTriangle, CheckCircle2, Shield, RefreshCw, Loader2, ArrowRight } from 'lucide-react'
import { supabase, submitStockAuditReconciliation } from '../../lib/supabase'
import { formatCurrency } from '../../lib/depreciation'

export default function StockReconciliationAuditView({ sites = [], profile, onAuditSubmitted }) {
  const [loading, setLoading] = useState(true)
  const [stock, setStock] = useState([])
  const [items, setItems] = useState([])
  const [selectedSite, setSelectedSite] = useState('All')
  const [search, setSearch] = useState('')
  const [submittingId, setSubmittingId] = useState(null)
  
  // Physical counts form state
  const [physicalCounts, setPhysicalCounts] = useState({}) // itemId -> physicalQty
  const [reasonings, setReasonings] = useState({}) // itemId -> text

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sRes, iRes] = await Promise.all([
        supabase.from('bulk_site_stock').select('*, bulk_items(*)'),
        supabase.from('bulk_items').select('*')
      ])
      setStock(sRes.data || [])
      setItems(iRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const siteList = useMemo(() => {
    const fromStock = stock.map(s => s.site).filter(Boolean)
    const fromSites = sites.map(s => s.name).filter(Boolean)
    return ['All', ...new Set([...fromStock, ...fromSites])].sort()
  }, [stock, sites])

  const filteredStock = useMemo(() => {
    return stock.filter(r => {
      const matchSite = selectedSite === 'All' || r.site === selectedSite
      const matchSearch = !search || (
        r.bulk_items?.item_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.bulk_items?.item_code?.toLowerCase().includes(search.toLowerCase()) ||
        r.site?.toLowerCase().includes(search.toLowerCase())
      )
      return matchSite && matchSearch
    })
  }, [stock, selectedSite, search])

  const handleAuditSubmit = async (row) => {
    const key = `${row.site}_${row.item_id}`
    const phys = physicalCounts[key]
    if (phys === undefined || phys === '') return alert('Please enter a physical count')

    const sys = Number(row.usable_qty || 0)
    const variance = Number(phys) - sys
    const reason = reasonings[key] || ''

    if (variance !== 0 && !reason.trim()) {
      return alert('Mandatory: Please provide a reasoning note for non-zero audit variance.')
    }

    setSubmittingId(key)
    try {
      const res = await submitStockAuditReconciliation({
        site: row.site,
        itemId: row.item_id,
        physicalQty: phys,
        systemQty: sys,
        reasoning: reason,
        userId: profile?.id
      })

      if (res.isHighRisk) {
        alert(`🚨 HIGH-RISK ANOMALY DETECTED!\nVariance: ${res.variance > 0 ? '+' : ''}${res.variance} (${Math.round(res.variancePct)}%)\nSuper-Admins have been notified and audit record frozen.`)
      } else {
        alert('Stock Audit Reconciled & Frozen Successfully!')
      }

      await fetchData()
      if (onAuditSubmitted) onAuditSubmitted()
    } catch (e) {
      alert('Error submitting audit: ' + e.message)
    } finally {
      setSubmittingId(null)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="spin" size={24} color="var(--accent)" /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: 'var(--bg-2)', padding: 16, borderRadius: 14, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Boxes size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-0)', }}>
              Physical Stock Audit & Anomaly Detection
            </h3>
            <p style={{ margin: 0, color: 'var(--text-3)', }}>
              Verify system stock against physical count. Variances {'>'}10% trigger high-risk security alerts.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="inp" value={selectedSite} onChange={e => setSelectedSite(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
            {siteList.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sites' : s}</option>)}
          </select>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-3)' }} />
            <input 
              type="text" 
              className="inp" 
              placeholder="Search SKU / Item / Site..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ paddingLeft: 30, width: 220 }}
            />
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div style={{ overflowX: 'auto', background: 'var(--bg-1)', borderRadius: 14, border: '1px solid var(--border)' }}>
        <table className="tbl" style={{ width: '100%', minWidth: 850 }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)' }}>
              <th>Site</th>
              <th>SKU / Item</th>
              <th style={{ textAlign: 'right' }}>System Usable</th>
              <th style={{ width: 140 }}>Physical Count</th>
              <th>Variance</th>
              <th>Audit Reasoning</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStock.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No inventory stock records found for audit.</td></tr>
            )}
            {filteredStock.map(r => {
              const key = `${r.site}_${r.item_id}`
              const sys = Number(r.usable_qty || 0)
              const physVal = physicalCounts[key]
              const phys = physVal !== undefined && physVal !== '' ? Number(physVal) : sys
              const variance = phys - sys
              const variancePct = sys > 0 ? Math.abs(variance / sys) * 100 : (phys > 0 ? 100 : 0)
              const unitPrice = Number(r.bulk_items?.unit_price || 0)
              const varianceValue = Math.abs(variance) * unitPrice
              
              // Value-Based Variance Alerting: High-Risk if % > 10% OR Value > ₹25,000
              const isHighRisk = (variancePct >= 10 && Math.abs(variance) > 2) || (varianceValue > 25000)

              return (
                <tr key={r.id}>
                  <td>
                    <span style={{ color: 'var(--text-0)', }}>
                      {r.site}
                    </span>
                  </td>
                  <td>
                    <div style={{ color: 'var(--text-0)' }}>{r.bulk_items?.item_name || 'Item'}</div>
                    <div style={{ color: 'var(--text-3)', }}>
                      SKU: {r.bulk_items?.item_code} • ₹{unitPrice}/{r.bulk_items?.unit || 'nos'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-0)' }}>
                    {sys} <span >{r.bulk_items?.unit || 'nos'}</span>
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className="inp" 
                      placeholder={sys}
                      value={physicalCounts[key] ?? ''} 
                      onChange={e => setPhysicalCounts({ ...physicalCounts, [key]: e.target.value })} 
                      style={{ width: 110, padding: '6px 10px', borderColor: isHighRisk ? 'var(--red)' : 'var(--border)' }}
                    />
                  </td>
                  <td>
                    {variance === 0 ? (
                      <span style={{ color: 'var(--green)', }}>0 (Match)</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: variance > 0 ? 'var(--green)' : 'var(--red)' }}>
                          {variance > 0 ? `+${variance}` : variance} ({formatCurrency(varianceValue)})
                        </span>
                        {isHighRisk && (
                          <span style={{ color: 'var(--red)', background: 'var(--status-danger-soft)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <AlertTriangle size={10} /> HIGH RISK ({Math.round(variancePct)}% | {formatCurrency(varianceValue)})
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <input 
                      type="text" 
                      className="inp" 
                      placeholder={variance !== 0 ? 'Reason for variance *' : 'Optional notes...'} 
                      value={reasonings[key] ?? ''} 
                      onChange={e => setReasonings({ ...reasonings, [key]: e.target.value })} 
                      style={{ padding: '6px 10px', width: '100%' }}
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      onClick={() => handleAuditSubmit(r)} 
                      className="btn-primary" 
                      disabled={submittingId === key}
                      style={{ padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      {submittingId === key ? <Loader2 className="spin" size={13} /> : <Shield size={13} />} Reconcile
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
