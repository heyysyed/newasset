import { supabase } from './supabase'
import { fmtDate, daysBetween, yearsBetween } from './reports'

// Helper for depreciation calculation to match existing logic
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
  return { 
    purchaseVal: Math.round(purchaseVal), 
    accumDepr: Math.round(accumDepr), 
    netBookValue: Math.round(netBookValue), 
    deprPct: purchaseVal > 0 ? Math.min(100, Math.round((accumDepr / purchaseVal) * 100)) : 0, 
    yearsOwned: Math.round(yearsOwned * 10) / 10 
  }
}

// 3. Asset Valuation & Capital Exposure
export async function getAssetValuationReport({ siteId = 'all', category = 'All' } = {}) {
  let q = supabase.from('assets').select('*').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (siteId && siteId !== 'All' && siteId !== 'all') q = q.ilike('site', `%${siteId.replace(/^\[.*?\]\s*/, '')}%`)
  if (category && category !== 'All' && category !== 'all') q = q.eq('category', category)
  
  const { data, error } = await q
  if (error) throw error
  const assets = data || []
  
  const rows = assets.map(a => {
    const depr = calcDepreciation(a)
    return {
      id: a.id,
      asset_code: a.asset_code,
      asset_name: a.asset_name || 'N/A',
      category: a.category || 'N/A',
      site: a.site || 'N/A',
      purchase_value: depr.purchaseVal,
      accumulated_depreciation: depr.accumDepr,
      net_book_value: depr.netBookValue,
      depr_pct: `${depr.deprPct}%`,
      years_owned: depr.yearsOwned,
      status: a.status || 'N/A'
    }
  }).sort((a, b) => b.net_book_value - a.net_book_value)

  const totalGrossValue = rows.reduce((s, r) => s + r.purchase_value, 0)
  const totalNetBookValue = rows.reduce((s, r) => s + r.net_book_value, 0)
  const totalAccumDepr = rows.reduce((s, r) => s + r.accumulated_depreciation, 0)
  
  // Categorize exposure
  const categoryExposure = {}
  rows.forEach(r => {
    categoryExposure[r.category] = (categoryExposure[r.category] || 0) + r.net_book_value
  })

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalAssets: rows.length,
      totalGrossValue,
      totalNetBookValue,
      totalAccumDepr,
      averageAssetValue: rows.length > 0 ? Math.round(totalNetBookValue / rows.length) : 0
    },
    chartData: Object.entries(categoryExposure).map(([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value),
    columns: [
      { key: 'asset_code', label: 'Code' },
      { key: 'asset_name', label: 'Asset Name' },
      { key: 'category', label: 'Category' },
      { key: 'site', label: 'Site' },
      { key: 'purchase_value', label: 'Purchase Value (₹)', format: 'currency' },
      { key: 'accumulated_depreciation', label: 'Accumulated Depr (₹)', format: 'currency' },
      { key: 'net_book_value', label: 'Net Book Value (₹)', format: 'currency' },
      { key: 'depr_pct', label: 'Depr %' },
      { key: 'years_owned', label: 'Age (Yrs)' }
    ],
    rows
  }
}

// 5. Asset Lifespan Intelligence
export async function getAssetLifespanReport({ siteId = 'all', category = 'All' } = {}) {
  let q = supabase.from('assets').select('*').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
  if (siteId && siteId !== 'All' && siteId !== 'all') q = q.ilike('site', `%${siteId.replace(/^\[.*?\]\s*/, '')}%`)
  if (category && category !== 'All' && category !== 'all') q = q.eq('category', category)
  
  const { data, error } = await q
  if (error) throw error
  const assets = data || []
  
  const rows = assets.map(a => {
    const pDateStr = a.purchase_date || a.added_on || a.created_at
    const usefulLife = Number(a.useful_life_years) || 10
    const ageYrs = pDateStr ? Math.max(0, yearsBetween(pDateStr)) : 0
    const remainingYrs = Math.max(0, usefulLife - ageYrs)
    const consumedPct = usefulLife > 0 ? Math.min(100, Math.round((ageYrs / usefulLife) * 100)) : 0
    
    let bucket = 'Unknown'
    if (ageYrs < 1) bucket = '0-1 Years'
    else if (ageYrs < 3) bucket = '1-3 Years'
    else if (ageYrs < 5) bucket = '3-5 Years'
    else if (ageYrs < 10) bucket = '5-10 Years'
    else bucket = '10+ Years'

    let risk = 'Normal'
    if (consumedPct >= 100) risk = 'Beyond Useful Life'
    else if (consumedPct >= 80) risk = 'Approaching End of Life'

    return {
      id: a.id,
      asset_code: a.asset_code,
      asset_name: a.asset_name || 'N/A',
      site: a.site || 'N/A',
      category: a.category || 'N/A',
      purchase_value: Number(a.purchase_value) || 0,
      useful_life: usefulLife,
      age_yrs: Math.round(ageYrs * 10) / 10,
      remaining_yrs: Math.round(remainingYrs * 10) / 10,
      consumed_pct: consumedPct,
      bucket,
      risk
    }
  }).sort((a, b) => b.age_yrs - a.age_yrs)

  const beyondLife = rows.filter(r => r.risk === 'Beyond Useful Life').length
  const approachingEOL = rows.filter(r => r.risk === 'Approaching End of Life').length

  const bucketMap = { '0-1 Years': 0, '1-3 Years': 0, '3-5 Years': 0, '5-10 Years': 0, '10+ Years': 0 }
  rows.forEach(r => { if(bucketMap[r.bucket] !== undefined) bucketMap[r.bucket]++ })

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalAssets: rows.length,
      beyondLife,
      approachingEOL,
      avgAge: rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.age_yrs, 0) / rows.length) * 10) / 10 : 0
    },
    chartData: Object.entries(bucketMap).map(([name, value]) => ({ name, value })),
    columns: [
      { key: 'asset_code', label: 'Code' },
      { key: 'asset_name', label: 'Asset Name' },
      { key: 'category', label: 'Category' },
      { key: 'site', label: 'Site' },
      { key: 'age_yrs', label: 'Age (Yrs)' },
      { key: 'useful_life', label: 'Useful Life (Yrs)' },
      { key: 'consumed_pct', label: 'Consumed %', format: 'progress' },
      { key: 'risk', label: 'Lifespan Risk' },
    ],
    rows
  }
}

// 6. Asset Movement Intelligence
export async function getAssetMovementReport({ siteId = 'all', dateRange = 'Last 90 Days' } = {}) {
  // Proxy for actual location telemetry
  let q = supabase.from('asset_movements').select('*, assets(asset_code, asset_name, category, purchase_value)')
  
  // Date filtering logic could go here if we parse dateRange
  const { data, error } = await q.order('moved_at', { ascending: false })
  if (error) throw error
  
  const movements = data || []
  let filtered = movements
  if (siteId !== 'All' && siteId !== 'all') {
    filtered = filtered.filter(m => m.from_location?.includes(siteId) || m.to_location?.includes(siteId))
  }

  const rows = filtered.map(m => ({
    id: m.id,
    asset_code: m.assets?.asset_code || 'N/A',
    asset_name: m.assets?.asset_name || 'N/A',
    category: m.assets?.category || 'N/A',
    purchase_value: Number(m.assets?.purchase_value) || 0,
    from_location: m.from_location || 'Unknown',
    to_location: m.to_location || 'Unknown',
    movement_type: m.movement_type || 'Transfer',
    moved_at: fmtDate(m.moved_at),
    moved_by: m.moved_by || 'Unknown'
  }))

  const typeMap = {}
  rows.forEach(r => { typeMap[r.movement_type] = (typeMap[r.movement_type] || 0) + 1 })

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalMovements: rows.length,
      uniqueAssetsMoved: new Set(rows.map(r => r.asset_code)).size,
      topMovementType: Object.entries(typeMap).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'N/A'
    },
    chartData: Object.entries(typeMap).map(([name, value]) => ({ name, value })),
    columns: [
      { key: 'asset_code', label: 'Code' },
      { key: 'asset_name', label: 'Asset Name' },
      { key: 'movement_type', label: 'Type' },
      { key: 'from_location', label: 'From' },
      { key: 'to_location', label: 'To' },
      { key: 'moved_at', label: 'Date' },
      { key: 'moved_by', label: 'Moved By' },
    ],
    rows
  }
}

// 7. PM Compliance Report
export async function getPMComplianceReport({ siteId = 'all' } = {}) {
  // We use maintenance_schedules and maintenance_logs
  const [schedRes, logRes] = await Promise.all([
    supabase.from('maintenance_schedules').select('id, title, next_due, frequency, asset_id, assets(asset_code, asset_name, site, category)'),
    supabase.from('maintenance_logs').select('schedule_id, performed_at')
  ])
  
  const schedules = schedRes.data || []
  const logs = logRes.data || []
  
  let filtered = schedules
  if (siteId !== 'All' && siteId !== 'all') {
    filtered = filtered.filter(s => s.assets?.site?.includes(siteId))
  }

  const now = new Date()
  
  const rows = filtered.map(s => {
    // find latest log for this schedule
    const schedLogs = logs.filter(l => l.schedule_id === s.id).map(l => new Date(l.performed_at))
    const lastDone = schedLogs.length > 0 ? new Date(Math.max.apply(null, schedLogs)) : null
    
    let status = 'Unknown'
    const nextDue = new Date(s.next_due)
    if (nextDue < now) status = 'Overdue'
    else if (daysBetween(now, nextDue) <= 7) status = 'Due Soon'
    else status = 'Compliant'

    return {
      id: s.id,
      title: s.title || 'PM Task',
      asset_code: s.assets?.asset_code || 'N/A',
      asset_name: s.assets?.asset_name || 'N/A',
      site: s.assets?.site || 'N/A',
      frequency: s.frequency || 'Monthly',
      last_done: lastDone ? fmtDate(lastDone) : 'Never',
      next_due: fmtDate(s.next_due),
      status
    }
  }).sort((a, b) => a.status === 'Overdue' ? -1 : 1)

  const overdueCount = rows.filter(r => r.status === 'Overdue').length
  const compliantCount = rows.filter(r => r.status === 'Compliant').length
  const compliancePct = rows.length > 0 ? Math.round((compliantCount / rows.length) * 100) : 0

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalSchedules: rows.length,
      overdueCount,
      compliantCount,
      compliancePct: `${compliancePct}%`
    },
    chartData: [
      { name: 'Compliant', value: compliantCount },
      { name: 'Overdue', value: overdueCount },
      { name: 'Due Soon', value: rows.filter(r => r.status === 'Due Soon').length }
    ].filter(d => d.value > 0),
    columns: [
      { key: 'title', label: 'PM Title' },
      { key: 'asset_code', label: 'Asset Code' },
      { key: 'asset_name', label: 'Asset Name' },
      { key: 'site', label: 'Site' },
      { key: 'frequency', label: 'Frequency' },
      { key: 'last_done', label: 'Last Performed' },
      { key: 'next_due', label: 'Next Due' },
      { key: 'status', label: 'Compliance Status' }
    ],
    rows
  }
}

// 8. Maintenance Backlog Report
export async function getMaintenanceBacklogReport({ siteId = 'all', status = 'All' } = {}) {
  let q = supabase.from('maintenance_tickets').select('*, assets(asset_code, asset_name, category, site)')
    .in('status', ['open', 'in_progress', 'assigned'])
    
  const { data, error } = await q
  if (error) throw error
  
  let tickets = data || []
  if (siteId !== 'All' && siteId !== 'all') {
    tickets = tickets.filter(t => t.assets?.site?.includes(siteId))
  }
  
  const now = new Date()
  
  const rows = tickets.map(t => {
    const ageDays = Math.max(0, daysBetween(t.created_at, now))
    let backlogState = 'Current'
    if (ageDays > 30) backlogState = 'Severe Backlog (>30d)'
    else if (ageDays > 14) backlogState = 'Aging Backlog (>14d)'
    else if (ageDays > 7) backlogState = 'Growing Backlog (>7d)'

    return {
      id: t.id,
      ticket_no: t.ticket_no || 'N/A',
      title: t.title || 'N/A',
      asset_code: t.assets?.asset_code || 'N/A',
      site: t.assets?.site || 'N/A',
      priority: t.priority || 'normal',
      status: t.status || 'open',
      created_at: fmtDate(t.created_at),
      age_days: ageDays,
      backlog_state: backlogState
    }
  }).sort((a, b) => b.age_days - a.age_days)

  const priorityMap = { critical: 0, high: 0, normal: 0, low: 0 }
  rows.forEach(r => { if(priorityMap[r.priority] !== undefined) priorityMap[r.priority]++ })

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalBacklog: rows.length,
      criticalBacklog: priorityMap.critical,
      severeBacklog: rows.filter(r => r.backlog_state === 'Severe Backlog (>30d)').length,
      avgAgeDays: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.age_days, 0) / rows.length) : 0
    },
    chartData: Object.entries(priorityMap).filter(([k,v]) => v > 0).map(([name, value]) => ({ name, value })),
    columns: [
      { key: 'ticket_no', label: 'Ticket #' },
      { key: 'title', label: 'Title' },
      { key: 'asset_code', label: 'Asset' },
      { key: 'site', label: 'Site' },
      { key: 'priority', label: 'Priority', format: 'badge_priority' },
      { key: 'status', label: 'Status', format: 'badge_status' },
      { key: 'created_at', label: 'Created' },
      { key: 'age_days', label: 'Age (Days)' },
      { key: 'backlog_state', label: 'Backlog State' }
    ],
    rows
  }
}

// 10. Breakdown Activity Report
export async function getBreakdownActivityReport({ siteId = 'all' } = {}) {
  let q = supabase.from('maintenance_tickets').select('*, assets(asset_code, asset_name, category, site)')
    .eq('ticket_type', 'breakdown')
    
  const { data, error } = await q
  if (error) throw error
  
  let tickets = data || []
  if (siteId !== 'All' && siteId !== 'all') {
    tickets = tickets.filter(t => t.assets?.site?.includes(siteId))
  }
  
  // Aggregate by asset
  const breakdownByAsset = {}
  tickets.forEach(t => {
    const aid = t.asset_id
    if (!breakdownByAsset[aid]) {
      breakdownByAsset[aid] = {
        asset_code: t.assets?.asset_code || 'N/A',
        asset_name: t.assets?.asset_name || 'N/A',
        site: t.assets?.site || 'N/A',
        category: t.assets?.category || 'N/A',
        breakdown_count: 0,
        total_downtime_hrs: 0,
        last_breakdown: null
      }
    }
    breakdownByAsset[aid].breakdown_count++
    const res = new Date(t.resolved_at || t.downtime_end || new Date())
    const start = new Date(t.created_at || t.downtime_start || new Date())
    const hrs = Math.max(0, (res - start) / 3600000)
    breakdownByAsset[aid].total_downtime_hrs += hrs
    
    if (!breakdownByAsset[aid].last_breakdown || new Date(t.created_at) > new Date(breakdownByAsset[aid].last_breakdown)) {
      breakdownByAsset[aid].last_breakdown = t.created_at
    }
  })

  const rows = Object.values(breakdownByAsset).map(r => ({
    ...r,
    total_downtime_hrs: Math.round(r.total_downtime_hrs),
    last_breakdown: fmtDate(r.last_breakdown)
  })).sort((a, b) => b.breakdown_count - a.breakdown_count)

  const repeatFailures = rows.filter(r => r.breakdown_count >= 3).length

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalBreakdownEvents: tickets.length,
      affectedAssets: rows.length,
      repeatFailures,
      totalDowntimeHrs: rows.reduce((s, r) => s + r.total_downtime_hrs, 0)
    },
    chartData: rows.slice(0, 10).map(r => ({ name: r.asset_code, value: r.breakdown_count })),
    columns: [
      { key: 'asset_code', label: 'Asset Code' },
      { key: 'asset_name', label: 'Asset Name' },
      { key: 'category', label: 'Category' },
      { key: 'site', label: 'Site' },
      { key: 'breakdown_count', label: 'Breakdown Events' },
      { key: 'total_downtime_hrs', label: 'Downtime (Hrs)' },
      { key: 'last_breakdown', label: 'Last Breakdown' }
    ],
    rows
  }
}

// 11. Inventory Position Report
export async function getInventoryPositionReport({ siteId = 'all' } = {}) {
  let q = supabase.from('inventory_items').select('*')
  if (siteId !== 'All' && siteId !== 'all') {
    q = q.ilike('location', `%${siteId.replace(/^\[.*?\]\s*/, '')}%`)
  }
  
  const { data, error } = await q
  if (error) throw error
  
  const rows = (data || []).map(it => {
    const stock = Number(it.current_stock) || 0
    const reorder = Number(it.reorder_level) || 0
    const val = stock * (Number(it.unit_cost) || 0)
    let state = 'Healthy'
    if (stock <= 0) state = 'Out of Stock'
    else if (stock <= reorder) state = 'Low Stock'
    
    return {
      id: it.id,
      item_code: it.item_code || 'N/A',
      item_name: it.item_name || 'N/A',
      category: it.category || 'N/A',
      location: it.location || 'N/A',
      current_stock: stock,
      reorder_level: reorder,
      unit_cost: Number(it.unit_cost) || 0,
      total_value: val,
      stock_state: state
    }
  }).sort((a, b) => b.total_value - a.total_value)

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalSKUs: rows.length,
      totalStockValue: rows.reduce((s, r) => s + r.total_value, 0),
      outOfStock: rows.filter(r => r.stock_state === 'Out of Stock').length,
      lowStock: rows.filter(r => r.stock_state === 'Low Stock').length
    },
    chartData: [
      { name: 'Healthy', value: rows.filter(r => r.stock_state === 'Healthy').length },
      { name: 'Low Stock', value: rows.filter(r => r.stock_state === 'Low Stock').length },
      { name: 'Out of Stock', value: rows.filter(r => r.stock_state === 'Out of Stock').length }
    ].filter(d => d.value > 0),
    columns: [
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_name', label: 'Item Name' },
      { key: 'category', label: 'Category' },
      { key: 'location', label: 'Location' },
      { key: 'current_stock', label: 'Qty' },
      { key: 'reorder_level', label: 'Reorder At' },
      { key: 'unit_cost', label: 'Unit Cost (₹)', format: 'currency' },
      { key: 'total_value', label: 'Total Value (₹)', format: 'currency' },
      { key: 'stock_state', label: 'Status' }
    ],
    rows
  }
}

// 13. Inventory Aging Report
export async function getInventoryAgingReport({ siteId = 'all' } = {}) {
  // Since we don't have batch-level aging, we will approximate using last transaction date
  const [itemsRes, txRes] = await Promise.all([
    supabase.from('inventory_items').select('*'),
    supabase.from('inventory_transactions').select('item_id, transaction_at').order('transaction_at', { ascending: false })
  ])
  
  let items = itemsRes.data || []
  if (siteId !== 'All' && siteId !== 'all') {
    items = items.filter(it => it.location?.includes(siteId))
  }
  const tx = txRes.data || []
  
  const lastTxMap = {}
  tx.forEach(t => {
    if (!lastTxMap[t.item_id]) lastTxMap[t.item_id] = t.transaction_at
  })
  
  const now = new Date()
  
  const rows = items.map(it => {
    const ltx = lastTxMap[it.id]
    const daysSinceTx = ltx ? daysBetween(ltx, now) : daysBetween(it.created_at, now)
    const stock = Number(it.current_stock) || 0
    const val = stock * (Number(it.unit_cost) || 0)
    
    let agingBucket = 'Active (<30d)'
    if (daysSinceTx > 180) agingBucket = 'Critical Aging (>180d)'
    else if (daysSinceTx > 90) agingBucket = 'Slow Moving (>90d)'
    else if (daysSinceTx > 30) agingBucket = 'Moderate (>30d)'

    return {
      id: it.id,
      item_code: it.item_code || 'N/A',
      item_name: it.item_name || 'N/A',
      location: it.location || 'N/A',
      current_stock: stock,
      total_value: val,
      last_activity: ltx ? fmtDate(ltx) : 'None',
      days_inactive: daysSinceTx || 0,
      aging_bucket: agingBucket
    }
  }).filter(r => r.current_stock > 0).sort((a, b) => b.days_inactive - a.days_inactive)

  const slowValue = rows.filter(r => r.aging_bucket.includes('Critical') || r.aging_bucket.includes('Slow')).reduce((s, r) => s + r.total_value, 0)

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalSKUsAnalyzed: rows.length,
      totalStockValue: rows.reduce((s, r) => s + r.total_value, 0),
      slowMovingValue: slowValue,
      criticalAgingItems: rows.filter(r => r.aging_bucket.includes('Critical')).length
    },
    chartData: [
      { name: 'Active', value: rows.filter(r => r.aging_bucket.includes('Active')).length },
      { name: 'Moderate', value: rows.filter(r => r.aging_bucket.includes('Moderate')).length },
      { name: 'Slow Moving', value: rows.filter(r => r.aging_bucket.includes('Slow Moving')).length },
      { name: 'Critical Aging', value: rows.filter(r => r.aging_bucket.includes('Critical')).length }
    ].filter(d => d.value > 0),
    columns: [
      { key: 'item_code', label: 'Item Code' },
      { key: 'item_name', label: 'Item Name' },
      { key: 'location', label: 'Location' },
      { key: 'current_stock', label: 'Qty' },
      { key: 'total_value', label: 'Stock Value (₹)', format: 'currency' },
      { key: 'last_activity', label: 'Last Transaction' },
      { key: 'days_inactive', label: 'Days Inactive' },
      { key: 'aging_bucket', label: 'Aging Risk' }
    ],
    rows
  }
}

// 15. Asset Risk Intelligence
export async function getAssetRiskReport({ siteId = 'all' } = {}) {
  // Combines age, breakdown count, and PM compliance
  const [assetsRes, ticketsRes] = await Promise.all([
    supabase.from('assets').select('*').or('status.eq.Active,status.eq.Under Repair'),
    supabase.from('maintenance_tickets').select('asset_id, ticket_type')
  ])
  
  let assets = assetsRes.data || []
  if (siteId !== 'All' && siteId !== 'all') {
    assets = assets.filter(a => a.site?.includes(siteId))
  }
  const tickets = ticketsRes.data || []
  
  const breakdownCount = {}
  tickets.forEach(t => {
    if (t.ticket_type === 'breakdown') {
      breakdownCount[t.asset_id] = (breakdownCount[t.asset_id] || 0) + 1
    }
  })
  
  const rows = assets.map(a => {
    const ageYrs = (a.purchase_date || a.added_on) ? Math.max(0, yearsBetween(a.purchase_date || a.added_on)) : 0
    const bCount = breakdownCount[a.id] || 0
    const isOld = ageYrs >= (Number(a.useful_life_years) || 10) * 0.8
    const val = Number(a.purchase_value) || 0
    
    const riskReasons = []
    if (bCount >= 3) riskReasons.push(`High Breakdown Frequency (${bCount})`)
    if (isOld) riskReasons.push(`Approaching/Beyond Useful Life (${Math.round(ageYrs)} yrs)`)
    if (a.condition === 'needs_repair' || a.condition === 'poor') riskReasons.push(`Poor Condition Recorded`)
    
    let riskLevel = 'Low'
    if (riskReasons.length >= 2) riskLevel = 'High'
    else if (riskReasons.length === 1) riskLevel = 'Medium'
    
    return {
      id: a.id,
      asset_code: a.asset_code,
      asset_name: a.asset_name || 'N/A',
      site: a.site || 'N/A',
      purchase_value: val,
      age_yrs: Math.round(ageYrs * 10) / 10,
      breakdown_count: bCount,
      risk_level: riskLevel,
      risk_reasons: riskReasons.join('; ') || 'None'
    }
  }).sort((a, b) => (b.risk_level === 'High' ? 2 : b.risk_level === 'Medium' ? 1 : 0) - (a.risk_level === 'High' ? 2 : a.risk_level === 'Medium' ? 1 : 0))

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalAssetsAnalyzed: rows.length,
      highRiskAssets: rows.filter(r => r.risk_level === 'High').length,
      mediumRiskAssets: rows.filter(r => r.risk_level === 'Medium').length,
      valueAtRisk: rows.filter(r => r.risk_level === 'High').reduce((s, r) => s + r.purchase_value, 0)
    },
    chartData: [
      { name: 'High Risk', value: rows.filter(r => r.risk_level === 'High').length },
      { name: 'Medium Risk', value: rows.filter(r => r.risk_level === 'Medium').length },
      { name: 'Low Risk', value: rows.filter(r => r.risk_level === 'Low').length }
    ].filter(d => d.value > 0),
    columns: [
      { key: 'asset_code', label: 'Code' },
      { key: 'asset_name', label: 'Asset Name' },
      { key: 'site', label: 'Site' },
      { key: 'purchase_value', label: 'Value (₹)', format: 'currency' },
      { key: 'age_yrs', label: 'Age (Yrs)' },
      { key: 'breakdown_count', label: 'Breakdowns' },
      { key: 'risk_level', label: 'Risk Level' },
      { key: 'risk_reasons', label: 'Risk Drivers' }
    ],
    rows
  }
}

// 17. Data Quality & Governance
export async function getDataQualityReport({ siteId = 'all' } = {}) {
  let q = supabase.from('assets').select('*').or('status.eq.Active,status.eq.Idle')
  if (siteId !== 'All' && siteId !== 'all') {
    q = q.ilike('site', `%${siteId.replace(/^\[.*?\]\s*/, '')}%`)
  }
  
  const { data, error } = await q
  if (error) throw error
  
  const assets = data || []
  
  const rows = assets.map(a => {
    const missing = []
    if (!a.site) missing.push('Site')
    if (!a.category) missing.push('Category')
    if (!a.purchase_value) missing.push('Purchase Value')
    if (!a.useful_life_years) missing.push('Useful Life')
    if (!a.added_on && !a.purchase_date) missing.push('Acquisition Date')
    
    const completeness = Math.round(((5 - missing.length) / 5) * 100)
    
    return {
      id: a.id,
      asset_code: a.asset_code,
      asset_name: a.asset_name || 'N/A',
      site: a.site || 'Missing',
      completeness: `${completeness}%`,
      missing_fields: missing.join(', ') || 'None',
      status: completeness === 100 ? 'Healthy' : completeness >= 60 ? 'Incomplete' : 'Critical Data Missing'
    }
  }).sort((a, b) => parseInt(a.completeness) - parseInt(b.completeness))

  const completeAssets = rows.filter(r => r.status === 'Healthy').length
  const criticalMissing = rows.filter(r => r.status === 'Critical Data Missing').length

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalRecords: rows.length,
      completeRecords: completeAssets,
      criticalDataMissing: criticalMissing,
      overallCompleteness: rows.length > 0 ? `${Math.round(rows.reduce((s, r) => s + parseInt(r.completeness), 0) / rows.length)}%` : '0%'
    },
    chartData: [
      { name: '100% Complete', value: completeAssets },
      { name: 'Partially Complete', value: rows.filter(r => r.status === 'Incomplete').length },
      { name: 'Critical Data Missing', value: criticalMissing }
    ].filter(d => d.value > 0),
    columns: [
      { key: 'asset_code', label: 'Code' },
      { key: 'asset_name', label: 'Asset Name' },
      { key: 'site', label: 'Site' },
      { key: 'completeness', label: 'Completeness %' },
      { key: 'missing_fields', label: 'Missing Fields' },
      { key: 'status', label: 'Data Status' }
    ],
    rows
  }
}

// 18. Operational Exceptions Center
export async function getOperationalExceptionsReport({ siteId = 'all' } = {}) {
  // Aggregate various anomalies from the system
  
  // 1. Overdue Maintenance
  const { data: overdueTkts } = await supabase.from('maintenance_tickets').select('id, ticket_no, asset_id, title').in('status', ['open', 'in_progress']).lt('sla_due_at', new Date().toISOString())
  // 2. High Variance Audits
  const { data: varAudits } = await supabase.from('bulk_audits').select('id, item_code, variance_value_inr').eq('risk_tier', 'Critical')
  // 3. Out of stock inventory
  const { data: oosInv } = await supabase.from('inventory_items').select('id, item_code, item_name, location').lte('current_stock', 0)
  
  const rows = []
  
  ;(overdueTkts || []).forEach(t => {
    rows.push({
      id: `mt-${t.id}`,
      module: 'Maintenance',
      severity: 'High',
      entity: t.ticket_no || 'Unknown',
      description: `SLA Breached: ${t.title}`,
      action: 'Open Maintenance Ticket'
    })
  })
  
  ;(varAudits || []).forEach(a => {
    rows.push({
      id: `au-${a.id}`,
      module: 'Audit',
      severity: 'Critical',
      entity: a.item_code || 'Unknown',
      description: `Critical Variance Detected (₹${a.variance_value_inr})`,
      action: 'Review Audit Record'
    })
  })
  
  ;(oosInv || []).forEach(i => {
    if (siteId !== 'All' && siteId !== 'all' && !i.location?.includes(siteId)) return;
    rows.push({
      id: `inv-${i.id}`,
      module: 'Inventory',
      severity: 'Medium',
      entity: i.item_code || 'Unknown',
      description: `Stockout: ${i.item_name} is fully depleted.`,
      action: 'Create Purchase Order'
    })
  })

  return {
    state: 'DATA_AVAILABLE',
    summary: {
      totalExceptions: rows.length,
      criticalExceptions: rows.filter(r => r.severity === 'Critical').length,
      highExceptions: rows.filter(r => r.severity === 'High').length
    },
    chartData: [
      { name: 'Maintenance', value: rows.filter(r => r.module === 'Maintenance').length },
      { name: 'Audit', value: rows.filter(r => r.module === 'Audit').length },
      { name: 'Inventory', value: rows.filter(r => r.module === 'Inventory').length }
    ].filter(d => d.value > 0),
    columns: [
      { key: 'module', label: 'Domain' },
      { key: 'severity', label: 'Severity' },
      { key: 'entity', label: 'Entity ID' },
      { key: 'description', label: 'Exception Description' },
      { key: 'action', label: 'Recommended Action' }
    ],
    rows
  }
}


