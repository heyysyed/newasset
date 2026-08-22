import React, { createContext, useContext, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { bulkInsertAssets } from '../lib/supabase'

const ImportCtx = createContext(null)
export const useImport = () => useContext(ImportCtx)

export function ImportProvider({ children }) {
  const queryClient = useQueryClient()
  const [status,   setStatus]   = useState('idle') // 'idle' | 'running' | 'done' | 'error'
  const [progress, setProgress] = useState(0)
  const [result,   setResult]   = useState(null)   // { count } | { error }
  const [total,    setTotal]    = useState(0)

  async function startImport(rows) {
    if (status === 'running') return
    if (!rows.length) return
    setStatus('running')
    setProgress(0)
    setResult(null)
    setTotal(rows.length)

    try {
      const CHUNK  = 500
      const chunks = []
      for (let i = 0; i < rows.length; i += CHUNK) chunks.push(rows.slice(i, i + CHUNK))

      let done = 0
      for (const chunk of chunks) {
        await bulkInsertAssets(chunk)
        done += chunk.length
        setProgress(Math.round((done / rows.length) * 100))
      }

      setStatus('done')
      setResult({ count: rows.length })

      // Invalidate queries so that AssetList and Dashboard fetch fresh data
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['filterOptions'] })
    } catch (err) {
      console.error('Import failed:', err)
      setStatus('error')
      setResult({ error: err.message })
      alert('Import failed: ' + err.message)
    }
  }

  function dismiss() {
    setStatus('idle')
    setResult(null)
    setProgress(0)
    setTotal(0)
  }

  return (
    <ImportCtx.Provider value={{ status, progress, result, total, startImport, dismiss }}>
      {children}
    </ImportCtx.Provider>
  )
}
