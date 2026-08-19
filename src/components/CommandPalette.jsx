import React, { useState, useEffect, useRef } from 'react'
import { Search, Package, MapPin, Ticket, X, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev))
      }
      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        handleSelect(results[selectedIndex])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const fetchResults = async () => {
      setLoading(true)
      try {
        const [assetRes, profileRes, empRes] = await Promise.all([
          supabase.from('assets').select('id, asset_code, asset_name, category, site').or(`asset_code.ilike.%${query}%,asset_name.ilike.%${query}%`).limit(6),
          supabase.from('profiles').select('id, full_name, email, role').or(`full_name.ilike.%${query}%,email.ilike.%${query}%`).limit(4),
          supabase.from('employees').select('id, full_name, employee_code, department').or(`full_name.ilike.%${query}%,employee_code.ilike.%${query}%`).limit(4),
        ])

        const combined = [
          ...(assetRes.data || []).map(a => ({ ...a, type: 'asset', label: `${a.asset_code} — ${a.asset_name}`, path: `/assets/${a.id}` })),
          ...(profileRes.data || []).map(p => ({ ...p, type: 'user', label: `User: ${p.full_name || p.email}`, path: `/admin` })),
          ...(empRes.data || []).map(e => ({ ...e, type: 'employee', label: `Staff: ${e.full_name} (${e.employee_code})`, path: `/admin` })),
        ]

        setResults(combined)
        setSelectedIndex(0)
      } catch (e) {
        console.error('Search error:', e)
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(fetchResults, 250)
    return () => clearTimeout(debounce)
  }, [query])

  const handleSelect = (item) => {
    navigate(item.path || `/assets/${item.id}`)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      zIndex: 99999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '10vh'
    }} onClick={onClose}>
      
      <div style={{
        background: 'var(--bg-0)', width: '100%', maxWidth: 600,
        borderRadius: 16, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        border: '1px solid var(--border)'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <Search size={20} color="var(--text-3)" style={{ marginRight: 12 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search assets by code or name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: '1.1rem', color: 'var(--text-0)', outline: 'none',
              fontFamily: 'DM Sans', fontWeight: 500
            }}
          />
          {loading ? (
            <div style={{ width: 18, height: 18, border: '2px solid var(--text-3)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          ) : (
            <button className="btn-ghost" onClick={onClose} style={{ padding: 4, minHeight: 'unset', border: 'none' }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
          {results.length === 0 && query.trim() && !loading && (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>
              No results found for "{query}"
            </div>
          )}
          
          {results.length === 0 && !query.trim() && (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'DM Sans', fontSize: '0.9rem' }}>
              Start typing to search...
            </div>
          )}

          {results.map((item, i) => (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{
                display: 'flex', alignItems: 'center', padding: '12px 20px',
                background: selectedIndex === i ? 'var(--bg-2)' : 'transparent',
                cursor: 'pointer', transition: 'background 0.1s'
              }}
            >
              <Package size={18} color="var(--accent)" style={{ marginRight: 14 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-0)', fontFamily: 'DM Sans', fontSize: '0.95rem' }}>
                    {item.asset_name || 'Unnamed Asset'}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'DM Mono', color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: 6 }}>
                    {item.asset_code}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.8rem', color: 'var(--text-3)' }}>
                  {item.category && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Ticket size={12} /> {item.category}</span>}
                  {item.site && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {item.site}</span>}
                </div>
              </div>
              <ChevronRight size={16} color={selectedIndex === i ? 'var(--text-1)' : 'transparent'} />
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><kbd style={{ background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 4, fontFamily: 'DM Mono' }}>↑↓</kbd> to navigate</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><kbd style={{ background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 4, fontFamily: 'DM Mono' }}>Enter</kbd> to select</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><kbd style={{ background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 4, fontFamily: 'DM Mono' }}>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  )
}
