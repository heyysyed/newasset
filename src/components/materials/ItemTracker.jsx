import { useState, useMemo } from 'react';
import {
  Package, MapPin, Hash, IndianRupee, BarChart3,
  ArrowRightLeft, Calendar, User, FileText, Search,
  Layers, TrendingUp, Building2, Activity, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

/* ── helpers ──────────────────────────────────────────────── */

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(v) {
  if (v == null) return '-';
  return '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtQty(v) {
  if (v == null) return '0';
  return Number(v).toLocaleString();
}

/* ── type badge ───────────────────────────────────────────── */

const TypeBadge = ({ type }) => {
  const map = {
    purchase:       { bg: 'var(--green-dim)',  color: 'var(--green)',  border: 'rgba(0,185,107,0.25)' },
    transfer:       { bg: 'var(--accent-glow)', color: 'var(--accent)', border: 'var(--accent-soft)' },
    issue:          { bg: 'var(--amber-dim)',  color: '#c97b00',       border: 'var(--status-warning-soft)' },
    return:         { bg: 'var(--cyan-dim)',   color: 'var(--cyan)',   border: 'rgba(6,182,212,0.25)' },
    consumption:    { bg: 'var(--red-dim)',    color: 'var(--red)',    border: 'var(--status-danger-soft)' },
    requisition:    { bg: 'var(--purple-dim)', color: 'var(--purple)', border: 'rgba(139,92,246,0.25)' },
    adjustment_out: { bg: 'var(--red-dim)',    color: 'var(--red)',    border: 'var(--status-danger-soft)' },
  };
  const m = map[type] || { bg: 'var(--bg-3)', color: 'var(--text-2)', border: 'var(--border)' };
  return (
    <span
      className="badge"
      style={{ background: m.bg, color: m.color, border: `1.5px solid ${m.border}` }}
    >
      {type?.replace(/_/g, ' ') || 'unknown'}
    </span>
  );
};

/* ── main component ───────────────────────────────────────── */

function downloadItemReport(mat, matStock, matTxns) {
  const wb = XLSX.utils.book_new()
  const today = new Date().toISOString().split('T')[0]
  const name = mat.material_name || mat.name || 'Material'
  const code = mat.material_code || mat.code || ''

  // Sheet 1: Material Info
  const infoRows = [
    { Field:'Material Name', Value: name },
    { Field:'Material Code', Value: code },
    { Field:'Category', Value: mat.category || '' },
    { Field:'Unit', Value: mat.unit || '' },
    { Field:'Unit Cost', Value: Number(mat.unit_cost || 0) },
    { Field:'Description', Value: mat.description || '' },
    { Field:'Report Date', Value: today },
  ]
  const infoWs = XLSX.utils.json_to_sheet(infoRows)
  infoWs['!cols'] = [{ wch:18 }, { wch:40 }]
  XLSX.utils.book_append_sheet(wb, infoWs, 'Material Info')

  // Sheet 2: Stock by Site
  const stkRows = matStock.map((s,i) => ({
    '#': i+1,
    Site: s.site || s.site_name || '',
    Quantity: Number(s.quantity || 0),
    Unit: mat.unit || '',
    'Unit Cost': Number(mat.unit_cost || 0),
    Value: Number(s.quantity || 0) * Number(mat.unit_cost || 0),
    'Reorder Level': Number(s.reorder_level || 0),
    'Batch No': s.batch_no || '',
    'Expiry Date': s.expiry_date || '',
  }))
  const stkWs = XLSX.utils.json_to_sheet(stkRows)
  stkWs['!cols'] = [{ wch:4 },{ wch:16 },{ wch:10 },{ wch:8 },{ wch:12 },{ wch:14 },{ wch:12 },{ wch:14 },{ wch:12 }]
  XLSX.utils.book_append_sheet(wb, stkWs, 'Stock by Site')

  // Sheet 3: Transaction History
  const txnRows = matTxns.map((t,i) => ({
    '#': i+1,
    Date: t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '',
    Type: t.transaction_type || t.type || '',
    From: t.from_site || '',
    To: t.to_site || '',
    Quantity: Number(t.quantity || 0),
    'Unit Cost': Number(t.unit_cost || 0),
    Total: Number(t.quantity || 0) * Number(t.unit_cost || 0),
    'Performed By': t.performer?.full_name || '',
    Notes: t.notes || '',
  }))
  const txnWs = XLSX.utils.json_to_sheet(txnRows)
  txnWs['!cols'] = [{ wch:4 },{ wch:14 },{ wch:14 },{ wch:14 },{ wch:14 },{ wch:10 },{ wch:12 },{ wch:14 },{ wch:18 },{ wch:28 }]
  XLSX.utils.book_append_sheet(wb, txnWs, 'Transactions')

  // Sheet 4: Summary
  const totalStock = matStock.reduce((s, r) => s + Number(r.quantity || 0), 0)
  const totalValue = totalStock * Number(mat.unit_cost || 0)
  const purchases = matTxns.filter(t => (t.transaction_type || t.type) === 'purchase')
  const transfers = matTxns.filter(t => (t.transaction_type || t.type) === 'transfer')
  const issues = matTxns.filter(t => (t.transaction_type || t.type) === 'issue')
  const returns = matTxns.filter(t => (t.transaction_type || t.type) === 'return')
  const consumed = matTxns.filter(t => (t.transaction_type || t.type) === 'consumption')

  const sumRows = [
    { Metric:'Total Stock', Value: totalStock },
    { Metric:'Total Value', Value: totalValue },
    { Metric:'Sites Present', Value: matStock.filter(s => Number(s.quantity) > 0).length },
    { Metric:'Total Transactions', Value: matTxns.length },
    { Metric:'Purchases', Value: purchases.length },
    { Metric:'Transfers', Value: transfers.length },
    { Metric:'Issues', Value: issues.length },
    { Metric:'Returns', Value: returns.length },
    { Metric:'Consumption', Value: consumed.length },
    { Metric:'Total Purchased Qty', Value: purchases.reduce((s,t) => s + Number(t.quantity||0), 0) },
    { Metric:'Total Issued Qty', Value: issues.reduce((s,t) => s + Number(t.quantity||0), 0) },
    { Metric:'Total Consumed Qty', Value: consumed.reduce((s,t) => s + Number(t.quantity||0), 0) },
    { Metric:'Total Returned Qty', Value: returns.reduce((s,t) => s + Number(t.quantity||0), 0) },
  ]
  const sumWs = XLSX.utils.json_to_sheet(sumRows)
  sumWs['!cols'] = [{ wch:22 }, { wch:16 }]
  XLSX.utils.book_append_sheet(wb, sumWs, 'Summary')

  const safeName = (code || name).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)
  XLSX.writeFile(wb, `Material_Report_${safeName}_${today}.xlsx`)
}

export default function ItemTracker({ materials = [], stock = [], txns = [] }) {
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => materials.find(m => m.id === selectedId) || null,
    [materials, selectedId]
  );

  /* stock rows for this material */
  const matStock = useMemo(() => {
    if (!selectedId) return [];
    return stock.filter(s => {
      const mid = s.material_id || s.materials?.id;
      return mid === selectedId;
    });
  }, [stock, selectedId]);

  /* txns for this material */
  const matTxns = useMemo(() => {
    if (!selectedId) return [];
    return txns
      .filter(t => {
        const mid = t.material_id || t.materials?.id;
        return mid === selectedId;
      })
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
  }, [txns, selectedId]);

  /* summary stats */
  const summary = useMemo(() => {
    const totalQty = matStock.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const unitCost = Number(selected?.unit_cost) || 0;
    const isReusable = selected?.is_reusable || false;

    // For reusable items: calculate issued vs returned
    let totalIssued = 0, totalReturned = 0;
    if (isReusable) {
      matTxns.forEach(t => {
        const type = t.transaction_type || t.type;
        const qty = Number(t.quantity) || 0;
        if (type === 'issue') totalIssued += qty;
        if (type === 'return') totalReturned += qty;
      });
    }

    return {
      totalQty,
      totalValue: totalQty * unitCost,
      totalTxns: matTxns.length,
      sitesPresent: matStock.filter(r => (Number(r.quantity) || 0) > 0).length,
      isReusable,
      totalIssued,
      totalReturned,
      currentlyOut: totalIssued - totalReturned,
      returnRate: totalIssued > 0 ? Math.round((totalReturned / totalIssued) * 100) : 0,
    };
  }, [matStock, matTxns, selected]);

  /* ── render ── */

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>

      {/* ── Material Selector ── */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <select className="sel" value={selectedId || ''} onChange={e => setSelectedId(e.target.value || null)}
          style={{ flex:1, minWidth:200 }}>
          <option value="">- Choose a material -</option>
          {materials.map(m => (
            <option key={m.id} value={m.id}>
              {m.material_name || m.name}{(m.material_code || m.code) ? ` (${m.material_code || m.code})` : ''}
            </option>
          ))}
        </select>
        {selected && (
          <button className="btn-primary" onClick={() => downloadItemReport(selected, matStock, matTxns)}
            style={{ flexShrink:0 }}>
            <Download size={15}/><span className="btn-label">Download Report</span>
          </button>
        )}
      </div>

      {/* ── Empty state ── */}
      {!selected && (
        <div style={{ padding:'50px 20px', textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'var(--bg-3)', display:'inline-flex',
            alignItems:'center', justifyContent:'center', marginBottom:14, boxShadow:'var(--clay-inset)' }}>
            <Search size={26} style={{ color:'var(--text-3)' }}/>
          </div>
          <p style={{ color:'var(--text-3)', }}>
            Select a material to view its complete tracking history
          </p>
        </div>
      )}

      {/* ── Selected material ── */}
      {selected && (
        <>
          {/* Material header + key info */}
          <div style={{ display:'flex', gap:14, flexWrap:'wrap' }} className="trk-top-grid">
            {/* Left: material info */}
            <div className="card" style={{ flex:'1 1 340px', padding:'18px 20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'var(--accent-glow)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Package size={18} style={{ color:'var(--accent)' }}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'var(--text-0)' }}>
                    {selected.material_name || selected.name}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:2 }}>
                    <code style={{ background:'var(--bg-3)', padding:'2px 8px', borderRadius:6,
                      color:'var(--text-2)', border:'1px solid var(--border)' }}>
                      {selected.material_code || selected.code}
                    </code>
                    <span style={{ color:'var(--text-3)' }}>{selected.category} · {selected.unit}</span>
                  </div>
                </div>
              </div>
              {/* Key metrics inline */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(100px, 1fr))', gap:10 }}>
                {[
                  { label:'Unit Cost', val: fmtCurrency(selected.unit_cost), color:'var(--green)' },
                  { label:'Total Stock', val: fmtQty(summary.totalQty), color:'var(--accent)' },
                  { label:'Total Value', val: fmtCurrency(summary.totalValue), color:'var(--green)' },
                  { label:'Transactions', val: summary.totalTxns, color:'var(--amber)' },
                ].map(m => (
                  <div key={m.label} style={{ padding:'10px 12px', borderRadius:10, background:'var(--bg-3)',
                    border:'1px solid var(--border)' }}>
                    <div style={{ color:m.color, }}>{m.val}</div>
                    <div style={{ color:'var(--text-3)', marginTop:3 }}>{m.label}</div>
                  </div>
                ))}
              </div>
              {selected.description && (
                <p style={{ margin:'12px 0 0', color:'var(--text-2)', }}>
                  {selected.description}
                </p>
              )}

              {/* Reusable utilization */}
              {summary.isReusable && (
                <div style={{ marginTop:14, padding:'14px 16px', borderRadius:12,
                  background:'rgba(6,182,212,0.04)', border:'1.5px solid rgba(6,182,212,0.15)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                    <Activity size={14} style={{ color:'var(--cyan)' }}/>
                    <span style={{ color:'var(--cyan)', letterSpacing:'0.03em' }}>
                      REUSABLE ITEM UTILIZATION
                    </span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(80px, 1fr))', gap:8 }}>
                    {[
                      { label:'Total Issued', val: fmtQty(summary.totalIssued), color:'var(--amber)' },
                      { label:'Returned', val: fmtQty(summary.totalReturned), color:'var(--green)' },
                      { label:'Currently Out', val: fmtQty(summary.currentlyOut), color: summary.currentlyOut > 0 ? 'var(--red)' : 'var(--green)' },
                      { label:'Return Rate', val: `${summary.returnRate}%`, color: summary.returnRate >= 80 ? 'var(--green)' : summary.returnRate >= 50 ? 'var(--amber)' : 'var(--red)' },
                    ].map(m => (
                      <div key={m.label} style={{ padding:'8px 10px', borderRadius:8, background:'var(--bg-1)', border:'1px solid var(--border)', textAlign:'center' }}>
                        <div style={{ color:m.color, }}>{m.val}</div>
                        <div style={{ color:'var(--text-3)', marginTop:3 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {summary.currentlyOut > 0 && (
                    <div style={{ marginTop:8, color:'var(--red)', display:'flex', alignItems:'center', gap:4 }}>
                      <Activity size={11}/> {fmtQty(summary.currentlyOut)} {selected.unit || 'units'} still out - pending return
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: sites */}
            <div className="card" style={{ flex:'1 1 280px', padding:'18px 20px' }}>
              <div style={{ color:'var(--text-0)',
                letterSpacing:'0.03em', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <MapPin size={15} style={{ color:'var(--accent)' }}/> Stock by Site
                <span style={{ marginLeft:'auto', color:'var(--text-3)', }}>
                  {summary.sitesPresent} site{summary.sitesPresent !== 1 ? 's' : ''}
                </span>
              </div>
              {matStock.length === 0 ? (
                <p style={{ color:'var(--text-3)', textAlign:'center', padding:'20px 0' }}>No stock</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {matStock.map((row, i) => {
                    const qty = Number(row.quantity) || 0
                    const unitCost = Number(selected.unit_cost) || 0
                    const value = qty * unitCost
                    const reorder = Number(row.reorder_level || 0)
                    const isLow = reorder > 0 && qty <= reorder
                    const barPct = reorder > 0 ? Math.min((qty / (reorder * 3)) * 100, 100) : 70
                    const barColor = qty <= 0 ? 'var(--red)' : isLow ? 'var(--amber)' : 'var(--green)'
                    return (
                      <div key={row.id || i} style={{ padding:'10px 12px', borderRadius:10, background:'var(--bg-1)',
                        border:'1.5px solid var(--border)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                          <span style={{ color:'var(--text-0)' }}>
                            {row.site || `Site ${i+1}`}
                          </span>
                          <span style={{ color:barColor }}>{fmtQty(qty)}</span>
                        </div>
                        <div style={{ height:4, borderRadius:2, background:'var(--bg-4)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${barPct}%`, borderRadius:2,
                            background:`linear-gradient(90deg, ${barColor}, ${barColor}80)`, transition:'width 0.3s' }}/>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, color:'var(--text-3)', }}>
                          <span>{fmtCurrency(value)}</span>
                          {reorder > 0 && <span>Reorder: {fmtQty(reorder)}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Transaction Timeline ── */}
          <div className="card" style={{ padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <ArrowRightLeft size={16} style={{ color:'var(--accent)' }}/>
              <span style={{ color:'var(--text-0)', letterSpacing:'0.03em' }}>
                Transaction Timeline
              </span>
              <span className="badge" style={{ background:'var(--bg-3)', color:'var(--text-2)', marginLeft:'auto' }}>
                {matTxns.length} entries
              </span>
            </div>

            {matTxns.length === 0 ? (
              <p style={{ textAlign:'center', color:'var(--text-3)', padding:'24px 0' }}>
                No transactions recorded for this material.
              </p>
            ) : (
              <div style={{ position:'relative', paddingLeft:24 }}>
                {/* Vertical line */}
                <div style={{ position:'absolute', left:7, top:8, bottom:8, width:2, background:'var(--border)', borderRadius:1 }}/>

                {matTxns.map((t, idx) => {
                  const date = t.created_at || t.date
                  const fromSite = (typeof t.from_site === 'string' ? t.from_site : null) || null
                  const toSite = (typeof t.to_site === 'string' ? t.to_site : null) || null
                  const performer = t.performer?.full_name || null
                  const qty = t.quantity
                  const type = t.transaction_type || t.type
                  const dotColorMap = {
                    purchase:'var(--green)', transfer:'var(--accent)', issue:'var(--amber)',
                    return:'var(--cyan)', consumption:'var(--red)', requisition:'var(--purple)', adjustment_out:'var(--red)',
                  }
                  const dotColor = dotColorMap[type] || 'var(--accent)'

                  return (
                    <div key={t.id || idx} style={{ position:'relative', paddingBottom: idx < matTxns.length-1 ? 16 : 0 }}>
                      {/* Dot */}
                      <div style={{ position:'absolute', left:-24, top:6, width:16, height:16, borderRadius:'50%',
                        border:`2.5px solid ${dotColor}`, background:'var(--bg-2)', display:'flex',
                        alignItems:'center', justifyContent:'center', zIndex:1 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:dotColor }}/>
                      </div>
                      {/* Content */}
                      <div style={{ background:'var(--bg-1)', border:'1.5px solid var(--border)', borderRadius:10, padding:'10px 14px' }}>
                        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:8 }}>
                          <span style={{ color:'var(--text-3)' }}>{fmtDate(date)}</span>
                          <TypeBadge type={type}/>
                          <span style={{ color:'var(--text-0)', marginLeft:'auto' }}>
                            {qty != null ? `${fmtQty(qty)} ${selected.unit || ''}` : ''}
                          </span>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginTop:6, color:'var(--text-2)', }}>
                          {(fromSite || toSite) && (
                            <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
                              <MapPin size={11}/>
                              {fromSite && toSite ? `${fromSite} → ${toSite}` : fromSite ? `From: ${fromSite}` : `To: ${toSite}`}
                            </span>
                          )}
                          {performer && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><User size={11}/>{performer}</span>}
                          {t.notes && <span style={{ display:'inline-flex', alignItems:'center', gap:3, flexBasis:'100%' }}><FileText size={11}/>{t.notes}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 768px) {
          .trk-top-grid { flex-direction: column !important; }
          .trk-top-grid > * { flex: 1 1 auto !important; }
        }
      `}</style>
    </div>
  );
}
