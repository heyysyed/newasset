import React, { useState, useMemo } from 'react'
import { Search, HelpCircle, ArrowRight, X } from 'lucide-react'

const BUSINESS_QUESTIONS = [
  { q: 'Which assets are idle?', keywords: ['idle', 'inactive', 'unused', 'sitting'], reportId: 'idle-radar', hint: 'Idle Asset Radar' },
  { q: 'Which assets are at risk?', keywords: ['risk', 'dangerous', 'critical asset'], reportId: 'asset-risk-intelligence', hint: 'Asset Risk Intelligence' },
  { q: 'What maintenance is overdue?', keywords: ['overdue', 'late', 'sla breach'], reportId: 'overdue-wo-detail', hint: 'Overdue Work Orders' },
  { q: 'Which sites have the highest asset value?', keywords: ['site value', 'highest value', 'site comparison'], reportId: 'site-comparison', hint: 'Site Comparison & Benchmarking' },
  { q: 'Which equipment is breaking down repeatedly?', keywords: ['breakdown', 'repeat failure', 'fault'], reportId: 'breakdown-activity', hint: 'Breakdown Activity' },
  { q: 'Which inventory items are running low?', keywords: ['low stock', 'stockout', 'shortage'], reportId: 'inventory-position', hint: 'Inventory Position' },
  { q: 'What are my critical exceptions?', keywords: ['exceptions', 'alerts', 'urgent'], reportId: 'operational-exceptions', hint: 'Operational Exceptions Center' },
  { q: 'What is our PM compliance?', keywords: ['pm', 'preventive', 'pm compliance'], reportId: 'pm-compliance-intelligence', hint: 'Preventive Maintenance Compliance' },
  { q: 'Which assets have poor data quality?', keywords: ['data quality', 'missing data', 'incomplete'], reportId: 'data-quality-intelligence', hint: 'Data Quality Intelligence' },
  { q: 'Where is capital idle?', keywords: ['capital idle', 'idle capital', 'wasted'], reportId: 'idle-radar', hint: 'Idle Asset Radar' },
  { q: 'Which site has the highest maintenance backlog?', keywords: ['site backlog', 'maintenance backlog site'], reportId: 'site-comparison', hint: 'Site Comparison & Benchmarking' },
  { q: 'What assets are due for attention?', keywords: ['attention', 'needs work', 'action required'], reportId: 'asset-risk-intelligence', hint: 'Asset Risk Intelligence' },
  { q: 'What is my total asset value and depreciation?', keywords: ['valuation', 'nbv', 'book value'], reportId: 'asset-current-valuation', hint: 'Total Current Asset Valuation' }
]

export default function BusinessQuestionBar({ onSelectReport, allReports = [] }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const matches = useMemo(() => {
    if (!query || query.length < 2) return []
    const q = query.toLowerCase()

    const results = BUSINESS_QUESTIONS
      .map(bq => {
        // Check question text match
        const questionMatch = bq.q.toLowerCase().includes(q)
        // Check keyword match
        const keywordMatch = bq.keywords.some(k => k.includes(q) || q.includes(k))
        if (!questionMatch && !keywordMatch) return null

        // Try to find the actual report in the registry
        const report = allReports.find(r => r.id === bq.reportId)
        return { ...bq, report, score: questionMatch ? 2 : 1 }
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    return results
  }, [query, allReports])

  const handleSelect = (item) => {
    if (item.report) {
      onSelectReport(item.report)
      setQuery('')
      setFocused(false)
    }
  }

  if (dismissed) return null

  return (
    <div style={{ position: 'relative', zIndex: 20 }}>
      {/* Question Bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(139,92,246,0.04))',
        border: focused ? '1px solid rgba(14,165,233,0.5)' : '1px solid var(--border)',
        borderRadius: 14,
        padding: '3px 3px 3px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transition: 'all 0.2s',
        boxShadow: focused ? '0 0 0 3px rgba(14,165,233,0.1)' : 'none'
      }}>
        <HelpCircle size={18} style={{ color: 'var(--status-special)', flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="What do you want to know? e.g. 'Which assets are at risk?' or 'Where are stockouts?'"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-0)',
            padding: '10px 0',
          }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{ padding: 8, color: 'var(--text-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        )}
        <button onClick={() => setDismissed(true)} style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--bg-3)', border: 'none', color: 'var(--text-3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Dismiss
        </button>
      </div>

      {/* Quick Suggestion Pills - show when not typing */}
      {!query && !focused && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {BUSINESS_QUESTIONS.slice(0, 6).map((bq, i) => (
            <button
              key={i}
              onClick={() => setQuery(bq.q)}
              style={{
                padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)',
                background: 'var(--bg-2)', color: 'var(--text-2)',
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--status-special)'; e.currentTarget.style.color = 'var(--status-special)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
            >
              {bq.q.length > 40 ? bq.q.slice(0, 40) + '…' : bq.q}
            </button>
          ))}
        </div>
      )}

      {/* Results Dropdown */}
      {focused && query.length >= 2 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          zIndex: 100
        }}>
          {matches.length === 0 ? (
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)' }}>
              <Search size={16} />
              <span >No matching intelligence module found for "{query}"</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 16px 4px', color: 'var(--text-3)', letterSpacing: '0.06em' }}>
                INTELLIGENCE MODULES FOUND
              </div>
              {matches.map((item, i) => (
                <button
                  key={i}
                  onMouseDown={() => handleSelect(item)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    cursor: item.report ? 'pointer' : 'default',
                    textAlign: 'left',
                    gap: 12,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ color: 'var(--text-0)', marginBottom: 2 }}>{item.q}</div>
                    <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ArrowRight size={11} /> {item.hint}
                      {!item.report && <span style={{ color: 'var(--status-warning)', marginLeft: 6 }}>(module not found in registry)</span>}
                    </div>
                  </div>
                  {item.report && (
                    <div style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--accent-glow)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      Open →
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


