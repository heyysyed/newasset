import React, { useMemo } from 'react'
import {
  MapPin, Package, Activity, AlertTriangle, IndianRupee, Wrench, Shield, CheckCircle2, TrendingDown, Clock, Hash
} from 'lucide-react'
import { buildSite360 } from '../../lib/intelligence/siteIntelligence'
import { formatCurrency } from '../../lib/depreciation'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'

const ConfidenceBadge = ({ level }) => {
  const colors = {
    HIGH: { bg: 'var(--green-dim)', color: 'var(--green)' },
    MEDIUM: { bg: 'var(--amber-dim)', color: 'var(--amber)' },
    LIMITED: { bg: 'var(--red-dim)', color: 'var(--red)' }
  }
  const c = colors[level] || colors.LIMITED
  return (
    <span style={{
      padding: '2px 6px', borderRadius: 6,
      background: c.bg, color: c.color, textTransform: 'uppercase'
    }}>
      {level} CONFIDENCE
    </span>
  )
}

const SectionCard360 = ({ title, icon: Icon, confidence, children, accent = 'var(--accent)' }) => (
  <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden', border: `1px solid ${accent}40` }}>
    <div style={{
      padding: '12px 20px', background: `${accent}10`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `1px solid ${accent}20`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={18} style={{ color: accent }} />
        <h3 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--text-0)' }}>
          {title}
        </h3>
      </div>
      {confidence && <ConfidenceBadge level={confidence} />}
    </div>
    <div style={{ padding: 20 }}>
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
      <div className="card" style={{ marginBottom: 20, padding: 24, border: '1px solid var(--cyan)', background: 'var(--bg-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h1 style={{ margin: '0 0 8px', color: 'var(--text-0)' }}>
              {site.name}
            </h1>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {site.site_code && (
                <span className="font-mono" style={{ padding: '2px 8px', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6, }}>
                  {site.site_code}
                </span>
              )}
              <span style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={14} /> {site.address || 'Address not provided'}
              </span>
              <span style={{ color: site.is_active ? 'var(--green)' : 'var(--red)' }}>
                ● {site.is_active ? 'Active Site' : 'Inactive Site'}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ textTransform: 'uppercase', color: 'var(--text-3)', letterSpacing: '0.05em' }}>Portfolio Health</div>
              <div style={{ color: intel.maintenance.data.openTickets > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {intel.maintenance.data.openTickets > 0 ? 'NEEDS ATTENTION' : 'GOOD'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TODAY'S ATTENTION */}
      {intel.attention?.length > 0 && (
        <SectionCard360 title="Site Attention Required" icon={AlertTriangle} accent="var(--amber)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {intel.attention.map((att, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: att.severity === 'CRITICAL' || att.severity === 'HIGH' ? 'var(--red-dim)' : 'var(--amber-dim)',
                border: `1px solid ${att.severity === 'CRITICAL' || att.severity === 'HIGH' ? 'var(--red)' : 'var(--amber)'}`,
                borderRadius: 12
              }}>
                <div>
                  <div style={{ color: 'var(--text-0)' }}>{att.title}</div>
                  <div style={{ color: 'var(--text-2)' }}>{att.explanation}</div>
                </div>
                {att.actionLabel && (
                  <button className="btn-ghost" style={{ padding: '6px 12px' }}>
                    {att.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        </SectionCard360>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* 3. PORTFOLIO INTELLIGENCE */}
        <SectionCard360 title="Asset Portfolio" icon={Package} confidence={intel.portfolio.confidence} accent="var(--cyan)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ textTransform: 'uppercase', color: 'var(--text-3)' }}>Total Assets</div>
              <div style={{ color: 'var(--text-0)' }}>
                {intel.portfolio.data.totalAssets}
              </div>
            </div>
            <div>
              <div style={{ textTransform: 'uppercase', color: 'var(--text-3)' }}>Active</div>
              <div style={{ color: 'var(--green)' }}>
                {intel.portfolio.data.activeAssets}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, color: 'var(--text-2)', textAlign: 'center' }}>
            <div style={{ background: 'var(--bg-1)', padding: 8, borderRadius: 8 }}>
              <div style={{ color: 'var(--amber)' }}>{intel.portfolio.data.underMaintenance}</div>
              <div style={{ textTransform: 'uppercase' }}>In Repair</div>
            </div>
            <div style={{ background: 'var(--bg-1)', padding: 8, borderRadius: 8 }}>
              <div style={{ color: 'var(--red)' }}>{intel.portfolio.data.downAssets}</div>
              <div style={{ textTransform: 'uppercase' }}>Down</div>
            </div>
            <div style={{ background: 'var(--bg-1)', padding: 8, borderRadius: 8 }}>
              <div style={{ color: 'var(--text-3)' }}>{intel.portfolio.data.idleAssets}</div>
              <div style={{ textTransform: 'uppercase' }}>Idle</div>
            </div>
          </div>
          <div style={{ marginTop: 16, color: 'var(--text-3)', fontStyle: 'italic' }}>
            Methodology: {intel.portfolio.methodology}
          </div>
        </SectionCard360>

        {/* 4. FINANCIAL INTELLIGENCE */}
        <SectionCard360 title="Capital Exposure" icon={IndianRupee} confidence={intel.financial.confidence} accent="var(--green)">
          {intel.financial.status === 'INSUFFICIENT_DATA' ? (
            <div style={{ color: 'var(--amber)' }}>{intel.financial.methodology}</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ textTransform: 'uppercase', color: 'var(--text-3)' }}>Gross Value</div>
                  <div className="font-mono" style={{ color: 'var(--text-0)' }}>{formatCurrency(intel.financial.data.grossAssetValue)}</div>
                </div>
                <div>
                  <div style={{ textTransform: 'uppercase', color: 'var(--text-3)' }}>Current Book Value</div>
                  <div className="font-mono" style={{ color: 'var(--accent)' }}>{formatCurrency(intel.financial.data.totalNBV)}</div>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-2)' }}>At-Risk Capital</span>
                  <span className="font-mono" style={{ color: 'var(--red)', }}>{formatCurrency(intel.financial.data.atRiskCapital)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', }}>
                  <span style={{ color: 'var(--text-2)' }}>Idle Capital Proxy</span>
                  <span className="font-mono" style={{ color: 'var(--amber)', }}>{formatCurrency(intel.financial.data.idleCapitalProxy)}</span>
                </div>
              </div>
            </>
          )}
        </SectionCard360>

        {/* 5. MAINTENANCE INTELLIGENCE */}
        <SectionCard360 title="Site Maintenance" icon={Wrench} confidence={intel.maintenance.confidence} accent="var(--orange)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ textTransform: 'uppercase', color: 'var(--text-3)' }}>Open Tickets</div>
              <div style={{ color: intel.maintenance.data.openTickets > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {intel.maintenance.data.openTickets}
              </div>
            </div>
            <div>
              <div style={{ textTransform: 'uppercase', color: 'var(--text-3)' }}>Overdue PMs</div>
              <div style={{ color: intel.maintenance.data.overdueTickets > 0 ? 'var(--red)' : 'var(--green)' }}>
                {intel.maintenance.data.overdueTickets}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-2)', background: 'var(--bg-1)', padding: 12, borderRadius: 8 }}>
            <span>Critical Breakdowns</span>
            <span style={{ color: intel.maintenance.data.criticalBreakdowns > 0 ? 'var(--red)' : 'var(--text-0)' }}>
              {intel.maintenance.data.criticalBreakdowns}
            </span>
          </div>
        </SectionCard360>

        {/* 6. LOCATION BOUNDARY */}
        <SectionCard360 title="Location Boundary" icon={MapPin} confidence="HIGH" accent="var(--cyan)">
           {site.latitude && site.longitude ? (
              <>
                <div style={{ background: 'var(--bg-1)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
                  <div>Lat: <span >{Number(site.latitude).toFixed(4)}</span></div>
                  <div>Lng: <span >{Number(site.longitude).toFixed(4)}</span></div>
                </div>
                <div style={{ background: 'var(--accent-glow)', color: 'var(--accent)', padding: '8px 12px', borderRadius: 8, }}>
                  {site.radius_meters}m Operational Radius
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-3)', fontStyle: 'italic', padding: 12, background: 'var(--bg-1)', borderRadius: 8 }}>
                No precise geospatial boundary defined. Map tracking is disabled for this site.
              </div>
            )}
        </SectionCard360>
      </div>
      
      {/* 7. RECOMMENDATIONS */}
      {intel.recommendations?.length > 0 && (
        <div className="card" style={{ padding: 24, background: 'var(--accent-glow)', border: '1px solid var(--accent-soft)', marginTop: 20 }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} /> Strategic Recommendations
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-0)', }}>
            {intel.recommendations.map((rec, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}


