import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { readOfflineQueue } from '../lib/offlineQueue'
import { syncOfflineActionsQueue } from '../lib/supabase'

export default function ConnectionStatus() {
  const { user } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  function refresh() {
    if (!user) { setPending(0); return }
    try { setPending(readOfflineQueue(localStorage,user.id).length) } catch (err) { setError(err.message) }
  }
  useEffect(() => {
    setError(''); refresh()
    const update = () => { setOnline(navigator.onLine); refresh() }
    window.addEventListener('online',update);window.addEventListener('offline',update);window.addEventListener('storage',update)
    const timer=setInterval(refresh,5000)
    return () => { clearInterval(timer);window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener('storage',update) }
  },[user?.id])
  if (online && !pending && !error) return null
  return <aside role="status" style={{padding:12,background:'var(--bg-2)',borderBottom:'1px solid var(--border)'}}>
    {!online && <span>You’re offline. Reconnect before saving changes. </span>}
    {pending > 0 && <span>{pending} saved audit action(s) await synchronization. </span>}
    {error && <span role="alert">{error} </span>}
    {pending > 0 && <button className="btn-primary" disabled={!online || syncing} onClick={async()=>{
      setSyncing(true);setError('')
      try { await syncOfflineActionsQueue(user.id) } catch(err) { setError(err.message) }
      finally { setSyncing(false);refresh() }
    }}>{syncing ? 'Syncing…' : 'Sync pending work'}</button>}
  </aside>
}
