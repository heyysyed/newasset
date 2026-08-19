import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Position dropdown using fixed coords — flip upward if near bottom of viewport
  function openDropdown() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const DROPDOWN_HEIGHT = 420
      const DROPDOWN_WIDTH = 320
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < DROPDOWN_HEIGHT + 16

      setDropdownPos({
        top: openUpward ? rect.top - DROPDOWN_HEIGHT - 8 : rect.bottom + 8,
        left: Math.max(8, Math.min(rect.right - DROPDOWN_WIDTH, window.innerWidth - DROPDOWN_WIDTH - 8)),
      })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    function handleOutsideClick(e) {
      const clickedBtn = btnRef.current?.contains(e.target)
      const clickedDropdown = dropdownRef.current?.contains(e.target)
      if (!clickedBtn && !clickedDropdown) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  function handleNotifClick(n) {
    if (!n.is_read) markRead([n.id])
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: 99999,
        width: 320,
        maxHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-0)' }}>
          Notifications{unreadCount > 0 && <span style={{ color: 'var(--accent)', marginLeft: 5 }}>({unreadCount})</span>}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {unreadCount > 0 && (
            <button onClick={() => markRead()} className="btn-ghost" title="Mark all read"
              style={{ padding: '3px 8px', fontSize: '0.65rem', gap: 3, border: 'none', display: 'flex', alignItems: 'center' }}>
              <CheckCheck size={11} /> All read
            </button>
          )}
          <button onClick={() => setOpen(false)} className="btn-ghost" style={{ padding: 4, border: 'none' }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'DM Sans', fontSize: '0.8rem' }}>
            <Bell size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 8px' }} />
            <p style={{ margin: 0 }}>No notifications yet</p>
          </div>
        ) : (
          notifications.slice(0, 30).map(n => (
            <div
              key={n.id}
              onClick={() => handleNotifClick(n)}
              style={{
                display: 'flex', gap: 10, padding: '10px 14px',
                cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: n.is_read ? 'transparent' : 'rgba(79,126,255,0.05)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)' }}
              onMouseLeave={e => { e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(79,126,255,0.05)' }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                background: n.is_read ? 'var(--text-3)' : 'var(--accent)',
                opacity: n.is_read ? 0.3 : 1,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-0)', marginBottom: 2 }}>
                  {n.title}
                </div>
                <div style={{
                  fontFamily: 'DM Sans', fontSize: '0.72rem', color: 'var(--text-2)',
                  marginBottom: 3, lineHeight: 1.4,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {n.body}
                </div>
                <div style={{ fontFamily: 'DM Mono', fontSize: '0.62rem', color: 'var(--text-3)' }}>
                  {n.created_at ? timeAgo(n.created_at) : ''}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div style={{ flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={openDropdown}
        title="Notifications"
        style={{ 
          width: 32, height: 32, borderRadius: 8, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', position: 'relative',
          cursor: 'pointer'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Bell size={18} style={{ color: 'var(--text-2)' }} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#ef4444', color: 'white',
            borderRadius: '50%', width: 14, height: 14,
            fontSize: '0.55rem', fontWeight: 700, fontFamily: 'DM Sans',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, pointerEvents: 'none', border: '1.5px solid var(--bg-1)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {dropdown}
    </div>
  )
}
