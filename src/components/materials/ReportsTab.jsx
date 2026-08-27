import React, { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area
} from 'recharts'
import {
  BarChart3, TrendingUp, Package, IndianRupee,
  ArrowUpDown, PieChart as PieIcon, Layers
} from 'lucide-react'

const fmtCur = (n) => '\u20B9' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const COLORS = {
  purchase: '#00b96b',
  transfer: '#4f7eff',
  requisition: 'var(--status-special)',
  issue: 'var(--status-warning)',
}
const BAR_PALETTE = ['#4f7eff', 'var(--status-special)', '#06b6d4', '#00b96b']

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const chartCard = { padding: 0, overflow: 'hidden' }
const chartHeader = {
  padding: '14px 16px 10px',
  borderBottom: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', gap: 8,
  color: 'var(--text-0)', letterSpacing: '0.02em',
  textTransform: 'uppercase',
}
const chartBody = { padding: '16px 8px 12px' }

export default function ReportsTab({ materials = [], stock = [], txns = [], requisitions = [] }) {

  /* ── Summary stats ────────────────────────────────── */
  const totalMaterials = materials.length

  const totalStockValue = useMemo(() =>
    stock.reduce((sum, s) => {
      const mat = s.materials || s.material || {}
      const cost = Number(mat.unit_cost || s.unit_cost || 0)
      return sum + Number(s.quantity || 0) * cost
    }, 0),
    [stock]
  )

  const txnsThisMonth = useMemo(() => {
    const now = new Date()
    return txns.filter(t => {
      const d = new Date(t.created_at || t.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [txns])

  const avgMonthlySpend = useMemo(() => {
    const purchases = txns.filter(t => t.type === 'purchase' || t.transaction_type === 'purchase')
    if (!purchases.length) return 0
    const byMonth = {}
    purchases.forEach(t => {
      const d = new Date(t.created_at || t.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const mat = t.materials || t.material || {}
      const cost = Number(mat.unit_cost || t.unit_cost || 0)
      byMonth[key] = (byMonth[key] || 0) + Number(t.quantity || 0) * cost
    })
    const months = Object.keys(byMonth).length || 1
    const total = Object.values(byMonth).reduce((a, b) => a + b, 0)
    return total / months
  }, [txns])

  const summaryCards = [
    { label: 'Total Materials', val: totalMaterials, icon: Package, color: 'var(--accent)' },
    { label: 'Total Stock Value', val: fmtCur(totalStockValue), icon: IndianRupee, color: 'var(--green)' },
    { label: 'Txns This Month', val: txnsThisMonth, icon: ArrowUpDown, color: 'var(--purple)' },
    { label: 'Avg Monthly Spend', val: fmtCur(avgMonthlySpend), icon: TrendingUp, color: 'var(--cyan)' },
  ]

  /* ── 1. Stock Value by Site ───────────────────────── */
  const stockBySite = useMemo(() => {
    const map = {}
    stock.forEach(s => {
      const site = (typeof s.site === 'string' ? s.site : s.site_name || s.site?.name || s.site_id) || 'Unknown'
      const mat = s.materials || s.material || {}
      const cost = Number(mat.unit_cost || s.unit_cost || 0)
      map[site] = (map[site] || 0) + Number(s.quantity || 0) * cost
    })
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }))
  }, [stock])

  /* ── 2. Monthly Spending Trend (last 6 months) ───── */
  const monthlySpend = useMemo(() => {
    const now = new Date()
    const result = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({ month: MONTH_NAMES[d.getMonth()], year: d.getFullYear(), m: d.getMonth(), y: d.getFullYear(), spend: 0 })
    }
    txns.forEach(t => {
      if (t.type !== 'purchase' && t.transaction_type !== 'purchase') return
      const d = new Date(t.created_at || t.date)
      const entry = result.find(r => r.m === d.getMonth() && r.y === d.getFullYear())
      if (!entry) return
      const mat = t.materials || t.material || {}
      const cost = Number(mat.unit_cost || t.unit_cost || 0)
      entry.spend += Number(t.quantity || 0) * cost
    })
    return result.map(r => ({ name: r.month, spend: Math.round(r.spend) }))
  }, [txns])

  /* ── 3. Top 5 Materials by Stock Value ────────────── */
  const topMaterials = useMemo(() => {
    const map = {}
    stock.forEach(s => {
      const mat = s.materials || s.material || {}
      const name = mat.material_name || s.material_name || 'Unknown'
      const cost = Number(mat.unit_cost || s.unit_cost || 0)
      map[name] = (map[name] || 0) + Number(s.quantity || 0) * cost
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [stock])

  /* ── 4. Transaction Type Breakdown ────────────────── */
  const txnBreakdown = useMemo(() => {
    const map = {}
    txns.forEach(t => {
      const type = t.type || t.transaction_type || 'other'
      map[type] = (map[type] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [txns])

  /* ── 5. Site-wise Stock by Category (stacked) ────── */
  const { siteStackedData, categories } = useMemo(() => {
    const siteMap = {}
    const catSet = new Set()
    stock.forEach(s => {
      const site = (typeof s.site === 'string' ? s.site : s.site_name || s.site?.name || s.site_id) || 'Unknown'
      const mat = s.materials || s.material || {}
      const cat = mat.category || 'Uncategorized'
      const cost = Number(mat.unit_cost || s.unit_cost || 0)
      catSet.add(cat)
      if (!siteMap[site]) siteMap[site] = {}
      siteMap[site][cat] = (siteMap[site][cat] || 0) + Number(s.quantity || 0) * cost
    })
    const cats = [...catSet]
    const data = Object.entries(siteMap).map(([site, vals]) => {
      const row = { name: site }
      cats.forEach(c => { row[c] = Math.round(vals[c] || 0) })
      return row
    })
    return { siteStackedData: data, categories: cats }
  }, [stock])

  /* ── Custom Tooltip ──────────────────────────────── */
  const CurrencyTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.15)'
      }}>
        <div style={{ color: 'var(--text-0)', marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color || 'var(--text-1)' }}>
            {p.name}: {fmtCur(p.value)}
          </div>
        ))}
      </div>
    )
  }

  const CountTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.15)'
      }}>
        <div style={{ color: 'var(--text-0)', marginBottom: 4 }}>{label || payload[0]?.name}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color || p.payload?.fill || 'var(--text-1)' }}>
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    )
  }

  const axisStyle = { fill: 'var(--text-2)' }
  const chartH = 220

  return (
    <div style={{ padding:16, display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Summary Cards ──────────────────────────── */}
      <div className="mat-sub-stats" style={{ padding:0 }}>
        {summaryCards.map(s => {
          const accentMap = { 'var(--accent)':'accent', 'var(--green)':'green', 'var(--purple)':'accent', 'var(--cyan)':'cyan' }
          return (
            <div key={s.label} className="mat-sub-stat" data-accent={accentMap[s.color] || 'accent'}>
              <div className="mat-sub-stat-icon" style={{ background: `${s.color}18` }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
              <div style={{ minWidth:0 }}>
                <div className="mat-sub-stat-val" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.val}</div>
                <div className="mat-sub-stat-label">{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Row 1: Stock by Site + Monthly Trend ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }} className="rpt-grid-2">
        <div className="card" style={chartCard}>
          <div style={chartHeader}><BarChart3 size={15} style={{ color:'var(--accent)' }}/> Stock Value by Site</div>
          <div style={chartBody}>
            <ResponsiveContainer width="100%" height={chartH}>
              <BarChart data={stockBySite} margin={{ top:5, right:10, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={axisStyle} interval={0} angle={-20} textAnchor="end" height={40}/>
                <YAxis tick={axisStyle} tickFormatter={v => fmtCur(v)} width={70}/>
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="value" name="Value" radius={[4,4,0,0]}>
                  {stockBySite.map((_,i) => <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={chartCard}>
          <div style={chartHeader}><TrendingUp size={15} style={{ color:'var(--green)' }}/> Monthly Spending</div>
          <div style={chartBody}>
            <ResponsiveContainer width="100%" height={chartH}>
              <AreaChart data={monthlySpend} margin={{ top:5, right:10, left:0, bottom:5 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00b96b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00b96b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={axisStyle}/>
                <YAxis tick={axisStyle} tickFormatter={v => fmtCur(v)} width={70}/>
                <Tooltip content={<CurrencyTooltip />} />
                <Area type="monotone" dataKey="spend" name="Spend" stroke="#00b96b" strokeWidth={2} fill="url(#spendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 2: Top Materials + Txn Breakdown ─── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:14 }} className="rpt-grid-2">
        <div className="card" style={chartCard}>
          <div style={chartHeader}><Layers size={15} style={{ color:'#4f7eff' }}/> Top 5 Materials by Value</div>
          <div style={chartBody}>
            <ResponsiveContainer width="100%" height={chartH}>
              <BarChart data={topMaterials} layout="vertical" margin={{ top:5, right:10, left:0, bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={axisStyle} tickFormatter={v => fmtCur(v)}/>
                <YAxis type="category" dataKey="name" tick={{...axisStyle, width:70}} width={75}/>
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="value" name="Value" fill="#4f7eff" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={chartCard}>
          <div style={chartHeader}><PieIcon size={15} style={{ color:'var(--purple)' }}/> Transaction Types</div>
          <div style={chartBody}>
            <ResponsiveContainer width="100%" height={chartH}>
              <PieChart>
                <Pie data={txnBreakdown} cx="50%" cy="45%" innerRadius={45} outerRadius={75}
                  paddingAngle={3} dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                  >
                  {txnBreakdown.map((entry,i) => <Cell key={i} fill={COLORS[entry.name] || BAR_PALETTE[i % BAR_PALETTE.length]} />)}
                </Pie>
                <Tooltip content={<CountTooltip />} />
                <Legend wrapperStyle={{ }}
                  formatter={val => <span style={{ color:'var(--text-1)' }}>{val}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 3: Full width stacked ──────────────── */}
      <div className="card" style={chartCard}>
        <div style={chartHeader}><BarChart3 size={15} style={{ color:'var(--cyan)' }}/> Site-wise Stock Comparison</div>
        <div style={chartBody}>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={siteStackedData} margin={{ top:5, right:10, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={axisStyle}/>
              <YAxis tick={axisStyle} tickFormatter={v => fmtCur(v)} width={70}/>
              <Tooltip content={<CurrencyTooltip />} />
              <Legend wrapperStyle={{ }}/>
              {categories.map((cat,i) => <Bar key={cat} dataKey={cat} stackId="a" fill={BAR_PALETTE[i % BAR_PALETTE.length]} radius={i===categories.length-1 ? [4,4,0,0] : [0,0,0,0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .rpt-grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}


