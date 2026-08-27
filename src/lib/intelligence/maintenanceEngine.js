import { createDomainContract, ConfidenceLevel, DomainStatus } from './intelligenceContract'

/**
 * Maintenance Intelligence Engine
 * Evaluates backlog, PM compliance, repeat failures, and aging.
 */

export function calculateMaintenanceIntelligence(tickets = [], logs = []) {
  if (!tickets || tickets.length === 0) {
    return createDomainContract({
      status: DomainStatus.INSUFFICIENT_DATA,
      value: null,
      recordCount: 0,
      source: 'maintenance_tickets, maintenance_logs',
      confidence: ConfidenceLevel.LOW,
      methodology: 'No maintenance records found.',
      data: {
        backlogCount: 0,
        overdueCount: 0,
        criticalCount: 0,
        agingBuckets: { '0-7': 0, '8-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
        pmCompliance: null,
        repeatFailuresCount: 0
      }
    })
  }

  const OPEN_STATUSES = ['Open', 'In Progress', 'On Hold', 'Pending Vendor']
  
  let backlogCount = 0
  let overdueCount = 0
  let criticalCount = 0
  let totalPmScheduled = 0
  let pmCompletedOnTime = 0
  let pmCompletedLate = 0
  let pmOverdue = 0

  const agingBuckets = {
    '0-7': 0,
    '8-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0
  }

  const repeatFailuresMap = {}
  let totalRepeatFailures = 0

  const now = new Date()

  tickets.forEach(tkt => {
    const isPM = tkt.ticket_type === 'scheduled' || tkt.ticket_type === 'preventive' || tkt.title?.toLowerCase().includes('pm')
    const isOpen = OPEN_STATUSES.includes(tkt.status)
    const isCritical = tkt.priority === 'High' || tkt.priority === 'Critical' || tkt.priority === 'Urgent'
    const createdDate = new Date(tkt.created_at)
    
    let isOverdue = false
    if (tkt.sla_due_at) {
      isOverdue = isOpen && (new Date(tkt.sla_due_at) < now)
    } else {
      // Proxy SLA: 7 days for normal, 24h for critical
      const slaDays = isCritical ? 1 : 7
      const dueProxy = new Date(createdDate.getTime() + slaDays * 24 * 60 * 60 * 1000)
      isOverdue = isOpen && (dueProxy < now)
    }

    if (isOpen) {
      backlogCount++
      if (isOverdue) overdueCount++
      if (isCritical) criticalCount++

      // Aging
      const ageDays = (now - createdDate) / (1000 * 60 * 60 * 24)
      if (ageDays <= 7) agingBuckets['0-7']++
      else if (ageDays <= 30) agingBuckets['8-30']++
      else if (ageDays <= 60) agingBuckets['31-60']++
      else if (ageDays <= 90) agingBuckets['61-90']++
      else agingBuckets['90+']++
    }

    // PM Compliance Logic
    if (isPM) {
      totalPmScheduled++
      if (isOpen) {
        if (isOverdue) pmOverdue++
      } else if (tkt.resolved_at) {
        const resolvedDate = new Date(tkt.resolved_at)
        let dueD = tkt.sla_due_at ? new Date(tkt.sla_due_at) : new Date(createdDate.getTime() + 14 * 24 * 60 * 60 * 1000)
        if (resolvedDate <= dueD) {
          pmCompletedOnTime++
        } else {
          pmCompletedLate++
        }
      }
    }

    // Repeat Failure Tracking (Breakdowns)
    if (tkt.ticket_type === 'breakdown' || tkt.ticket_type === 'fault') {
      if (tkt.asset_id) {
        if (!repeatFailuresMap[tkt.asset_id]) repeatFailuresMap[tkt.asset_id] = []
        repeatFailuresMap[tkt.asset_id].push(tkt)
      }
    }
  })

  // Detect repeat failures (e.g. >=3 breakdowns in last 90 days for same asset)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  Object.keys(repeatFailuresMap).forEach(assetId => {
    const recentBreakdowns = repeatFailuresMap[assetId].filter(t => new Date(t.created_at) >= ninetyDaysAgo)
    if (recentBreakdowns.length >= 3) {
      totalRepeatFailures++
    }
  })

  const pmCompliancePct = totalPmScheduled > 0 ? Math.round((pmCompletedOnTime / totalPmScheduled) * 100) : null
  const confidence = tickets.some(t => t.sla_due_at) ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM

  return createDomainContract({
    status: DomainStatus.SUCCESS,
    value: pmCompliancePct,
    recordCount: tickets.length,
    source: 'maintenance_tickets',
    confidence,
    methodology: 'PM Compliance is calculated from scheduled/preventive tickets. Overdue tickets without explicit SLA dates use a proxy SLA of 7 days (normal) or 1 day (critical).',
    actions: [{ label: 'View Maintenance Backlog', route: '/admin/reports/maintenance-backlog' }],
    data: {
      backlogCount,
      overdueCount,
      criticalCount,
      agingBuckets,
      pmCompliance: pmCompliancePct !== null ? {
        score: pmCompliancePct,
        totalScheduled: totalPmScheduled,
        completedOnTime: pmCompletedOnTime,
        completedLate: pmCompletedLate,
        overdue: pmOverdue
      } : null,
      repeatFailuresCount: totalRepeatFailures
    }
  })
}


