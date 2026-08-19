import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────
// SHARED CONSTANTS
// ─────────────────────────────────────────────────────────
export const VARIANCE_THRESHOLDS = { CRITICAL: 10, HIGH: 5, MEDIUM: 2 }
const OPEN_STATUSES = ['open', 'assigned', 'working', 'in_progress', 'pending']
const CLOSED_STATUSES = ['resolved', 'closed']

// ─────────────────────────────────────────────────────────
// FORMATTING HELPERS
// ─────────────────────────────────────────────────────────
export function fmtDate(val) {
  if (!val) return 'N/A'
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return 'N/A'
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return 'N/A' }
}

export function daysBetween(a, b = new Date()) {
  if (!a) return null
  try {
    const diff = (new Date(b) - new Date(a)) / 86400000
    return isNaN(diff) ? null : Math.round(diff)
  } catch { return null }
}

export function yearsBetween(a, b = new Date()) {
  const d = daysBetween(a, b)
  return d === null ? null : d / 365.25
}

// ─────────────────────────────────────────────────────────
// DEPRECIATION ENGINE  
// ─────────────────────────────────────────────────────────
function calcDepreciation(asset, atDate = new Date()) {
  const purchaseVal = Number(asset.purchase_value) || 0
  if (purchaseVal === 0) return { purchaseVal: 0, accumDepr: 0, netBookValue: 0, deprPct: 0, yearsOwned: 0 }
  const salvageVal = Number(asset.salvage_value) || 0
  const usefulLife = Number(asset.useful_life_years) || 10
  const deprMethod = asset.depreciation_method || 'Straight Line'
  const deprRate = (Number(asset.depreciation_rate_percent) || 0) / 100
  const pDateStr = asset.purchase_date || asset.added_on || asset.created_at
  let yearsOwned = 0
  if (pDateStr) yearsOwned = Math.max(0, (new Date(atDate) - new Date(pDateStr)) / (1000 * 60 * 60 * 24 * 365.25))
  let netBookValue = purchaseVal, accumDepr = 0
  if (deprMethod === 'Reducing Balance' || deprMethod === 'Declining Balance') {
    const rate = deprRate || (1 - Math.pow(salvageVal / purchaseVal || 0.05, 1 / usefulLife))
    netBookValue = Math.max(salvageVal, purchaseVal * Math.pow(1 - rate, yearsOwned))
    accumDepr = purchaseVal - netBookValue
  } else {
    const annualDepr = (purchaseVal - salvageVal) / Math.max(1, usefulLife)
    accumDepr = Math.min(purchaseVal - salvageVal, annualDepr * yearsOwned)
    netBookValue = Math.max(salvageVal, purchaseVal - accumDepr)
  }
  return { purchaseVal: Math.round(purchaseVal), accumDepr: Math.round(accumDepr), netBookValue: Math.round(netBookValue), deprPct: purchaseVal > 0 ? Math.min(100, Math.round((accumDepr / purchaseVal) * 100)) : 0, yearsOwned: Math.round(yearsOwned * 10) / 10 }
}

/**
 * Normalizing Helper for Report Output Structure:
 * { summary: {...}, rows: [...], chartData: [...], columns: [...] }
 */

// 1. Executive Summary Report
export async function getExecutiveSummaryReport({ siteId = 'all', startDate = '', endDate = '' } = {}) {
  const now = new Date()
  let assetQ = supabase.from('assets').select('id, asset_code, asset_name, category, site, status, purchase_value, added_on, warranty_expiry').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (siteId !== 'all') assetQ = assetQ.eq('site', siteId)
  const [assetsRes, auditsRes, ticketsRes, movementsRes] = await Promise.all([
    assetQ,
    supabase.from('audit_assignments').select('id, status, due_date, created_at'),
    supabase.from('maintenance_tickets').select('id, status, priority, sla_due_at, asset_id, created_at'),
    supabase.from('asset_movements').select('asset_id, moved_at').order('moved_at', { ascending: false }),
  ])
  const assets = assetsRes.data || []
  const audits = auditsRes.data || []
  const tickets = ticketsRes.data || []
  const movements = movementsRes.data || []
  const totalAssets = assets.length
  const totalValuation = assets.reduce((sum, a) => sum + (Number(a.purchase_value) || 0), 0)
  const activeAssets = assets.filter(a => a.status === 'Active').length
  const underMaintenance = assets.filter(a => a.status === 'Under Maintenance' || a.status === 'maintenance').length
  const lastMoveByAsset = {}
  movements.forEach(m => { if (!lastMoveByAsset[m.asset_id] || new Date(m.moved_at) > new Date(lastMoveByAsset[m.asset_id])) lastMoveByAsset[m.asset_id] = m.moved_at })
  const idleAssets = assets.filter(a => { const lm = lastMoveByAsset[a.id]; if (!lm) return false; const d = daysBetween(lm); return d !== null && d > 30 }).length
  const warrantyExpiringSoon = assets.filter(a => { if (!a.warranty_expiry) return false; const d = daysBetween(now, new Date(a.warranty_expiry)); return d !== null && d >= 0 && d <= 60 }).length
  const openTickets = tickets.filter(t => OPEN_STATUSES.includes(t.status)).length
  const criticalTickets = tickets.filter(t => t.priority === 'critical' && OPEN_STATUSES.includes(t.status)).length
  const overdueTickets = tickets.filter(t => { if (!t.sla_due_at) return false; return OPEN_STATUSES.includes(t.status) && new Date(t.sla_due_at) < now }).length
  const completedAudits = audits.filter(a => a.status === 'completed').length
  const auditCompliancePct = audits.length > 0 ? Math.round((completedAudits / audits.length) * 100) : 0
  const siteMap = {}
  assets.forEach(a => {
    const key = getCanonicalSiteKey(a.site || 'Unassigned', siteMap)
    if (!siteMap[key]) siteMap[key] = { site: key, total_assets: 0, total_value: 0, open_tickets: 0 }
    siteMap[key].total_assets += 1
    siteMap[key].total_value += Number(a.purchase_value) || 0
  })
  const siteRows = Object.values(siteMap).sort((a, b) => b.total_value - a.total_value)
  const sixMonthTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i)
    const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const count = assets.filter(a => { if (!a.added_on) return false; const dd = new Date(a.added_on); return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() }).length
    sixMonthTrend.push({ name: monthLabel, additions: count })
  }
  const chartData = siteRows.slice(0, 8).map(r => ({ name: r.site, value: r.total_value }))
  const columns = [
    { key: 'site', label: 'Site Location' },
    { key: 'total_assets', label: 'Assets', format: 'number' },
    { key: 'total_value', label: 'Portfolio Value (₹)', format: 'currency' },
    { key: 'open_tickets', label: 'Open Tickets', format: 'number' },
  ]
  return {
    state: 'DATA_AVAILABLE',
    summary: { totalAssets, totalValuation, activeAssets, underMaintenance, idleAssets, openTickets, criticalTickets, overdueTickets, warrantyExpiringSoon, auditCompliancePct: `${auditCompliancePct}%` },
    chartData,
    lineChartData: sixMonthTrend,
    columns,
    rows: siteRows,
  }
}

// 2. Stock Variance Report
export async function getStockVarianceReport({ siteId = 'all', riskTier = 'all' } = {}) {
  let q = supabase.from('bulk_audits').select('*, bulk_items(id, item_code, item_name, unit, unit_price)')
  if (siteId !== 'all') q = q.eq('site', siteId)
  if (riskTier !== 'all') q = q.eq('risk_tier', riskTier)
  const { data, error } = await q.order('variance_value_inr', { ascending: false })
  if (error) throw error
  const raw = data || []
  const rows = raw.map(r => {
    const sysQty = Number(r.system_qty) || 0
    const phyQty = Number(r.physical_qty) || 0
    const varQty = phyQty - sysQty
    const unitPrice = Number(r.bulk_items?.unit_price) || 0
    const varValue = Math.round(varQty * unitPrice)
    const varPct = sysQty !== 0 ? Math.round((varQty / sysQty) * 100 * 10) / 10 : null
    const absPct = Math.abs(varPct || 0)
    let riskTierCalc = absPct >= VARIANCE_THRESHOLDS.CRITICAL ? 'Critical' : absPct >= VARIANCE_THRESHOLDS.HIGH ? 'High' : absPct >= VARIANCE_THRESHOLDS.MEDIUM ? 'Medium' : 'Low'
    return {
      id: r.id, site: r.site || 'N/A',
      item_code: r.bulk_items?.item_code || 'N/A', item_name: r.bulk_items?.item_name || 'N/A', unit: r.bulk_items?.unit || 'pcs',
      system_qty: sysQty, physical_qty: phyQty, variance_qty: varQty,
      variance_pct: varPct !== null ? `${varPct}%` : 'N/A', unit_price: unitPrice, variance_value_inr: varValue,
      risk_tier: r.risk_tier || riskTierCalc,
      is_high_risk_anomaly: r.is_high_risk_anomaly ? 'Yes' : 'No',
      matched_transfer_site: r.matched_transfer_site || 'N/A',
      audited_at: fmtDate(r.audited_at),
    }
  })
  const totalItems = rows.length
  const totalVarianceValue = rows.reduce((s, r) => s + r.variance_value_inr, 0)
  const criticalCount = rows.filter(r => r.risk_tier === 'Critical' || r.is_high_risk_anomaly === 'Yes').length
  const highCount = rows.filter(r => r.risk_tier === 'High').length
  const columns = [
    { key: 'site', label: 'Site' }, { key: 'item_code', label: 'Item Code' }, { key: 'item_name', label: 'Item Name' }, { key: 'unit', label: 'Unit' },
    { key: 'system_qty', label: 'System Qty', format: 'number' }, { key: 'physical_qty', label: 'Physical Qty', format: 'number' },
    { key: 'variance_qty', label: 'Variance Qty', format: 'number' }, { key: 'variance_pct', label: 'Variance %' },
    { key: 'unit_price', label: 'Unit Price (₹)', format: 'currency' }, { key: 'variance_value_inr', label: 'Variance Value (₹)', format: 'currency' },
    { key: 'risk_tier', label: 'Risk Tier', format: 'badge_risk' }, { key: 'matched_transfer_site', label: 'Matched Transfer' }, { key: 'audited_at', label: 'Audit Date' },
  ]
  const chartData = [
    { name: 'Critical', value: criticalCount }, { name: 'High', value: highCount },
    { name: 'Medium', value: rows.filter(r => r.risk_tier === 'Medium').length }, { name: 'Low', value: rows.filter(r => r.risk_tier === 'Low').length },
  ].filter(d => d.value > 0)
  return { state: 'DATA_AVAILABLE', summary: { totalItems, totalVarianceValue, criticalCount, surplusItems: rows.filter(r => r.variance_qty > 0).length, shortageItems: rows.filter(r => r.variance_qty < 0).length }, chartData, secondaryChartData: [...rows].sort((a, b) => Math.abs(b.variance_value_inr) - Math.abs(a.variance_value_inr)).slice(0, 5).map(r => ({ name: r.item_name, value: r.variance_value_inr })), columns, rows }
}

// 3. Audit Compliance Report
export async function getAuditComplianceReport({ siteId = 'all' } = {}) {
  const now = new Date()
  let q = supabase.from('audit_assignments').select('*, site:sites(name), auditor:profiles!assigned_to(full_name)')
  if (siteId !== 'all') q = q.eq('site_id', siteId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  const raw = data || []
  const rows = raw.map(a => {
    const overdueDays = (a.status !== 'completed' && a.due_date && new Date(a.due_date) < now) ? daysBetween(a.due_date, now) : null
    const daysToComplete = (a.status === 'completed' && a.created_at && a.due_date) ? daysBetween(a.created_at, a.due_date) : null
    return { ...a, site_name: a.site?.name || 'Unassigned', auditor_name: a.auditor?.full_name || 'Unassigned', geofence_status: a.geofence_verified ? 'Verified (On-Site)' : 'Unverified', overdue_days: overdueDays !== null ? overdueDays : 'N/A', days_to_complete: daysToComplete !== null ? daysToComplete : 'N/A', due_date: fmtDate(a.due_date), created_at: fmtDate(a.created_at) }
  })
  const totalAudits = rows.length
  const completed = rows.filter(a => a.status === 'completed').length
  const pending = rows.filter(a => a.status === 'pending').length
  const inProgress = rows.filter(a => a.status === 'in_progress').length
  const overdue = rows.filter(a => a.overdue_days !== 'N/A' && a.overdue_days > 0).length
  const complianceRate = totalAudits > 0 ? Math.round((completed / totalAudits) * 100) : 0
  const geofenced = rows.filter(a => a.geofence_verified).length
  const geofencePassRate = totalAudits > 0 ? Math.round((geofenced / totalAudits) * 100) : 0
  const completedWithDays = rows.filter(a => a.days_to_complete !== 'N/A')
  const avgCompletionDays = completedWithDays.length > 0 ? Math.round(completedWithDays.reduce((s, a) => s + (a.days_to_complete || 0), 0) / completedWithDays.length) : null
  const sixMonthTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i)
    const ml = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const mA = raw.filter(a => { if (!a.created_at) return false; const dd = new Date(a.created_at); return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() })
    const mC = mA.filter(a => a.status === 'completed').length
    sixMonthTrend.push({ name: ml, compliance: mA.length > 0 ? Math.round((mC / mA.length) * 100) : 0, total: mA.length })
  }
  const columns = [
    { key: 'title', label: 'Audit Title' }, { key: 'site_name', label: 'Site' }, { key: 'auditor_name', label: 'Auditor' },
    { key: 'status', label: 'Status', format: 'badge_status' }, { key: 'geofence_status', label: 'Geofence' },
    { key: 'due_date', label: 'Due Date' }, { key: 'overdue_days', label: 'Overdue (Days)' }, { key: 'days_to_complete', label: 'Completion Days' },
  ]
  const chartData = [{ name: 'Completed', value: completed }, { name: 'In Progress', value: inProgress }, { name: 'Pending', value: pending }, { name: 'Overdue', value: overdue }].filter(d => d.value > 0)
  return { state: 'DATA_AVAILABLE', summary: { totalAudits, completed, overdue, complianceRate: `${complianceRate}%`, geofencePassRate: `${geofencePassRate}%`, avgCompletionDays: avgCompletionDays !== null ? `${avgCompletionDays} days` : 'N/A' }, chartData, lineChartData: sixMonthTrend, columns, rows }
}

// 4. Asset Health Trend Report
export async function getAssetHealthTrendReport({ siteId = 'all', category = 'all' } = {}) {
  let assetQ = supabase.from('assets').select('id, asset_code, asset_name, category, site, status, condition, purchase_date, added_on').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (siteId !== 'all') assetQ = assetQ.eq('site', siteId)
  if (category !== 'all') assetQ = assetQ.eq('category', category)
  const [assetsRes, ticketsRes, schedulesRes] = await Promise.all([
    assetQ,
    supabase.from('maintenance_tickets').select('asset_id, status, priority, created_at, ticket_type').in('status', OPEN_STATUSES),
    supabase.from('maintenance_schedules').select('asset_id, next_due, status').eq('status', 'active'),
  ])
  const assets = assetsRes.data || []
  const openTickets = ticketsRes.data || []
  const schedules = schedulesRes.data || []
  const now = new Date()
  const ticketsByAsset = {}; openTickets.forEach(t => { if (!ticketsByAsset[t.asset_id]) ticketsByAsset[t.asset_id] = []; ticketsByAsset[t.asset_id].push(t) })
  const scheduleByAsset = {}; schedules.forEach(s => { scheduleByAsset[s.asset_id] = s })
  const rows = assets.map(a => {
    let condScore = 100
    const cond = (a.condition || '').toLowerCase()
    if (cond === 'damaged') condScore = 60; else if (cond === 'needs_repair') condScore = 50; else if (cond === 'non_functional') condScore = 20; else if (cond === 'missing') condScore = 0; else if (cond === 'poor') condScore = 65; else if (cond === 'fair') condScore = 80
    const assetTickets = ticketsByAsset[a.id] || []
    const criticalOpen = assetTickets.filter(t => t.priority === 'critical').length
    const highOpen = assetTickets.filter(t => t.priority === 'high').length
    let maintScore = Math.max(0, Math.min(100, 100 - (criticalOpen * 25) - (highOpen * 10) - (assetTickets.length * 5)))
    const sched = scheduleByAsset[a.id]
    let pmScore = 100, nextServiceDue = 'N/A'
    if (sched?.next_due) {
      const daysUntilPM = daysBetween(now, new Date(sched.next_due))
      nextServiceDue = fmtDate(sched.next_due)
      if (daysUntilPM !== null) { if (daysUntilPM < 0) pmScore = 30; else if (daysUntilPM <= 7) pmScore = 60; else if (daysUntilPM <= 30) pmScore = 85 }
    }
    const healthScore = Math.max(0, Math.min(100, Math.round((condScore * 0.40) + (maintScore * 0.35) + (pmScore * 0.25))))
    let healthStatus = healthScore < 50 ? 'Critical' : healthScore < 70 ? 'Attention' : healthScore < 85 ? 'Watch' : 'Healthy'
    if (sched?.next_due && daysBetween(now, new Date(sched.next_due)) !== null && daysBetween(now, new Date(sched.next_due)) <= 7) healthStatus = 'SERVICE DUE'
    return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', status: a.status || 'N/A', condition: a.condition || 'N/A', open_tickets: assetTickets.length, next_service_due: nextServiceDue, health_score: healthScore, health_status: healthStatus }
  }).sort((a, b) => a.health_score - b.health_score)
  const totalAssets = rows.length
  const avgHealthScore = totalAssets > 0 ? Math.round(rows.reduce((s, r) => s + r.health_score, 0) / totalAssets) : 0
  const criticalAssets = rows.filter(r => r.health_score < 50).length
  const serviceDueAssets = rows.filter(r => r.health_status === 'SERVICE DUE').length
  const columns = [
    { key: 'asset_code', label: 'Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' },
    { key: 'condition', label: 'Condition' }, { key: 'open_tickets', label: 'Open Tickets', format: 'number' }, { key: 'next_service_due', label: 'Next PM Due' },
    { key: 'health_score', label: 'Health Score', format: 'progress' }, { key: 'health_status', label: 'Status', format: 'badge_health' },
  ]
  const chartData = [{ name: 'Healthy (≥85)', value: rows.filter(r => r.health_score >= 85).length }, { name: 'Watch (70-84)', value: rows.filter(r => r.health_score >= 70 && r.health_score < 85).length }, { name: 'Attention (50-69)', value: rows.filter(r => r.health_score >= 50 && r.health_score < 70).length }, { name: 'Critical (<50)', value: criticalAssets }].filter(d => d.value > 0)
  return { state: 'DATA_AVAILABLE', summary: { totalAssets, avgHealthScore, criticalAssets, serviceDueAssets }, chartData, columns, rows }
}

// 5. Maintenance Cost Report
export async function getMaintenanceCostReport({ siteId = 'all' } = {}) {
  const now = new Date()
  const [logsRes, ticketsRes] = await Promise.all([
    supabase.from('maintenance_logs').select('id, asset_id, cost, performed_at, work_done, assets!asset_id(asset_code, asset_name, category, site)').order('performed_at', { ascending: false }),
    supabase.from('maintenance_tickets').select('id, ticket_no, title, priority, status, ticket_type, asset_id, created_at, resolved_at, downtime_start, downtime_end, sla_due_at, assets!asset_id(asset_code, asset_name, category, site)').order('created_at', { ascending: false }),
  ])
  let logs = (logsRes.data || []).filter(l => siteId === 'all' || l.assets?.site === siteId)
  let tickets = (ticketsRes.data || []).filter(t => siteId === 'all' || t.assets?.site === siteId)
  const costByAsset = {}; logs.forEach(l => { costByAsset[l.asset_id] = (costByAsset[l.asset_id] || 0) + (Number(l.cost) || 0) })
  const rows = tickets.map(t => {
    const resHrs = t.resolved_at && t.created_at ? Math.round(((new Date(t.resolved_at) - new Date(t.created_at)) / 3600000) * 10) / 10 : null
    const dtHrs = t.downtime_start && t.downtime_end ? Math.round(((new Date(t.downtime_end) - new Date(t.downtime_start)) / 3600000) * 10) / 10 : null
    return { id: t.id, ticket_no: t.ticket_no || 'N/A', title: t.title || 'N/A', asset_code: t.assets?.asset_code || 'N/A', asset_name: t.assets?.asset_name || 'N/A', category: t.assets?.category || 'N/A', site: t.assets?.site || 'N/A', priority: t.priority || 'normal', status: t.status || 'open', ticket_type: t.ticket_type || 'other', cost: Number(costByAsset[t.asset_id]) || 0, resolution_hrs: resHrs !== null ? resHrs : 'N/A', downtime_hrs: dtHrs !== null ? dtHrs : 'N/A', sla_breach: (t.sla_due_at && OPEN_STATUSES.includes(t.status) && new Date(t.sla_due_at) < now) ? 'YES' : 'No', created_at: fmtDate(t.created_at) }
  })
  const sixMonthTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i)
    const ml = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const mc = logs.filter(l => { if (!l.performed_at) return false; const dd = new Date(l.performed_at); return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() }).reduce((s, l) => s + (Number(l.cost) || 0), 0)
    sixMonthTrend.push({ name: ml, cost: Math.round(mc) })
  }
  const assetCostMap = {}; logs.forEach(l => { const k = l.asset_id; if (!assetCostMap[k]) assetCostMap[k] = { asset_name: l.assets?.asset_name || 'N/A', site: l.assets?.site || 'N/A', total_cost: 0, count: 0 }; assetCostMap[k].total_cost += Number(l.cost) || 0; assetCostMap[k].count += 1 })
  const top5Assets = Object.values(assetCostMap).sort((a, b) => b.total_cost - a.total_cost).slice(0, 5)
  const totalCost = logs.reduce((s, l) => s + (Number(l.cost) || 0), 0)
  const totalTickets = tickets.length
  const resolvedCount = tickets.filter(t => CLOSED_STATUSES.includes(t.status)).length
  const slaBreachCount = rows.filter(r => r.sla_breach === 'YES').length
  const typeMap = {}; tickets.forEach(t => { const typ = t.ticket_type || 'other'; typeMap[typ] = (typeMap[typ] || 0) + 1 })
  const chartData = Object.entries(typeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const columns = [
    { key: 'ticket_no', label: 'Ticket #' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'site', label: 'Site' },
    { key: 'ticket_type', label: 'Type', format: 'badge_type' }, { key: 'priority', label: 'Priority', format: 'badge_priority' }, { key: 'status', label: 'Status', format: 'badge_status' },
    { key: 'cost', label: 'Cost (₹)', format: 'currency' }, { key: 'resolution_hrs', label: 'Resolution (Hrs)' }, { key: 'downtime_hrs', label: 'Downtime (Hrs)' }, { key: 'sla_breach', label: 'SLA Breach', format: 'badge_yesno' }, { key: 'created_at', label: 'Created' },
  ]
  return { state: 'DATA_AVAILABLE', summary: { totalCost, totalTickets, resolvedCount, avgCostPerTicket: totalTickets > 0 ? Math.round(totalCost / totalTickets) : 0, slaBreachCount }, chartData, lineChartData: sixMonthTrend, secondaryChartData: top5Assets.map(a => ({ name: a.asset_name, value: a.total_cost })), columns, rows: rows.slice(0, 300) }
}

/**
 * Helper to resolve raw site names to canonical site keys in map to prevent duplicate short/long name rows
 * (e.g. merges "BALMORAL" into "P158 - P158 BALMORAL")
 */
export function getCanonicalSiteKey(rawSite, map = {}) {
  if (!rawSite) return 'Unassigned Site'
  const rawClean = String(rawSite).trim().toLowerCase()

  // 1. Direct key match
  for (const existingKey of Object.keys(map)) {
    if (rawClean === existingKey.toLowerCase()) {
      return existingKey
    }
  }

  // 2. Substring & word overlap token matching
  for (const existingKey of Object.keys(map)) {
    const existingClean = existingKey.toLowerCase()

    const rawWords = rawClean.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3)
    const existingWords = existingClean.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3)

    const hasOverlap = rawWords.some(rw => existingWords.includes(rw))
    if (hasOverlap) {
      // If rawSite is longer / contains site codes, upgrade existingKey to rawSite
      if (rawSite.length > existingKey.length) {
        const item = map[existingKey]
        delete map[existingKey]
        item.site = rawSite
        map[rawSite] = item
        return rawSite
      }
      return existingKey
    }
  }

  return rawSite
}

// 6. Site Comparison Report
export async function getSiteComparisonReport() {
  const [sitesRes, assetsRes, bulkRes, ticketsRes] = await Promise.all([
    fetchSites(),
    supabase.from('assets').select('site, purchase_value').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%'),
    supabase.from('bulk_audits').select('site, variance_value_inr, is_high_risk_anomaly'),
    supabase.from('maintenance_tickets').select('site, cost'),
  ])

  const assets = assetsRes.data || []
  const bulks = bulkRes.data || []
  const tickets = ticketsRes.data || []

  const siteMap = {}

  // 1. Process Assets (Primary source of active site assets)
  assets.forEach(a => {
    const rawS = a.site || 'Main Site'
    const key = getCanonicalSiteKey(rawS, siteMap)
    if (!siteMap[key]) {
      siteMap[key] = { site: key, total_assets: 0, total_value: 0, variance_value: 0, open_tickets: 0 }
    }
    siteMap[key].total_assets += 1
    siteMap[key].total_value += Number(a.purchase_value) || 0
  })

  // 2. Process Bulk Variance
  bulks.forEach(b => {
    const rawS = b.site || 'Main Site'
    const key = getCanonicalSiteKey(rawS, siteMap)
    if (!siteMap[key]) {
      siteMap[key] = { site: key, total_assets: 0, total_value: 0, variance_value: 0, open_tickets: 0 }
    }
    siteMap[key].variance_value += Number(b.variance_value_inr) || 0
  })

  // 3. Process Maintenance Tickets
  tickets.forEach(t => {
    const rawS = t.site || 'Main Site'
    const key = getCanonicalSiteKey(rawS, siteMap)
    if (!siteMap[key]) {
      siteMap[key] = { site: key, total_assets: 0, total_value: 0, variance_value: 0, open_tickets: 0 }
    }
    siteMap[key].open_tickets += 1
  })

  // Filter out zero-activity ghost sites to prevent duplicate rows
  const rows = Object.values(siteMap)
    .filter(r => r.total_assets > 0 || r.total_value > 0 || r.variance_value > 0 || r.open_tickets > 0)
    .sort((a, b) => b.total_value - a.total_value)

  const columns = [
    { key: 'site', label: 'Site Name' },
    { key: 'total_assets', label: 'Assets', format: 'number' },
    { key: 'total_value', label: 'Portfolio Value (₹)', format: 'currency' },
    { key: 'variance_value', label: 'Variance (₹)', format: 'currency' },
    { key: 'open_tickets', label: 'Tickets', format: 'number' },
  ]

  const chartData = rows.map(r => ({ name: r.site, value: r.total_value })).slice(0, 7)

  return {
    summary: {
      totalSites: rows.length,
      totalValuation: rows.reduce((s, r) => s + r.total_value, 0),
      totalVariance: rows.reduce((s, r) => s + r.variance_value, 0),
    },
    chartData,
    columns,
    rows,
  }
}

// 7. Hire vs Buy Lease Analysis Report
export async function getHireVsBuyReport({ siteId = 'all' } = {}) {
  let q = supabase.from('assets').select('id, asset_code, asset_name, category, site, purchase_value, salvage_value, added_on, purchase_date, useful_life_years').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (siteId !== 'all') q = q.eq('site', siteId)
  const { data, error } = await q
  if (error) throw error
  const assets = data || []
  const rows = assets.map(a => {
    const purchaseVal = Number(a.purchase_value) || 0
    const usefulLife = Number(a.useful_life_years) || 10
    const ageDays = (a.added_on || a.purchase_date) ? Math.max(0, Math.round((new Date() - new Date(a.added_on || a.purchase_date)) / 86400000)) : 0
    const dailyOwnershipCost = usefulLife > 0 && purchaseVal > 0 ? Math.round(purchaseVal / (usefulLife * 365)) : 0
    const recommendation = ageDays < 90 ? 'HIRE (Short Project)' : ageDays < 365 ? 'LEASE (Medium Term)' : 'OWN (Long Term)'
    return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', purchase_value: purchaseVal, useful_life_years: usefulLife, age_days: ageDays, daily_ownership_cost: dailyOwnershipCost, recommendation }
  }).sort((a, b) => b.purchase_value - a.purchase_value)
  const totalAssetsAnalyzed = rows.length
  const totalPurchaseValue = rows.reduce((s, r) => s + r.purchase_value, 0)
  const ownCount = rows.filter(r => r.recommendation.startsWith('OWN')).length
  const columns = [
    { key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Equipment Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' },
    { key: 'purchase_value', label: 'Purchase Value (₹)', format: 'currency' }, { key: 'useful_life_years', label: 'Useful Life (Yrs)' },
    { key: 'age_days', label: 'Age (Days)', format: 'number' }, { key: 'daily_ownership_cost', label: 'Daily Cost (₹)', format: 'currency' }, { key: 'recommendation', label: 'Recommendation', format: 'badge_status' },
  ]
  const recMap = {}; rows.forEach(r => { recMap[r.recommendation.split(' ')[0]] = (recMap[r.recommendation.split(' ')[0]] || 0) + 1 })
  return { state: 'DATA_AVAILABLE', summary: { totalAssetsAnalyzed, totalPurchaseValue, ownCount }, chartData: Object.entries(recMap).map(([name, value]) => ({ name, value })), columns, rows }
}

// 8. Warranty Radar Report — REAL WARRANTY DATA ONLY. No fabricated expiry dates.
export async function getWarrantyRadarReport({ siteId = 'all' } = {}) {
  let q = supabase.from('assets').select('id, asset_code, asset_name, make, model_no, category, site, purchase_value, warranty_expiry, purchase_date').not('warranty_expiry', 'is', null).or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (siteId !== 'all') q = q.eq('site', siteId)
  const { data, error } = await q
  if (error) throw error
  const now = new Date()
  const assets = data || []
  const rows = assets.map(a => {
    const expDate = new Date(a.warranty_expiry)
    const daysRemaining = daysBetween(now, expDate)
    let bucket = 'Active (90+ days)', warranty_status = 'ACTIVE'
    if (daysRemaining === null) { bucket = 'Unknown'; warranty_status = 'UNKNOWN' }
    else if (daysRemaining < 0) { bucket = 'Expired'; warranty_status = 'EXPIRED' }
    else if (daysRemaining <= 30) { bucket = '0–30 Days'; warranty_status = 'EXPIRING SOON' }
    else if (daysRemaining <= 60) { bucket = '31–60 Days'; warranty_status = 'EXPIRING' }
    else if (daysRemaining <= 90) { bucket = '61–90 Days'; warranty_status = 'EXPIRING' }
    return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', make: a.make || 'N/A', model_no: a.model_no || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', purchase_value: Number(a.purchase_value) || 0, warranty_expiry: fmtDate(a.warranty_expiry), days_remaining: daysRemaining !== null ? daysRemaining : 'N/A', expiry_bucket: bucket, warranty_status }
  }).sort((a, b) => { const da = typeof a.days_remaining === 'number' ? a.days_remaining : 99999; const db = typeof b.days_remaining === 'number' ? b.days_remaining : 99999; return da - db })
  const expired = rows.filter(r => r.warranty_status === 'EXPIRED').length
  const expiringSoon30 = rows.filter(r => r.expiry_bucket === '0–30 Days').length
  const expiringSoon60 = rows.filter(r => r.expiry_bucket === '31–60 Days').length
  const active = rows.filter(r => r.warranty_status === 'ACTIVE').length
  const atRiskValue = rows.filter(r => r.warranty_status !== 'ACTIVE').reduce((s, r) => s + r.purchase_value, 0)
  const columns = [
    { key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'make', label: 'Make' }, { key: 'model_no', label: 'Model' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' },
    { key: 'purchase_value', label: 'Asset Value (₹)', format: 'currency' }, { key: 'warranty_expiry', label: 'Expiry Date' }, { key: 'days_remaining', label: 'Days Remaining' }, { key: 'warranty_status', label: 'Warranty Status', format: 'badge_warranty' },
  ]
  const chartData = [{ name: 'Expired', value: expired }, { name: 'Expiring (0-30d)', value: expiringSoon30 }, { name: 'Expiring (31-60d)', value: expiringSoon60 }, { name: 'Active (60+ days)', value: active }].filter(d => d.value > 0)
  return { state: 'DATA_AVAILABLE', summary: { totalWithWarranty: rows.length, expired, expiringSoon30, active, atRiskValue }, chartData, columns, rows, dataQuality: { missingCount: 0, warrantyDataPct: `Only assets with actual warranty_expiry are shown` } }
}

// 9. Idle Asset Radar Report — REAL MOVEMENT DATA ONLY. No random timestamps.
export async function getIdleRadarReport({ siteId = 'all' } = {}) {
  let assetQ = supabase.from('assets').select('id, asset_code, asset_name, category, site, status, purchase_value, added_on').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (siteId !== 'all') assetQ = assetQ.eq('site', siteId)
  const [assetsRes, movementsRes, activityRes] = await Promise.all([
    assetQ,
    supabase.from('asset_movements').select('asset_id, moved_at'),
    supabase.from('activity_logs').select('entity_id, entity_type, created_at').eq('entity_type', 'asset').order('created_at', { ascending: false }),
  ])
  const assets = assetsRes.data || []
  const movements = movementsRes.data || []
  const activityLogs = activityRes.data || []
  const now = new Date()
  const lastMoveByAsset = {}; movements.forEach(m => { if (!lastMoveByAsset[m.asset_id] || new Date(m.moved_at) > new Date(lastMoveByAsset[m.asset_id])) lastMoveByAsset[m.asset_id] = m.moved_at })
  const lastActivityByAsset = {}; activityLogs.forEach(l => { if (l.entity_id && !lastActivityByAsset[l.entity_id]) lastActivityByAsset[l.entity_id] = l.created_at })
  const rows = assets.map(a => {
    const lm = lastMoveByAsset[a.id], la = lastActivityByAsset[a.id]
    let lastActiveDate = null
    if (lm && la) lastActiveDate = new Date(lm) > new Date(la) ? lm : la
    else if (lm) lastActiveDate = lm
    else if (la) lastActiveDate = la
    const daysIdle = lastActiveDate ? daysBetween(lastActiveDate) : null
    const purchaseVal = Number(a.purchase_value) || 0
    let idle_status = 'Unknown'
    if (daysIdle !== null) { idle_status = daysIdle <= 30 ? 'Active' : daysIdle <= 60 ? 'Low Idle' : daysIdle <= 90 ? 'Medium Idle' : daysIdle <= 180 ? 'High Idle' : 'Critical Idle' }
    return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', status: a.status || 'N/A', last_active_date: lastActiveDate ? fmtDate(lastActiveDate) : 'N/A', days_idle: daysIdle !== null ? daysIdle : 'N/A', purchase_value: purchaseVal, idle_status }
  }).sort((a, b) => { const da = typeof a.days_idle === 'number' ? a.days_idle : -1; const db = typeof b.days_idle === 'number' ? b.days_idle : -1; return db - da })
  const idleRows = rows.filter(r => typeof r.days_idle === 'number' && r.days_idle > 30)
  const totalIdleAssets = idleRows.length
  const totalIdleCapitalValue = idleRows.reduce((s, r) => s + r.purchase_value, 0)
  const criticalIdleCount = rows.filter(r => r.idle_status === 'Critical Idle').length
  const unknownActivity = rows.filter(r => r.last_active_date === 'N/A').length
  const avgIdleDays = idleRows.length > 0 ? Math.round(idleRows.reduce((s, r) => s + (typeof r.days_idle === 'number' ? r.days_idle : 0), 0) / idleRows.length) : 0
  const columns = [
    { key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' }, { key: 'status', label: 'Status', format: 'badge_status' },
    { key: 'last_active_date', label: 'Last Activity' }, { key: 'days_idle', label: 'Days Idle' }, { key: 'purchase_value', label: 'Asset Value (₹)', format: 'currency' }, { key: 'idle_status', label: 'Idle Status', format: 'badge_idle' },
  ]
  const chartData = [
    { name: 'Active (≤30d)', value: rows.filter(r => r.idle_status === 'Active').length }, { name: 'Low Idle (31-60d)', value: rows.filter(r => r.idle_status === 'Low Idle').length },
    { name: 'Medium Idle (61-90d)', value: rows.filter(r => r.idle_status === 'Medium Idle').length }, { name: 'High Idle (91-180d)', value: rows.filter(r => r.idle_status === 'High Idle').length },
    { name: 'Critical Idle (180d+)', value: criticalIdleCount }, { name: 'Unknown Activity', value: unknownActivity },
  ].filter(d => d.value > 0)
  return { state: 'DATA_AVAILABLE', summary: { totalIdleAssets, totalIdleCapitalValue, criticalIdleCount, avgIdleDays, unknownActivity }, chartData, columns, rows, dataQuality: { complete: unknownActivity === 0, missingFields: unknownActivity > 0 ? [`${unknownActivity} assets have no movement or activity records`] : [] } }
}

// 10. Statutory & Fitness Compliance Report — REAL FIELDS ONLY. No synthetic expiry dates.
export async function getStatutoryComplianceReport({ siteId = 'all' } = {}) {
  let q = supabase.from('assets').select('id, asset_code, asset_name, category, site, status, condition, warranty_expiry, disposal_date, added_on, purchase_date').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (siteId !== 'all') q = q.eq('site', siteId)
  const { data, error } = await q
  if (error) throw error
  const now = new Date()
  const assets = data || []
  const rows = assets.map(a => {
    const warrantyDays = a.warranty_expiry ? daysBetween(now, new Date(a.warranty_expiry)) : null
    const disposalSet = !!a.disposal_date
    let compliance_status = 'UNKNOWN', risk_notes = []
    if (a.status === 'Disposed' || a.status === 'disposed' || disposalSet) { compliance_status = 'DISPOSED' }
    else if (a.condition === 'non_functional' || a.condition === 'missing') { compliance_status = 'NON COMPLIANT'; risk_notes.push('Non-functional/Missing') }
    else if (warrantyDays !== null) {
      if (warrantyDays < 0) { compliance_status = 'WARRANTY EXPIRED'; risk_notes.push('Warranty expired') }
      else if (warrantyDays <= 30) { compliance_status = 'EXPIRING SOON'; risk_notes.push(`Warranty expires in ${warrantyDays} days`) }
      else { compliance_status = 'WARRANTY ACTIVE' }
    } else if (a.condition && a.condition !== 'good' && a.condition !== 'excellent') { compliance_status = 'ATTENTION'; risk_notes.push(`Condition: ${a.condition}`) }
    else if (a.status === 'Active') { compliance_status = 'OPERATIONAL' }
    return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', status: a.status || 'N/A', condition: a.condition || 'N/A', warranty_expiry: a.warranty_expiry ? fmtDate(a.warranty_expiry) : 'N/A', warranty_days_remaining: warrantyDays !== null ? warrantyDays : 'N/A', disposal_date: a.disposal_date ? fmtDate(a.disposal_date) : 'N/A', compliance_status, risk_notes: risk_notes.join('; ') || 'None' }
  }).sort((a, b) => { const order = { 'NON COMPLIANT': 0, 'WARRANTY EXPIRED': 1, 'EXPIRING SOON': 2, 'ATTENTION': 3, 'UNKNOWN': 4, 'OPERATIONAL': 5, 'WARRANTY ACTIVE': 6, 'DISPOSED': 7 }; return (order[a.compliance_status] ?? 9) - (order[b.compliance_status] ?? 9) })
  const nonCompliant = rows.filter(r => r.compliance_status === 'NON COMPLIANT' || r.compliance_status === 'WARRANTY EXPIRED').length
  const expiringSoon = rows.filter(r => r.compliance_status === 'EXPIRING SOON').length
  const operational = rows.filter(r => r.compliance_status === 'OPERATIONAL' || r.compliance_status === 'WARRANTY ACTIVE').length
  const unknown = rows.filter(r => r.compliance_status === 'UNKNOWN').length
  const complianceRatePct = rows.length > 0 ? Math.round((operational / rows.length) * 100) : 0
  const columns = [
    { key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Equipment Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' },
    { key: 'status', label: 'Asset Status', format: 'badge_status' }, { key: 'condition', label: 'Condition' },
    { key: 'warranty_expiry', label: 'Warranty Expiry' }, { key: 'warranty_days_remaining', label: 'Warranty Days' },
    { key: 'compliance_status', label: 'Compliance Status', format: 'badge_compliance' }, { key: 'risk_notes', label: 'Risk Notes' },
  ]
  const chartData = [{ name: 'Operational/Active', value: operational }, { name: 'Expiring Soon', value: expiringSoon }, { name: 'Non-Compliant/Expired', value: nonCompliant }, { name: 'Unknown', value: unknown }].filter(d => d.value > 0)
  return { state: 'DATA_AVAILABLE', summary: { totalAssets: rows.length, operational, expiringSoon, nonCompliant, unknown, complianceRatePct: `${complianceRatePct}%` }, chartData, columns, rows, dataQuality: { complete: unknown === 0, missingFields: unknown > 0 ? [`${unknown} assets have incomplete compliance data — shown as UNKNOWN`] : [] } }
}

// 11. Scrap Yield & Salvage Realization Report — DISPOSAL RECORDS ONLY. No estimated salvage.
export async function getScrapYieldReport({ siteId = 'all' } = {}) {
  let q = supabase.from('assets').select('id, asset_code, asset_name, category, site, purchase_value, salvage_value, scrap_value, disposal_date, disposal_reason, scrap_date, scrap_reason, is_scrapped, status, added_on, purchase_date, useful_life_years, depreciation_method, depreciation_rate_percent')
  if (siteId !== 'all') q = q.eq('site', siteId)
  const { data, error } = await q
  if (error) throw error
  const assets = data || []
  const eligibleAssets = assets.filter(a => a.disposal_date || a.is_scrapped || a.scrap_date || a.status === 'Disposed' || a.status === 'Scrapped' || a.status === 'disposed')
  const rows = eligibleAssets.map(a => {
    const purchaseVal = Number(a.purchase_value) || 0
    const scrapVal = Number(a.scrap_value) || Number(a.salvage_value) || null
    const depr = calcDepreciation(a)
    const bookVal = depr.netBookValue
    const yieldDelta = scrapVal !== null ? Math.round(scrapVal - bookVal) : null
    const recoveryPct = purchaseVal > 0 && scrapVal !== null ? Math.round((scrapVal / purchaseVal) * 100) : null
    return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', disposal_date: fmtDate(a.disposal_date || a.scrap_date), disposal_reason: a.disposal_reason || a.scrap_reason || 'N/A', purchase_value: purchaseVal, net_book_value: bookVal, scrap_salvage_value: scrapVal !== null ? scrapVal : 'N/A', yield_delta: yieldDelta !== null ? yieldDelta : 'N/A', recovery_pct: recoveryPct !== null ? `${recoveryPct}%` : 'N/A' }
  }).sort((a, b) => (Number(b.scrap_salvage_value) || 0) - (Number(a.scrap_salvage_value) || 0))
  const totalDisposed = rows.length
  const totalOriginalValue = rows.reduce((s, r) => s + (r.purchase_value || 0), 0)
  const totalBookValue = rows.reduce((s, r) => s + r.net_book_value, 0)
  const totalScrapProceeds = rows.filter(r => typeof r.scrap_salvage_value === 'number').reduce((s, r) => s + r.scrap_salvage_value, 0)
  const missingScrapValue = rows.filter(r => r.scrap_salvage_value === 'N/A').length
  const columns = [
    { key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Equipment Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' },
    { key: 'disposal_date', label: 'Disposal Date' }, { key: 'disposal_reason', label: 'Reason' }, { key: 'purchase_value', label: 'Original Cost (₹)', format: 'currency' },
    { key: 'net_book_value', label: 'Book Value (₹)', format: 'currency' }, { key: 'scrap_salvage_value', label: 'Scrap Proceeds (₹)', format: 'currency' }, { key: 'yield_delta', label: 'Yield Variance (₹)' }, { key: 'recovery_pct', label: 'Recovery %' },
  ]
  const chartData = [{ name: 'With Scrap Proceeds', value: rows.filter(r => typeof r.scrap_salvage_value === 'number').length }, { name: 'No Proceeds Recorded', value: missingScrapValue }].filter(d => d.value > 0)
  return { state: eligibleAssets.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalDisposed, totalOriginalValue, totalBookValue, totalScrapProceeds, missingScrapValue }, chartData, columns, rows, dataQuality: { complete: missingScrapValue === 0, missingFields: missingScrapValue > 0 ? [`${missingScrapValue} disposals have no scrap/salvage value recorded`] : [] } }
}

// 12. Consumables & Material Burn Rate Report — REAL inventory_transactions data.
export async function getConsumablesBurnReport({ siteId = 'all' } = {}) {
  const now = new Date()
  const [itemsRes, txRes] = await Promise.all([
    supabase.from('inventory_items').select('id, item_code, item_name, category, unit, current_stock, reorder_level, unit_cost, location'),
    supabase.from('inventory_transactions').select('item_id, transaction_type, quantity, transaction_at').in('transaction_type', ['issue', 'transfer']).order('transaction_at', { ascending: false }),
  ])
  const items = itemsRes.data || []
  const transactions = txRes.data || []
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const burnByItem = {}; transactions.forEach(tx => { if (new Date(tx.transaction_at) >= thirtyDaysAgo) burnByItem[tx.item_id] = (burnByItem[tx.item_id] || 0) + (Number(tx.quantity) || 0) })
  const rows = items.map(it => {
    const currentStock = Number(it.current_stock) || 0
    const reorderLevel = Number(it.reorder_level) || 0
    const unitCost = Number(it.unit_cost) || 0
    const monthlyBurnRate = burnByItem[it.id] || 0
    const stockValue = Math.round(currentStock * unitCost)
    const daysToStockout = monthlyBurnRate > 0 ? Math.round((currentStock / monthlyBurnRate) * 30) : null
    let stockout_risk = 'No Burn Data'
    if (monthlyBurnRate > 0) { stockout_risk = currentStock <= reorderLevel ? 'REORDER REQUIRED' : daysToStockout !== null && daysToStockout <= 7 ? 'CRITICAL' : daysToStockout !== null && daysToStockout <= 15 ? 'WARNING' : 'HEALTHY' }
    return { id: it.id, item_code: it.item_code, item_name: it.item_name, category: it.category || 'General', unit: it.unit || 'pcs', current_stock: currentStock, reorder_level: reorderLevel, unit_cost: unitCost, stock_value: stockValue, monthly_burn_rate: monthlyBurnRate > 0 ? Math.round(monthlyBurnRate) : 'N/A', days_to_stockout: daysToStockout !== null ? daysToStockout : 'N/A', stockout_risk, location: it.location || 'N/A' }
  }).sort((a, b) => { const order = { 'CRITICAL': 0, 'REORDER REQUIRED': 1, 'WARNING': 2, 'HEALTHY': 3, 'No Burn Data': 4 }; return (order[a.stockout_risk] ?? 5) - (order[b.stockout_risk] ?? 5) })
  const totalSKUs = rows.length; const criticalSKUs = rows.filter(r => r.stockout_risk === 'CRITICAL' || r.stockout_risk === 'REORDER REQUIRED').length
  const totalStockValue = rows.reduce((s, r) => s + r.stock_value, 0); const itemsWithBurnData = rows.filter(r => r.monthly_burn_rate !== 'N/A').length
  const sixMonthTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i)
    const ml = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const monthIssue = transactions.filter(tx => { if (!tx.transaction_at) return false; const dd = new Date(tx.transaction_at); return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() }).reduce((s, tx) => s + (Number(tx.quantity) || 0), 0)
    sixMonthTrend.push({ name: ml, issued: Math.round(monthIssue) })
  }
  const columns = [
    { key: 'item_code', label: 'Item Code' }, { key: 'item_name', label: 'Item Name' }, { key: 'category', label: 'Category' }, { key: 'unit', label: 'Unit' },
    { key: 'current_stock', label: 'Current Stock', format: 'number' }, { key: 'reorder_level', label: 'Reorder Level', format: 'number' },
    { key: 'monthly_burn_rate', label: 'Monthly Issue (30d)' }, { key: 'days_to_stockout', label: 'Days to Stockout' }, { key: 'stock_value', label: 'Stock Value (₹)', format: 'currency' }, { key: 'stockout_risk', label: 'Risk Status', format: 'badge_risk' },
  ]
  const chartData = [{ name: 'Critical/Reorder', value: criticalSKUs }, { name: 'Warning', value: rows.filter(r => r.stockout_risk === 'WARNING').length }, { name: 'Healthy', value: rows.filter(r => r.stockout_risk === 'HEALTHY').length }, { name: 'No Burn Data', value: rows.filter(r => r.stockout_risk === 'No Burn Data').length }].filter(d => d.value > 0)
  return { state: 'DATA_AVAILABLE', summary: { totalSKUs, criticalSKUs, totalStockValue, itemsWithBurnData }, chartData, lineChartData: sixMonthTrend, columns, rows, dataQuality: { complete: itemsWithBurnData === totalSKUs, missingFields: itemsWithBurnData < totalSKUs ? [`${totalSKUs - itemsWithBurnData} items have no recent transaction data`] : [] } }
}

// 13. Freight & Logistics Optimization Report — REAL asset_movements data. No simulated routes.
export async function getFreightLogisticsReport({ siteId = 'all' } = {}) {
  const { data, error } = await supabase.from('asset_movements').select('id, asset_id, movement_type, from_location, to_location, notes, moved_at, assets!asset_id(asset_code, asset_name, category, site)').in('movement_type', ['transfer', 'check_out', 'check_in']).order('moved_at', { ascending: false }).limit(500)
  if (error) throw error
  const movements = data || []
  let filtered = siteId !== 'all' ? movements.filter(m => m.assets?.site === siteId || m.to_location === siteId || m.from_location === siteId) : movements
  const rows = filtered.map(m => ({ id: m.id, asset_code: m.assets?.asset_code || 'N/A', asset_name: m.assets?.asset_name || 'N/A', category: m.assets?.category || 'N/A', movement_type: m.movement_type || 'N/A', from_location: m.from_location || 'N/A', to_location: m.to_location || 'N/A', moved_at: fmtDate(m.moved_at), notes: m.notes || 'N/A' }))
  const totalTransfers = rows.length
  const transferTypes = {}; rows.forEach(r => { transferTypes[r.movement_type] = (transferTypes[r.movement_type] || 0) + 1 })
  const routeMap = {}; rows.forEach(r => { const key = `${r.from_location} → ${r.to_location}`; routeMap[key] = (routeMap[key] || 0) + 1 })
  const topRoutes = Object.entries(routeMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const now = new Date()
  const sixMonthTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i)
    const ml = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const count = movements.filter(m => { if (!m.moved_at) return false; const dd = new Date(m.moved_at); return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() }).length
    sixMonthTrend.push({ name: ml, transfers: count })
  }
  const columns = [
    { key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'category', label: 'Category' },
    { key: 'movement_type', label: 'Movement Type', format: 'badge_type' }, { key: 'from_location', label: 'From Location' }, { key: 'to_location', label: 'To Location' }, { key: 'moved_at', label: 'Transfer Date' }, { key: 'notes', label: 'Notes' },
  ]
  const chartData = Object.entries(transferTypes).map(([name, value]) => ({ name, value }))
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalTransfers, topRoute: topRoutes[0] ? topRoutes[0][0] : 'N/A', uniqueRoutes: Object.keys(routeMap).length }, chartData, lineChartData: sixMonthTrend, secondaryChartData: topRoutes.map(([name, value]) => ({ name, value })), columns, rows }
}

// 14. Operator Safety Report — REAL profiles + checklist_submissions data. No hardcoded operators.
export async function getOperatorSafetyReport({ siteId = 'all' } = {}) {
  const [profilesRes, submissionsRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, department, is_active'),
    supabase.from('checklist_submissions').select('id, performed_by, status, site, submitted_at'),
  ])
  const profiles = (profilesRes.data || []).filter(p => p.is_active)
  const submissions = submissionsRes.data || []
  const subsByOperator = {}; submissions.forEach(s => { if (!s.performed_by) return; if (!subsByOperator[s.performed_by]) subsByOperator[s.performed_by] = []; subsByOperator[s.performed_by].push(s) })
  const rows = profiles.map(p => {
    const ops = subsByOperator[p.id] || []
    const total = ops.length; const passed = ops.filter(s => s.status === 'pass').length; const failed = ops.filter(s => s.status === 'fail').length
    const passRate = total > 0 ? Math.round((passed / total) * 100) : null
    return { id: p.id, operator_name: p.full_name || 'N/A', department: p.department || 'N/A', checklists_completed: total, passed, failed, pass_rate: passRate !== null ? `${passRate}%` : 'N/A', risk_tier: passRate === null ? 'No Data' : passRate >= 90 ? 'LOW RISK' : passRate >= 70 ? 'MEDIUM RISK' : 'HIGH RISK' }
  }).filter(r => r.checklists_completed > 0).sort((a, b) => (Number(b.pass_rate?.replace('%', '')) || 0) - (Number(a.pass_rate?.replace('%', '')) || 0))
  const totalOperators = rows.length; const highRiskCount = rows.filter(r => r.risk_tier === 'HIGH RISK').length
  const totalSubmissions = rows.reduce((s, r) => s + r.checklists_completed, 0)
  const overallPassRate = totalSubmissions > 0 ? Math.round((rows.reduce((s, r) => s + r.passed, 0) / totalSubmissions) * 100) : 0
  const columns = [
    { key: 'operator_name', label: 'Operator Name' }, { key: 'department', label: 'Department' }, { key: 'checklists_completed', label: 'Checklists', format: 'number' },
    { key: 'passed', label: 'Passed', format: 'number' }, { key: 'failed', label: 'Failed', format: 'number' }, { key: 'pass_rate', label: 'Pass Rate' }, { key: 'risk_tier', label: 'Risk Tier', format: 'badge_risk' },
  ]
  const chartData = [{ name: 'Low Risk (≥90%)', value: rows.filter(r => r.risk_tier === 'LOW RISK').length }, { name: 'Medium Risk (70-89%)', value: rows.filter(r => r.risk_tier === 'MEDIUM RISK').length }, { name: 'High Risk (<70%)', value: highRiskCount }].filter(d => d.value > 0)
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalOperators, highRiskCount, totalSubmissions, overallPassRate: `${overallPassRate}%` }, chartData, gaugeData: { scorePct: overallPassRate, maxScore: 100 }, columns, rows, dataQuality: { complete: true, missingFields: totalOperators === 0 ? ['No operators have completed checklist submissions yet'] : [] } }
}

// 15. Tool Crib & Check-out Turnover Report — uses gate passes / asset movements for tool checkout tracking
export async function getToolCribTurnoverReport({ siteId = 'all' } = {}) {
  const { data, error } = await supabase.from('asset_movements')
    .select('id, asset_id, movement_type, from_location, to_location, notes, moved_at, assets!asset_id(asset_code, asset_name, category, site)')
    .in('movement_type', ['check_out', 'check_in'])
    .order('moved_at', { ascending: false }).limit(300)
  if (error) throw error
  const movements = (data || []).filter(m => siteId === 'all' || m.assets?.site === siteId)
  const rows = movements.map(m => ({
    id: m.id, asset_code: m.assets?.asset_code || 'N/A', asset_name: m.assets?.asset_name || 'N/A',
    category: m.assets?.category || 'N/A', site: m.assets?.site || 'N/A',
    movement_type: m.movement_type, from_location: m.from_location || 'N/A', to_location: m.to_location || 'N/A',
    notes: m.notes || 'N/A', moved_at: fmtDate(m.moved_at),
  }))
  const checkOuts = rows.filter(r => r.movement_type === 'check_out').length
  const checkIns = rows.filter(r => r.movement_type === 'check_in').length
  const columns = [
    { key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' },
    { key: 'movement_type', label: 'Movement', format: 'badge_type' }, { key: 'from_location', label: 'From' }, { key: 'to_location', label: 'To' }, { key: 'moved_at', label: 'Date' }, { key: 'notes', label: 'Notes' },
  ]
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalMovements: rows.length, checkOuts, checkIns }, chartData: [{ name: 'Check Out', value: checkOuts }, { name: 'Check In', value: checkIns }].filter(d => d.value > 0), columns, rows }
}

// 16. Procurement & PO Fulfillment Pipeline Report — REAL purchase_orders data.
export async function getProcurementPipelineReport({ siteId = 'all' } = {}) {
  const [ordersRes, reqRes] = await Promise.all([
    supabase.from('purchase_orders').select('id, po_number, status, delivery_location, delivery_date, total_amount, created_at, vendors!vendor_id(name), purchase_requisitions!requisition_id(title, category)').order('created_at', { ascending: false }),
    supabase.from('purchase_requisitions').select('id, title, category, estimated_cost, status, priority, required_by, created_at'),
  ])
  const orders = ordersRes.data || []
  const reqs = reqRes.data || []
  const rows = orders.map(po => {
    const fulfillmentDays = po.created_at && po.delivery_date ? daysBetween(po.created_at, new Date(po.delivery_date)) : null
    return { id: po.id, po_number: po.po_number || 'N/A', vendor_name: po.vendors?.name || 'N/A', requisition_title: po.purchase_requisitions?.title || 'N/A', category: po.purchase_requisitions?.category || 'N/A', delivery_location: po.delivery_location || 'N/A', total_amount: Number(po.total_amount) || 0, status: po.status || 'open', delivery_date: fmtDate(po.delivery_date), created_at: fmtDate(po.created_at), fulfillment_days: fulfillmentDays !== null ? fulfillmentDays : 'N/A' }
  })
  const totalOrders = rows.length; const totalValue = rows.reduce((s, r) => s + r.total_amount, 0)
  const openOrders = rows.filter(r => r.status === 'open').length; const closedOrders = rows.filter(r => r.status === 'closed').length
  const pendingReqs = reqs.filter(r => r.status === 'pending').length; const totalReqValue = reqs.reduce((s, r) => s + (Number(r.estimated_cost) || 0), 0)
  const fulfilledWithDays = rows.filter(r => r.fulfillment_days !== 'N/A')
  const avgFulfillmentDays = fulfilledWithDays.length > 0 ? Math.round(fulfilledWithDays.reduce((s, r) => s + r.fulfillment_days, 0) / fulfilledWithDays.length) : null
  const columns = [
    { key: 'po_number', label: 'PO Number' }, { key: 'vendor_name', label: 'Vendor' }, { key: 'requisition_title', label: 'Requisition' }, { key: 'category', label: 'Category' },
    { key: 'delivery_location', label: 'Delivery Site' }, { key: 'total_amount', label: 'PO Amount (₹)', format: 'currency' }, { key: 'status', label: 'PO Status', format: 'badge_status' }, { key: 'delivery_date', label: 'Delivery Date' }, { key: 'fulfillment_days', label: 'Lead Days' },
  ]
  const chartData = [{ name: 'Open', value: openOrders }, { name: 'Partially Received', value: rows.filter(r => r.status === 'partially_received').length }, { name: 'Closed', value: closedOrders }, { name: 'Cancelled', value: rows.filter(r => r.status === 'cancelled').length }].filter(d => d.value > 0)
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalOrders, totalValue, openOrders, closedOrders, pendingReqs, totalReqValue, avgFulfillmentDays: avgFulfillmentDays !== null ? `${avgFulfillmentDays} days` : 'N/A' }, chartData, columns, rows }
}

// 7. Custom Report Executor
export async function executeCustomReport(config) {
  const { data_source = 'assets', fields = [], group_by, filters = {} } = config
  let q = supabase.from(data_source).select('*')

  if (filters.site && filters.site !== 'all') q = q.eq('site', filters.site)
  if (filters.category && filters.category !== 'all') q = q.eq('category', filters.category)

  const { data, error } = await q
  if (error) throw error

  const rows = data || []
  const groupMap = {}

  if (group_by) {
    rows.forEach(r => {
      const g = r[group_by] || 'Other'
      groupMap[g] = (groupMap[g] || 0) + 1
    })
  }

  const chartData = Object.entries(groupMap).map(([name, value]) => ({ name, value }))

  const columns = fields.length > 0
    ? fields.map(f => ({ key: f, label: f.replace(/_/g, ' ').toUpperCase() }))
    : Object.keys(rows[0] || {}).slice(0, 6).map(k => ({ key: k, label: k.replace(/_/g, ' ').toUpperCase() }))

  return {
    summary: { totalRecords: rows.length },
    chartData,
    columns,
    rows,
  }
}

/**
 * Universal Generic Report Adapter — Specialized per reportId.
 * Each report ID gets tailored columns, data source, and calculations.
 */
export async function getGenericReportAdapter(reportId, { siteId = 'all', category = 'all', startDate = '', endDate = '' } = {}) {
  try {
    // ── ASSET-BASED REPORTS ──────────────────────────────
    if (['asset-register-details','all-asset-report','asset-list-report','asset-register-summary','asset-current-valuation','asset-valuation-chart','asset-status-report','asset-allocation-report','asset-ytd-summary'].includes(reportId)) {
      return await _assetRegisterAdapter(reportId, { siteId, category, startDate, endDate })
    }
    if (reportId === 'asset-age-report') return await _assetAgeAdapter({ siteId, category })
    if (reportId === 'asset-additions' || reportId === 'asset-new-register-details') return await _assetAdditionsAdapter({ siteId, startDate, endDate })
    if (reportId === 'asset-disposal') return await _assetDisposalAdapter({ siteId })
    if (reportId === 'asset-lifespan-analysis') return await _assetLifespanAdapter({ siteId, category })
    if (reportId === 'asset-valuation-journey' || reportId === 'asset-revaluation') return await _assetRegisterAdapter('asset-current-valuation', { siteId, category, startDate, endDate })
    if (reportId === 'department-depreciation') return await _deptDepreciationAdapter({ siteId })
    if (reportId === 'product-depreciation') return await _productDepreciationAdapter({ siteId, category })
    if (reportId === 'asset-transaction-report') return await _assetTransactionAdapter({ siteId })
    if (reportId === 'asset-scrap-analysis') return await getScrapYieldReport({ siteId })
    // ── MAINTENANCE REPORTS ──────────────────────────────
    if (['maintenance-kpi-dashboard','maintenance-summary','asset-maint-summary','asset-maint-report'].includes(reportId)) return await _maintenanceSummaryAdapter({ siteId })
    if (['work-orders-list','all-wo-detail'].includes(reportId)) return await _workOrdersAdapter('all', { siteId })
    if (reportId === 'open-wo-detail' || reportId === 'work-order-backlog') return await _workOrdersAdapter('open', { siteId })
    if (reportId === 'overdue-wo-detail') return await _workOrdersAdapter('overdue', { siteId })
    if (reportId === 'closed-wo-detail') return await _workOrdersAdapter('closed', { siteId })
    if (reportId === 'technician-performance') return await _technicianPerformanceAdapter({ siteId })
    if (reportId === 'wo-time-consumption') return await _downtimeAdapter({ siteId })
    if (reportId === 'wo-cost-report') return await _woCostAdapter('monthly', { siteId })
    if (reportId === 'asset-wo-cost') return await _woCostAdapter('per-asset', { siteId })
    if (reportId === 'fault-breakage-report' || reportId === 'asset-breakdown-history') return await _faultBreakageAdapter({ siteId })
    if (reportId === 'asset-mttr-report') return await _mttrAdapter({ siteId })
    if (reportId === 'asset-mtbf-report') return await _mtbfAdapter({ siteId })
    if (reportId === 'assets-downtime-availability') return await _availabilityAdapter({ siteId })
    if (reportId === 'scheduled-vs-unplanned-downtime') return await _downtimeComparisonAdapter({ siteId })
    if (reportId === 'wo-completion-rate') return await _woCompletionRateAdapter({ siteId })
    // ── PM MAINTENANCE REPORTS ──────────────────────────
    if (['pm-scheduler-report','open-pm-wo-list','wo-pm-plan','inventory-upcoming-pm','deviation-report','suggested-vs-actual-date','wo-completion-maintenance','closed-wo-completion-notes','checklist-wo-summary'].includes(reportId)) return await _pmSchedulerAdapter(reportId, { siteId })
    // ── INVENTORY REPORTS ───────────────────────────────
    if (['inventory-overview','spare-parts-report','inventory-valuation'].includes(reportId)) return await _inventoryAdapter({ siteId })
    // Default fallback to asset register
    return await _assetRegisterAdapter('asset-register-details', { siteId, category, startDate, endDate })
  } catch (err) {
    return { state: 'QUERY_ERROR', summary: {}, chartData: [], columns: [], rows: [], message: `Report "${reportId}" query failed: ${err.message}` }
  }
}

// ── PRIVATE ADAPTER HELPERS ──────────────────────────────────────────────────

async function _fetchAssets(siteId = 'all', category = 'all') {
  let q = supabase.from('assets').select('id, asset_code, asset_name, make, model_no, serial_no, category, site, status, condition, purchase_value, salvage_value, useful_life_years, depreciation_method, depreciation_rate_percent, purchase_date, added_on, warranty_expiry, disposal_date, disposal_reason, department, location, assigned_to, quantity, is_scrapped, scrap_date, scrap_value').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%').order('added_on', { ascending: false })
  if (siteId !== 'all') q = q.eq('site', siteId)
  if (category !== 'all') q = q.eq('category', category)
  const { data, error } = await q.limit(500)
  if (error) throw error
  return data || []
}

async function _assetRegisterAdapter(reportId, { siteId, category, startDate, endDate }) {
  const now = new Date(); const currentYear = now.getFullYear()
  const assets = await _fetchAssets(siteId, category)
  let filteredAssets = assets
  if (reportId === 'asset-ytd-summary') filteredAssets = assets.filter(a => { if (!a.added_on) return false; return new Date(a.added_on).getFullYear() === currentYear })
  let totalAcqCost = 0, totalAccumDepr = 0, totalNBV = 0
  const rows = filteredAssets.map(a => {
    const depr = calcDepreciation(a); totalAcqCost += depr.purchaseVal; totalAccumDepr += depr.accumDepr; totalNBV += depr.netBookValue
    return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', make: a.make || 'N/A', model_no: a.model_no || 'N/A', serial_no: a.serial_no || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', department: a.department || 'N/A', status: a.status || 'N/A', condition: a.condition || 'N/A', purchase_date: fmtDate(a.purchase_date), added_on: fmtDate(a.added_on), purchase_value: depr.purchaseVal, accumulated_depreciation: depr.accumDepr, net_book_value: depr.netBookValue, depreciation_pct: `${depr.deprPct}%`, age_years: depr.yearsOwned }
  })
  const statusMap = {}; rows.forEach(r => { statusMap[r.status] = (statusMap[r.status] || 0) + 1 })
  const catMap = {}; rows.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + r.net_book_value })
  const lineChartData = []
  for (let yr = currentYear - 5; yr <= currentYear; yr++) {
    let yrGross = 0, yrDepr = 0
    assets.forEach(a => { const pYear = new Date(a.purchase_date || a.added_on || '2020-01-01').getFullYear(); if (pYear <= yr) { const pVal = Number(a.purchase_value) || 0; const age = Math.max(0, yr - pYear); const uLife = Number(a.useful_life_years) || 10; const salvage = Number(a.salvage_value) || 0; const annualDepr = (pVal - salvage) / Math.max(1, uLife); yrGross += pVal; yrDepr += Math.min(pVal - salvage, annualDepr * age) } })
    lineChartData.push({ name: String(yr), year: String(yr), purchaseValue: Math.round(yrGross), accumulatedDepreciation: Math.round(yrDepr), netBookValue: Math.round(Math.max(0, yrGross - yrDepr)) })
  }
  return {
    state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE',
    summary: { totalAssets: rows.length, totalAcquisitionCost: totalAcqCost, totalAccumulatedDepreciation: totalAccumDepr, totalNetBookValue: totalNBV, activeCount: rows.filter(r => r.status === 'Active').length },
    chartData: Object.entries(statusMap).map(([name, value]) => ({ name, value })),
    secondaryChartData: Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
    lineChartData,
    columns: [
      { key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'make', label: 'Make' }, { key: 'model_no', label: 'Model' }, { key: 'serial_no', label: 'Serial No' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' }, { key: 'department', label: 'Department' }, { key: 'status', label: 'Status', format: 'badge_status' }, { key: 'condition', label: 'Condition' }, { key: 'purchase_date', label: 'Purchase Date' }, { key: 'purchase_value', label: 'Original Cost (₹)', format: 'currency' }, { key: 'accumulated_depreciation', label: 'Accum Depr (₹)', format: 'currency' }, { key: 'net_book_value', label: 'Net Book Value (₹)', format: 'currency' }, { key: 'depreciation_pct', label: 'Depr %' },
    ],
    rows,
  }
}

async function _assetAgeAdapter({ siteId, category }) {
  const assets = await _fetchAssets(siteId, category)
  const buckets = { '0–2 yrs': 0, '3–5 yrs': 0, '6–10 yrs': 0, '11–15 yrs': 0, '15+ yrs': 0 }
  const rows = assets.map(a => {
    const ageYrs = yearsBetween(a.purchase_date || a.added_on) || 0
    const ageBucket = ageYrs <= 2 ? '0–2 yrs' : ageYrs <= 5 ? '3–5 yrs' : ageYrs <= 10 ? '6–10 yrs' : ageYrs <= 15 ? '11–15 yrs' : '15+ yrs'
    buckets[ageBucket]++
    const depr = calcDepreciation(a); const remainingLife = Math.max(0, (Number(a.useful_life_years) || 10) - ageYrs)
    return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', status: a.status || 'N/A', purchase_date: fmtDate(a.purchase_date), age_years: Math.round(ageYrs * 10) / 10, age_bucket: ageBucket, remaining_life: Math.round(remainingLife * 10) / 10, net_book_value: depr.netBookValue, depreciation_pct: `${depr.deprPct}%`, replacement_priority: ageYrs > (Number(a.useful_life_years) || 10) ? 'HIGH' : ageYrs > (Number(a.useful_life_years) || 10) * 0.8 ? 'MEDIUM' : 'LOW' }
  }).sort((a, b) => b.age_years - a.age_years)
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalAssets: rows.length, avgAge: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.age_years, 0) / rows.length * 10) / 10 : 0, highPriorityReplacement: rows.filter(r => r.replacement_priority === 'HIGH').length }, chartData: Object.entries(buckets).map(([name, value]) => ({ name, value })), columns: [{ key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' }, { key: 'purchase_date', label: 'Purchase Date' }, { key: 'age_years', label: 'Age (Yrs)' }, { key: 'age_bucket', label: 'Age Bucket' }, { key: 'remaining_life', label: 'Remaining (Yrs)' }, { key: 'net_book_value', label: 'Net Book Value (₹)', format: 'currency' }, { key: 'replacement_priority', label: 'Replacement Priority', format: 'badge_priority' }], rows }
}

async function _assetAdditionsAdapter({ siteId, startDate, endDate }) {
  const now = new Date(); const currentYear = now.getFullYear()
  const fromDate = startDate || `${currentYear}-01-01`; const toDate = endDate || now.toISOString().split('T')[0]
  let q = supabase.from('assets').select('id, asset_code, asset_name, make, model_no, category, site, status, purchase_value, added_on, purchase_date, department, purchase_order_no').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%').gte('added_on', fromDate).lte('added_on', toDate + 'T23:59:59Z').order('added_on', { ascending: false })
  if (siteId !== 'all') q = q.eq('site', siteId)
  const { data, error } = await q; if (error) throw error
  const rows = (data || []).map(a => ({ id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', make: a.make || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', department: a.department || 'N/A', status: a.status || 'N/A', purchase_value: Number(a.purchase_value) || 0, purchase_order_no: a.purchase_order_no || 'N/A', added_on: fmtDate(a.added_on), purchase_date: fmtDate(a.purchase_date) }))
  const totalValue = rows.reduce((s, r) => s + r.purchase_value, 0); const catMap = {}; rows.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + 1 })
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalAdditions: rows.length, totalCapitalizationValue: totalValue, dateRange: `${fromDate} to ${toDate}` }, chartData: Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value), columns: [{ key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'make', label: 'Make' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' }, { key: 'department', label: 'Department' }, { key: 'purchase_value', label: 'Capitalized Value (₹)', format: 'currency' }, { key: 'purchase_order_no', label: 'PO Number' }, { key: 'added_on', label: 'Added On' }], rows }
}

async function _assetDisposalAdapter({ siteId }) {
  let q = supabase.from('assets').select('id, asset_code, asset_name, category, site, purchase_value, salvage_value, scrap_value, disposal_date, disposal_reason, scrap_date, scrap_reason, is_scrapped, status, added_on, purchase_date, useful_life_years, depreciation_method, depreciation_rate_percent').or('disposal_date.not.is.null,is_scrapped.eq.true,status.eq.Disposed,status.eq.Scrapped')
  if (siteId !== 'all') q = q.eq('site', siteId)
  const { data, error } = await q; if (error) throw error
  const rows = (data || []).map(a => { const depr = calcDepreciation(a); const proceeds = Number(a.scrap_value) || Number(a.salvage_value) || null; return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', disposal_date: fmtDate(a.disposal_date || a.scrap_date), disposal_reason: a.disposal_reason || a.scrap_reason || 'N/A', original_cost: depr.purchaseVal, book_value_at_disposal: depr.netBookValue, proceeds: proceeds !== null ? proceeds : 'N/A', gain_loss: proceeds !== null ? Math.round(proceeds - depr.netBookValue) : 'N/A', status: a.status || 'N/A' } }).sort((a, b) => (b.original_cost || 0) - (a.original_cost || 0))
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalDisposed: rows.length, totalOriginalCost: rows.reduce((s, r) => s + (r.original_cost || 0), 0), totalProceeds: rows.filter(r => typeof r.proceeds === 'number').reduce((s, r) => s + r.proceeds, 0) }, chartData: [{ name: 'With Proceeds', value: rows.filter(r => typeof r.proceeds === 'number').length }, { name: 'No Proceeds', value: rows.filter(r => r.proceeds === 'N/A').length }].filter(d => d.value > 0), columns: [{ key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' }, { key: 'disposal_date', label: 'Disposal Date' }, { key: 'disposal_reason', label: 'Reason' }, { key: 'original_cost', label: 'Original Cost (₹)', format: 'currency' }, { key: 'book_value_at_disposal', label: 'Book Value (₹)', format: 'currency' }, { key: 'proceeds', label: 'Proceeds (₹)', format: 'currency' }, { key: 'gain_loss', label: 'Gain/Loss (₹)' }], rows }
}

async function _assetLifespanAdapter({ siteId, category }) {
  const assets = await _fetchAssets(siteId, category)
  const rows = assets.map(a => { const expectedLife = Number(a.useful_life_years) || null; const actualAge = yearsBetween(a.purchase_date || a.added_on); const depr = calcDepreciation(a); const remainingLife = expectedLife !== null && actualAge !== null ? Math.max(0, expectedLife - actualAge) : null; let life_status = expectedLife === null ? 'Unknown' : actualAge >= expectedLife ? 'BEYOND EXPECTED LIFE' : actualAge >= expectedLife * 0.8 ? 'NEAR END OF LIFE' : 'WITHIN EXPECTED LIFE'; return { id: a.id, asset_code: a.asset_code, asset_name: a.asset_name || 'N/A', category: a.category || 'N/A', site: a.site || 'N/A', status: a.status || 'N/A', expected_life_years: expectedLife !== null ? expectedLife : 'N/A', actual_age_years: actualAge !== null ? Math.round(actualAge * 10) / 10 : 'N/A', remaining_life_years: remainingLife !== null ? Math.round(remainingLife * 10) / 10 : 'N/A', net_book_value: depr.netBookValue, life_status } }).sort((a, b) => { const da = typeof a.remaining_life_years === 'number' ? a.remaining_life_years : 999; const db = typeof b.remaining_life_years === 'number' ? b.remaining_life_years : 999; return da - db })
  const beyondExpected = rows.filter(r => r.life_status === 'BEYOND EXPECTED LIFE').length; const nearEnd = rows.filter(r => r.life_status === 'NEAR END OF LIFE').length
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalAssets: rows.length, beyondExpected, nearEnd }, chartData: [{ name: 'Within Expected Life', value: rows.filter(r => r.life_status === 'WITHIN EXPECTED LIFE').length }, { name: 'Near End of Life', value: nearEnd }, { name: 'Beyond Expected Life', value: beyondExpected }, { name: 'Unknown', value: rows.filter(r => r.life_status === 'Unknown').length }].filter(d => d.value > 0), columns: [{ key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' }, { key: 'expected_life_years', label: 'Expected Life (Yrs)' }, { key: 'actual_age_years', label: 'Actual Age (Yrs)' }, { key: 'remaining_life_years', label: 'Remaining (Yrs)' }, { key: 'net_book_value', label: 'Net Book Value (₹)', format: 'currency' }, { key: 'life_status', label: 'Life Status', format: 'badge_compliance' }], rows }
}

async function _deptDepreciationAdapter({ siteId }) {
  const assets = await _fetchAssets(siteId)
  const deptMap = {}; assets.forEach(a => { const dept = a.department || 'Unassigned'; if (!deptMap[dept]) deptMap[dept] = { department: dept, total_assets: 0, opening_value: 0, annual_depreciation: 0, net_book_value: 0 }; const depr = calcDepreciation(a); const usefulLife = Number(a.useful_life_years) || 10; const pVal = depr.purchaseVal; const salvage = Number(a.salvage_value) || 0; const annualDepr = usefulLife > 0 ? Math.round((pVal - salvage) / usefulLife) : 0; deptMap[dept].total_assets += 1; deptMap[dept].opening_value += pVal; deptMap[dept].annual_depreciation += annualDepr; deptMap[dept].net_book_value += depr.netBookValue })
  const rows = Object.values(deptMap).sort((a, b) => b.opening_value - a.opening_value)
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalDepts: rows.length, totalAssets: rows.reduce((s, r) => s + r.total_assets, 0), totalAnnualDepreciation: rows.reduce((s, r) => s + r.annual_depreciation, 0) }, chartData: rows.slice(0, 8).map(r => ({ name: r.department, value: r.annual_depreciation })), columns: [{ key: 'department', label: 'Department' }, { key: 'total_assets', label: 'Assets', format: 'number' }, { key: 'opening_value', label: 'Opening Value (₹)', format: 'currency' }, { key: 'annual_depreciation', label: 'Annual Depreciation (₹)', format: 'currency' }, { key: 'net_book_value', label: 'Net Book Value (₹)', format: 'currency' }], rows }
}

async function _productDepreciationAdapter({ siteId, category }) {
  const assets = await _fetchAssets(siteId, category)
  const catMap = {}; assets.forEach(a => { const cat = a.category || 'Uncategorized'; if (!catMap[cat]) catMap[cat] = { category: cat, units: 0, gross_cost: 0, accumulated_depreciation: 0, net_book_value: 0 }; const depr = calcDepreciation(a); catMap[cat].units += 1; catMap[cat].gross_cost += depr.purchaseVal; catMap[cat].accumulated_depreciation += depr.accumDepr; catMap[cat].net_book_value += depr.netBookValue })
  const rows = Object.values(catMap).map(r => ({ ...r, depreciation_pct: r.gross_cost > 0 ? `${Math.round((r.accumulated_depreciation / r.gross_cost) * 100)}%` : 'N/A' })).sort((a, b) => b.gross_cost - a.gross_cost)
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalCategories: rows.length, totalGrossCost: rows.reduce((s, r) => s + r.gross_cost, 0), totalAccumDepr: rows.reduce((s, r) => s + r.accumulated_depreciation, 0), totalNBV: rows.reduce((s, r) => s + r.net_book_value, 0) }, chartData: rows.slice(0, 8).map(r => ({ name: r.category, value: r.net_book_value })), columns: [{ key: 'category', label: 'Category' }, { key: 'units', label: 'Units', format: 'number' }, { key: 'gross_cost', label: 'Gross Cost (₹)', format: 'currency' }, { key: 'accumulated_depreciation', label: 'Accum Depr (₹)', format: 'currency' }, { key: 'net_book_value', label: 'Net Book Value (₹)', format: 'currency' }, { key: 'depreciation_pct', label: 'Depr %' }], rows }
}

async function _assetTransactionAdapter({ siteId }) {
  const { data, error } = await supabase.from('activity_logs').select('id, action, entity_type, entity_id, entity_name, created_at, profiles!user_id(full_name)').eq('entity_type', 'asset').order('created_at', { ascending: false }).limit(300)
  if (error) throw error
  const rows = (data || []).map(r => ({ id: r.id, entity_name: r.entity_name || 'N/A', action: r.action || 'N/A', performed_by: r.profiles?.full_name || 'N/A', created_at: fmtDate(r.created_at) }))
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalTransactions: rows.length }, chartData: [], columns: [{ key: 'entity_name', label: 'Asset' }, { key: 'action', label: 'Action' }, { key: 'performed_by', label: 'Performed By' }, { key: 'created_at', label: 'Date/Time' }], rows }
}

async function _maintenanceSummaryAdapter({ siteId }) {
  const now = new Date()
  const [ticketsRes, logsRes] = await Promise.all([
    supabase.from('maintenance_tickets').select('id, ticket_no, title, priority, status, ticket_type, asset_id, created_at, resolved_at, downtime_start, downtime_end, sla_due_at, assets!asset_id(asset_code, asset_name, category, site)').order('created_at', { ascending: false }).limit(300),
    supabase.from('maintenance_logs').select('id, asset_id, cost, performed_at, assets!asset_id(site)').order('performed_at', { ascending: false }),
  ])
  let tickets = (ticketsRes.data || []).filter(t => siteId === 'all' || t.assets?.site === siteId)
  let logs = (logsRes.data || []).filter(l => siteId === 'all' || l.assets?.site === siteId)
  const totalTickets = tickets.length; const resolvedCount = tickets.filter(t => CLOSED_STATUSES.includes(t.status)).length
  const openCount = tickets.filter(t => OPEN_STATUSES.includes(t.status)).length
  const totalCost = logs.reduce((s, l) => s + (Number(l.cost) || 0), 0)
  const completionRate = totalTickets > 0 ? Math.round((resolvedCount / totalTickets) * 100) : 0
  const resolvedWithTime = tickets.filter(t => t.resolved_at && t.created_at && CLOSED_STATUSES.includes(t.status))
  const avgMTTR = resolvedWithTime.length > 0 ? Math.round(resolvedWithTime.reduce((s, t) => s + ((new Date(t.resolved_at) - new Date(t.created_at)) / 3600000), 0) / resolvedWithTime.length * 10) / 10 : null
  const slaBreaches = tickets.filter(t => t.sla_due_at && OPEN_STATUSES.includes(t.status) && new Date(t.sla_due_at) < now).length
  const rows = tickets.map(t => { const resHrs = (t.resolved_at && t.created_at) ? Math.round(((new Date(t.resolved_at) - new Date(t.created_at)) / 3600000) * 10) / 10 : null; const dtHrs = (t.downtime_start && t.downtime_end) ? Math.round(((new Date(t.downtime_end) - new Date(t.downtime_start)) / 3600000) * 10) / 10 : null; return { id: t.id, ticket_no: t.ticket_no || 'N/A', title: t.title || 'N/A', asset_code: t.assets?.asset_code || 'N/A', asset_name: t.assets?.asset_name || 'N/A', site: t.assets?.site || 'N/A', priority: t.priority || 'normal', status: t.status || 'open', ticket_type: t.ticket_type || 'other', resolution_hrs: resHrs !== null ? resHrs : 'N/A', downtime_hrs: dtHrs !== null ? dtHrs : 'N/A', sla_breach: (t.sla_due_at && OPEN_STATUSES.includes(t.status) && new Date(t.sla_due_at) < now) ? 'YES' : 'No', created_at: fmtDate(t.created_at) } })
  const typeMap = {}; tickets.forEach(t => { typeMap[t.ticket_type || 'other'] = (typeMap[t.ticket_type || 'other'] || 0) + 1 })
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalTickets, resolvedCount, openCount, totalCost, completionRate: `${completionRate}%`, avgMTTR: avgMTTR !== null ? `${avgMTTR} hrs` : 'N/A', slaBreaches }, chartData: Object.entries(typeMap).map(([name, value]) => ({ name, value })), columns: [{ key: 'ticket_no', label: 'Ticket #' }, { key: 'asset_name', label: 'Asset' }, { key: 'site', label: 'Site' }, { key: 'ticket_type', label: 'Type', format: 'badge_type' }, { key: 'priority', label: 'Priority', format: 'badge_priority' }, { key: 'status', label: 'Status', format: 'badge_status' }, { key: 'resolution_hrs', label: 'Resolution (Hrs)' }, { key: 'downtime_hrs', label: 'Downtime (Hrs)' }, { key: 'sla_breach', label: 'SLA Breach', format: 'badge_yesno' }, { key: 'created_at', label: 'Created' }], rows }
}

async function _workOrdersAdapter(filter, { siteId }) {
  const now = new Date()
  const { data, error } = await supabase.from('maintenance_tickets').select('id, ticket_no, title, priority, status, ticket_type, created_at, resolved_at, sla_due_at, downtime_start, downtime_end, assets!asset_id(asset_code, asset_name, site, category), assigned:profiles!assigned_to(full_name)').order('created_at', { ascending: false }).limit(300)
  if (error) throw error
  let rows = (data || []).map(t => { const ageDays = daysBetween(t.created_at); const isOverdue = t.sla_due_at && OPEN_STATUSES.includes(t.status) && new Date(t.sla_due_at) < now; const ageGroup = ageDays === null ? 'Unknown' : ageDays <= 2 ? '0–2 days' : ageDays <= 7 ? '3–7 days' : ageDays <= 14 ? '8–14 days' : ageDays <= 30 ? '15–30 days' : '30+ days'; return { id: t.id, ticket_no: t.ticket_no || 'N/A', title: t.title || 'N/A', asset_code: t.assets?.asset_code || 'N/A', asset_name: t.assets?.asset_name || 'N/A', category: t.assets?.category || 'N/A', site: t.assets?.site || 'N/A', priority: t.priority || 'normal', status: t.status || 'open', ticket_type: t.ticket_type || 'other', assigned_to: t.assigned?.full_name || 'Unassigned', sla_due_at: fmtDate(t.sla_due_at), created_at: fmtDate(t.created_at), resolved_at: fmtDate(t.resolved_at), age_days: ageDays !== null ? ageDays : 'N/A', age_group: ageGroup, sla_breach: isOverdue ? 'YES' : 'No', _rawStatus: t.status } }).filter(r => { if (siteId !== 'all' && r.site !== siteId) return false; if (filter === 'open') return OPEN_STATUSES.includes(r._rawStatus); if (filter === 'closed') return CLOSED_STATUSES.includes(r._rawStatus); if (filter === 'overdue') return r.sla_breach === 'YES'; return true })
  const ageGroups = {}; rows.forEach(r => { ageGroups[r.age_group] = (ageGroups[r.age_group] || 0) + 1 })
  const criticalCount = rows.filter(r => r.priority === 'critical').length; const slaBreachCount = rows.filter(r => r.sla_breach === 'YES').length
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalWorkOrders: rows.length, criticalCount, slaBreachCount, avgAgeDays: rows.filter(r => typeof r.age_days === 'number').length > 0 ? Math.round(rows.filter(r => typeof r.age_days === 'number').reduce((s, r) => s + r.age_days, 0) / rows.filter(r => typeof r.age_days === 'number').length) : 0 }, chartData: Object.entries(ageGroups).map(([name, value]) => ({ name, value })), columns: [{ key: 'ticket_no', label: 'Ticket #' }, { key: 'title', label: 'Title' }, { key: 'asset_name', label: 'Asset' }, { key: 'site', label: 'Site' }, { key: 'priority', label: 'Priority', format: 'badge_priority' }, { key: 'status', label: 'Status', format: 'badge_status' }, { key: 'ticket_type', label: 'Type', format: 'badge_type' }, { key: 'assigned_to', label: 'Assigned To' }, { key: 'age_days', label: 'Age (Days)' }, { key: 'age_group', label: 'Age Bucket' }, { key: 'sla_due_at', label: 'SLA Due' }, { key: 'sla_breach', label: 'SLA Breach', format: 'badge_yesno' }, { key: 'created_at', label: 'Created' }], rows: rows.map(({ _rawStatus, ...r }) => r) }
}

async function _technicianPerformanceAdapter({ siteId }) {
  const { data, error } = await supabase.from('maintenance_tickets').select('id, status, priority, created_at, resolved_at, sla_due_at, assigned:profiles!assigned_to(id, full_name, department), assets!asset_id(site)').limit(500)
  if (error) throw error
  const tickets = (data || []).filter(t => siteId === 'all' || t.assets?.site === siteId)
  const techMap = {}; tickets.forEach(t => { const uid = t.assigned?.id || 'unassigned'; const name = t.assigned?.full_name || 'Unassigned'; const dept = t.assigned?.department || 'N/A'; if (!techMap[uid]) techMap[uid] = { technician: name, department: dept, assigned: 0, resolved: 0, open: 0, total_resolution_hrs: 0, resolved_with_time: 0, sla_compliant: 0, sla_applicable: 0 }; techMap[uid].assigned += 1; if (CLOSED_STATUSES.includes(t.status)) { techMap[uid].resolved += 1; if (t.resolved_at && t.created_at) { techMap[uid].total_resolution_hrs += (new Date(t.resolved_at) - new Date(t.created_at)) / 3600000; techMap[uid].resolved_with_time += 1 } } else { techMap[uid].open += 1 }; if (t.sla_due_at) { techMap[uid].sla_applicable += 1; if (CLOSED_STATUSES.includes(t.status) && t.resolved_at && new Date(t.resolved_at) <= new Date(t.sla_due_at)) techMap[uid].sla_compliant += 1 } })
  const rows = Object.values(techMap).map(r => ({ ...r, completion_rate: r.assigned > 0 ? `${Math.round((r.resolved / r.assigned) * 100)}%` : 'N/A', avg_resolution_hrs: r.resolved_with_time > 0 ? Math.round(r.total_resolution_hrs / r.resolved_with_time * 10) / 10 : 'N/A', sla_compliance: r.sla_applicable > 0 ? `${Math.round((r.sla_compliant / r.sla_applicable) * 100)}%` : 'N/A' })).sort((a, b) => b.assigned - a.assigned).filter(r => r.assigned > 0)
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalTechnicians: rows.length, totalAssigned: rows.reduce((s, r) => s + r.assigned, 0), totalResolved: rows.reduce((s, r) => s + r.resolved, 0) }, chartData: rows.slice(0, 8).map(r => ({ name: r.technician, value: r.resolved })), columns: [{ key: 'technician', label: 'Technician' }, { key: 'department', label: 'Department' }, { key: 'assigned', label: 'Assigned', format: 'number' }, { key: 'resolved', label: 'Resolved', format: 'number' }, { key: 'open', label: 'Open', format: 'number' }, { key: 'completion_rate', label: 'Completion Rate' }, { key: 'avg_resolution_hrs', label: 'Avg Resolution (Hrs)' }, { key: 'sla_compliance', label: 'SLA Compliance' }], rows }
}

async function _downtimeAdapter({ siteId }) {
  const { data, error } = await supabase.from('maintenance_tickets').select('id, ticket_no, title, ticket_type, downtime_start, downtime_end, status, assets!asset_id(asset_code, asset_name, category, site)').not('downtime_start', 'is', null).not('downtime_end', 'is', null).order('downtime_start', { ascending: false }).limit(300)
  if (error) throw error
  const tickets = (data || []).filter(t => siteId === 'all' || t.assets?.site === siteId)
  const rows = tickets.map(t => { const dtHrs = Math.round(((new Date(t.downtime_end) - new Date(t.downtime_start)) / 3600000) * 10) / 10; return { id: t.id, ticket_no: t.ticket_no || 'N/A', asset_code: t.assets?.asset_code || 'N/A', asset_name: t.assets?.asset_name || 'N/A', category: t.assets?.category || 'N/A', site: t.assets?.site || 'N/A', ticket_type: t.ticket_type || 'N/A', downtime_start: fmtDate(t.downtime_start), downtime_end: fmtDate(t.downtime_end), downtime_hrs: dtHrs } }).sort((a, b) => b.downtime_hrs - a.downtime_hrs)
  const totalDowntimeHrs = rows.reduce((s, r) => s + r.downtime_hrs, 0)
  const typeMap = {}; rows.forEach(r => { typeMap[r.ticket_type] = (typeMap[r.ticket_type] || 0) + r.downtime_hrs })
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalTicketsWithDowntime: rows.length, totalDowntimeHrs: Math.round(totalDowntimeHrs * 10) / 10, avgDowntimeHrs: rows.length > 0 ? Math.round(totalDowntimeHrs / rows.length * 10) / 10 : 0 }, chartData: Object.entries(typeMap).map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 })), columns: [{ key: 'ticket_no', label: 'Ticket #' }, { key: 'asset_name', label: 'Asset' }, { key: 'site', label: 'Site' }, { key: 'ticket_type', label: 'Type', format: 'badge_type' }, { key: 'downtime_start', label: 'Downtime Start' }, { key: 'downtime_end', label: 'Downtime End' }, { key: 'downtime_hrs', label: 'Downtime (Hrs)', format: 'number' }], rows }
}

async function _woCostAdapter(mode, { siteId }) {
  const { data, error } = await supabase.from('maintenance_logs').select('id, asset_id, cost, performed_at, work_done, assets!asset_id(asset_code, asset_name, category, site)').order('performed_at', { ascending: false }).limit(500)
  if (error) throw error
  let logs = (data || []).filter(l => siteId === 'all' || l.assets?.site === siteId)
  if (mode === 'per-asset') {
    const assetMap = {}; logs.forEach(l => { const aid = l.asset_id; if (!assetMap[aid]) assetMap[aid] = { asset_code: l.assets?.asset_code || 'N/A', asset_name: l.assets?.asset_name || 'N/A', category: l.assets?.category || 'N/A', site: l.assets?.site || 'N/A', ticket_count: 0, total_cost: 0, last_maintenance: null }; assetMap[aid].ticket_count += 1; assetMap[aid].total_cost += Number(l.cost) || 0; if (!assetMap[aid].last_maintenance || new Date(l.performed_at) > new Date(assetMap[aid].last_maintenance)) assetMap[aid].last_maintenance = l.performed_at })
    const rows = Object.values(assetMap).map(r => ({ ...r, total_cost: Math.round(r.total_cost), avg_cost: r.ticket_count > 0 ? Math.round(r.total_cost / r.ticket_count) : 0, last_maintenance: fmtDate(r.last_maintenance) })).sort((a, b) => b.total_cost - a.total_cost)
    return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { topAssets: rows.length, totalCost: rows.reduce((s, r) => s + r.total_cost, 0) }, chartData: rows.slice(0, 8).map(r => ({ name: r.asset_name, value: r.total_cost })), columns: [{ key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'site', label: 'Site' }, { key: 'ticket_count', label: 'Tickets', format: 'number' }, { key: 'total_cost', label: 'Total Cost (₹)', format: 'currency' }, { key: 'avg_cost', label: 'Avg Cost/Ticket (₹)', format: 'currency' }, { key: 'last_maintenance', label: 'Last Maintenance' }], rows }
  }
  const now = new Date(); const sixMonthTrend = []
  for (let i = 5; i >= 0; i--) { const d = new Date(now); d.setMonth(d.getMonth() - i); const ml = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); const mc = logs.filter(l => { if (!l.performed_at) return false; const dd = new Date(l.performed_at); return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() }).reduce((s, l) => s + (Number(l.cost) || 0), 0); sixMonthTrend.push({ name: ml, cost: Math.round(mc) }) }
  const rows2 = logs.slice(0, 200).map(l => ({ id: l.id, asset_code: l.assets?.asset_code || 'N/A', asset_name: l.assets?.asset_name || 'N/A', site: l.assets?.site || 'N/A', cost: Number(l.cost) || 0, work_done: l.work_done || 'N/A', performed_at: fmtDate(l.performed_at) }))
  return { state: rows2.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalEntries: rows2.length, totalCost: rows2.reduce((s, r) => s + r.cost, 0) }, lineChartData: sixMonthTrend, chartData: [], columns: [{ key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'site', label: 'Site' }, { key: 'cost', label: 'Cost (₹)', format: 'currency' }, { key: 'work_done', label: 'Work Done' }, { key: 'performed_at', label: 'Date' }], rows: rows2 }
}

async function _faultBreakageAdapter({ siteId }) {
  const { data, error } = await supabase.from('maintenance_tickets').select('id, ticket_no, title, ticket_type, priority, status, created_at, assets!asset_id(asset_code, asset_name, category, site)').in('ticket_type', ['breakdown', 'fault', 'damage', 'inspection']).order('created_at', { ascending: false }).limit(300)
  if (error) throw error
  const tickets = (data || []).filter(t => siteId === 'all' || t.assets?.site === siteId)
  const typeMap = {}; tickets.forEach(t => { typeMap[t.ticket_type || 'other'] = (typeMap[t.ticket_type || 'other'] || 0) + 1 })
  const rows = tickets.map(t => ({ id: t.id, ticket_no: t.ticket_no || 'N/A', asset_code: t.assets?.asset_code || 'N/A', asset_name: t.assets?.asset_name || 'N/A', category: t.assets?.category || 'N/A', site: t.assets?.site || 'N/A', ticket_type: t.ticket_type || 'N/A', priority: t.priority || 'normal', status: t.status || 'open', created_at: fmtDate(t.created_at) }))
  const assetHits = {}; rows.forEach(r => { if (r.asset_code !== 'N/A') assetHits[r.asset_name] = (assetHits[r.asset_name] || 0) + 1 })
  const topFailingAssets = Object.entries(assetHits).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalFaults: rows.length, breakdowns: rows.filter(r => r.ticket_type === 'breakdown').length, faults: rows.filter(r => r.ticket_type === 'fault').length, topFailingAsset: topFailingAssets[0] ? `${topFailingAssets[0][0]} (${topFailingAssets[0][1]})` : 'N/A' }, chartData: Object.entries(typeMap).map(([name, value]) => ({ name, value })), secondaryChartData: topFailingAssets.map(([name, value]) => ({ name, value })), columns: [{ key: 'ticket_no', label: 'Ticket #' }, { key: 'asset_name', label: 'Asset' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' }, { key: 'ticket_type', label: 'Fault Type', format: 'badge_type' }, { key: 'priority', label: 'Priority', format: 'badge_priority' }, { key: 'status', label: 'Status', format: 'badge_status' }, { key: 'created_at', label: 'Reported' }], rows }
}

async function _mttrAdapter({ siteId }) {
  const { data, error } = await supabase.from('maintenance_tickets').select('id, ticket_type, created_at, resolved_at, assets!asset_id(asset_code, asset_name, category, site)').not('resolved_at', 'is', null).limit(300)
  if (error) throw error
  const tickets = (data || []).filter(t => { if (siteId !== 'all' && t.assets?.site !== siteId) return false; return t.created_at && t.resolved_at })
  const catMap = {}; tickets.forEach(t => { const cat = t.assets?.category || 'Uncategorized'; const hrs = (new Date(t.resolved_at) - new Date(t.created_at)) / 3600000; if (!catMap[cat]) catMap[cat] = { category: cat, count: 0, total_hrs: 0 }; catMap[cat].count += 1; catMap[cat].total_hrs += hrs })
  const rows = Object.values(catMap).map(r => ({ category: r.category, ticket_count: r.count, avg_mttr_hrs: r.count > 0 ? Math.round(r.total_hrs / r.count * 10) / 10 : 'N/A' })).sort((a, b) => (Number(b.avg_mttr_hrs) || 0) - (Number(a.avg_mttr_hrs) || 0))
  const overall = tickets.length > 0 ? Math.round(tickets.reduce((s, t) => s + ((new Date(t.resolved_at) - new Date(t.created_at)) / 3600000), 0) / tickets.length * 10) / 10 : null
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalTicketsWithData: tickets.length, overallMTTR: overall !== null ? `${overall} hrs` : 'N/A' }, chartData: rows.map(r => ({ name: r.category, value: r.avg_mttr_hrs })), columns: [{ key: 'category', label: 'Category' }, { key: 'ticket_count', label: 'Ticket Count', format: 'number' }, { key: 'avg_mttr_hrs', label: 'Avg MTTR (Hrs)' }], rows, dataQuality: { complete: tickets.length > 0, missingFields: tickets.length === 0 ? ['No tickets have both created_at and resolved_at timestamps'] : [] } }
}

async function _mtbfAdapter({ siteId }) {
  const { data, error } = await supabase.from('maintenance_tickets').select('id, asset_id, ticket_type, created_at, assets!asset_id(asset_code, asset_name, site)').in('ticket_type', ['breakdown', 'fault']).order('created_at', { ascending: true }).limit(500)
  if (error) throw error
  const tickets = (data || []).filter(t => siteId === 'all' || t.assets?.site === siteId)
  const assetTickets = {}; tickets.forEach(t => { if (!t.asset_id) return; if (!assetTickets[t.asset_id]) assetTickets[t.asset_id] = { asset_code: t.assets?.asset_code || 'N/A', asset_name: t.assets?.asset_name || 'N/A', site: t.assets?.site || 'N/A', dates: [] }; assetTickets[t.asset_id].dates.push(t.created_at) })
  const rows = Object.values(assetTickets).map(a => { const dates = a.dates.sort((x, y) => new Date(x) - new Date(y)); let totalGap = 0, gaps = 0; for (let i = 1; i < dates.length; i++) { totalGap += (new Date(dates[i]) - new Date(dates[i - 1])) / 3600000; gaps++ }; const mtbf = gaps > 0 ? Math.round(totalGap / gaps * 10) / 10 : null; return { asset_code: a.asset_code, asset_name: a.asset_name, site: a.site, failure_count: dates.length, mtbf_hrs: mtbf !== null ? mtbf : 'N/A', reliability: mtbf === null ? 'Insufficient data' : mtbf > 720 ? 'HIGH' : mtbf > 168 ? 'MEDIUM' : 'LOW' } }).sort((a, b) => (Number(a.mtbf_hrs) || 999999) - (Number(b.mtbf_hrs) || 999999))
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalAssets: rows.length, lowReliabilityAssets: rows.filter(r => r.reliability === 'LOW').length }, chartData: rows.filter(r => typeof r.mtbf_hrs === 'number').slice(0, 8).map(r => ({ name: r.asset_name, value: r.mtbf_hrs })), columns: [{ key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'site', label: 'Site' }, { key: 'failure_count', label: 'Failure Count', format: 'number' }, { key: 'mtbf_hrs', label: 'MTBF (Hrs)' }, { key: 'reliability', label: 'Reliability', format: 'badge_health' }], rows }
}

async function _availabilityAdapter({ siteId }) {
  const { data, error } = await supabase.from('maintenance_tickets').select('asset_id, downtime_start, downtime_end, status, assets!asset_id(asset_code, asset_name, category, site)').not('downtime_start', 'is', null).not('downtime_end', 'is', null).limit(300)
  if (error) throw error
  const tickets = (data || []).filter(t => siteId === 'all' || t.assets?.site === siteId)
  const assetMap = {}; tickets.forEach(t => { const aid = t.asset_id; if (!assetMap[aid]) assetMap[aid] = { asset_code: t.assets?.asset_code || 'N/A', asset_name: t.assets?.asset_name || 'N/A', site: t.assets?.site || 'N/A', total_downtime_hrs: 0, incidents: 0 }; const hrs = (new Date(t.downtime_end) - new Date(t.downtime_start)) / 3600000; if (hrs > 0) { assetMap[aid].total_downtime_hrs += hrs; assetMap[aid].incidents += 1 } })
  const refHrs = 2920
  const rows = Object.values(assetMap).map(r => ({ ...r, total_downtime_hrs: Math.round(r.total_downtime_hrs * 10) / 10, availability_pct: Math.max(0, Math.round(((refHrs - r.total_downtime_hrs) / refHrs) * 100)) })).sort((a, b) => a.availability_pct - b.availability_pct)
  const avgAvail = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.availability_pct, 0) / rows.length) : 0
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalAssets: rows.length, avgAvailability: `${avgAvail}%`, belowTarget: rows.filter(r => r.availability_pct < 85).length }, gaugeData: { scorePct: avgAvail, maxScore: 100 }, chartData: rows.slice(0, 8).map(r => ({ name: r.asset_name, value: r.availability_pct })), columns: [{ key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'site', label: 'Site' }, { key: 'incidents', label: 'Downtime Events', format: 'number' }, { key: 'total_downtime_hrs', label: 'Total Downtime (Hrs)' }, { key: 'availability_pct', label: 'Availability %', format: 'progress' }], rows }
}

async function _downtimeComparisonAdapter({ siteId }) {
  const [scheduledRes, unplannedRes] = await Promise.all([
    supabase.from('maintenance_tickets').select('ticket_type, downtime_start, downtime_end, assets!asset_id(site)').in('ticket_type', ['scheduled', 'inspection']).not('downtime_start', 'is', null).not('downtime_end', 'is', null),
    supabase.from('maintenance_tickets').select('ticket_type, downtime_start, downtime_end, assets!asset_id(site)').in('ticket_type', ['breakdown', 'fault', 'damage']).not('downtime_start', 'is', null).not('downtime_end', 'is', null),
  ])
  const filterSite = t => siteId === 'all' || t.assets?.site === siteId
  const calcHrs = arr => arr.filter(filterSite).reduce((s, t) => s + Math.max(0, (new Date(t.downtime_end) - new Date(t.downtime_start)) / 3600000), 0)
  const scheduledHrs = Math.round(calcHrs(scheduledRes.data || []) * 10) / 10
  const unplannedHrs = Math.round(calcHrs(unplannedRes.data || []) * 10) / 10
  return { state: 'DATA_AVAILABLE', summary: { scheduledDowntimeHrs: scheduledHrs, unplannedDowntimeHrs: unplannedHrs, ratio: unplannedHrs > 0 ? Math.round(scheduledHrs / unplannedHrs * 100) / 100 : 'N/A' }, chartData: [{ name: 'Scheduled/Planned (hrs)', value: scheduledHrs }, { name: 'Unplanned Breakdown (hrs)', value: unplannedHrs }], columns: [{ key: 'type', label: 'Downtime Type' }, { key: 'total_hrs', label: 'Total Hours' }], rows: [{ type: 'Scheduled / Planned PM', total_hrs: scheduledHrs }, { type: 'Unplanned / Breakdown', total_hrs: unplannedHrs }] }
}

async function _woCompletionRateAdapter({ siteId }) {
  const { data, error } = await supabase.from('maintenance_tickets').select('id, status, assets!asset_id(site)').limit(500)
  if (error) throw error
  const tickets = (data || []).filter(t => siteId === 'all' || t.assets?.site === siteId)
  const total = tickets.length; const resolved = tickets.filter(t => CLOSED_STATUSES.includes(t.status)).length
  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0
  return { state: 'DATA_AVAILABLE', summary: { totalWorkOrders: total, resolved, completionRate: `${rate}%` }, gaugeData: { scorePct: rate, maxScore: 100 }, chartData: [{ name: 'Resolved', value: resolved }, { name: 'Open', value: total - resolved }], columns: [{ key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value' }], rows: [{ metric: 'Total Work Orders', value: total }, { metric: 'Resolved', value: resolved }, { metric: 'Open', value: total - resolved }, { metric: 'Completion Rate', value: `${rate}%` }] }
}

async function _pmSchedulerAdapter(reportId, { siteId }) {
  const [schedulesRes, ticketsRes] = await Promise.all([
    supabase.from('maintenance_schedules').select('id, title, frequency, next_due, last_done, status, assets!asset_id(id, asset_code, asset_name, category, site), assigned:profiles!assigned_to(full_name)').limit(300),
    supabase.from('maintenance_tickets').select('id, ticket_no, title, status, resolved_at, resolution_notes, created_at, assets!asset_id(site)').not('source_schedule_id', 'is', null).in('status', CLOSED_STATUSES).limit(200),
  ])
  const now = new Date()
  let schedules = (schedulesRes.data || []).filter(s => siteId === 'all' || s.assets?.site === siteId)
  if (reportId === 'closed-wo-completion-notes') {
    const rows = (ticketsRes.data || []).filter(t => siteId === 'all' || t.assets?.site === siteId).map(t => ({ id: t.id, ticket_no: t.ticket_no || 'N/A', title: t.title || 'N/A', status: t.status, resolved_at: fmtDate(t.resolved_at), resolution_notes: t.resolution_notes || 'No notes recorded' }))
    return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalClosed: rows.length, withNotes: rows.filter(r => r.resolution_notes !== 'No notes recorded').length }, chartData: [], columns: [{ key: 'ticket_no', label: 'Ticket #' }, { key: 'title', label: 'Title' }, { key: 'status', label: 'Status', format: 'badge_status' }, { key: 'resolved_at', label: 'Resolved At' }, { key: 'resolution_notes', label: 'Completion Notes' }], rows }
  }
  const rows = schedules.map(s => { const daysUntilDue = s.next_due ? daysBetween(now, new Date(s.next_due)) : null; let pmStatus = 'Unknown'; if (daysUntilDue === null) pmStatus = 'Unknown'; else if (daysUntilDue < 0) pmStatus = 'Overdue'; else if (daysUntilDue <= 7) pmStatus = 'Due'; else if (daysUntilDue <= 30) pmStatus = 'Upcoming'; else pmStatus = 'Scheduled'; return { id: s.id, title: s.title || 'N/A', asset_code: s.assets?.asset_code || 'N/A', asset_name: s.assets?.asset_name || 'N/A', category: s.assets?.category || 'N/A', site: s.assets?.site || 'N/A', frequency: s.frequency || 'N/A', next_due: fmtDate(s.next_due), last_done: fmtDate(s.last_done), days_until_due: daysUntilDue !== null ? daysUntilDue : 'N/A', assigned_to: s.assigned?.full_name || 'Unassigned', pm_status: pmStatus } }).sort((a, b) => { const da = typeof a.days_until_due === 'number' ? a.days_until_due : 999; const db = typeof b.days_until_due === 'number' ? b.days_until_due : 999; return da - db })
  const overdueCount = rows.filter(r => r.pm_status === 'Overdue').length; const dueCount = rows.filter(r => r.pm_status === 'Due').length
  const chartData = [{ name: 'Overdue', value: overdueCount }, { name: 'Due (≤7 days)', value: dueCount }, { name: 'Upcoming (≤30 days)', value: rows.filter(r => r.pm_status === 'Upcoming').length }, { name: 'Scheduled (30+ days)', value: rows.filter(r => r.pm_status === 'Scheduled').length }].filter(d => d.value > 0)
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalSchedules: rows.length, overdueCount, dueCount }, chartData, columns: [{ key: 'asset_code', label: 'Asset Code' }, { key: 'asset_name', label: 'Asset Name' }, { key: 'category', label: 'Category' }, { key: 'site', label: 'Site' }, { key: 'frequency', label: 'Frequency' }, { key: 'next_due', label: 'Next Due' }, { key: 'last_done', label: 'Last Done' }, { key: 'days_until_due', label: 'Days Until Due' }, { key: 'assigned_to', label: 'Assigned To' }, { key: 'pm_status', label: 'PM Status', format: 'badge_pm' }], rows }
}

async function _inventoryAdapter({ siteId }) {
  const [itemsRes, txRes] = await Promise.all([
    supabase.from('inventory_items').select('id, item_code, item_name, category, unit, current_stock, reorder_level, unit_cost, location').limit(300),
    supabase.from('inventory_transactions').select('item_id, transaction_type, quantity').limit(500),
  ])
  const items = itemsRes.data || []; const txByItem = {}; ;(txRes.data || []).forEach(tx => { if (!txByItem[tx.item_id]) txByItem[tx.item_id] = { receipts: 0, issues: 0 }; if (tx.transaction_type === 'receipt' || tx.transaction_type === 'purchase') txByItem[tx.item_id].receipts += Number(tx.quantity) || 0; if (tx.transaction_type === 'issue') txByItem[tx.item_id].issues += Number(tx.quantity) || 0 })
  const rows = items.map(i => { const stock = Number(i.current_stock) || 0; const cost = Number(i.unit_cost) || 0; const totalVal = Math.round(stock * cost); const tx = txByItem[i.id] || { receipts: 0, issues: 0 }; const isLow = stock <= (Number(i.reorder_level) || 0); return { id: i.id, item_code: i.item_code, item_name: i.item_name, category: i.category || 'General', unit: i.unit || 'pcs', current_stock: stock, reorder_level: Number(i.reorder_level) || 0, unit_cost: cost, total_value: totalVal, total_receipts: Math.round(tx.receipts), total_issues: Math.round(tx.issues), stock_status: isLow ? 'REORDER' : 'OK', location: i.location || 'N/A' } })
  const totalVal = rows.reduce((s, r) => s + r.total_value, 0); const reorderCount = rows.filter(r => r.stock_status === 'REORDER').length
  const catMap = {}; rows.forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + r.total_value })
  return { state: rows.length === 0 ? 'NO_DATA' : 'DATA_AVAILABLE', summary: { totalSKUs: rows.length, totalInventoryValue: totalVal, reorderCount }, chartData: Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value), columns: [{ key: 'item_code', label: 'Item Code' }, { key: 'item_name', label: 'Item Name' }, { key: 'category', label: 'Category' }, { key: 'unit', label: 'Unit' }, { key: 'current_stock', label: 'Stock', format: 'number' }, { key: 'reorder_level', label: 'Reorder Level', format: 'number' }, { key: 'unit_cost', label: 'Unit Cost (₹)', format: 'currency' }, { key: 'total_value', label: 'Total Value (₹)', format: 'currency' }, { key: 'stock_status', label: 'Status', format: 'badge_stock' }], rows }
}
