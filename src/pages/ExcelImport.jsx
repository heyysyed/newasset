import React, { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Upload, FileSpreadsheet, XCircle, AlertTriangle,
  Download, AlertCircle, RefreshCw, Table2, Layers, X, Trash2, PlusCircle, Loader2
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { bulkInsertAssets, generateAssetCode, getAssetCodePrefix, fetchSites, supabase } from '../lib/supabase'
import { resolveSite, addSiteAlias } from '../lib/siteResolver'
import { useAuth } from '../context/AuthContext'
import { useImport } from '../context/ImportContext'

// ── Column name → DB field ───────────────────────────────────────────────────
const COL_MAP = {
  'asset code': 'asset_code', 'asset_code': 'asset_code', 'assetcode': 'asset_code',
  'asset name': 'asset_name', 'asset_name': 'asset_name', 'assetname': 'asset_name', 'name': 'asset_name',
  'make': 'make', 'manufacturer': 'make',
  'model no': 'model_no', 'model no.': 'model_no', 'model number': 'model_no', 'model_no': 'model_no', 'modelno': 'model_no',
  'purchase order no': 'purchase_order_no', 'purchase order number': 'purchase_order_no',
  'po no': 'purchase_order_no', 'po number': 'purchase_order_no', 'purchase_order_no': 'purchase_order_no',
  'serial no': 'serial_no', 'serial no.': 'serial_no', 'serial number': 'serial_no', 'serial_no': 'serial_no', 'serialno': 'serial_no',
  'capacity': 'capacity', 'status': 'status', 'category': 'category',
  'site': 'site', 'location': 'site', 'site / location': 'site', 'site/location': 'site',
  'site code': 'site', 'site_code': 'site', 'sitecode': 'site', 'project code': 'site', 'project': 'site', 'location code': 'site',
  'type code': 'type_code', 'type_code': 'type_code', 'typecode': 'type_code',
  'department': 'department',
  'purchase date': 'purchase_date', 'purchase_date': 'purchase_date', 'date of purchase': 'purchase_date',
  'purchase value': 'purchase_value', 'purchase_value': 'purchase_value', 'purchase price': 'purchase_value', 'cost': 'purchase_value',
  'salvage value': 'salvage_value', 'salvage_value': 'salvage_value', 'residual value': 'salvage_value',
  'useful life': 'useful_life_years', 'useful life (yrs)': 'useful_life_years', 'useful life years': 'useful_life_years', 'useful_life_years': 'useful_life_years',
  'depreciation method': 'depreciation_method', 'depreciation_method': 'depreciation_method', 'depr. method': 'depreciation_method',
  'depreciation rate': 'depreciation_rate_percent', 'depreciation rate %': 'depreciation_rate_percent', 'depr. rate %': 'depreciation_rate_percent', 'depreciation_rate_percent': 'depreciation_rate_percent',
  'warranty expiry': 'warranty_expiry', 'warranty_expiry': 'warranty_expiry', 'warranty expiry date': 'warranty_expiry',
  'notes': 'notes', 'added on': 'added_on', 'added_on': 'added_on',
  'company code': 'company_code', 'company_code': 'company_code', 'company name': 'company_code', 'company': 'company_code',
}

const DB_LABELS = {
  company_code: 'Company Name', asset_code: 'Asset Code', asset_name: 'Asset Name', make: 'Make', model_no: 'Model No',
  purchase_order_no: 'PO No', serial_no: 'Serial No', capacity: 'Capacity', status: 'Status',
  category: 'Category', site: 'Site', type_code: 'Type Code', department: 'Department',
  purchase_date: 'Purchase Date', purchase_value: 'Purchase Value', salvage_value: 'Salvage Value',
  useful_life_years: 'Useful Life (Yrs)', depreciation_method: 'Depr. Method',
  depreciation_rate_percent: 'Depr. Rate %', warranty_expiry: 'Warranty Expiry', notes: 'Notes',
}

const DATE_FIELDS    = new Set(['purchase_date', 'warranty_expiry', 'added_on'])
const NUMERIC_FIELDS = new Set(['purchase_value', 'salvage_value', 'useful_life_years', 'depreciation_rate_percent'])
const VALID_STATUSES = ['Active', 'Inactive', 'Disposed', 'Under Repair', 'On Hire']
const VALID_DEPR     = ['Straight Line', 'Reducing Balance', 'Declining Balance']
const TEMPLATE_HEADERS = [
  'Asset Code','Asset Name','Make','Model No','Purchase Order No','Serial No','Capacity',
  'Status','Category','Site','Department','Type Code','Purchase Date','Purchase Value',
  'Salvage Value','Useful Life (Yrs)','Depreciation Method','Depreciation Rate %','Warranty Expiry','Notes',
]

function parseDate(val) {
  if (!val) return null
  // Excel numeric date (days since 1900-01-01) - effectively UTC
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return isNaN(d) ? null : d.toISOString().slice(0, 10)
  }
  const d = new Date(val)
  if (isNaN(d)) return null
  
  // Extract local date components to avoid timezone shift on string dates (e.g. MM/DD/YYYY)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
function parseNumber(val) {
  if (val === '' || val == null) return null
  const n = Number(String(val).replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : n
}
function fmt(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

// ── Validation (pure function, runs on every edit) ───────────────────────────
function validateRows(rows) {
  const errors = [], warnings = [], seen = new Map()
  rows.forEach(a => {
    if (!a.asset_code) {
      errors.push({ row: a._row, msg: 'Missing Asset Code (required)', field: 'asset_code' })
    } else {
      if (seen.has(a.asset_code)) errors.push({ row: a._row, msg: `Duplicate code "${a.asset_code}" in file`, field: 'asset_code' })
      seen.set(a.asset_code, a._row)
    }
    if (a.status && !VALID_STATUSES.some(s => s.toLowerCase() === String(a.status).toLowerCase()))
      warnings.push({ row: a._row, msg: `Unknown status "${a.status}"`, field: 'status' })
    if (a.depreciation_method && !VALID_DEPR.includes(a.depreciation_method))
      warnings.push({ row: a._row, msg: `Unknown depreciation method "${a.depreciation_method}"`, field: 'depreciation_method' })
  })
  return { errors, warnings }
}

// A ghost row has every mapped field empty/null/whitespace
function isGhostRow(asset) {
  const { _row, ...fields } = asset
  if (Object.keys(fields).length === 0) return true
  return Object.values(fields).every(v =>
    v === null || v === undefined || v === '' || (typeof v === 'string' && v.trim() === '')
  )
}

function extractRawData(wb, sheetName) {
  const ws = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })
  if (!raw.length) return { raw: [], excelCols: [], initialMapping: {} }

  const excelCols = Object.keys(raw[0])
  const initialMapping = {}
  excelCols.forEach(col => {
    const db = COL_MAP[col.trim().toLowerCase()]
    if (db && !initialMapping[db]) initialMapping[db] = col
  })
  return { raw, excelCols, initialMapping }
}

function applyMapping(rawRows, excelCols, userMapping) {
  const allRows = rawRows.map((row, i) => {
    const asset = {}
    Object.entries(userMapping).forEach(([db, excelCol]) => {
      if (!excelCol) return
      const v = row[excelCol]
      if (DATE_FIELDS.has(db))         asset[db] = parseDate(v)
      else if (NUMERIC_FIELDS.has(db)) asset[db] = parseNumber(v)
      else asset[db] = v !== '' && v !== undefined ? String(v).trim() : null
    })
    asset._row = i + 2
    return asset
  })

  const rows = allRows.filter(r => !isGhostRow(r))
  const ghostCount = allRows.length - rows.length

  const recognized = Object.keys(userMapping).filter(k => userMapping[k]).map(db => ({ db, excel: userMapping[db] }))
  const mappedExcelCols = Object.values(userMapping).filter(Boolean)
  const unrecognized = excelCols.filter(c => !mappedExcelCols.includes(c))

  return { rows, recognized, unrecognized, ghostCount }
}

// ── Inline cell editor ───────────────────────────────────────────────────────
function CellInput({ field, value, onChange, hasError, hasWarning }) {
  const base = {
    width: '100%', minWidth: 80, background: hasError ? 'rgba(239,68,68,0.08)' : hasWarning ? 'rgba(245,158,11,0.08)' : 'transparent', border: 'none',
    borderBottom: `1.5px solid ${hasError ? 'var(--red)' : hasWarning ? '#f59e0b' : 'transparent'}`, padding: '3px 4px',
    fontFamily: 'DM Sans, sans-serif', fontSize: '0.79rem', color: 'var(--text-0)',
    outline: 'none', borderRadius: '3px 3px 0 0', transition: 'all 0.12s',
  }
  const focusStyle = { background: 'var(--bg-1)', borderBottomColor: hasError ? 'var(--red)' : hasWarning ? '#f59e0b' : 'var(--accent)' }

  const [focused, setFocused] = useState(false)
  const style = { ...base, ...(focused ? focusStyle : {}) }
  const handlers = {
    onFocus: () => setFocused(true),
    onBlur:  () => setFocused(false),
  }

  if (field === 'status') return (
    <select value={value || ''} onChange={e => onChange(e.target.value || null)} style={{ ...style, cursor: 'pointer' }} {...handlers}>
      <option value="">—</option>
      {VALID_STATUSES.map(s => <option key={s}>{s}</option>)}
    </select>
  )
  if (field === 'depreciation_method') return (
    <select value={value || ''} onChange={e => onChange(e.target.value || null)} style={{ ...style, cursor: 'pointer' }} {...handlers}>
      <option value="">—</option>
      {VALID_DEPR.map(s => <option key={s}>{s}</option>)}
    </select>
  )
  if (DATE_FIELDS.has(field)) return (
    <input type="date" value={value || ''} onChange={e => onChange(e.target.value || null)} style={style} {...handlers}/>
  )
  if (NUMERIC_FIELDS.has(field)) return (
    <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value !== '' ? Number(e.target.value) : null)} style={style} {...handlers}/>
  )
  return (
    <input type="text" value={value || ''} onChange={e => onChange(e.target.value || null)} style={style} {...handlers}/>
  )
}

function SiteCellInput({ value, onChange, availableSites, onReloadSites }) {
  const [savingAlias, setSavingAlias] = useState(false)
  const res = resolveSite(value, availableSites)

  async function handleLearnAlias(siteId, rawVal) {
    if (!siteId || !rawVal) return
    setSavingAlias(true)
    try {
      const targetSite = availableSites.find(s => s.id === siteId)
      await addSiteAlias(siteId, rawVal, targetSite?.aliases || [])
      const updated = await fetchSites()
      if (onReloadSites) onReloadSites(updated)
      onChange(targetSite ? targetSite.name : rawVal)
    } catch (e) {
      alert('Failed to save alias: ' + e.message)
    } finally {
      setSavingAlias(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder="Site or Code..."
          style={{ flex: 1, padding: '3px 6px', fontSize: '0.78rem', background: res.matched ? 'rgba(16,185,129,0.06)' : 'var(--bg-1)', border: `1.5px solid ${res.matched ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: 4, color: 'var(--text-0)', outline: 'none' }}
        />
        <select
          value={res.matched ? res.site_id : ''}
          onChange={e => {
            const chosenId = e.target.value
            const chosenSite = availableSites.find(s => s.id === chosenId)
            if (chosenSite) {
              onChange(chosenSite.name)
              if (value && !res.matched && window.confirm(`Save "${value}" as a permanent site alias for ${chosenSite.name}?`)) {
                handleLearnAlias(chosenId, value)
              }
            }
          }}
          style={{ width: 95, padding: '3px 4px', fontSize: '0.72rem', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
        >
          <option value="">Link...</option>
          {availableSites.map(s => (
            <option key={s.id} value={s.id}>
              {s.site_code ? `[${s.site_code}] ` : ''}{s.name}
            </option>
          ))}
        </select>
      </div>

      {value && (
        <div>
          {res.matched ? (
            <span style={{ fontSize: '0.68rem', color: '#059669', background: 'rgba(16,185,129,0.12)', padding: '1px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              {res.site_code && <span style={{ fontFamily: 'DM Mono, monospace' }}>[{res.site_code}]</span>}
              {res.site_name} ({res.matched_by})
            </span>
          ) : (
            <span style={{ fontSize: '0.68rem', color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '1px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              ⚠️ Unresolved Location
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ExcelImport() {
  const { user, can, currentCompany } = useAuth()
  const { status: importStatus, startImport } = useImport()
  const importing = importStatus === 'running'
  const [wb,          setWb]          = useState(null)
  const [fileInfo,    setFileInfo]    = useState(null)
  const [activeSheet, setActiveSheet] = useState('')
  const [colInfo,     setColInfo]     = useState(null)
  const [editRows,    setEditRows]    = useState([])
  const [errors,      setErrors]      = useState([])
  const [warnings,    setWarnings]    = useState([])
  const [ghostCount,  setGhostCount]  = useState(0)
  const [dragging,    setDragging]    = useState(false)
  const [manualMode,  setManualMode]  = useState(false)
  const [isMapping,   setIsMapping]   = useState(false)
  const [checkingSerial, setCheckingSerial] = useState(false)
  const [rawExcel,    setRawExcel]    = useState([])
  const [excelCols,   setExcelCols]   = useState([])
  const [userMapping, setUserMapping] = useState({})
  const [availableSites, setAvailableSites] = useState([])
  const fileRef = useRef()
  let newRowCounter = useRef(0)

  React.useEffect(() => {
    fetchSites().then(s => setAvailableSites(s || [])).catch(console.error)
  }, [])

  if (!can('import')) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <AlertCircle size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px', display: 'block' }}/>
      <p style={{ color: 'var(--text-2)', fontFamily: 'DM Sans' }}>You don't have permission to import assets.</p>
    </div>
  )

  function applyRows(rows) {
    setEditRows(rows)
    const v = validateRows(rows)
    setErrors(v.errors)
    setWarnings(v.warnings)
  }

  function handleFile(f) {
    if (!f) return
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary', cellDates: true })
        setWb(workbook)
        setFileInfo({ name: f.name, size: f.size, sheets: workbook.SheetNames })
        const first = workbook.SheetNames[0]
        setActiveSheet(first)
        
        const { raw, excelCols, initialMapping } = extractRawData(workbook, first)
        setRawExcel(raw)
        setExcelCols(excelCols)
        setUserMapping(initialMapping)
        setIsMapping(true)
      } catch (err) {
        setColInfo({ recognized: [], unrecognized: [] })
        setErrors([{ row: null, msg: 'Could not read file: ' + err.message }])
        setWarnings([])
        setEditRows([])
      }
    }
    reader.readAsBinaryString(f)
  }

  function switchSheet(name) {
    setActiveSheet(name)
    if (wb) {
      const { raw, excelCols, initialMapping } = extractRawData(wb, name)
      setRawExcel(raw)
      setExcelCols(excelCols)
      setUserMapping(initialMapping)
      setIsMapping(true)
    }
  }

  function clearFile() {
    setWb(null); setFileInfo(null); setColInfo(null)
    setEditRows([]); setErrors([]); setWarnings([])
    setActiveSheet(''); setGhostCount(0); setManualMode(false)
    setIsMapping(false); setRawExcel([]); setExcelCols([]); setUserMapping({})
    if (fileRef.current) fileRef.current.value = ''
  }

  function confirmMapping() {
    const { rows, recognized, unrecognized, ghostCount } = applyMapping(rawExcel, excelCols, userMapping)
    setColInfo({ recognized, unrecognized })
    setGhostCount(ghostCount)
    applyRows(rows)
    setIsMapping(false)
  }

  function updateCell(rowIndex, field, value) {
    const next = editRows.map((r, i) => i === rowIndex ? { ...r, [field]: value } : r)
    applyRows(next)
  }

  function deleteRow(rowIndex) {
    applyRows(editRows.filter((_, i) => i !== rowIndex))
  }

  function addRow() {
    newRowCounter.current += 1
    const newRow = { _row: `new_${newRowCounter.current}` }
    applyRows([...editRows, newRow])
  }

  const [generating, setGenerating] = useState(false)

  async function autoGenerateCodes() {
    const missing = editRows.filter(r => !r.asset_code && r.asset_name && r.category)
    if (!missing.length) return alert('All rows either have codes already, or are missing Asset Name / Category needed to generate.')
    setGenerating(true)
    try {
      const updated = [...editRows]
      
      // 1. Group missing rows by their computed prefix
      const prefixGroups = {}
      for (const row of missing) {
        const rowCompanyCode = row.company_code || currentCompany?.code || 'SBC'
        const prefix = getAssetCodePrefix(row.asset_name, row.category, rowCompanyCode)
        if (!prefix) continue
        if (!prefixGroups[prefix]) prefixGroups[prefix] = []
        prefixGroups[prefix].push(row)
      }

      // 2. Query the DB for the count of each unique prefix concurrently
      const prefixCounts = {}
      const queries = Object.keys(prefixGroups).map(async (prefix) => {
        const { count } = await supabase
          .from('assets')
          .select('id', { count: 'exact', head: true })
          .ilike('asset_code', `${prefix}%`)
        prefixCounts[prefix] = count || 0
      })
      await Promise.all(queries)

      // 3. Assign sequential codes in memory
      for (const [prefix, rows] of Object.entries(prefixGroups)) {
        let currentCount = prefixCounts[prefix] + 1
        for (const row of rows) {
          const idx = updated.findIndex(r => r._row === row._row)
          if (idx === -1) continue
          const finalCode = `${prefix}${String(currentCount).padStart(3, '0')}`
          updated[idx] = { ...updated[idx], asset_code: finalCode, company_code: row.company_code || currentCompany?.code || 'SBC' }
          currentCount++
        }
      }

      applyRows(updated)
    } catch (e) { alert('Code generation failed: ' + e.message) }
    finally { setGenerating(false) }
  }

  async function handleImport() {
    if (errors.length || !editRows.length) return
    let rows = editRows
      .filter(a => a.asset_code)
      .map(({ _row, ...asset }) => ({ ...asset, added_by: user?.id || null, company_code: currentCompany?.code || 'SBC' }))
    
    if (rows.length === 0) {
      alert('No valid rows to import. Ensure every row has an Asset Code.')
      return
    }

    try {
      setCheckingSerial(true)
      const cc = currentCompany?.code || 'SBC'
      // 1. Extract non-empty serial numbers
      const serials = [...new Set(rows.map(r => r.serial_no).filter(s => s !== null && s !== undefined && String(s).trim() !== ''))]

      let existingAssetsMap = Object.create(null)
      let updatedCount = 0

      if (serials.length > 0) {
        // 2. Query existing assets with those serial numbers in chunks of 200
        const CHUNK = 200
        for (let i = 0; i < serials.length; i += CHUNK) {
          const batch = serials.slice(i, i + CHUNK)
          const { data, error } = await supabase
            .from('assets')
            .select('id, asset_code, serial_no')
            .eq('company_code', cc)
            .in('serial_no', batch)
          
          if (!error && data) {
            data.forEach(a => {
              existingAssetsMap[a.serial_no] = a
            })
          }
        }

        // 3. Map incoming rows to existing assets
        rows = rows.map(row => {
          if (row.serial_no && existingAssetsMap[row.serial_no]) {
            updatedCount++
            return {
              ...row,
              id: existingAssetsMap[row.serial_no].id,
              asset_code: existingAssetsMap[row.serial_no].asset_code
            }
          }
          return row
        })
      }

      if (updatedCount > 0) {
        alert(`Found ${updatedCount} assets with existing serial numbers. They will be updated instead of duplicated.`)
      }

      // 4. Deduplicate by asset_code to prevent Postgres "cannot affect row a second time" error
      const finalRowsMap = new Map()
      rows.forEach(r => finalRowsMap.set(r.asset_code, r))
      rows = Array.from(finalRowsMap.values())

      startImport(rows)
      clearFile()
    } catch (e) {
      alert('Error checking serial numbers: ' + e.message)
    } finally {
      setCheckingSerial(false)
    }
  }

  function downloadTemplate() {
    const s1 = ['SBC/P&M/TWC/001','MOBILE TOWER CRANE','POTAIN','EC/26/16/2','PO-2024-001','SN-12345','10T','Active','Plant & Machinery','Project Site A','Operations','TWC','2024-01-15',250000,25000,10,'Straight Line',10,'2026-01-15','Sample asset']
    const s2 = ['SBC/VEH/PC/001','PICKUP TRUCK','TOYOTA','HILUX','PO-2024-002','SN-67890','1T','Active','Vehicles','Head Office','Logistics','VEH','2023-06-01',85000,8500,5,'Reducing Balance',20,'2025-06-01','Company vehicle']
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, s1, s2])
    ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, ws, 'Assets')
    XLSX.writeFile(book, 'strongbuilt-import-template.xlsx')
  }

  // ── Add Column ─────────────────────────────────────────────────────────────
  const [showAddCol, setShowAddCol] = useState(false)
  const [extraCols, setExtraCols] = useState([])

  const availableCols = Object.entries(DB_LABELS).filter(([k]) =>
    !(colInfo?.recognized || []).some(c => c.db === k) && !extraCols.includes(k)
  )

  function addColumn(dbField) {
    setExtraCols(prev => [...prev, dbField])
    setShowAddCol(false)
  }

  function removeColumn(dbField) {
    setExtraCols(prev => prev.filter(c => c !== dbField))
    // Clear data in that column
    const next = editRows.map(r => { const n = { ...r }; delete n[dbField]; return n })
    applyRows(next)
  }

  const hasFile    = !!fileInfo || manualMode
  const totalRows  = editRows.length
  const readyCount = editRows.filter(r => r.asset_code).length
  const errCount   = errors.length
  const warnCount  = warnings.length
  const canImport  = hasFile && errCount === 0 && readyCount > 0 && !importing && !checkingSerial
  const cols       = colInfo?.recognized || []
  const allCols    = [...cols, ...extraCols.map(db => ({ excel: DB_LABELS[db], db }))]

  return (
    <div style={{ width: '100%' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-2), var(--bg-3))',
        border: '1px solid var(--border)', borderRadius: 16,
        padding: '18px 24px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/assets" style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', textDecoration: 'none', flexShrink: 0 }}>
            <ArrowLeft size={16}/>
          </Link>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileSpreadsheet size={22} style={{ color: '#34d399' }}/>
          </div>
          <div>
            <h1 style={{ fontFamily: 'Oswald', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-0)', letterSpacing: '0.06em', margin: 0, lineHeight: 1.1 }}>
              IMPORT <span style={{ color: '#34d399' }}>EXCEL</span>
            </h1>
            <p style={{ color: 'var(--text-3)', fontSize: '0.75rem', fontFamily: 'DM Sans', margin: 0, marginTop: 3 }}>
              Upload, edit inline, then import — existing asset codes are updated automatically
            </p>
          </div>
        </div>
        <button onClick={downloadTemplate} className="btn-ghost" style={{ gap: 7, fontSize: '0.82rem' }}>
          <Download size={14}/> Download Template
        </button>
      </div>

      {/* ── Upload zone ── */}
      {!hasFile ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => fileRef.current?.click()}
          style={{
            borderRadius: 14, border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            padding: '64px 24px', textAlign: 'center', cursor: 'pointer',
            background: dragging ? 'var(--accent-glow)' : 'var(--bg-2)',
            transition: 'all 0.2s', marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }} style={{ display: 'none' }}/>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: dragging ? 'var(--accent-glow)' : 'var(--bg-3)', border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FileSpreadsheet size={28} style={{ color: dragging ? 'var(--accent)' : 'var(--text-3)' }}/>
          </div>
          <p style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: '1rem', color: 'var(--text-1)', marginBottom: 6 }}>
            {dragging ? 'Drop to upload' : 'Drop your Excel file here'}
          </p>
          <p style={{ fontFamily: 'DM Sans', fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: 16 }}>
            or click to browse — .xlsx and .xls supported
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 9, background: 'var(--accent)', color: 'white', fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.85rem' }}>
              <Upload size={14}/> Choose File
            </span>
            <button onClick={(e) => {
              e.stopPropagation()
              setManualMode(true)
              setColInfo({ recognized: [], unrecognized: [] })
            }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 9, background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-1)', fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              <PlusCircle size={14}/> Start from Scratch
            </button>
          </div>
        </div>
      ) : (
        /* File info strip */
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileSpreadsheet size={16} style={{ color: '#34d399' }}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-0)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileInfo ? fileInfo.name : 'Manual Entry Mode'}
            </p>
            <p style={{ fontFamily: 'DM Mono', fontSize: '0.67rem', color: 'var(--text-3)', margin: 0, marginTop: 2 }}>
              {fileInfo ? `${fmt(fileInfo.size)} · ${fileInfo.sheets.length} sheet${fileInfo.sheets.length > 1 ? 's' : ''} · ` : ''}{totalRows} row{totalRows !== 1 ? 's' : ''}
            </p>
          </div>
          {fileInfo?.sheets?.length > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {fileInfo.sheets.map(s => (
                <button key={s} onClick={() => switchSheet(s)} style={{
                  padding: '4px 10px', borderRadius: 7, border: '1px solid', cursor: 'pointer',
                  fontSize: '0.72rem', fontFamily: 'DM Sans', fontWeight: 600,
                  background: activeSheet === s ? 'var(--accent)' : 'var(--bg-3)',
                  color: activeSheet === s ? 'white' : 'var(--text-2)',
                  borderColor: activeSheet === s ? 'var(--accent)' : 'var(--border)',
                }}>
                  <Layers size={10} style={{ marginRight: 4 }}/>{s}
                </button>
              ))}
            </div>
          )}
          <button onClick={clearFile} className="btn-ghost" style={{ padding: '6px 10px', gap: 5, fontSize: '0.75rem', flexShrink: 0 }}>
            <RefreshCw size={12}/> Change
          </button>
        </div>
      )}

      {/* ── Ghost row alert ── */}
      {!isMapping && ghostCount > 0 && (
        <div style={{
          marginBottom: 14, padding: '12px 16px', borderRadius: 12,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <AlertTriangle size={17} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }}/>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.85rem', color: '#f59e0b', margin: 0, marginBottom: 3 }}>
              {ghostCount} ghost row{ghostCount > 1 ? 's' : ''} detected &amp; removed
            </p>
            <p style={{ fontFamily: 'DM Sans', fontSize: '0.75rem', color: 'var(--text-2)', margin: 0 }}>
              Ghost rows are completely empty rows Excel silently adds — often caused by accidental formatting below your data, extra line breaks, or copy-paste artifacts. They have been automatically excluded from the import.
            </p>
          </div>
          <button onClick={() => setGhostCount(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, flexShrink: 0 }}>
            <X size={14}/>
          </button>
        </div>
      )}

      {/* ── Mapping UI ── */}
      {isMapping && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Oswald', color: 'var(--accent)', fontSize: '1.2rem', marginBottom: 20, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Asset Import
          </h2>
          
          <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 32px' }}>
            {Object.entries(DB_LABELS).map(([db, label]) => (
              <div key={db} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <label style={{ flex: '0 0 145px', fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-0)', textAlign: 'left' }}>
                  {label}:
                </label>
                <select 
                  value={userMapping[db] || ''}
                  onChange={e => setUserMapping(prev => ({ ...prev, [db]: e.target.value }))}
                  style={{ flex: 1, minWidth: 0, minHeight: 38, padding: '6px 12px', fontSize: '0.82rem', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', outline: 'none', textOverflow: 'ellipsis' }}
                >
                  <option value="">Select</option>
                  {excelCols.map((col, i) => (
                    <option key={i} value={col}>{col} (Col {i+1})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button onClick={clearFile} className="btn-ghost" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>Cancel</button>
            <button onClick={confirmMapping} className="btn-primary" style={{ padding: '10px 24px', fontSize: '0.85rem', fontWeight: 700 }}>Apply Mapping</button>
          </div>
        </div>
      )}

      {/* ── Validation stats + errors ── */}
      {!isMapping && colInfo && (
        <div style={{ marginBottom: 14 }}>
          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'Total',    val: totalRows,  color: 'var(--text-2)' },
              { label: 'Ready',    val: readyCount, color: '#34d399' },
              { label: 'Errors',   val: errCount,   color: errCount  > 0 ? 'var(--red)' : 'var(--text-3)' },
              { label: 'Warnings', val: warnCount,  color: warnCount > 0 ? '#f59e0b'   : 'var(--text-3)' },
              { label: 'Mapped',   val: `${cols.length}/${cols.length + (colInfo.unrecognized?.length || 0)}`, color: 'var(--accent)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Oswald', fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontFamily: 'DM Sans', fontSize: '0.58rem', color: 'var(--text-3)', marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Errors/warnings list */}
          {(errCount > 0 || warnCount > 0) && (
            <div style={{ background: 'var(--bg-2)', border: `1px solid ${errCount > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 10, padding: '10px 14px', maxHeight: 120, overflowY: 'auto', marginBottom: 10 }}>
              {[...errors.map(e => ({ ...e, type: 'error' })), ...warnings.map(w => ({ ...w, type: 'warning' }))].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3, alignItems: 'flex-start' }}>
                  {item.type === 'error'
                    ? <XCircle size={10} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }}/>
                    : <AlertTriangle size={10} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }}/>}
                  <span style={{ fontFamily: 'DM Sans', fontSize: '0.7rem', color: item.type === 'error' ? 'var(--red)' : '#f59e0b', lineHeight: 1.4 }}>
                    {item.row ? `Row ${item.row}: ` : ''}{item.msg}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Auto-generate codes for rows missing asset_code */}
          {editRows.some(r => !r.asset_code) && (
            <button onClick={autoGenerateCodes} disabled={generating}
              className="btn-primary" style={{ fontSize: '0.82rem', padding: '10px 20px', gap: 8, width: '100%', justifyContent: 'center' }}>
              {generating
                ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/> Generating codes…</>
                : <><FileSpreadsheet size={15}/> Auto-Generate Asset Codes (SBC/Category/Name/001)</>
              }
            </button>
          )}
        </div>
      )}

      {/* ── Editable data table ── */}
      {!isMapping && colInfo && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 16, position: 'relative' }}>

          {/* Table toolbar */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Table2 size={13} style={{ color: 'var(--accent)' }}/>
              <span style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.06em', color: 'var(--text-0)' }}>
                EDIT & IMPORT DATA
              </span>
              <span style={{ fontSize: '0.68rem', fontFamily: 'DM Sans', color: 'var(--text-3)' }}>
                {totalRows} row{totalRows !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <button onClick={() => { if (confirm('Are you sure you want to clear all data?')) { setEditRows([]); setErrors([]); setWarnings([]) } }} className="btn-ghost" style={{ fontSize: '0.75rem', color: 'var(--red)', padding: '5px 10px' }}>
                <Trash2 size={12}/> Clear Data
              </button>
              
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowAddCol(!showAddCol)} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '5px 10px' }}>
                  <PlusCircle size={12}/> Add Column
                </button>
                {showAddCol && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 8, zIndex: 100, width: 220, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 300, overflowY: 'auto' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-2)', fontFamily: 'DM Sans', textTransform: 'uppercase', padding: '0 8px' }}>Available Columns</p>
                    {availableCols.length === 0 ? (
                      <p style={{ margin: 0, padding: '8px', fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>All mapped.</p>
                    ) : (
                      availableCols.map(([k, label]) => (
                        <button key={k} onClick={() => addColumn(k)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.75rem', color: 'var(--text-1)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-3)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          + {label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button onClick={addRow} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '5px 10px', background: 'var(--bg-3)' }}>
                <PlusCircle size={12}/> Add Row
              </button>
            </div>
          </div>

          {/* Scrollable table */}
          <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
            {editRows.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-3)', fontFamily: 'DM Sans', fontSize: '0.82rem' }}>
                  No rows yet. Upload a file or click <strong>+ Row</strong> to start manually.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: 'var(--bg-3)' }}>
                    <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: '0.65rem', fontFamily: 'DM Sans', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center', width: 36, position: 'sticky', left: 0, background: 'var(--bg-3)' }}>#</th>
                    {allCols.length === 0 && (
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: '0.65rem', fontFamily: 'DM Sans', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                        Asset Code *
                      </th>
                    )}
                    {allCols.map(({ db }) => (
                      <th key={db} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontSize: '0.63rem', fontFamily: 'DM Sans', fontWeight: 700, color: db === 'asset_code' ? 'var(--accent-light)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {DB_LABELS[db]}{db === 'asset_code' ? ' *' : ''}
                          {extraCols.includes(db) && (
                            <button onClick={() => removeColumn(db)} title="Remove column" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 1, display: 'flex', lineHeight: 1 }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                              <X size={10}/>
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editRows.map((row, rowIdx) => {
                    const rowErrors = errors.filter(e => e.row === row._row)
                    const rowWarns = warnings.filter(w => w.row === row._row)
                    const rowErr = rowErrors.length > 0
                    const rowWarn = rowWarns.length > 0 && !rowErr
                    return (
                      <tr key={row._row} style={{ background: rowErr ? 'rgba(239,68,68,0.05)' : rowWarn ? 'rgba(245,158,11,0.03)' : 'transparent', transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (!rowErr && !rowWarn) e.currentTarget.style.background = 'var(--bg-1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = rowErr ? 'rgba(239,68,68,0.05)' : rowWarn ? 'rgba(245,158,11,0.03)' : 'transparent' }}
                      >
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'center', position: 'sticky', left: 0, background: rowErr ? 'rgba(239,68,68,0.08)' : rowWarn ? 'rgba(245,158,11,0.06)' : 'var(--bg-2)', zIndex: 1 }}>
                          {rowErr
                            ? <XCircle size={11} style={{ color: 'var(--red)' }}/>
                            : rowWarn
                              ? <AlertTriangle size={11} style={{ color: '#f59e0b' }}/>
                              : <span style={{ fontFamily: 'DM Mono', fontSize: '0.63rem', color: 'var(--text-3)' }}>{typeof row._row === 'string' ? '✦' : row._row}</span>}
                        </td>
                        {allCols.length === 0 && (
                          <td style={{ padding: '2px 6px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                            <CellInput field="asset_code" value={row.asset_code} onChange={v => updateCell(rowIdx, 'asset_code', v)}
                              hasError={rowErrors.some(e => e.field === 'asset_code')}
                              hasWarning={rowWarns.some(w => w.field === 'asset_code')} />
                          </td>
                        )}
                        {allCols.map(({ db }) => (
                          <td key={db} style={{ padding: '2px 6px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', minWidth: db === 'notes' ? 160 : db === 'asset_name' ? 140 : db === 'site' ? 180 : 90 }}>
                            {db === 'site' ? (
                              <SiteCellInput
                                value={row[db]}
                                onChange={v => updateCell(rowIdx, db, v)}
                                availableSites={availableSites}
                                onReloadSites={s => setAvailableSites(s)}
                              />
                            ) : (
                              <CellInput field={db} value={row[db]} onChange={v => updateCell(rowIdx, db, v)}
                                hasError={rowErrors.some(e => e.field === db)}
                                hasWarning={rowWarns.some(w => w.field === db)} />
                            )}
                          </td>
                        ))}
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                          <button onClick={() => deleteRow(rowIdx)} title="Delete row" style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)',
                            padding: 4, borderRadius: 5, display: 'flex', alignItems: 'center', opacity: 0.5, transition: 'opacity 0.15s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                            <Trash2 size={12}/>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table footer */}
          <div style={{ padding: '10px 16px', background: 'var(--bg-3)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontFamily: 'DM Sans', flex: 1 }}>
              {readyCount} ready
              {errCount > 0 && <span style={{ color: 'var(--red)', marginLeft: 6 }}>· {errCount} error{errCount > 1 ? 's' : ''}</span>}
              {warnCount > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· {warnCount} warning{warnCount > 1 ? 's' : ''}</span>}
            </span>
          </div>
        </div>
      )}

      {/* ── Import button ── */}
      {!isMapping && colInfo && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
          {errCount > 0 && (
            <span style={{ fontSize: '0.75rem', fontFamily: 'DM Sans', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <XCircle size={13}/> Fix {errCount} error{errCount > 1 ? 's' : ''} before importing
            </span>
          )}
          <button onClick={handleImport} disabled={!canImport} className="btn-primary"
            style={{ padding: '11px 28px', gap: 8, opacity: canImport ? 1 : 0.4, cursor: canImport ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
            {checkingSerial ? (
              <><Loader2 size={15} className="animate-spin" /> Checking Serials...</>
            ) : (
              <><Upload size={15}/> Import {readyCount} Asset{readyCount !== 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
