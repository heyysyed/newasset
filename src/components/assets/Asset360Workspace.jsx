import React, { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, Clock, Activity, AlertTriangle, Shield, Wrench,
  IndianRupee, Layers, ChevronRight, CheckCircle2, History,
  Info, Copy, Check, AlertCircle, TrendingDown, GitBranch,
  Building2, User, Hash, Package, Calendar, Tag, FileText,
  BarChart3, Database
} from 'lucide-react'
import { formatCurrency } from '../../lib/depreciation'
import AssetTimeline from './AssetTimeline'
import AssetPulse from './AssetPulse'
import AttentionEngineUI from './AttentionEngineUI'
import ExecutiveSummary from './ExecutiveSummary'
import AssetLocationCard from './AssetLocationCard'

/* â”€â”€ Helpers â”€â”€ */
function safe(val, fallback = 'â€”') {
  if (val === null || val === undefined || val === '') return fallback
  return val
}
function fmtDate(d) {
  if (!d) return 'â€”'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return 'â€”' }
}

/* â”€â”€ Copy to Clipboard Hook â”€â”€ */
function useCopy() {
  const [copiedKey, setCopiedKey] = useState(null)
  const copy = useCallback((val, key) => {
    if (!val || val === 'â€”') return
    navigator.clipboard.writeText(String(val)).catch(() => {})
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1800)
  }, [])
  return { copiedKey, copy }
}

/* â”€â”€ Section Card â”€â”€ */
function Card360({ title, icon: Icon, accent = 'var(--accent)', children, noPad }) {
  return (
    <div style={{
      background: 'var(--bg-1)', border: `1px solid ${accent}30`,
      borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--clay-shadow-sm)',
    }}>
      <div style={{
        padding: '12px 18px', background: `${accent}08`,
        borderBottom: `1px solid ${accent}18`,
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <Icon size={16} style={{ color: accent, flexShrink: 0 }} />
        <h3 style={{ margin: 0, color: 'var(--text-0)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </h3>
      </div>
      <div style={noPad ? {} : { padding: '16px 18px' }}>
        {children}
      </div>
    </div>
  )
}

/* â”€â”€ Spec Row â”€â”€ */
function SpecRow({ label, value, mono, copyKey, copiedKey, onCopy }) {
  const displayVal = safe(value)
  const canCopy = displayVal !== 'â€”' && !!copyKey
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--border)',
      gap: 12,
    }}>
      <span style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{
          color: 'var(--text-0)', fontWeight: mono ? 600 : 500,
          fontFamily: mono ? "var(--font-mono)" : undefined,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {displayVal}
        </span>
        {canCopy && (
          <button
            onClick={() => onCopy(value, copyKey)}
            title="Copy"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              color: copiedKey === copyKey ? 'var(--green)' : 'var(--text-3)',
              display: 'flex', flexShrink: 0, transition: 'color 0.15s',
            }}
          >
            {copiedKey === copyKey ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  )
}

/* â”€â”€ Lifecycle Bar â”€â”€ */
function LifecycleBar({ pct, label, color }) {
  const safeColor = color || (pct >= 100 ? 'var(--red)' : pct > 75 ? 'var(--amber)' : 'var(--green)')
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, }}>
        <span style={{ color: 'var(--text-2)', }}>{label}</span>
        <span style={{ color: safeColor, }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: safeColor, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN COMPONENT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function Asset360Workspace({
  asset,
  asset360: intel,
  movements,
  maintenance,
  audit,
  canViewFinancials = true,
  assigneeLabel,
  assigneeType,
  photos = [],
}) {
  const { copiedKey, copy } = useCopy()

  if (!asset) return null

  // â”€â”€ Executive Summary (deterministic) â”€â”€
  const genSummary = () => {
    if (!intel) return null
    const name = safe(asset.asset_name, 'This asset')
    const site = intel.location?.data?.siteName || 'an unassigned location'
    const status = (asset.status || 'Active').toLowerCase()
    const health = intel.health?.data?.score ?? null
    const risk = (intel.risk?.data?.level || '').toLowerCase()
    const open = intel.maintenance?.data?.openTickets ?? 0
    const wState = intel.warranty?.data?.state
    const wDays = intel.warranty?.data?.daysRemaining

    let s = `${name} is currently ${status} at ${site}.`
    if (health !== null) s += ` Health Score: ${health}/100 (${risk || 'unknown'} risk).`
    if (open > 0) s += ` ${open} open maintenance ticket${open > 1 ? 's' : ''}.`
    else s += ` No open maintenance tickets.`
    if (wState === 'EXPIRING SOON') s += ` Warranty expires in ${wDays} days.`
    else if (wState === 'EXPIRED') s += ` Warranty has expired.`
    return s
  }
  const summaryText = genSummary()

  // â”€â”€ Financial â”€â”€
  const pv = Number(asset.purchase_value) || 0
  const bv = intel?.financial?.data?.bookValue ?? 0
  const sv = Number(asset.salvage_value) || 0
  const depPct = intel?.financial?.data?.depreciationPercent ?? 0
  const hasFinancials = pv > 0

  // â”€â”€ Age / Lifecycle â”€â”€
  const ageData = intel?.age?.data
  const lifeConsumedPct = ageData?.lifeConsumedPct ?? null
  const lifeRemainingPct = ageData?.lifeRemainingPct ?? null

  // â”€â”€ Location â”€â”€
  const locData = intel?.location?.data

  // â”€â”€ Maintenance summary â”€â”€
  const maintData = intel?.maintenance?.data
  const lastMaint = maintData?.lastMaintenance

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* â”€â”€ SECTION 1: ASSET PULSE â”€â”€ */}
      <AssetPulse asset={asset} asset360={intel} />

      {/* â”€â”€ SECTION 2: EXECUTIVE SUMMARY + ATTENTION â”€â”€ */}
      {(summaryText || (intel?.attention?.length > 0)) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {summaryText && (
            <div style={{
              background: 'var(--bg-1)', padding: '14px 18px', borderRadius: 12,
              borderLeft: '4px solid var(--accent)',
              display: 'flex', alignItems: 'flex-start', gap: 12,
              border: '1px solid var(--border)',
            }}>
              <Info size={16} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ margin: 0, color: 'var(--text-1)', }}>{summaryText}</p>
            </div>
          )}
          {intel?.attention?.length > 0 && (
            <div style={{
              background: 'var(--bg-1)', border: '1px solid var(--amber)', borderRadius: 12,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 16px', background: 'rgba(217, 119, 6, 0.06)',
                borderBottom: '1px solid rgba(217, 119, 6, 0.15)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={15} color="var(--amber)" />
                <span style={{ color: 'var(--text-0)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Attention Required Â· {intel.attention.length} item{intel.attention.length > 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <AttentionEngineUI attentionItems={intel.attention} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ SECTION 3 + 4: TECHNICAL SPECS + LOCATION (2-col) â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* Technical Specifications */}
        <Card360 title="Technical Specifications" icon={Database} accent="var(--accent)">
          {/* Identity Group */}
          <p style={{ margin: '0 0 6px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Identity</p>
          <SpecRow label="Asset Code" value={asset.asset_code} mono copyKey="code" copiedKey={copiedKey} onCopy={copy} />
          <SpecRow label="Asset ID" value={asset.id} mono copyKey="id" copiedKey={copiedKey} onCopy={copy} />
          <SpecRow label="Category" value={asset.category} />
          <SpecRow label="Sub-Category" value={asset.sub_category} />
          <SpecRow label="Asset Type" value={asset.asset_type} />
          <SpecRow label="Status" value={asset.status} />
          <SpecRow label="Condition" value={asset.condition} />
          <SpecRow label="Quantity" value={asset.quantity} />

          {/* Technical Group */}
          <p style={{ margin: '14px 0 6px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Technical</p>
          <SpecRow label="Make / Brand" value={asset.make} />
          <SpecRow label="Model No." value={asset.model_no} />
          <SpecRow label="Serial No." value={asset.serial_no} mono copyKey="serial" copiedKey={copiedKey} onCopy={copy} />
          <SpecRow label="Capacity" value={asset.capacity} />

          {/* Procurement Group */}
          <p style={{ margin: '14px 0 6px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Procurement</p>
          <SpecRow label="Purchase Date" value={fmtDate(asset.purchase_date)} />
          <SpecRow label="Added On" value={fmtDate(asset.added_on)} />
          <SpecRow label="Purchase Order" value={asset.purchase_order} mono copyKey="po" copiedKey={copiedKey} onCopy={copy} />
          <SpecRow label="Warranty Expiry" value={fmtDate(asset.warranty_expiry)} />
        </Card360>

        {/* Location & Assignment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AssetLocationCard
            location={intel?.location}
            assigneeLabel={assigneeLabel}
            assigneeType={assigneeType}
          />

          {/* Data Quality */}
          {intel?.dataQuality && (
            <Card360 title="Data Quality" icon={CheckCircle2} accent="var(--purple)">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ color: intel.dataQuality.data?.score >= 80 ? 'var(--green)' : intel.dataQuality.data?.score >= 60 ? 'var(--amber)' : 'var(--red)' }}>
                    {intel.dataQuality.data?.score ?? 'â€”'}%
                  </div>
                  <div style={{ color: 'var(--text-3)' }}>Asset record completeness</div>
                </div>
                <div style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                  {intel.dataQuality.data?.missing?.length > 0
                    ? <span style={{ color: 'var(--amber)' }}>{intel.dataQuality.data.missing.length} fields missing</span>
                    : <span style={{ color: 'var(--green)' }}>All fields present</span>}
                </div>
              </div>
              {intel.dataQuality.data?.missing?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {intel.dataQuality.data.missing.map(f => (
                    <span key={f} style={{
                      padding: '2px 8px', borderRadius: 6,
                      background: 'var(--amber-dim)', color: 'var(--amber)', }}>{f.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              )}
            </Card360>
          )}
        </div>
      </div>

      {/* â”€â”€ SECTION 5: FINANCIAL INTELLIGENCE â”€â”€ */}
      {canViewFinancials ? (
        <Card360 title="Financial Intelligence" icon={IndianRupee} accent="var(--green)">
          {!hasFinancials ? (
            <div style={{ color: 'var(--text-3)', padding: '8px 0' }}>
              Purchase value not recorded. Add financial details to unlock depreciation analytics.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Purchase Value</div>
                <div style={{ color: 'var(--text-0)', }}>{formatCurrency(pv)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Current Book Value</div>
                <div style={{ color: 'var(--accent)', }}>{formatCurrency(bv)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Salvage Value</div>
                <div style={{ color: 'var(--text-2)', }}>{formatCurrency(sv)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Accumulated Depreciation</div>
                <div style={{ color: 'var(--amber)', }}>{formatCurrency(pv - bv)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Method</div>
                <div style={{ color: 'var(--text-1)' }}>{safe(asset.depreciation_method, 'Straight Line')}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Useful Life</div>
                <div style={{ color: 'var(--text-1)' }}>{safe(asset.useful_life_years, 'â€”')} {asset.useful_life_years ? 'years' : ''}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <LifecycleBar pct={depPct} label={`Depreciation Â· ${safe(asset.depreciation_method, 'Standard')}`} />
              </div>
            </div>
          )}
        </Card360>
      ) : (
        <Card360 title="Financial Intelligence" icon={IndianRupee} accent="var(--green)">
          <div style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} /> Financial information is restricted for your role.
          </div>
        </Card360>
      )}

      {/* â”€â”€ SECTION 6: LIFECYCLE â”€â”€ */}
      {ageData && (
        <Card360 title="Asset Lifecycle" icon={TrendingDown} accent="var(--cyan)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: lifeConsumedPct !== null ? 20 : 0 }}>
            <div>
              <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Acquisition Date</div>
              <div style={{ color: 'var(--text-0)' }}>{fmtDate(ageData.acquisitionDate)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Asset Age</div>
              <div style={{ color: 'var(--text-0)' }}>{safe(ageData.ageString)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Lifecycle Stage</div>
              <div style={{ color: 'var(--accent)' }}>{safe(ageData.lifecycleStage)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Useful Life</div>
              <div style={{ color: 'var(--text-0)' }}>{ageData.usefulLifeYears ? `${ageData.usefulLifeYears} years` : 'â€”'}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Expected End of Life</div>
              <div style={{ color: 'var(--text-0)' }}>{fmtDate(ageData.expectedEnd)}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Remaining Life</div>
              <div style={{ color: 'var(--text-0)' }}>{ageData.remainingYears ? `${ageData.remainingYears} years` : 'â€”'}</div>
            </div>
          </div>
          {lifeConsumedPct !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <LifecycleBar pct={lifeConsumedPct} label="Life Consumed" />
              {lifeRemainingPct !== null && <LifecycleBar pct={lifeRemainingPct} label="Remaining Useful Life" color={lifeRemainingPct < 25 ? 'var(--red)' : lifeRemainingPct < 50 ? 'var(--amber)' : 'var(--green)'} />}
            </div>
          )}
          {lifeConsumedPct === null && (
            <p style={{ margin: '8px 0 0', color: 'var(--text-3)' }}>
              Add Useful Life (Years) and Purchase Date to unlock lifecycle consumption analytics.
            </p>
          )}
        </Card360>
      )}

      {/* â”€â”€ SECTION 7: PHOTOS â”€â”€ */}
      {photos.length > 0 && (
        <Card360 title="Visual Condition" icon={Tag} accent="var(--purple)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {photos.map(p => (
              <div key={p.id} style={{ aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-3)' }}>
                <img
                  src={p.photo_url || p.url}
                  alt="Asset photo"
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
            ))}
          </div>
        </Card360>
      )}

      {/* â”€â”€ SECTION 8: TIMELINE â”€â”€ */}
      <Card360 title="Lifecycle Timeline" icon={History} accent="var(--text-3)">
        <AssetTimeline asset={asset} movements={movements} maintenance={maintenance} audit={audit} />
      </Card360>

    </div>
  )
}


