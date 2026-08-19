import React, { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader2, ArrowRight, Package, CheckCircle2, FileText, Truck, UserCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const ESignaturePad = lazy(() => import('../common/ESignaturePad'))

export default function BulkTransactionModal({ isOpen, onClose, txType, items, stock, onSaved, user, defaultItem, defaultSite, onViewGatePass, allConfiguredSites = [] }) {
  const [loading, setLoading] = useState(false)
  const [generatedPass, setGeneratedPass] = useState(null) // { pass_no, id }
  const [signatureUrl, setSignatureUrl] = useState('')
  
  // txType: 'receipt', 'transfer', 'deploy', 'return', 'consume', 'scrap'
  const isTransfer = txType === 'transfer'
  const isReceipt = txType === 'receipt'
  const isDeploy = txType === 'deploy' // Or dismantle
  const isReturn = txType === 'return' // Same as receipt, but different tx log
  const isConsume = txType === 'consume' // Deduct usable
  const isScrap = txType === 'scrap' // Usable -> Scrap

  const [form, setForm] = useState({
    item_id: defaultItem || '',
    from_site: defaultSite || '',
    to_site: '',
    quantity: '',
    notes: '',
    transporter_name: '',
    dispatcher_name: '',
    action: isDeploy ? 'deploy' : (isScrap ? 'scrap' : txType) // deploy/dismantle
  })

  // Update form if defaults change while modal is open
  useEffect(() => {
    if (isOpen) {
      setForm(prev => ({
        ...prev,
        item_id: defaultItem || prev.item_id,
        from_site: defaultSite || prev.from_site,
        action: isDeploy ? 'deploy' : (isScrap ? 'scrap' : txType)
      }))
      setGeneratedPass(null)
    }
  }, [isOpen, defaultItem, defaultSite, txType, isDeploy, isScrap])

  // Filter items based on availability for transfers, deploys, scraps, consumes
  const availableItems = useMemo(() => {
    if (isReceipt || isReturn) return items // Can receive/return any master item
    
    // For others, only show items that have stock
    const itemIdsWithStock = new Set(stock.map(s => s.item_id))
    return items.filter(i => itemIdsWithStock.has(i.id))
  }, [isReceipt, isReturn, items, stock])

  // Get sites that have the selected item in stock
  const availableSites = useMemo(() => {
    if (!form.item_id) return []
    return stock.filter(s => s.item_id === form.item_id).map(s => s.site)
  }, [form.item_id, stock])

  // Get all unique sites: merge stock-derived sites + configured sites from prop
  const allSites = useMemo(() => {
    const fromStock = stock.map(s => s.site).filter(Boolean)
    const fromConfig = allConfiguredSites.filter(Boolean)
    return [...new Set([...fromStock, ...fromConfig])].sort()
  }, [stock, allConfiguredSites])

  const selectedItem = items.find(i => i.id === form.item_id)
  
  // Calculate max available based on action
  const maxAvailable = useMemo(() => {
    if (!form.item_id || !form.from_site) return 0
    const s = stock.find(st => st.item_id === form.item_id && st.site === form.from_site)
    if (!s) return 0
    if (form.action === 'dismantle') return Number(s.in_use_qty)
    return Number(s.usable_qty) // transfer, deploy, scrap, consume all pull from usable
  }, [form.item_id, form.from_site, form.action, stock])

  // Smart Inventory Transfer Suggestion: Find site with highest surplus stock for selected item
  const recommendedSourceSite = useMemo(() => {
    if (!form.item_id || !isTransfer) return null
    const siteStocks = stock.filter(s => s.item_id === form.item_id && Number(s.usable_qty) > 0)
    if (siteStocks.length === 0) return null
    const sorted = [...siteStocks].sort((a, b) => Number(b.usable_qty) - Number(a.usable_qty))
    const topSite = sorted[0]
    if (topSite.site === form.to_site) return sorted[1] || null
    return topSite
  }, [form.item_id, isTransfer, stock, form.to_site])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.item_id || !form.quantity) return
    const qty = Number(form.quantity)
    if (qty <= 0) return alert('Quantity must be greater than 0')

    if (!isReceipt && !isReturn && qty > maxAvailable) {
      return alert(`Cannot ${form.action} more than available stock (${maxAvailable})`)
    }

    setLoading(true)
    try {
      const wt = qty * Number(selectedItem.unit_weight_kg || 0)
      const now = new Date().toISOString()

      // 1. Log transaction
      const { error: txErr } = await supabase.from('bulk_transactions').insert([{
        item_id: form.item_id,
        transaction_type: form.action,
        from_site: (isReceipt || isReturn) ? null : form.from_site,
        to_site: (isTransfer || isReceipt || isReturn) ? form.to_site : form.from_site, 
        quantity: qty,
        total_weight_kg: wt,
        notes: form.notes,
        performed_by: user.id
      }])
      if (txErr) throw txErr

      // 2. Update stock
      if (isReceipt || isReturn) {
        // Add to usable_qty at to_site
        const dest = stock.find(s => s.item_id === form.item_id && s.site === form.to_site)
        if (dest) {
          await supabase.from('bulk_site_stock')
            .update({ usable_qty: Number(dest.usable_qty) + qty, updated_at: now })
            .eq('id', dest.id)
        } else {
          await supabase.from('bulk_site_stock')
            .insert({ item_id: form.item_id, site: form.to_site, usable_qty: qty })
        }
      } 
      else if (isTransfer) {
        // Deduct from from_site usable_qty
        const src = stock.find(s => s.item_id === form.item_id && s.site === form.from_site)
        await supabase.from('bulk_site_stock')
          .update({ usable_qty: Number(src.usable_qty) - qty, updated_at: now })
          .eq('id', src.id)
        
        // Add to to_site usable_qty
        const dest = stock.find(s => s.item_id === form.item_id && s.site === form.to_site)
        if (dest) {
          await supabase.from('bulk_site_stock')
            .update({ usable_qty: Number(dest.usable_qty) + qty, updated_at: now })
            .eq('id', dest.id)
        } else {
          await supabase.from('bulk_site_stock')
            .insert({ item_id: form.item_id, site: form.to_site, usable_qty: qty })
        }

        // ── Auto-generate a Gate Pass for this transfer ──────────────────────
        const passNo = `GP-${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-2).toUpperCase()}`
        const { data: pass, error: gpErr } = await supabase.from('gate_passes').insert({
          pass_no: passNo,
          pass_type: 'material_out',
          purpose: `Bulk Transfer: ${form.from_site} → ${form.to_site}`,
          site: form.from_site,
          destination: form.to_site,
          status: 'completed',
          requested_by: user.id,
          notes: form.notes || null,
        }).select().single()

        if (!gpErr && pass) {
          // Insert gate_pass_items using correct schema columns
          await supabase.from('gate_pass_items').insert({
            gate_pass_id: pass.id,
            item_type: 'other',
            description: `${selectedItem.item_name} (${selectedItem.item_code})`,
            quantity: qty,
            unit: selectedItem.unit || 'pcs',
            remarks: form.notes || null,
          })
          setGeneratedPass({ pass_no: passNo, id: pass.id })
        }
        // ── End Gate Pass generation ─────────────────────────────────────────
      }
      else if (isDeploy) {
        const s = stock.find(st => st.item_id === form.item_id && st.site === form.from_site)
        if (form.action === 'deploy') {
          // Usable -> In Use
          await supabase.from('bulk_site_stock')
            .update({ 
              usable_qty: Number(s.usable_qty) - qty, 
              in_use_qty: Number(s.in_use_qty) + qty, 
              updated_at: now 
            }).eq('id', s.id)
        } else { // dismantle
          // In Use -> Usable
          await supabase.from('bulk_site_stock')
            .update({ 
              in_use_qty: Number(s.in_use_qty) - qty, 
              usable_qty: Number(s.usable_qty) + qty, 
              updated_at: now 
            }).eq('id', s.id)
        }
      }
      else if (isScrap) {
        // Usable -> Scrap
        const s = stock.find(st => st.item_id === form.item_id && st.site === form.from_site)
        await supabase.from('bulk_site_stock')
          .update({ 
            usable_qty: Number(s.usable_qty) - qty, 
            scrap_qty: Number(s.scrap_qty) + qty, 
            updated_at: now 
          }).eq('id', s.id)
      }
      else if (isConsume) {
        // Usable -> poof (consumed)
        const s = stock.find(st => st.item_id === form.item_id && st.site === form.from_site)
        await supabase.from('bulk_site_stock')
          .update({ 
            usable_qty: Number(s.usable_qty) - qty, 
            updated_at: now 
          }).eq('id', s.id)
      }

      onSaved()
      // For transfers, don't auto-close — show the gate pass toast first
      if (!isTransfer) {
        onClose()
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const titleMap = {
    receipt: 'Receive Bulk Items',
    transfer: 'Transfer Bulk Items',
    deploy: 'Deploy / Dismantle Items',
    return: 'Return Bulk Items',
    consume: 'Consume Bulk Items',
    scrap: 'Scrap Bulk Items'
  }

  return createPortal(
    <div className="modal-bg" onClick={generatedPass ? undefined : onClose}>
      <div 
        className="modal" 
        style={{ 
          maxWidth: 450, 
          display: 'flex',
          flexDirection: 'column'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', padding: '24px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 7, background: 'rgba(79,126,255,0.12)', borderRadius: 9, color: 'var(--accent)', border: '1px solid rgba(79,126,255,0.3)' }}>
              <Package size={16} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.05em', color: 'var(--text-0)', margin: 0, textTransform: 'uppercase' }}>
                {titleMap[txType]}
              </h3>
              <p style={{ fontFamily: 'DM Sans', fontSize: '0.72rem', color: 'var(--text-3)', margin: 0 }}>Execute stock movement</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
        </div>
        
        {/* ── Gate Pass Success Banner (shown after transfer completes) ── */}
        {generatedPass && (
          <div style={{
            margin: '0 24px',
            marginTop: 20,
            padding: '14px 16px',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle2 size={18} color="var(--green)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--green)', marginBottom: 2 }}>
                Transfer Complete ✓
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                Gate Pass generated:{' '}
                <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--accent)' }}>
                  {generatedPass.pass_no}
                </span>
              </div>
            </div>
            {onViewGatePass && (
              <button
                onClick={() => { onViewGatePass(); onClose() }}
                className="btn-ghost"
                style={{ padding: '6px 12px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, border: '1px solid var(--green)', color: 'var(--green)' }}
              >
                <FileText size={13} /> View Pass
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          <form id="bulk-tx-form" onSubmit={handleSubmit} style={{ padding: '24px', display:'flex', flexDirection:'column', gap:20 }}>
            
            {isDeploy && (
            <div style={{ display:'flex', gap:10, marginBottom:8 }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                <input type="radio" checked={form.action === 'deploy'} onChange={() => setForm({...form, action:'deploy', quantity:''})} />
                <span className="lbl" style={{ margin:0 }}>Deploy (Use)</span>
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                <input type="radio" checked={form.action === 'dismantle'} onChange={() => setForm({...form, action:'dismantle', quantity:''})} />
                <span className="lbl" style={{ margin:0 }}>Dismantle (Return to Usable)</span>
              </label>
            </div>
          )}

          <div>
            <label className="lbl">Item *</label>
            <select className="sel" required value={form.item_id} onChange={e => setForm({...form, item_id: e.target.value, from_site:'', to_site:'', quantity:''})}>
              <option value="">Select Item...</option>
              {availableItems.map(i => (
                <option key={i.id} value={i.id}>{i.item_name} ({i.item_code})</option>
              ))}
            </select>
          </div>

          {recommendedSourceSite && (
            <div 
              onClick={() => setForm(f => ({ ...f, from_site: recommendedSourceSite.site }))}
              style={{
                padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 8, transition: 'all 0.2s'
              }}
              title="Click to auto-select recommended source site"
            >
              <div style={{ padding: 4, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', color: '#059669', display: 'flex' }}>
                <Package size={14} />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#059669', fontFamily: 'DM Sans', fontWeight: 600 }}>
                Recommended Source: <strong>{recommendedSourceSite.site}</strong> (Surplus: {recommendedSourceSite.usable_qty} {selectedItem?.unit || 'pcs'}) — Tap to select
              </span>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns: isTransfer ? '1fr 1fr' : '1fr', gap:12 }}>
            {(!isReceipt && !isReturn) && (
              <div>
                <label className="lbl">From Site *</label>
                <select className="sel" required value={form.from_site} onChange={e => setForm({...form, from_site: e.target.value, quantity:''})}>
                  <option value="">Select Site...</option>
                  {availableSites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            
            {(isTransfer || isReceipt || isReturn) && (
              <div>
                <label className="lbl">To Site *</label>
                <select className="sel" required value={form.to_site} onChange={e => setForm({...form, to_site: e.target.value})}>
                  <option value="">Select Destination Site...</option>
                  {allSites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="lbl" style={{ display:'flex', justifyContent:'space-between' }}>
              <span>Quantity ({selectedItem?.unit || 'pcs'}) *</span>
              {(!isReceipt && !isReturn) && form.from_site && (
                <span style={{ color:'var(--accent)' }}>Available: {maxAvailable}</span>
              )}
            </label>
            <input type="number" step="0.001" className="inp" required value={form.quantity} 
              onChange={e => setForm({...form, quantity: e.target.value})} 
              max={(!isReceipt && !isReturn) ? maxAvailable : undefined}
            />
          </div>

          {form.quantity && selectedItem?.unit_weight_kg > 0 && (
            <div style={{ padding:'10px 14px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:'0.85rem', color:'var(--text-2)' }}>Total Weight:</span>
              <span style={{ fontFamily:'DM Mono', fontWeight:600, color:'var(--text-0)' }}>
                {(Number(form.quantity) * Number(selectedItem.unit_weight_kg)).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg
              </span>
            </div>
          )}

          {/* Transfer info note & Signature */}
          {isTransfer && (
            <>
              <div style={{ padding: '10px 14px', background: 'rgba(79,126,255,0.06)', borderRadius: 8, border: '1px solid rgba(79,126,255,0.2)', fontSize: '0.75rem', color: 'var(--text-2)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <FileText size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                <span>A <strong style={{ color: 'var(--accent)' }}>Gate Pass</strong> will be automatically generated and linked to this transfer with your digital signature.</span>
              </div>
              
              <Suspense fallback={null}>
                <ESignaturePad onSave={(url) => setSignatureUrl(url)} label="Transporter / Receiver Digital Signature" />
              </Suspense>
            </>
          )}

          <div>
            <label className="lbl">Notes (Optional)</label>
            <textarea className="inp" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
          </form>
        </div>

        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          {generatedPass ? (
            <button type="button" onClick={onClose} className="btn-primary">Done</button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button type="submit" form="bulk-tx-form" className="btn-primary" disabled={loading || !form.item_id || !form.quantity}>
                {loading ? <Loader2 className="spin" size={18}/> : <Save size={18}/>} Execute
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  )
}
