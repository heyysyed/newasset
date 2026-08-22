import React from 'react'
import { Archive, AlertCircle, IndianRupee, Layers, Package } from 'lucide-react'
import { formatCurrency } from '../../lib/depreciation'

export default function InventoryStats({ items, transactions, assets = [] }) {
  const totalValue = items.reduce((acc, i) => acc + (Number(i.unit_cost || 0) * Number(i.current_stock || 0)), 0)
  const assetValue = assets.reduce((acc, a) => acc + Number(a.purchase_value || 0), 0)
  const lowStockCount = items.filter(i => Number(i.current_stock) <= Number(i.reorder_level)).length

  const stats = [
    { label: 'Inventory Items', val: items.length, icon: Archive, color: 'var(--text-1)' },
    { label: 'Total Assets', val: assets.length, icon: Package, color: 'var(--accent)' },
    { label: 'Low Stock', val: lowStockCount, icon: AlertCircle, color: 'var(--red)' },
    { label: 'Total Value', val: formatCurrency(totalValue + assetValue), icon: IndianRupee, color: 'var(--green)' },
  ]

  return (
    <div className="inv-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
      {stats.map(s => (
        <div key={s.label} className="card inv-stat-card" style={{ padding: '14px 10px', textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, margin: '0 auto 8px',
            background: 'var(--bg-3)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: s.color
          }}>
            <s.icon size={18} />
          </div>
          <div style={{ color: 'var(--text-0)', letterSpacing: '0.02em', }}>
            {s.val}
          </div>
          <div className="lbl" style={{ marginTop: 4, }}>{s.label}</div>
        </div>
      ))}
      <style>{`
        @media (max-width: 600px) {
          .inv-stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .inv-stat-card { padding: 12px 8px !important; }
          .inv-stat-card .lbl { font-size: 0.58rem !important; }
        }
      `}</style>
    </div>
  )
}
