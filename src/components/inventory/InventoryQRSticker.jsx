import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { Printer, X } from 'lucide-react'
import defaultLogo from '../../assets/logo.png'

export default function InventoryQRSticker({ item }) {
  const [qrOpen, setQrOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    if (!item?.item_code) return
    const url = `${window.location.origin}/#/inventory?item=${item.item_code}`
    QRCode.toDataURL(url, { width: 300, margin: 1, color: { dark: '#000000', light: '#ffffff' } }, (err, dataUrl) => {
      if (!err) setQrUrl(dataUrl)
    })
  }, [item?.item_code])

  function handlePrint() {
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Sticker - ${item.item_code}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&family=DM+Mono:wght@400;500&family=Inter:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f2f5;font-family:var(--font-sans)}
.sticker{width:396px;height:280px;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #ddd;display:flex;flex-direction:column}
.header{background:#1e3a8a;padding:8px 14px;display:flex;align-items:center;justify-content:space-between}
.header img{height:32px;filter:brightness(0) invert(1)}
.header .code{font-family:var(--font-mono);font-size:14px;font-weight:700;color:#fff;letter-spacing:0.05em}
.body{flex:1;display:flex;padding:12px 14px;gap:12px}
.qr-col{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0}
.qr-col img{width:110px;height:110px;border:1px solid #e5e7eb;border-radius:4px}
.qr-col .qr-code{font-family:var(--font-mono);font-size:8px;color:#1e3a8a;text-align:center;max-width:110px;word-break:break-all}
.fields{flex:1;display:flex;flex-direction:column;gap:3px;justify-content:center}
.field .lbl{font-size:7px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;font-weight:600}
.field .val{font-size:11px;color:#111827;font-weight:600}
.dnr{font-size:11px;color:#dc2626;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px}
.footer{background:#1e3a8a;padding:5px 14px;text-align:center;font-size:7px;color:#fff;font-weight:600;text-transform:uppercase;letter-spacing:0.1em}
@media print{body{background:none}.sticker{border:none;box-shadow:none}}
</style></head><body onload="setTimeout(()=>window.print(),300)">
<div class="sticker">
  <div class="header">
    <img src="${defaultLogo}" alt="Logo"/>
    <div class="code">${item.item_code || ''}</div>
  </div>
  <div class="body">
    <div class="qr-col">
      <img src="${qrUrl}" alt="QR"/>
      <div class="qr-code">${item.item_code || ''}</div>
    </div>
    <div class="fields">
      <div class="field"><div class="lbl">Item Name</div><div class="val">${item.item_name || ''}</div></div>
      <div class="field"><div class="lbl">Category</div><div class="val">${item.category || '-'}</div></div>
      <div class="field"><div class="lbl">Location</div><div class="val">${item.location || '-'}${item.location_bin ? ' / ' + item.location_bin : ''}</div></div>
      <div class="field"><div class="lbl">Unit</div><div class="val">${item.unit || 'pcs'}</div></div>
      <div class="dnr">DO NOT REMOVE</div>
    </div>
  </div>
  <div class="footer">PROPERTY OF STRONGBUILT</div>
</div>
</body></html>`)
    w.document.close()
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setQrOpen(true)} style={{ padding: '4px 8px' }} title="Print Sticker">
        <Printer size={14} />
      </button>

      {qrOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setQrOpen(false)}>
          <div className="card" style={{ maxWidth: 420, width: '100%', padding: 0, overflow: 'hidden', animation: 'modalSlideUp 0.3s ease' }}
            onClick={e => e.stopPropagation()}>
            {/* Preview */}
            <div style={{ background: '#f0f2f5', padding: 20, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 340, background: '#fff', borderRadius: 6, overflow: 'hidden', border: '1px solid #ddd', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                {/* Header */}
                <div style={{ background: '#1e3a8a', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <img src={defaultLogo} alt="Logo" style={{ height: 26, filter: 'brightness(0) invert(1)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: '#fff' }}>{item.item_code}</span>
                </div>
                {/* Body */}
                <div style={{ display: 'flex', padding: '10px 12px', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    {qrUrl && <img src={qrUrl} alt="QR" style={{ width: 90, height: 90, borderRadius: 4, border: '1px solid #e5e7eb' }} />}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: '#1e3a8a', textAlign: 'center', maxWidth: 90, wordBreak: 'break-all' }}>{item.item_code}</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center' }}>
                    {[
                      { l: 'Item Name', v: item.item_name },
                      { l: 'Category', v: item.category },
                      { l: 'Location', v: `${item.location || '-'}${item.location_bin ? ' / ' + item.location_bin : ''}` },
                      { l: 'Unit', v: item.unit },
                    ].map(f => (
                      <div key={f.l}>
                        <div style={{ fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 600 }}>{f.l}</div>
                        <div style={{ fontSize: '0.72rem', color: '#111827', fontWeight: 600 }}>{f.v || '-'}</div>
                      </div>
                    ))}
                    <div style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>DO NOT REMOVE</div>
                  </div>
                </div>
                {/* Footer */}
                <div style={{ background: '#1e3a8a', padding: '4px 12px', textAlign: 'center', fontSize: '0.48rem', color: '#fff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  PROPERTY OF STRONGBUILT
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: '14px 20px', display: 'flex', gap: 10, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setQrOpen(false)} className="btn-ghost" style={{ flex: 1 }}>Close</button>
              <button onClick={handlePrint} className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Printer size={15} /> Print Sticker
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


