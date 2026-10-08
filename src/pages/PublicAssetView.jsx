import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  MapPin, Calendar, Package, AlertTriangle,
  Tag, Layers, Hash, Wrench, FileText,
  CheckCircle2, XCircle, Clock, Hammer, Truck,
} from 'lucide-react'
import { fetchPublicAsset } from '../lib/supabase'
import companyLogo from '../assets/logo.png'

const STATUS_CONFIG = {
  'Active':       { bg: 'rgba(0,185,107,0.1)',  color: '#00b96b', border: 'rgba(0,185,107,0.25)',  icon: CheckCircle2 },
  'Inactive':     { bg: 'rgba(107,125,153,0.1)', color: '#6b7a99', border: 'rgba(107,125,153,0.25)', icon: XCircle },
  'Under Repair': { bg: 'var(--status-warning-soft)',  color: 'var(--status-warning)', border: 'var(--status-warning-soft)', icon: Wrench },
  'Disposed':     { bg: 'var(--status-danger-soft)',   color: 'var(--status-danger)', border: 'var(--status-danger-soft)',  icon: XCircle },
  'On Hire':      { bg: 'rgba(6,182,212,0.1)',   color: '#06b6d4', border: 'rgba(6,182,212,0.25)',  icon: Truck },
}

const FIELD_ICON = {
  make:              Hammer,
  model_no:          Tag,
  serial_no:         Hash,
  capacity:          Layers,
  purchase_order_no: FileText,
  type_code:         Tag,
  purchase_date:     Calendar,
  site:              MapPin,
  category:          Layers,
}

export default function PublicAssetView() {
  const { id } = useParams()
  const [asset,    setAsset]    = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [locationCaptured, setLocationCaptured] = useState(false)
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    fetchPublicAsset(id)
      .then(a => {
        if (cancelled) return
        if (!a) { setError(true); setLoading(false); return }
        setAsset(a)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [id])


  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-3)', }}>Loading asset…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'var(--bg-2)', borderRadius: 20, padding: '40px 32px', boxShadow: 'var(--clay-shadow)', border: '1px solid var(--border)', maxWidth: 340 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--red-dim)', border: '1px solid var(--status-danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertTriangle size={26} style={{ color: 'var(--red)' }} />
        </div>
        <h2 style={{ color: 'var(--text-0)', marginBottom: 8, letterSpacing: '0.04em' }}>Asset Not Found</h2>
        <p style={{ color: 'var(--text-2)', }}>
          This QR code may be invalid or the asset has been removed from the system.
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const hidden = settings?.hidden_fields || []
  const userPerms = settings?.user_permissions || {}
  const userVisibleFields = userPerms.visible_fields || []

  function shouldShow(key) {
    if (hidden.includes(key)) return false
    if (userVisibleFields.length > 0 && !userVisibleFields.includes(key)) return false
    return true
  }

  const sc = STATUS_CONFIG[asset.status] || STATUS_CONFIG['Inactive']
  const StatusIcon = sc.icon

  const allFields = [
    { key: 'make',              label: 'Make' },
    { key: 'model_no',          label: 'Model No' },
    { key: 'serial_no',         label: 'Serial No' },
    { key: 'capacity',          label: 'Capacity' },
    { key: 'purchase_order_no', label: 'Purchase Order' },
    { key: 'type_code',         label: 'Type Code' },
    { key: 'purchase_date',     label: 'Purchase Date' },
    { key: 'category',          label: 'Category' },
    { key: 'site',              label: 'Location' },
  ]

  const visibleFields = allFields.filter(f => shouldShow(f.key) && asset[f.key])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 40px', }}>

      {/* ── Top bar ── */}
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <img src={companyLogo} alt="Company" style={{ height: 44, maxWidth: 160, objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: 'var(--clay-shadow-sm)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ color: 'var(--text-2)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Live</span>
        </div>
      </div>

      {/* ── Hero card ── */}
      <div style={{ width: '100%', maxWidth: 460, background: 'var(--bg-2)', borderRadius: 22, border: '1px solid var(--border)', boxShadow: 'var(--clay-shadow)', overflow: 'hidden', animation: 'fadeUp 0.35s ease both' }}>

        {/* Accent top strip */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, var(--accent), #6b96ff, var(--cyan))' }} />

        {/* Header */}
        <div style={{ padding: '22px 22px 18px' }}>
          {/* Asset code */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'var(--accent-glow)', border: '1px solid var(--accent-soft)', borderRadius: 8, marginBottom: 12 }}>
            <Package size={11} style={{ color: 'var(--accent)' }} />
            <span style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}>
              {asset.asset_code}
            </span>
          </div>

          {/* Asset name */}
          {shouldShow('asset_name') && (
            <h1 style={{ color: 'var(--text-0)', letterSpacing: '0.03em', marginBottom: 14, }}>
              {asset.asset_name}
            </h1>
          )}

          {/* Status + site pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, }}>
              <StatusIcon size={12} /> {asset.status}
            </span>
            {shouldShow('category') && asset.category && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)', }}>
                <Layers size={11} /> {asset.category}
              </span>
            )}
            {shouldShow('site') && asset.site && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.25)', }}>
                <MapPin size={11} /> {asset.site}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '0 22px' }} />

        {/* Fields grid */}
        {visibleFields.filter(f => f.key !== 'site' && f.key !== 'category').length > 0 && (
          <div style={{ padding: '6px 22px 10px' }}>
            {visibleFields.filter(f => f.key !== 'site' && f.key !== 'category').map((f, i, arr) => {
              const FieldIcon = FIELD_ICON[f.key] || Tag
              const isMono = ['model_no', 'serial_no', 'purchase_order_no', 'type_code'].includes(f.key)
              const value = f.key === 'purchase_date' && asset[f.key]
                ? new Date(asset[f.key]).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : asset[f.key]
              return (
                <div key={f.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '11px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FieldIcon size={13} style={{ color: 'var(--text-3)' }} />
                    </div>
                    <span style={{ letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', }}>{f.label}</span>
                  </div>
                  <span style={{
                    fontFamily: isMono ? 'DM Mono' : 'DM Sans',
                    color: 'var(--text-0)',
                    textAlign: 'right', wordBreak: 'break-word',
                  }}>
                    {value}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Notes */}
        {shouldShow('notes') && asset.notes && (
          <div style={{ margin: '0 22px 18px', padding: '13px 15px', background: 'var(--bg-3)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <p style={{ letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6, }}>Notes</p>
            <p style={{ color: 'var(--text-1)', margin: 0 }}>{asset.notes}</p>
          </div>
        )}

        <p style={{ margin: '0 22px 18px' }}>For asset details and location updates, <a href="/#/login">sign in</a>.</p>

        {/* Footer */}
        <div style={{ padding: '12px 22px', background: 'var(--bg-3)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={12} style={{ color: 'var(--text-3)' }} />
            <span style={{ color: 'var(--text-3)' }}>
              Added {asset.added_on
                ? new Date(asset.added_on).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : '-'}
            </span>
          </div>
          <span style={{ color: 'var(--text-3)', background: 'var(--bg-4)', padding: '2px 7px', borderRadius: 6, border: '1px solid var(--border)' }}>
            QR Scan
          </span>
        </div>
      </div>

      {/* ── Scan label ── */}
      <p style={{ marginTop: 20, color: 'var(--text-3)', textAlign: 'center' }}>
        Scanned via QR code · Asset Management System
      </p>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}


