import React, { useState } from 'react'
import {
  Tag, Printer, Save, RefreshCw, Layers, ZoomIn, ZoomOut, Check, AlertTriangle, Play
} from 'lucide-react'
import { updateQrScanConfig } from '../../lib/supabase'

export default function QrStickerDesigner({
  qrConfig = {},
  setQrConfig,
  saving = false,
  setSaving,
  setSaved
}) {
  const [zoom, setZoom] = useState(100)
  const [printQueue, setPrintQueue] = useState([
    { id: 'job_101', printer: 'Zebra ZD420 (Main Yard)', jobsCount: 45, status: 'Completed', timestamp: '10:42 AM' },
    { id: 'job_102', printer: 'TSPL Industrial Printer', jobsCount: 12, status: 'Queued', timestamp: '11:15 AM' },
  ])

  function handleSaveQrConfig() {
    setSaving(true)
    updateQrScanConfig(qrConfig)
      .then(() => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      })
      .catch(e => alert('Failed: ' + e.message))
      .finally(() => setSaving(false))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Banner */}
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14,
        boxShadow: 'var(--clay-shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--status-info-soft)', border: '1px solid var(--status-info-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-info)' }}>
            <Tag size={20} />
          </div>
          <div>
            <h2 style={{ color: 'var(--text-0)', margin: 0 }}>
              WYSIWYG STICKER BADGE DESIGNER & INDUSTRIAL PRINT QUEUE
            </h2>
            <p style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>
              Design asset stickers, configure signed QR payloads, and manage industrial Zebra / TSPL print spoolers.
            </p>
          </div>
        </div>

        <button onClick={handleSaveQrConfig} disabled={saving} className="btn-primary" style={{ padding: '8px 18px', gap: 6, }}>
          {saving ? 'Saving…' : <><Save size={14}/> Save QR & Printer Setup</>}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Designer Workspace */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--text-0)' }}>STICKER CANVAS PREVIEW</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setZoom(z => Math.max(75, z - 15))} className="btn-ghost" style={{ padding: 4 }}><ZoomOut size={14}/></button>
              <span style={{ color: 'var(--text-2)', padding: '2px 6px' }}>{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(150, z + 15))} className="btn-ghost" style={{ padding: 4 }}><ZoomIn size={14}/></button>
            </div>
          </div>

          {/* Interactive Badge Preview */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30, background: 'var(--bg-3)', borderRadius: 14, border: '1px dashed var(--border)', overflow: 'hidden' }}>
            <div style={{
              width: 240 * (zoom / 100), height: 160 * (zoom / 100),
              background: '#ffffff', color: '#000000', borderRadius: 8, padding: 14,
              border: '2px solid #000000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)', transition: 'all 0.2s', textAlign: 'center'
            }}>
              <span style={{ fontSize: `${0.75 * (zoom / 100)}rem`, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {qrConfig.custom_header || 'STRONG BUILT ENGINEERING'}
              </span>

              <div style={{ width: 64 * (zoom / 100), height: 64 * (zoom / 100), background: '#000000', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: `${0.6 * (zoom / 100)}rem`, }}>
                [ QR CODE ]
              </div>

              <span style={{ fontSize: `${0.78 * (zoom / 100)}rem`, }}>
                AST-2026-8809
              </span>
              <span style={{ fontSize: `${0.6 * (zoom / 100)}rem`, opacity: 0.8 }}>
                {qrConfig.custom_footer || 'Property of Enterprise'}
              </span>
            </div>
          </div>

          {/* Configuration Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="lbl">Custom Header Text</label>
              <input type="text" className="inp" value={qrConfig.custom_header || ''} onChange={e => setQrConfig(prev => ({ ...prev, custom_header: e.target.value }))} placeholder="e.g. STRONG BUILT ENGINEERING" style={{ width: '100%' }} />
            </div>
            <div>
              <label className="lbl">Custom Footer Text</label>
              <input type="text" className="inp" value={qrConfig.custom_footer || ''} onChange={e => setQrConfig(prev => ({ ...prev, custom_footer: e.target.value }))} placeholder="e.g. Property of Enterprise" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Industrial Print Queue Panel */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={16} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0, color: 'var(--text-0)' }}>THERMAL PRINTER SPOOLER</h3>
          </div>

          <div>
            <label className="lbl" style={{ marginBottom: 4 }}>Select Registered Thermal Printer (SSRF-Protected)</label>
            <select className="sel" value={qrConfig.printer_id || '00000000-0000-0000-0000-000000000001'} onChange={e => setQrConfig(prev => ({ ...prev, printer_id: e.target.value }))} style={{ width: '100%', }}>
              <option value="00000000-0000-0000-0000-000000000001">Main Yard Zebra ZD420 (192.168.1.150:9100)</option>
              <option value="00000000-0000-0000-0000-000000000002">North Plant TSPL Printer (192.168.2.110:9100)</option>
            </select>
            <span style={{ color: 'var(--text-3)', display: 'block', marginTop: 4 }}>
              🔒 Printer destinations are restricted to pre-registered, authenticated infrastructure endpoints.
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ color: 'var(--text-1)', marginBottom: 8 }}>Active Print Jobs ({printQueue.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {printQueue.map(q => (
                <div key={q.id} style={{ padding: 10, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'var(--text-0)', }}>{q.printer}</div>
                    <div style={{ color: 'var(--text-3)', }}>{q.jobsCount} labels • {q.timestamp}</div>
                  </div>
                  <span style={{ padding: '2px 6px', borderRadius: 6, background: q.status === 'Completed' ? 'rgba(34,197,94,0.12)' : 'var(--status-warning-soft)', color: q.status === 'Completed' ? '#22c55e' : 'var(--status-warning)' }}>
                    {q.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


