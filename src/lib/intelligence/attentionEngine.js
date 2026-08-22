import { ConfidenceLevel } from './intelligenceContract'

/**
 * Attention Engine (replaces Exception Engine)
 * Primary layer for surfacing actionable, high-priority operational intelligence.
 */

export function detectAttentionItems({ assets = [], tickets = [], inventory = [], financialExposureThreshold = 500000 }) {
  const items = []
  let idCounter = 1

  const now = new Date()

  const addItem = ({ severity, domain, title, explanation, evidence, financialExposure, affectedRecords, source, route, actionLabel, confidence, age, dedupeKey }) => {
    items.push({
      id: `ATTN-${idCounter++}`,
      severity, // CRITICAL, HIGH, MEDIUM, LOW
      domain,
      title,
      explanation,
      evidence,
      financialExposure: financialExposure || null,
      affectedRecords: affectedRecords || 1,
      source,
      route,
      actionLabel,
      confidence: confidence || ConfidenceLevel.MEDIUM,
      age: age || 0,
      dedupeKey,
      detectedAt: now.toISOString()
    })
  }

  // 1. Asset Exceptions
  assets.forEach(asset => {
    const pVal = Number(asset.purchase_value) || 0
    // High Value Asset Idle or Down
    if ((asset.status === 'Down' || asset.status === 'Idle') && pVal > financialExposureThreshold) {
      const daysSinceAdded = asset.added_on ? (now - new Date(asset.added_on)) / (1000 * 60 * 60 * 24) : 0
      addItem({
        severity: asset.status === 'Down' ? 'CRITICAL' : 'HIGH',
        domain: 'ASSET',
        title: `High-Value Asset ${asset.status}`,
        explanation: `Significant capital inefficiency and potential project delay due to ${asset.status.toLowerCase()} asset.`,
        evidence: `${asset.asset_name || asset.asset_code} is currently marked as ${asset.status}.`,
        financialExposure: pVal,
        affectedRecords: 1,
        source: 'assets',
        route: `/admin/assets/${asset.id}`,
        actionLabel: asset.status === 'Down' ? 'Prioritize repair' : 'Evaluate for reassignment',
        confidence: ConfidenceLevel.HIGH,
        age: Math.round(daysSinceAdded),
        dedupeKey: `ASSET:STATUS:${asset.id}`
      })
    }

    // End of Life Risk
    const ageScore = asset.useful_life_years && asset.added_on ? ((now - new Date(asset.added_on)) / (1000 * 60 * 60 * 24 * 365.25)) / asset.useful_life_years : 0
    if (ageScore > 1.2 && asset.status === 'Active') {
      const yearsExcess = Math.round((ageScore - 1) * asset.useful_life_years * 10) / 10
      addItem({
        severity: 'MEDIUM',
        domain: 'ASSET',
        title: 'Asset Operating Beyond Useful Life',
        explanation: 'Increased risk of sudden breakdown and elevated maintenance costs.',
        evidence: `${asset.asset_name || asset.asset_code} has exceeded its useful life by ${yearsExcess} years.`,
        financialExposure: null,
        affectedRecords: 1,
        source: 'assets',
        route: `/admin/assets/${asset.id}`,
        actionLabel: 'Plan for replacement',
        confidence: ConfidenceLevel.HIGH,
        age: Math.round(yearsExcess * 365.25),
        dedupeKey: `ASSET:EOL:${asset.id}`
      })
    }
  })

  // 2. Maintenance Exceptions
  tickets.forEach(tkt => {
    if (['Open', 'In Progress'].includes(tkt.status)) {
      const isCritical = tkt.priority === 'High' || tkt.priority === 'Critical'
      const createdDaysAgo = (now - new Date(tkt.created_at)) / (1000 * 60 * 60 * 24)
      
      let isOverdue = false
      if (tkt.sla_due_at) isOverdue = new Date(tkt.sla_due_at) < now
      else isOverdue = createdDaysAgo > (isCritical ? 1 : 14) // Proxy
      
      if (isOverdue && isCritical) {
        addItem({
          severity: 'CRITICAL',
          domain: 'MAINTENANCE',
          title: 'Critical Maintenance Overdue',
          explanation: 'Immediate risk to operations or safety.',
          evidence: `Ticket ${tkt.ticket_no} is overdue and marked as ${tkt.priority}.`,
          financialExposure: null,
          affectedRecords: 1,
          source: 'maintenance_tickets',
          route: `/admin/maintenance/tickets/${tkt.id}`,
          actionLabel: 'Escalate to supervisor',
          confidence: tkt.sla_due_at ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM,
          age: Math.round(createdDaysAgo),
          dedupeKey: `MAINTENANCE:OVERDUE:${tkt.id}`
        })
      } else if (createdDaysAgo > 30) {
        addItem({
          severity: 'HIGH',
          domain: 'MAINTENANCE',
          title: 'Severely Aging Ticket',
          explanation: 'Backlog accumulation and unaddressed minor issues can compound.',
          evidence: `Ticket ${tkt.ticket_no} has been open for >30 days.`,
          financialExposure: null,
          affectedRecords: 1,
          source: 'maintenance_tickets',
          route: `/admin/maintenance/tickets/${tkt.id}`,
          actionLabel: 'Review blockage',
          confidence: ConfidenceLevel.HIGH,
          age: Math.round(createdDaysAgo),
          dedupeKey: `MAINTENANCE:AGING:${tkt.id}`
        })
      }
    }
  })

  // 3. Inventory Exceptions
  inventory.forEach(item => {
    const qty = Number(item.current_stock) || 0
    if (qty <= 0) {
      addItem({
        severity: 'HIGH',
        domain: 'INVENTORY',
        title: 'Stockout',
        explanation: 'Potential delays in maintenance or operations requiring this item.',
        evidence: `${item.item_name} is currently out of stock.`,
        financialExposure: null,
        affectedRecords: 1,
        source: 'inventory_items',
        route: `/admin/inventory/items/${item.id}`,
        actionLabel: 'Initiate procurement',
        confidence: ConfidenceLevel.HIGH,
        age: 0,
        dedupeKey: `INVENTORY:STOCKOUT:${item.id}`
      })
    } else if (Number(item.reorder_level) > 0 && qty <= Number(item.reorder_level)) {
      addItem({
        severity: 'MEDIUM',
        domain: 'INVENTORY',
        title: 'Low Stock',
        explanation: 'Item is at or below the defined reorder level.',
        evidence: `${item.item_name} stock (${qty}) is at or below reorder level (${item.reorder_level}).`,
        financialExposure: null,
        affectedRecords: 1,
        source: 'inventory_items',
        route: `/admin/inventory/items/${item.id}`,
        actionLabel: 'Review reorder',
        confidence: ConfidenceLevel.HIGH,
        age: 0,
        dedupeKey: `INVENTORY:LOWSTOCK:${item.id}`
      })
    }
  })

  // Prioritization sorting:
  // 1. Severity
  // 2. Financial exposure
  // 3. Age
  const severityRank = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 }
  
  items.sort((a, b) => {
    const aRank = severityRank[a.severity] || 5
    const bRank = severityRank[b.severity] || 5
    if (aRank !== bRank) return aRank - bRank
    
    // Sort by financial exposure descending if present
    if ((a.financialExposure || 0) !== (b.financialExposure || 0)) {
       return (b.financialExposure || 0) - (a.financialExposure || 0)
    }

    // Sort by age descending
    return (b.age || 0) - (a.age || 0)
  })

  return items
}
