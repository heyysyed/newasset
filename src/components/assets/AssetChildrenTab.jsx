import React from 'react'
import { Link } from 'react-router-dom'
import { Link2, GitBranch, X, Plus, Search, Unlink } from 'lucide-react'
import { SectionCard, EmptyState, STATUS_BADGE } from '../../pages/AssetDetail'
import { formatCurrency } from '../../lib/depreciation'

export default function AssetChildrenTab({
  childAssets,
  can,
  showLinkChild,
  setShowLinkChild,
  childSearch,
  setChildSearch,
  setChildSearchResults,
  handleSearchChildren,
  childSearching,
  childSearchResults,
  handleLinkChild,
  handleUnlinkChild
}) {
  const totalChildValue = childAssets.reduce((sum, c) => sum + (Number(c.purchase_value) || 0), 0)
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {childAssets.length > 0 && (
        <div style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', gap: 20 }}>
          <div>
            <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', }}>Total Components</span>
            <div style={{ color: 'var(--text-1)' }}>{childAssets.length}</div>
          </div>
          <div>
            <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', }}>Aggregate Value</span>
            <div style={{ color: 'var(--green)' }}>{formatCurrency(totalChildValue)}</div>
          </div>
        </div>
      )}

      {/* Link Child Asset */}
      {can('edit') && (
        <SectionCard title="Link Child Assets" icon={Link2} accentColor="var(--accent)"
          actions={
            <button onClick={() => { setShowLinkChild(!showLinkChild); setChildSearch(''); setChildSearchResults([]) }}
              className={showLinkChild ? "btn-danger" : "btn-ghost"} style={{ padding: '6px 14px' }}>
              {showLinkChild ? <><X size={12} /> Cancel</> : <><Plus size={12} /> Add Child</>}
            </button>
          }
        >
          {showLinkChild && (
            <div>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                <input
                  type="text" value={childSearch} onChange={e => handleSearchChildren(e.target.value)}
                  placeholder="Search by asset name or code..." className="inp"
                  style={{ paddingLeft: 38, }} autoFocus
                />
              </div>
              {childSearching && <p style={{ color: 'var(--text-3)', marginTop: 10 }}>Searching...</p>}
              {childSearchResults.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {childSearchResults.map(r => (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                      background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'var(--text-0)' }}>{r.asset_name}</div>
                        <div style={{ color: 'var(--text-3)', }}>{r.asset_code} · {r.category} · {r.site || 'No site'}</div>
                      </div>
                      <span className={`badge ${STATUS_BADGE[r.status] || 'badge-inactive'}`} >{r.status}</span>
                      <button onClick={() => handleLinkChild(r.id)} className="btn-primary" style={{ padding: '6px 14px', }}>
                        <Link2 size={12} /> Link
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {childSearch.length >= 2 && !childSearching && childSearchResults.length === 0 && (
                <p style={{ color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>No available assets found matching "{childSearch}"</p>
              )}
            </div>
          )}
          {!showLinkChild && (
            <p style={{ color: 'var(--text-3)', margin: 0, textAlign: 'center' }}>Click "Add Child" to search and link sub-components.</p>
          )}
        </SectionCard>
      )}

      {/* Child Assets List */}
      <SectionCard title={`Child Assets (${childAssets.length})`} icon={GitBranch} accentColor="var(--cyan)">
        {childAssets.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {childAssets.map(c => (
              <div key={c.id} style={{
                padding: '16px', background: 'var(--bg-1)', borderRadius: 14,
                border: '1.5px solid var(--border)', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--cyan), var(--accent))' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <Link to={`/assets/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-0)', marginBottom: 2 }}>{c.asset_name}</div>
                    <div style={{ color: 'var(--accent)', }}>{c.asset_code}</div>
                  </Link>
                  <span className={`badge ${STATUS_BADGE[c.status] || 'badge-inactive'}`} style={{ flexShrink: 0, marginLeft: 8 }}>{c.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: 'var(--text-3)' }}>
                    {c.category}{c.make ? ` · ${c.make}` : ''}{c.model_no ? ` ${c.model_no}` : ''}
                  </div>
                  {can('edit') && (
                    <button onClick={() => handleUnlinkChild(c.id)} title="Remove child" style={{
                      background: 'var(--red-dim)', border: 'none', cursor: 'pointer', color: 'var(--red)',
                      padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, }}>
                      <Unlink size={12} /> Unlink
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={GitBranch}
            title="No child assets linked"
            description="Child assets are sub-components or parts that belong to this asset. Link them to track the full asset hierarchy."
          />
        )}
      </SectionCard>
    </div>
  )
}
