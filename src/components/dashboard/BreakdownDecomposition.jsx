import React, { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Wrench, Building2, Layers, AlertCircle } from 'lucide-react'
import { formatCurrency } from '../../lib/depreciation'

export default function BreakdownDecomposition({ maintLogs = [], onSelectFilter }) {
  const [expandedSite, setExpandedSite] = useState(null)
  const [expandedCategory, setExpandedCategory] = useState(null)

  const totalCost = useMemo(() => {
    return maintLogs.reduce((acc, log) => acc + Number(log.cost || 0), 0)
  }, [maintLogs])

  const siteTree = useMemo(() => {
    const map = {}
    maintLogs.forEach(log => {
      const siteName = log.assets?.site || 'Unassigned Site'
      const catName = log.assets?.category || 'General Equipment'
      const assetCode = log.assets?.asset_code || log.asset_id || 'Unknown Asset'
      const cost = Number(log.cost || 0)

      if (!map[siteName]) map[siteName] = { site: siteName, cost: 0, categories: {} }
      map[siteName].cost += cost

      if (!map[siteName].categories[catName]) {
        map[siteName].categories[catName] = { category: catName, cost: 0, assets: {} }
      }
      map[siteName].categories[catName].cost += cost

      if (!map[siteName].categories[catName].assets[assetCode]) {
        map[siteName].categories[catName].assets[assetCode] = { code: assetCode, cost: 0, count: 0 }
      }
      map[siteName].categories[catName].assets[assetCode].cost += cost
      map[siteName].categories[catName].assets[assetCode].count += 1
    })

    return Object.values(map).sort((a, b) => b.cost - a.cost)
  }, [maintLogs])

  return (
    <div className="card" style={{ padding: 20, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Repair Spend Decomposition Tree
          </h3>
          <p style={{ margin: 0, color: 'var(--text-2)' }}>Interactive drill-down: Site → Category → Asset</p>
        </div>
        <span style={{ color: 'var(--accent)', background: 'rgba(37,99,235,0.08)', padding: '4px 10px', borderRadius: 20 }}>
          Total: {formatCurrency(totalCost)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
        {siteTree.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No repair log data recorded.</div>
        )}
        {siteTree.map(s => {
          const sitePct = totalCost > 0 ? (s.cost / totalCost) * 100 : 0
          const isSiteOpen = expandedSite === s.site

          return (
            <div key={s.site} style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
              <div 
                onClick={() => setExpandedSite(isSiteOpen ? null : s.site)}
                style={{ 
                  padding: '10px 14px', 
                  background: isSiteOpen ? '#f8fafc' : '#ffffff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justify: 'space-between', 
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isSiteOpen ? <ChevronDown size={15} color='var(--accent)' /> : <ChevronRight size={15} color="#64748b" />}
                  <Building2 size={15} color='var(--accent)' />
                  <span style={{ color: 'var(--text-1)' }}>{s.site}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 80, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, sitePct)}%`, background: 'var(--accent)' }} />
                  </div>
                  <span style={{ color: 'var(--text-1)' }}>
                    {formatCurrency(s.cost)} <span style={{ color: 'var(--text-2)', }}>({Math.round(sitePct)}%)</span>
                  </span>
                </div>
              </div>

              {isSiteOpen && (
                <div style={{ paddingLeft: 24, paddingRight: 14, paddingBottom: 10, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #f1f5f9' }}>
                  {Object.values(s.categories).map(cat => {
                    const isCatOpen = expandedCategory === `${s.site}_${cat.category}`
                    return (
                      <div key={cat.category} style={{ borderLeft: '2px solid #cbd5e1', paddingLeft: 10, marginTop: 6 }}>
                        <div 
                          onClick={() => setExpandedCategory(isCatOpen ? null : `${s.site}_${cat.category}`)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Layers size={13} color="#64748b" />
                            <span style={{ color: '#334155' }}>{cat.category}</span>
                          </div>
                          <span style={{ color: '#475569' }}>{formatCurrency(cat.cost)}</span>
                        </div>

                        {isCatOpen && (
                          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 12 }}>
                            {Object.values(cat.assets).map(ast => (
                              <div key={ast.code} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)' }}>
                                <span>• {ast.code}</span>
                                <span style={{ color: 'var(--text-1)' }}>{formatCurrency(ast.cost)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


