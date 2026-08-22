import React, { useState } from 'react'
import {
  Hash, EyeOff, Eye, Plus, Database, Trash2, Save
} from 'lucide-react'
import { updateQrScanConfig } from '../../lib/supabase'
import { DEFAULT_FIELDS } from '../../context/AuthContext'

function SectionHead({ icon: Icon, title, sub, color = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} style={{ color }}/>
      </div>
      <div>
        <h2 style={{ letterSpacing: '0.06em', color: 'var(--text-0)', margin: 0 }}>{title}</h2>
        {sub && <p style={{ color: 'var(--text-3)', margin: 0, marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
      transition: 'background 0.2s', position: 'relative', flexShrink: 0,
      background: on ? 'var(--accent)' : 'var(--bg-4)',
      boxShadow: on ? '0 0 10px var(--accent)40' : 'none',
    }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', position: 'absolute', top: 4, left: on ? 24 : 4, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}/>
    </button>
  )
}

export default function SettingsManager({
  tab,
  settings,
  setSettings,
  qrConfig,
  setQrConfig,
  isSuperAdmin,
  saving,
  setSaving,
  setSaved
}) {
  const [newField, setNewField] = useState({ label: '', key: '', type: 'text', options: '' })

  // Field visibility helpers
  function isFieldHidden(key) { return (settings?.hidden_fields || []).includes(key) }
  function toggleHideField(key) {
    setSettings(s => {
      const hidden = s?.hidden_fields || []
      return { ...s, hidden_fields: hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key] }
    })
  }

  function isUserVisible(key) {
    const uvf = settings?.user_permissions?.visible_fields || []
    return uvf.length === 0 || uvf.includes(key)
  }
  function toggleUserVisible(key) {
    setSettings(s => {
      const uvf = s?.user_permissions?.visible_fields || []
      const allKeys = DEFAULT_FIELDS.map(f => f.key)
      const current = uvf.length === 0 ? allKeys : uvf
      const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key]
      const store = next.length === allKeys.length ? [] : next
      return { ...s, user_permissions: { ...(s?.user_permissions || {}), visible_fields: store } }
    })
  }

  // Custom fields helpers
  function addCustomField() {
    if (!newField.label.trim()) return
    const key  = newField.key.trim() || newField.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const opts = newField.options ? newField.options.split(',').map(o => o.trim()).filter(Boolean) : undefined
    const field = { label: newField.label, key: `cf_${key}`, type: newField.type, ...(opts ? { options: opts } : {}) }
    setSettings(s => ({ ...s, custom_fields: [...(s?.custom_fields || []), field] }))
    setNewField({ label: '', key: '', type: 'text', options: '' })
  }

  function removeCustomField(key) {
    setSettings(s => ({ ...s, custom_fields: (s?.custom_fields || []).filter(f => f.key !== key) }))
  }

  if (tab === 'fields') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Company Code - full-width */}
        <div style={{ gridColumn: '1 / -1', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
          <SectionHead icon={Hash} title="ASSET CODE FORMAT" sub="Company prefix used in auto-generated asset codes - format: CODE/CATEGORY/NAME/001" color="var(--accent)"/>
          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, maxWidth: 240 }}>
              <label style={{ color: 'var(--text-3)', display: 'block', marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Company Code</label>
              <input
                value={settings?.company_code || ''}
                onChange={e => setSettings(s => ({ ...s, company_code: e.target.value.toUpperCase().replace(/[^A-Z0-9&]/g, '') }))}
                placeholder="e.g. SBC"
                maxLength={8}
                style={{ color: 'var(--text-0)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', width: '100%', outline: 'none', letterSpacing: '0.1em' }}
              />
            </div>
            <div style={{ color: 'var(--text-3)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', marginTop: 20 }}>
              Preview: <span style={{ color: 'var(--accent)', }}>{settings?.company_code || 'SBC'}/P&M/BBM/001</span>
            </div>
          </div>
        </div>

        {/* Global hidden fields */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
          <SectionHead icon={EyeOff} title="GLOBAL VISIBILITY" sub="Hidden from mods & users (admin always sees all)" color="#f87171"/>
          <div style={{ padding: '0' }}>
            {DEFAULT_FIELDS.filter(f => !f.readOnly).map((f, i, arr) => {
              const hidden = isFieldHidden(f.key)
              return (
                <div key={f.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  background: hidden ? 'var(--status-danger-soft)' : 'transparent',
                }}>
                  <div>
                    <p style={{ color: hidden ? 'var(--text-3)' : 'var(--text-0)', margin: 0, textDecoration: hidden ? 'line-through' : 'none' }}>{f.label}</p>
                    <p style={{ color: 'var(--text-3)', margin: 0, marginTop: 1 }}>{f.key}</p>
                  </div>
                  <button onClick={() => toggleHideField(f.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                    borderRadius: 7, border: '1px solid', cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: hidden ? 'var(--status-danger-soft)' : 'rgba(34,197,94,0.08)',
                    color: hidden ? 'var(--red)' : 'var(--green)',
                    borderColor: hidden ? 'var(--status-danger-soft)' : 'rgba(34,197,94,0.25)',
                  }}>
                    {hidden ? <><EyeOff size={11}/> Hidden</> : <><Eye size={11}/> Visible</>}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* QR scan visibility */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
          <SectionHead icon={Eye} title="QR SCAN FIELDS" sub="Fields shown when a user scans an asset QR code" color="#34d399"/>
          <div>
            {DEFAULT_FIELDS.filter(f => !f.readOnly && !['asset_code', 'asset_name', 'status'].includes(f.key)).map((f, i, arr) => {
              const visible = isUserVisible(f.key)
              return (
                <div key={f.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  background: !visible ? 'var(--status-danger-soft)' : 'transparent',
                }}>
                  <p style={{ color: visible ? 'var(--text-0)' : 'var(--text-3)', margin: 0, textDecoration: !visible ? 'line-through' : 'none' }}>{f.label}</p>
                  <button onClick={() => toggleUserVisible(f.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                    borderRadius: 7, border: '1px solid', cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: visible ? 'rgba(34,197,94,0.08)' : 'var(--status-danger-soft)',
                    color: visible ? 'var(--green)' : 'var(--red)',
                    borderColor: visible ? 'rgba(34,197,94,0.25)' : 'var(--status-danger-soft)',
                  }}>
                    {visible ? <><Eye size={11}/> Shown</> : <><EyeOff size={11}/> Hidden</>}
                  </button>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '10px 18px', background: 'var(--bg-3)', borderTop: '1px solid var(--border)' }}>
            <p style={{ color: 'var(--text-3)', margin: 0 }}>
              Asset Code, Name and Status are always shown on scan pages.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (tab === 'custom') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Add new field card */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
          <SectionHead icon={Plus} title="ADD CUSTOM FIELD" sub="Extend all assets with an extra field" color="#34d399"/>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div>
                <label className="lbl">Field Label *</label>
                <input value={newField.label} onChange={e => setNewField(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Condition" className="inp" onKeyDown={e => e.key === 'Enter' && addCustomField()}/>
              </div>
              <div>
                <label className="lbl">Key (auto-generated)</label>
                <input value={newField.key} onChange={e => setNewField(f => ({ ...f, key: e.target.value }))}
                  placeholder="leave blank to auto-fill" className="inp"/>
              </div>
              <div>
                <label className="lbl">Field Type</label>
                <select value={newField.type} onChange={e => setNewField(f => ({ ...f, type: e.target.value }))} className="sel">
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown</option>
                </select>
              </div>
              {newField.type === 'select' && (
                <div>
                  <label className="lbl">Options (comma-separated)</label>
                  <input value={newField.options} onChange={e => setNewField(f => ({ ...f, options: e.target.value }))}
                    placeholder="Good, Fair, Poor" className="inp"/>
                </div>
              )}
            </div>
            <button onClick={addCustomField} disabled={!newField.label.trim()} className="btn-primary" style={{ gap: 7 }}>
              <Plus size={14}/> Add Field
            </button>
          </div>
        </div>

        {/* Existing custom fields */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
          <SectionHead icon={Database} title="EXISTING CUSTOM FIELDS" sub={`${(settings?.custom_fields || []).length} field${(settings?.custom_fields || []).length !== 1 ? 's' : ''} defined`} color='var(--status-info)'/>
          {(settings?.custom_fields || []).length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <Database size={32} style={{ color: 'var(--text-3)', marginBottom: 12 }}/>
              <p style={{ color: 'var(--text-2)', marginBottom: 4 }}>No custom fields yet</p>
              <p style={{ color: 'var(--text-3)', }}>Add one above to extend all assets</p>
            </div>
          ) : (
            <div>
              {(settings?.custom_fields || []).map((f, i, arr) => (
                <div key={f.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid var(--accent)20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Database size={14} style={{ color: 'var(--accent)' }}/>
                    </div>
                    <div>
                      <p style={{ color: 'var(--text-0)', margin: 0, marginBottom: 3 }}>{f.label}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--accent-light)', background: 'var(--accent-glow)', padding: '1px 6px', borderRadius: 4 }}>{f.key}</span>
                        <span style={{ color: 'var(--text-3)', background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>{f.type}</span>
                        {f.options && f.options.map(o => (
                          <span key={o} style={{ color: 'var(--text-3)', background: 'var(--bg-4)', padding: '1px 6px', borderRadius: 4 }}>{o}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeCustomField(f.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                    borderRadius: 8, border: '1px solid var(--status-danger-soft)',
                    background: 'var(--status-danger-soft)', color: 'var(--red)',
                    cursor: 'pointer', }}>
                    <Trash2 size={12}/> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (tab === 'qrconfig' && isSuperAdmin) {
    return (
      <div className="card" style={{ overflow: 'hidden' }}>
        <SectionHead icon={Hash} title="QR CODE SCAN CONFIGURATION" sub="Control what data is displayed when someone scans an asset's QR code" color='var(--status-danger)'/>
        <div style={{ padding: 20 }}>
          {qrConfig ? (
            <>
              {/* Visible fields on QR scan */}
              <h3 style={{ color: 'var(--text-0)', marginBottom: 10, letterSpacing: '0.04em' }}>FIELDS SHOWN ON QR SCAN</h3>
              <p style={{ color: 'var(--text-3)', marginBottom: 14 }}>
                Toggle which data fields appear when an end-user scans an asset's QR code.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                {[
                  { key: 'asset_code', label: 'Asset Code' },
                  { key: 'asset_name', label: 'Asset Name' },
                  { key: 'make', label: 'Make' },
                  { key: 'model_no', label: 'Model No' },
                  { key: 'serial_no', label: 'Serial No' },
                  { key: 'capacity', label: 'Capacity' },
                  { key: 'status', label: 'Status' },
                  { key: 'category', label: 'Category' },
                  { key: 'site', label: 'Site / Location' },
                  { key: 'purchase_date', label: 'Purchase Date' },
                  { key: 'purchase_value', label: 'Purchase Value' },
                  { key: 'purchase_order_no', label: 'Purchase Order No' },
                  { key: 'type_code', label: 'Type Code' },
                  { key: 'warranty_expiry', label: 'Warranty Expiry' },
                  { key: 'notes', label: 'Notes' },
                ].map(f => {
                  const vis = (qrConfig.visible_fields || [])
                  const on = vis.includes(f.key)
                  return (
                    <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div>
                        <span style={{ color: 'var(--text-0)' }}>{f.label}</span>
                        <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{f.key}</span>
                      </div>
                      <Toggle on={on} onChange={(val) => {
                        setQrConfig(prev => ({
                          ...prev,
                          visible_fields: val
                            ? [...(prev.visible_fields || []), f.key]
                            : (prev.visible_fields || []).filter(k => k !== f.key),
                        }))
                      }} />
                    </div>
                  )
                })}
              </div>

              {/* Additional options */}
              <h3 style={{ color: 'var(--text-0)', marginBottom: 10, letterSpacing: '0.04em' }}>ADDITIONAL OPTIONS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                {[
                  { key: 'show_photo', label: 'Show Asset Photo', desc: 'Display main asset photo on scan page' },
                  { key: 'show_maintenance_history', label: 'Show Maintenance History', desc: 'Display recent maintenance logs' },
                  { key: 'show_location_map', label: 'Show Location Map', desc: 'Show GPS coordinates on a mini map' },
                ].map(opt => (
                  <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ color: 'var(--text-0)' }}>{opt.label}</span>
                      <p style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>{opt.desc}</p>
                    </div>
                    <Toggle on={!!qrConfig[opt.key]} onChange={(val) => {
                      setQrConfig(prev => ({ ...prev, [opt.key]: val }))
                    }} />
                  </div>
                ))}
              </div>

              {/* Dynamic Sticker Badge Preview & Thermal Printer Setup */}
              <h3 style={{ color: 'var(--text-0)', marginBottom: 10, letterSpacing: '0.04em' }}>
                DYNAMIC STICKER DESIGNER PREVIEW & THERMAL PRINTER SETUP
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16, marginBottom: 20 }}>
                {/* Thermal Printer Settings */}
                <div style={{ padding: 14, background: 'var(--bg-3)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label className="lbl">Network Thermal Printer IP (Zebra / TSPL)</label>
                  <input
                    type="text"
                    value={qrConfig.thermal_printer_ip || '192.168.1.150:9100'}
                    onChange={e => setQrConfig(prev => ({ ...prev, thermal_printer_ip: e.target.value }))}
                    placeholder="e.g. 192.168.1.150:9100"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-1)' }}
                  />
                  <span style={{ color: 'var(--text-3)', }}>
                    Direct socket RAW printing supported for Zebra ZD420, S4M, and TSPL industrial label printers.
                  </span>
                </div>

                {/* Badge Live Preview Box */}
                <div style={{ padding: 14, borderRadius: 10, background: '#ffffff', color: '#000000', border: '2px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center' }}>
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {qrConfig.custom_header || 'STRONG BUILT'}
                  </span>
                  <div style={{ width: 64, height: 64, background: '#000000', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', }}>
                    [ QR CODE ]
                  </div>
                  <span >AST-2026-8809</span>
                  <span style={{ opacity: 0.8 }}>{qrConfig.custom_footer || 'Property of Enterprise'}</span>
                </div>
              </div>

              {/* Custom header/footer */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="lbl">Custom Header Text</label>
                  <input type="text" value={qrConfig.custom_header || ''} onChange={e => setQrConfig(prev => ({ ...prev, custom_header: e.target.value }))}
                    placeholder="e.g. STRONG BUILT ENGINEERING"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text-1)' }} />
                </div>
                <div>
                  <label className="lbl">Custom Footer Text</label>
                  <input type="text" value={qrConfig.custom_footer || ''} onChange={e => setQrConfig(prev => ({ ...prev, custom_footer: e.target.value }))}
                    placeholder="e.g. Property of Strong Built"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text-1)' }} />
                </div>
              </div>

              {/* Save QR config */}
              <button onClick={async () => {
                setSaving(true)
                try {
                  await updateQrScanConfig(qrConfig)
                  setSaved(true); setTimeout(() => setSaved(false), 2500)
                } catch (e) { alert('Failed: ' + e.message) }
                setSaving(false)
              }} disabled={saving} className="btn-primary" style={{ padding: '9px 20px', gap: 7, }}>
                {saving ? 'Saving…' : <><Save size={14}/> Save QR Configuration</>}
              </button>
            </>
          ) : (
            <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 30 }}>Loading QR configuration...</p>
          )}
        </div>
      </div>
    )
  }

  return null
}
