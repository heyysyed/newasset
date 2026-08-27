import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode, Search, Wrench, AlertCircle, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function MobileFieldView() {
  const { currentCompany } = useAuth()
  const navigate = useNavigate()
  const [assetCode, setAssetCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!assetCode.trim()) return

    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('assets')
        .select('id, asset_code')
        .eq('asset_code', assetCode.trim().toUpperCase())
        .single()
        
      if (currentCompany?.code) {
        q = q.eq('company_code', currentCompany.code)
      }

      const { data, error: err } = await q

      if (err || !data) {
        throw new Error('Asset not found. Please check the code and try again.')
      }

      // Navigate to maintenance page with a filter for this asset (or to a specific asset detail view)
      // Since we don't have a dedicated single asset view for logged in users yet, 
      // we can redirect them to maintenance with search filled
      navigate(`/maintenance?search=${data.asset_code}`)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto', minHeight: 'calc(100vh - 64px)', background: 'var(--bg-0)' }}>
      <button 
        onClick={() => navigate('/')} 
        className="btn-ghost" 
        style={{ padding: '8px 12px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="card animate-fade-up">
        <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <h1 style={{ margin: 0, color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <QrCode size={20} color="var(--accent)" />
            FIELD TECHNICIAN PORTAL
          </h1>
          <span style={{ color: 'var(--text-2)' }}>Scan or enter asset code to begin work</span>
        </div>
        
        <div className="card-body">
          <div style={{
            background: 'var(--bg-3)',
            border: '2px dashed var(--border)',
            borderRadius: 16,
            height: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 24,
            cursor: 'pointer'
          }} onClick={() => alert('Camera access requires HTTPS and a mobile device. For now, enter the code manually below.')}>
            <div style={{ width: 64, height: 64, background: 'var(--bg-2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--clay-shadow-sm)' }}>
              <QrCode size={32} color="var(--accent)" />
            </div>
            <span style={{ color: 'var(--text-1)', }}>Tap to Scan QR Code</span>
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 24, position: 'relative' }}>
            <span style={{ background: 'var(--bg-2)', padding: '0 10px', position: 'relative', zIndex: 2 }}>OR</span>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'var(--border)', zIndex: 1 }} />
          </div>

          <form onSubmit={handleSearch}>
            <label className="lbl">Asset Code</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                className="inp" 
                placeholder="e.g. AST-1001" 
                value={assetCode} 
                onChange={e => setAssetCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
              />
              <button type="submit" className="btn-primary" disabled={loading || !assetCode.trim()} style={{ padding: '0 20px' }}>
                <Search size={18} />
              </button>
            </div>
            {error && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--status-danger-soft)', color: 'var(--red)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="card animate-fade-up" style={{ marginTop: 16, animationDelay: '100ms' }}>
        <div className="card-body" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wrench size={16} color="var(--amber)" /> Quick Actions
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            <button className="btn-ghost" onClick={() => navigate('/maintenance')} style={{ justifyContent: 'flex-start' }}>View My Assigned Tickets</button>
            <button className="btn-ghost" onClick={() => navigate('/audit')} style={{ justifyContent: 'flex-start' }}>Start New Audit Session</button>
          </div>
        </div>
      </div>
    </div>
  )
}


