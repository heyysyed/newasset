import React, { useMemo } from 'react'
import {
  MapPin, Package, Activity, AlertTriangle, IndianRupee, Wrench, Shield, CheckCircle2, TrendingDown, Clock, Hash,
  Zap, BarChart3
} from 'lucide-react'
import { buildSite360 } from '../../lib/intelligence/siteIntelligence'
import { formatCurrency } from '../../lib/depreciation'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'
import './Site360Workspace.css'

const ConfidenceBadge = ({ level }) => {
  const colors = {
    HIGH: { bg: 'rgba(34, 197, 94, 0.12)', color: 'var(--green)', border: 'rgba(34, 197, 94, 0.2)' },
    MEDIUM: { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--amber)', border: 'rgba(245, 158, 11, 0.2)' },
    LIMITED: { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--red)', border: 'rgba(239, 68, 68, 0.2)' }
  }
  const c = colors[level] || colors.LIMITED
  return (
    <div style={{
      padding: '4px 10px', borderRadius: 20,
      background: c.bg, color: c.color, textTransform: 'uppercase',
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em',
      border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: 6
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
      {level} CONFIDENCE
    </div>
  )
}

const SectionCard360 = ({ title, icon: Icon, confidence, children, accent = 'var(--accent)' }) => (
  <div className="premium-card-360" style={{ '--card-accent': accent }}>
    <div style={{
      padding: '20px 24px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ 
          width: 36, height: 36, borderRadius: 10, 
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
          color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <h3 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--text-0)', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.02em' }}>
          {title}
        </h3>
      </div>
      {confidence && <ConfidenceBadge level={confidence} />}
    </div>
    <div style={{ padding: '0 24px 24px' }}>
      {children}
    </div>
  </div>
)

export default function Site360Workspace({ site, siteAssets, siteTickets }) {
  const { can } = useAuth()
  const intel = useMemo(() => {
    return buildSite360(site, { assets: siteAssets, tickets: siteTickets, hasFinancialAccess: can('view_financials') })
  }, [site, siteAssets, siteTickets, can])

  if (!intel || !site) return null

  return (
    <div className="site-360-workspace animate-fade-up">
      {/* 1. IDENTITY HEADER */}
      <div className="site-header-360">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 14, 
                background: 'var(--accent)', color: 'white', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(59,130,246,0.25)'
              }}>
                <MapPin size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h1 style={{ margin: 0, color: 'var(--text-0)', fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {site.name}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: site.is_active ? 'var(--green)' : 'var(--red)', boxShadow: `0 0 8px ${site.is_active ? 'var(--green)' : 'var(--red)'}` }} />
                  <span style={{ color: site.is_active ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {site.is_active ? 'Active Operation' : 'Inactive Location'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', color: 'var(--text-2)', fontSize: '0.9rem' }}>
              {site.site_code && (
                <span style={{ padding: '4px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, color: 'var(--text-1)' }}>
                  {site.site_code}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} /> {site.address || 'Geospatial coordinates only'}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="metric-box-360" style={{ background: 'var(--bg-1)', minWidth: 140 }}>
              <div className="metric-label-360" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} style={{ color: intel.maintenance.data.openTickets > 0 ? 'var(--amber)' : 'var(--green)' }}/> Health Score
              </div>
              <div className="metric-val-360" style={{ color: intel.maintenance.data.openTickets > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {intel.maintenance.data.openTickets > 0 ? 'ATTN' : '100%'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TODAY'S ATTENTION */}
      {intel.attention?.length > 0 && (
        <SectionCard360 title="Action Required" icon={AlertTriangle} accent="var(--amber)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {intel.attention.map((att, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px', 
                background: att.severity === 'CRITICAL' || att.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${att.severity === 'CRITICAL' || att.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                borderRadius: 14,
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ 
                    width: 40, height: 40, borderRadius: '50%', 
                    background: att.severity === 'CRITICAL' || att.severity === 'HIGH' ? 'var(--red)' : 'var(--amber)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 12px ${att.severity === 'CRITICAL' || att.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                  }}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-0)', fontWeight: 600, fontSize: '1.05rem', marginBottom: 2 }}>{att.title}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>{att.explanation}</div>
                  </div>
                </div>
                {att.actionLabel && (
                  <Link to="/maintenance" className="btn-primary" style={{ padding: '8px 16px', borderRadius: 10, background: att.severity === 'CRITICAL' || att.severity === 'HIGH' ? 'var(--red)' : 'var(--amber)', color: 'white', border: 'none', textDecoration: 'none' }}>
                    {att.actionLabel}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </SectionCard360>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
        {/* 3. PORTFOLIO INTELLIGENCE */}
        <SectionCard360 title="Asset Portfolio" icon={Package} confidence={intel.portfolio.confidence} accent="var(--cyan)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="metric-box-360">
              <div className="metric-label-360">Total Assets</div>
              <div className="metric-val-360" style={{ color: 'var(--cyan)' }}>
                {intel.portfolio.data.totalAssets}
              </div>
            </div>
            <div className="metric-box-360">
              <div className="metric-label-360">Active Output</div>
              <div className="metric-val-360" style={{ color: 'var(--green)' }}>
                {intel.portfolio.data.activeAssets}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div className="metric-box-360" style={{ padding: 12, alignItems: 'center' }}>
              <Wrench size={18} style={{ color: 'var(--amber)', marginBottom: 8 }} />
              <div className="metric-val-360" style={{ fontSize: '1.5rem', color: 'var(--amber)' }}>{intel.portfolio.data.underMaintenance}</div>
              <div className="metric-label-360" style={{ fontSize: '0.65rem' }}>In Repair</div>
            </div>
            <div className="metric-box-360" style={{ padding: 12, alignItems: 'center' }}>
              <TrendingDown size={18} style={{ color: 'var(--red)', marginBottom: 8 }} />
              <div className="metric-val-360" style={{ fontSize: '1.5rem', color: 'var(--red)' }}>{intel.portfolio.data.downAssets}</div>
              <div className="metric-label-360" style={{ fontSize: '0.65rem' }}>Down</div>
            </div>
            <div className="metric-box-360" style={{ padding: 12, alignItems: 'center' }}>
              <Clock size={18} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
              <div className="metric-val-360" style={{ fontSize: '1.5rem', color: 'var(--text-1)' }}>{intel.portfolio.data.idleAssets}</div>
              <div className="metric-label-360" style={{ fontSize: '0.65rem' }}>Idle</div>
            </div>
          </div>
          <div style={{ marginTop: 20, color: 'var(--text-3)', fontSize: '0.8rem', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            Methodology: {intel.portfolio.methodology}
          </div>
        </SectionCard360>

        {/* 4. FINANCIAL INTELLIGENCE */}
        <SectionCard360 title="Capital Exposure" icon={IndianRupee} confidence={intel.financial.confidence} accent="var(--emerald)">
          {intel.financial.status === 'INSUFFICIENT_DATA' ? (
            <div style={{ color: 'var(--amber)', padding: 20, background: 'rgba(245,158,11,0.05)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.1)' }}>
              {intel.financial.methodology}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 20 }}>
                <div className="metric-box-360" style={{ flexDirection: 'row', alignItems: 'center', padding: '16px 20px' }}>
                  <div className="metric-label-360">Current Book Value</div>
                  <div className="metric-val-360" style={{ marginTop: 0, fontSize: '1.75rem', color: 'var(--emerald)' }}>{formatCurrency(intel.financial.data.totalNBV)}</div>
                </div>
                <div className="metric-box-360" style={{ flexDirection: 'row', alignItems: 'center', padding: '16px 20px' }}>
                  <div className="metric-label-360">Gross Value</div>
                  <div className="metric-val-360" style={{ marginTop: 0, fontSize: '1.3rem', color: 'var(--text-1)' }}>{formatCurrency(intel.financial.data.grossAssetValue)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="metric-box-360" style={{ background: 'rgba(239,68,68,0.03)', borderColor: 'rgba(239,68,68,0.1)' }}>
                  <div className="metric-label-360" style={{ color: 'var(--red)' }}>At-Risk Capital</div>
                  <div className="metric-val-360" style={{ fontSize: '1.25rem', color: 'var(--red)' }}>{formatCurrency(intel.financial.data.atRiskCapital)}</div>
                </div>
                <div className="metric-box-360" style={{ background: 'rgba(245,158,11,0.03)', borderColor: 'rgba(245,158,11,0.1)' }}>
                  <div className="metric-label-360" style={{ color: 'var(--amber)' }}>Idle Capital</div>
                  <div className="metric-val-360" style={{ fontSize: '1.25rem', color: 'var(--amber)' }}>{formatCurrency(intel.financial.data.idleCapitalProxy)}</div>
                </div>
              </div>
            </>
          )}
        </SectionCard360>

        {/* 5. MAINTENANCE INTELLIGENCE */}
        <SectionCard360 title="Site Maintenance" icon={Wrench} confidence={intel.maintenance.confidence} accent="var(--orange)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="metric-box-360">
              <div className="metric-label-360">Open Tickets</div>
              <div className="metric-val-360" style={{ color: intel.maintenance.data.openTickets > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {intel.maintenance.data.openTickets}
              </div>
            </div>
            <div className="metric-box-360">
              <div className="metric-label-360">Overdue PMs</div>
              <div className="metric-val-360" style={{ color: intel.maintenance.data.overdueTickets > 0 ? 'var(--red)' : 'var(--green)' }}>
                {intel.maintenance.data.overdueTickets}
              </div>
            </div>
          </div>
          <div className="metric-box-360" style={{ flexDirection: 'row', alignItems: 'center', background: intel.maintenance.data.criticalBreakdowns > 0 ? 'var(--red-dim)' : 'var(--bg-2)' }}>
            <div className="metric-label-360" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={16} /> Critical Breakdowns
            </div>
            <div className="metric-val-360" style={{ marginTop: 0, fontSize: '1.5rem', color: intel.maintenance.data.criticalBreakdowns > 0 ? 'var(--red)' : 'var(--text-1)' }}>
              {intel.maintenance.data.criticalBreakdowns}
            </div>
          </div>
        </SectionCard360>

        {/* 6. LOCATION BOUNDARY */}
        <SectionCard360 title="Geospatial Zone" icon={MapPin} confidence="HIGH" accent="var(--blue)">
           {site.latitude && site.longitude ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="metric-box-360">
                    <div className="metric-label-360">Latitude</div>
                    <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-0)', marginTop: 8 }}>{Number(site.latitude).toFixed(4)}°</div>
                  </div>
                  <div className="metric-box-360">
                    <div className="metric-label-360">Longitude</div>
                    <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-0)', marginTop: 8 }}>{Number(site.longitude).toFixed(4)}°</div>
                  </div>
                </div>
                <div className="metric-box-360" style={{ background: 'var(--blue-dim)', borderColor: 'rgba(59,130,246,0.2)', flexDirection: 'row', alignItems: 'center' }}>
                  <div className="metric-label-360" style={{ color: 'var(--blue)' }}>Operational Radius</div>
                  <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--blue)' }}>{site.radius_meters}m</div>
                </div>
              </div>
            ) : (
              <div style={{ 
                color: 'var(--text-2)', padding: 24, background: 'var(--bg-2)', 
                borderRadius: 14, textAlign: 'center', border: '1px dashed var(--border)' 
              }}>
                <MapPin size={32} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                No precise geospatial boundary defined. Map tracking is disabled for this site.
              </div>
            )}
        </SectionCard360>
      </div>
      
      {/* 7. RECOMMENDATIONS */}
      {intel.recommendations?.length > 0 && (
        <div className="site-header-360" style={{ marginTop: 24, background: 'linear-gradient(135deg, var(--accent-glow) 0%, rgba(59,130,246,0.02) 100%)', borderColor: 'var(--accent-soft)' }}>
          <h3 style={{ margin: '0 0 20px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.25rem' }}>
            <BarChart3 size={24} strokeWidth={2.5} /> Strategic Recommendations
          </h3>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {intel.recommendations.map((rec, i) => (
              <li key={`skel2-${i}`} style={{ 
                display: 'flex', alignItems: 'flex-start', gap: 12, 
                padding: '16px', background: 'var(--bg-1)', borderRadius: 12,
                border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <div style={{ marginTop: 2, color: 'var(--accent)' }}><CheckCircle2 size={18} /></div>
                <div style={{ color: 'var(--text-0)', lineHeight: 1.5 }}>{rec}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
