/**
 * Exception Engine
 * Centralized detection of operational anomalies and critical issues.
 */

export function detectExceptions({ assets = [], tickets = [], inventory = [], financialExposureThreshold = 500000 }) {
  const exceptions = []
  let exceptionIdCounter = 1

  const now = new Date()

  const addException = (type, severity, title, description, entity, entityId, businessImpact, financialImpact, action, route) => {
    exceptions.push({
      id: `EXC-${exceptionIdCounter++}`,
      type,
      severity, // CRITICAL, HIGH, MEDIUM, LOW, INFO
      title,
      description,
      entity,
      entityId,
      businessImpact,
      financialImpact,
      recommendedAction: action,
      route,
      detectedAt: now.toISOString()
    })
  }

  // 1. Asset Exceptions
  assets.forEach(asset => {
    const pVal = Number(asset.purchase_value) || 0
    // High Value Asset Idle or Down
    if ((asset.status === 'Down' || asset.status === 'Idle') && pVal > financialExposureThreshold) {
      addException(
        'ASSET',
        asset.status === 'Down' ? 'CRITICAL' : 'HIGH',
        `High-Value Asset ${asset.status}`,
        `${asset.asset_name || asset.asset_code} is currently ${asset.status}.`,
        'Asset',
        asset.id,
        'Significant capital inefficiency and potential project delay.',
        pVal,
        asset.status === 'Down' ? 'Prioritize repair or replacement.' : 'Evaluate for reassignment or disposal.',
        `/admin/assets/${asset.id}`
      )
    }

    // End of Life Risk
    const ageScore = asset.useful_life_years && asset.added_on ? ((new Date() - new Date(asset.added_on)) / (1000 * 60 * 60 * 24 * 365.25)) / asset.useful_life_years : 0
    if (ageScore > 1.2 && asset.status === 'Active') {
      addException(
        'ASSET',
        'MEDIUM',
        'Asset Operating Beyond Useful Life',
        `${asset.asset_name || asset.asset_code} has exceeded its useful life by >20%.`,
        'Asset',
        asset.id,
        'Increased risk of sudden breakdown and elevated maintenance costs.',
        null,
        'Plan for replacement or overhaul.',
        `/admin/assets/${asset.id}`
      )
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
        addException(
          'MAINTENANCE',
          'CRITICAL',
          'Critical Maintenance Overdue',
          `Ticket ${tkt.ticket_no} is overdue.`,
          'Ticket',
          tkt.id,
          'Immediate risk to operations or safety.',
          null,
          'Escalate to maintenance supervisor immediately.',
          `/admin/maintenance/tickets/${tkt.id}`
        )
      } else if (createdDaysAgo > 30) {
        addException(
          'MAINTENANCE',
          'HIGH',
          'Severely Aging Ticket',
          `Ticket ${tkt.ticket_no} has been open for >30 days.`,
          'Ticket',
          tkt.id,
          'Backlog accumulation and unaddressed minor issues can compound.',
          null,
          'Review blockage reason (parts/labor) and resolve.',
          `/admin/maintenance/tickets/${tkt.id}`
        )
      }
    }
  })

  // 3. Inventory Exceptions
  inventory.forEach(item => {
    const qty = Number(item.current_stock) || 0
    if (qty <= 0) {
      addException(
        'INVENTORY',
        'HIGH',
        'Stockout',
        `${item.item_name} is out of stock.`,
        'Inventory',
        item.id,
        'Potential delays in maintenance or operations requiring this item.',
        null,
        'Initiate emergency procurement if critical.',
        `/admin/inventory/items/${item.id}`
      )
    }
  })

  // Sort by Severity
  const severityRank = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, INFO: 5 }
  exceptions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  return exceptions
}


