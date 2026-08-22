import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, fetchMyNotifications, markNotificationsRead } from '../lib/supabase'
import { useAuth } from './AuthContext'

const NotifCtx = createContext(null)
export const useNotifications = () => useContext(NotifCtx)

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])

  async function load() {
    if (!user?.id) return
    try {
      const data = await fetchMyNotifications(user.id)
      setNotifications(data)
    } catch (e) {
      console.error('Notification load failed', e)
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      return
    }
    load()

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function markRead(ids = null) {
    if (!user?.id) return
    try {
      await markNotificationsRead(user.id, ids)
      setNotifications(prev =>
        prev.map(n => (!ids || ids.includes(n.id)) ? { ...n, is_read: true } : n)
      )
    } catch (e) {
      console.error('Mark read failed', e)
    }
  }

  return (
    <NotifCtx.Provider value={{ notifications, unreadCount, markRead, refresh: load }}>
      {children}
    </NotifCtx.Provider>
  )
}
