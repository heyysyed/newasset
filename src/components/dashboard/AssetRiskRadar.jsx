import React from 'react'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts'
import { ShieldAlert, AlertTriangle } from 'lucide-react'

export default function AssetRiskRadar({ repairCount = 0, overdueCount = 0, anomalyCount = 0, expiringCount = 0, totalAssets = 1 }) {
  const radarData = [
    { subject: 'Breakdowns', value: Math.min(100, Math.round((repairCount / totalAssets) * 100 * 3)), fullMark: 100 },
    { subject: 'Overdue SLA', value: Math.min(100, overdueCount * 25), fullMark: 100 },
    { subject: 'Stock Anomalies', value: Math.min(100, anomalyCount * 30 || 20), fullMark: 100 },
    { subject: 'Expiring Docs', value: Math.min(100, expiringCount * 20), fullMark: 100 },
    { subject: 'Age Depreciation', value: 45, fullMark: 100 },
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    return (
      <div style={{ background: '#0f172a', color: '#fff', padding: '8px 12px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ color: '#f87171' }}>{item.subject} Risk Factor</div>
        <div>Score: <strong style={{ color: '#fbbf24', }}>{item.value}/100</strong></div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 20, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Operational Risk Radar
          </h3>
          <p style={{ margin: 0, color: '#64748b' }}>Multi-axis risk index assessing 5 operational factors</p>
        </div>
        <ShieldAlert size={18} color='var(--status-danger)' />
      </div>

      <div style={{ height: 220, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="subject" stroke="#475569" fontSize={10} tickLine={false} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" fontSize={8} />
            <Radar name="Risk Level" dataKey="value" stroke='var(--status-danger)' fill='var(--status-danger)' fillOpacity={0.25} />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
