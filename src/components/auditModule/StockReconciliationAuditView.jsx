import React, { useState, useEffect, useMemo } from 'react'
import { Boxes, Search, AlertTriangle, CheckCircle2, Shield, RefreshCw, Loader2, ArrowRight, MapPin, TrendingUp, TrendingDown } from 'lucide-react'
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

      {/* ── Stock List Cards ── */}
      <div className="flex flex-col gap-4">
        {filteredStock.length === 0 && (
          <div className="text-center p-10 text-[var(--text-3)] bg-[var(--bg-1)] rounded-2xl border border-[var(--border)]">
            No inventory stock records found for audit.
          </div>
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
            <div key={r.id} className="relative bg-[var(--bg-0)] p-4 md:p-5 rounded-2xl border border-[var(--border)] shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col lg:flex-row gap-5 lg:items-center justify-between transition-all duration-200 hover:shadow-md hover:border-[var(--accent)]/30 group">
              
              {/* High Risk Alert Badge */}
              {isHighRisk && variance !== 0 && (
                <div className="absolute -top-2.5 right-4 bg-[var(--red)] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 border-2 border-[var(--bg-0)] z-10">
                   <AlertTriangle size={10} /> HIGH RISK ({Math.round(variancePct)}% | {formatCurrency(varianceValue)})
                </div>
              )}

              {/* Site & Item Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider border border-[var(--accent)]/20">
                    <MapPin size={10} /> {r.site}
                  </span>
                  <span className="text-[11px] text-[var(--text-3)] font-semibold truncate">SKU: {r.bulk_items?.item_code}</span>
                </div>
                <h3 className="text-base font-bold text-[var(--text-0)] m-0 leading-tight truncate">{r.bulk_items?.item_name || 'Item'}</h3>
                <div className="text-xs text-[var(--text-2)] mt-1.5 flex items-center gap-2">
                  <span>System: <strong className="text-[var(--text-1)]">{sys} {r.bulk_items?.unit || 'nos'}</strong></span>
                  <span className="text-[var(--border)]">|</span>
                  <span>₹{unitPrice}/{r.bulk_items?.unit || 'nos'}</span>
                </div>
              </div>

              {/* Inputs & Actions */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch bg-[var(--bg-1)] p-3 rounded-xl border border-[var(--border)] group-hover:border-[var(--border-hover)] transition-colors w-full lg:w-auto shrink-0">
                
                {/* Physical Count */}
                <div className="flex flex-col gap-1.5 w-full sm:w-28 shrink-0">
                  <label className="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">Physical Count</label>
                  <input 
                    type="number" 
                    placeholder={sys}
                    value={physicalCounts[key] ?? ''} 
                    onChange={e => setPhysicalCounts({ ...physicalCounts, [key]: e.target.value })} 
                    className={`w-full bg-[var(--bg-0)] border rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text-0)] outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all ${isHighRisk ? 'border-[var(--red)] focus:border-[var(--red)]' : 'border-[var(--border)] focus:border-[var(--accent)]'}`}
                  />
                </div>

                {/* Variance & Reason */}
                <div className="flex flex-col gap-1.5 w-full sm:w-48 shrink-0">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">Reason</label>
                    {variance !== 0 ? (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${variance > 0 ? 'bg-[var(--green)]/10 text-[var(--green)]' : 'bg-[var(--red)]/10 text-[var(--red)]'}`}>
                        {variance > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {variance > 0 ? '+' : ''}{variance}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--green)]/10 text-[var(--green)] flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> Match
                      </span>
                    )}
                  </div>
                  <input 
                    type="text" 
                    placeholder={variance !== 0 ? 'Reason for variance *' : 'Optional notes...'} 
                    value={reasonings[key] ?? ''} 
                    onChange={e => setReasonings({ ...reasonings, [key]: e.target.value })} 
                    className={`w-full bg-[var(--bg-0)] border rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-0)] outline-none focus:ring-2 transition-all ${variance !== 0 && (!reasonings[key] || reasonings[key].trim() === '') ? 'border-[var(--amber)] focus:border-[var(--amber)] focus:ring-[var(--amber)]/20' : 'border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20'}`}
                  />
                </div>

                {/* Reconcile Button */}
                <div className="flex flex-col justify-end h-full sm:mt-0 shrink-0">
                  <button 
                    onClick={() => handleAuditSubmit(r)} 
                    disabled={submittingId === key || (variance !== 0 && (!reasonings[key] || reasonings[key].trim() === ''))}
                    className="bg-[var(--accent)] text-white font-semibold text-sm px-4 h-[38px] rounded-lg flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 disabled:grayscale"
                  >
                    {submittingId === key ? <Loader2 className="animate-spin" size={16} /> : <Shield size={16} />} 
                    <span>Reconcile</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


