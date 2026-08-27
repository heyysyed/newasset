import React from 'react'
import {
  Activity, ShieldAlert, CheckCircle2, Clock, Shield, MapPin, Wrench, Zap
} from 'lucide-react'

const COND_COLOR = {
  Operational: '#059669', Good: '#059669', Excellent: '#059669',
  Damaged: 'var(--status-warning)', Fair: 'var(--status-warning)', 'Needs Repair': '#0891b2',
  'Non-Functional': 'var(--status-danger)', Poor: 'var(--status-danger)', Critical: 'var(--status-danger)', Missing: '#64748b'
}

function PulseCell({ label, value, sub, icon: Icon, iconColor }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '14px 16px', background: 'var(--bg-1)',
      borderRadius: 12, border: '1px solid var(--border)', minWidth: 0,
    }}>
      <span style={{
        color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {Icon && <Icon size={11} color={iconColor || 'var(--text-3)'} />} {label}
      </span>
      <span style={{ color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value !== undefined && value !== null
          ? value
          : <span style={{ color: 'var(--text-3)', }}>-</span>}
      </span>
      {sub && <span style={{ color: 'var(--text-3)', marginTop: 1 }}>{sub}</span>}
    </div>
  )
}

export default function AssetPulse({ asset, asset360 }) {
  if (!asset360 || !asset) return null
  const { health, risk, warranty, location, maintenance, age } = asset360

  const healthScore = health?.data?.score ?? null
  const healthColor = healthScore === null ? 'var(--text-3)' : healthScore > 75 ? 'var(--green)' : healthScore > 40 ? 'var(--amber)' : 'var(--red)'
  const healthLabel = healthScore === null ? '-' : healthScore > 75 ? 'Good' : healthScore > 40 ? 'Fair' : 'Poor'

  const riskLevel = risk?.data?.level || null
  const riskColor = !riskLevel ? 'var(--text-3)' : riskLevel === 'LOW' ? 'var(--green)' : riskLevel === 'MEDIUM' ? 'var(--amber)' : 'var(--red)'

  const statusColor = asset.status === 'Active' ? 'var(--green)' : asset.status === 'Down' ? 'var(--red)' : asset.status === 'Under Repair' ? 'var(--amber)' : 'var(--text-2)'
  const condColor = COND_COLOR[asset.condition] || 'var(--text-3)'

  const wState = warranty?.data?.state || null
  const wDays = warranty?.data?.daysRemaining ?? null
  const wLabel = wState === 'ACTIVE' ? `${wDays}d left` : wState === 'EXPIRING SOON' ? `${wDays}d left!` : wState === 'EXPIRED' ? 'Expired' : 'Not set'
  const wColor = wState === 'ACTIVE' ? 'var(--green)' : wState === 'EXPIRING SOON' ? 'var(--amber)' : wState === 'EXPIRED' ? 'var(--red)' : 'var(--text-3)'

  const ageLabel = age?.data?.ageString || null
  const lifecycleStage = age?.data?.lifecycleStage || null
  const openTickets = maintenance?.data?.openTickets ?? null
  const mainColor = openTickets === 0 ? 'var(--green)' : openTickets > 0 ? 'var(--amber)' : 'var(--text-3)'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
      <PulseCell label="Health Score" icon={Activity} iconColor={healthColor}
        value={healthScore !== null ? <span style={{ color: healthColor }}>{healthScore}/100 · {healthLabel}</span> : null} />
      <PulseCell label="Risk Level" icon={ShieldAlert} iconColor={riskColor}
        value={riskLevel ? <span style={{ color: riskColor }}>{riskLevel}</span> : null} />
      <PulseCell label="Status" icon={CheckCircle2} iconColor={statusColor}
        value={<span style={{ color: statusColor }}>{asset.status || 'Unknown'}</span>} />
      <PulseCell label="Condition" icon={Zap} iconColor={condColor}
        value={<span style={{ color: condColor }}>{asset.condition || 'Unset'}</span>} />
      <PulseCell label="Asset Age" icon={Clock} iconColor="var(--text-2)"
        value={ageLabel} sub={lifecycleStage} />
      <PulseCell label="Warranty" icon={Shield} iconColor={wColor}
        value={<span style={{ color: wColor }}>{wLabel}</span>}
        sub={warranty?.data?.expiryDate ? `Expires ${new Date(warranty.data.expiryDate).toLocaleDateString()}` : null} />
      <PulseCell label="Current Site" icon={MapPin} iconColor="var(--cyan)"
        value={location?.data?.siteName || null} />
      <PulseCell label="Open Tickets" icon={Wrench} iconColor={mainColor}
        value={openTickets !== null ? <span style={{ color: mainColor }}>{openTickets} open</span> : null} />
    </div>
  )
}



