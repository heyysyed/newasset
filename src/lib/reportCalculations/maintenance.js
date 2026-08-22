/**
 * Maintenance KPI & Reliability Engineering Calculations
 * MTTR, MTBF, Operational Availability %, and SLA Compliance
 */

/**
 * Calculates Mean Time To Repair (MTTR) in Hours
 * MTTR = Total Breakdown Downtime Hours / Total Number of Repairs
 */
export function calculateMTTR(totalDowntimeHours = 0, repairCount = 1) {
  const count = Math.max(1, Number(repairCount) || 1)
  const downtime = Math.max(0, Number(totalDowntimeHours) || 0)
  return Math.round((downtime / count) * 10) / 10
}

/**
 * Calculates Mean Time Between Failures (MTBF) in Operating Hours
 * MTBF = Operating Time Hours / Total Number of Failures
 */
export function calculateMTBF(operatingHours = 0, failureCount = 1) {
  const count = Math.max(1, Number(failureCount) || 1)
  const hours = Math.max(0, Number(operatingHours) || 0)
  return Math.round(hours / count)
}

/**
 * Calculates Equipment Operational Availability % (OEE Availability Component)
 * Availability % = ((Scheduled Operating Time - Downtime) / Scheduled Operating Time) * 100
 */
export function calculateAvailabilityPct(scheduledHours = 720, downtimeHours = 0) {
  const scheduled = Math.max(1, Number(scheduledHours) || 720)
  const downtime = Math.max(0, Number(downtimeHours) || 0)
  const uptime = Math.max(0, scheduled - downtime)
  return Math.min(100, Math.round((uptime / scheduled) * 100))
}

/**
 * Calculates Preventive Maintenance (PM) Compliance %
 * PM Compliance % = (PM Work Orders Completed On-Time / Total PM Work Orders Due) * 100
 */
export function calculatePMCompliancePct(completedOnTime = 0, totalDue = 1) {
  const due = Math.max(1, Number(totalDue) || 1)
  const completed = Math.max(0, Number(completedOnTime) || 0)
  return Math.min(100, Math.round((completed / due) * 100))
}
