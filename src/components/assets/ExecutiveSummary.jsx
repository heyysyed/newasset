import React from 'react'
import { Info } from 'lucide-react'

export default function ExecutiveSummary({ asset360 }) {
  if (!asset360) return null

  const { asset, health, risk, maintenance, location } = asset360

  const name = asset?.asset_name || asset?.asset_code || 'This asset'
  const site = location?.data?.siteName || 'an unknown location'
  const status = (asset?.status || 'Active').toLowerCase()
  const healthScore = health?.data?.score || 0
  const riskLvl = (risk?.data?.level || 'unknown').toLowerCase()
  const openTkts = maintenance?.data?.openTickets || 0

  let sentence = `${name} is currently ${status} at ${site}. `
  sentence += `It has a Health Score of ${healthScore} and a ${riskLvl} risk classification. `
  
  if (openTkts > 0) {
    sentence += `The asset has ${openTkts} open maintenance ticket${openTkts > 1 ? 's' : ''}.`
  } else {
    sentence += `There are no open maintenance tickets.`
  }

  return (
    <div style={{
      background: 'var(--bg-3)',
      padding: '14px 18px',
      borderRadius: '12px',
      borderLeft: '4px solid var(--accent)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: '16px'
    }}>
      <Info size={18} color="var(--accent)" style={{ marginTop: 2 }} />
      <span style={{ color: 'var(--text-1)', }}>
        {sentence}
      </span>
    </div>
  )
}
