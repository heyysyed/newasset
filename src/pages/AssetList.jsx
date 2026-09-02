import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import {
  Search, Filter, PlusCircle, Trash2, Edit2, Eye, Download, RefreshCw, Tag,
  ChevronUp, ChevronDown, Loader2, ChevronLeft, ChevronRight, Copy, ArrowRight,
  X, MapPin, Package, IndianRupee, Activity, Check, ArrowRightLeft,
  FileSpreadsheet, FileText, ChevronDown as ChevronDownIcon, Layers,
  Clock, Ticket, BarChart3, Columns, Save, AlertTriangle
} from 'lucide-react'
import { supabase, fetchAssetsPaginated, bulkDeleteAssets, bulkUpdateAssets, fetchFilterOptions, createAsset, generateAssetCode, transferAsset, bulkCreateMaintenanceTickets, getAssetSelectCols } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calculateBookValue, formatCurrency } from '../lib/depreciation'
import AssetTransferTab from '../components/assets/AssetTransferTab'
import AssetMap from '../components/AssetMap'
import AssetHistoryDrawer from '../components/AssetHistoryDrawer'
import AssetFilters from '../components/assets/AssetFilters'
import AssetTable from '../components/assets/AssetTable'
import AssetRegisterModals from '../components/assets/AssetRegisterModals'
import companyLogo from '../assets/logo.png'
import { useIsMobile } from '../hooks/useBreakpoint'
import MobileAssetList from '../components/mobile/MobileAssetList'
import { generateAssetDossierPDF } from '../lib/exportDossier'
import { buildAsset360 } from '../lib/intelligence/assetIntelligence'
import AgeIntelligenceView from '../components/assets/AgeIntelligenceView'

export const STATUS_BADGE = {
  Active: 'badge-active', Inactive: 'badge-inactive',
  'Under Repair': 'badge-repair', Disposed: 'badge-disposed', 'On Hire': 'badge-onhire'
}
const STATUSES = ['Active', 'Inactive', 'Under Repair', 'Disposed', 'On Hire']


export default function AssetList() {
  const { user, can, isAdmin, isMod, visibleFields, currentCompany } = useAuth()
  const cc = currentCompany?.code
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(() => {
    try { return parseInt(localStorage.getItem('assetpro_page_size')) || 50 } catch { return 50 }
  })
  const [selected, setSelected] = useState(new Set())
  const [sortCol, setSortCol] = useState('added_on')
  const [sortDir, setSortDir] = useState('desc')
  const [deleting, setDeleting] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [localSearch, setLocalSearch] = useState(() => {
    const fromUrl = params.get('search')
    if (fromUrl) return fromUrl
    try { return JSON.parse(sessionStorage.getItem('assetListFilters') || '{}').search || '' } catch { return '' }
  })

  const [groupingOption, setGroupingOption] = useState('')
  const [showGroupOptions, setShowGroupOptions] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(new Set())


  // Bulk modals
  const [showBulkStatus, setShowBulkStatus] = useState(false)
  const [bulkStatusVal, setBulkStatusVal] = useState('')
  const [showBulkTransfer, setShowBulkTransfer] = useState(false)
  const [bulkTransferSite, setBulkTransferSite] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  // Assign Group Modal
  const [showAssignGroup, setShowAssignGroup] = useState(false)
  const [assignGroupAssets, setAssignGroupAssets] = useState([])
  const [assignGroupTab, setAssignGroupTab] = useState('existing') // 'existing' | 'new'
  const [assignGroupSearch, setAssignGroupSearch] = useState('')
  const [assignGroupSelected, setAssignGroupSelected] = useState('')
  const [assignGroupNewName, setAssignGroupNewName] = useState('')
  const [assignGroupLoading, setAssignGroupLoading] = useState(false)

  // Clone modal
  const [cloneAsset, setCloneAsset] = useState(null)
  const [cloneLoading, setCloneLoading] = useState(false)

  // Inline edit
  const [inlineEdit, setInlineEdit] = useState(null) // { id, field, value }

  // View mode: register or transfers
  const [viewMode, setViewMode] = useState('register') // 'register' | 'transfers' | 'map' | 'depreciation'

  // History Drawer
  const [showHistoryAsset, setShowHistoryAsset] = useState(null)

  // Customizable Columns
  const [visibleCols, setVisibleCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assetpro_visible_cols')) || ['asset_code', 'asset_name', 'make', 'model_no', 'category', 'site', 'condition', 'purchase_value', 'status'] } catch { return ['asset_code', 'asset_name', 'make', 'model_no', 'category', 'site', 'condition', 'purchase_value', 'status'] }
  })
  const [showColDropdown, setShowColDropdown] = useState(false)

  // Saved Views
  const [savedViews, setSavedViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem('assetpro_saved_views')) || [] } catch { return [] }
  })
  
  // Bulk Maintenance Modal
  const [showBulkMaintenance, setShowBulkMaintenance] = useState(false)
  const [bulkMaintenanceForm, setBulkMaintenanceForm] = useState({ title: '', description: '', priority: 'normal', ticket_type: 'preventive' })

  // PDF report modal
  const [showPDFModal, setShowPDFModal] = useState(false)

  // ── Restore saved filters when returning from edit/detail pages ──
  const [filtersReady, setFiltersReady] = useState(false)
  useEffect(() => {
    const hasFilters = params.get('search') || params.get('status') || params.get('category') || params.get('site')
    if (!hasFilters) {
      const saved = sessionStorage.getItem('assetListFilters')
      if (saved) {
        try {
          const f = JSON.parse(saved)
          const n = new URLSearchParams()
          if (f.search) n.set('search', f.search)
          if (f.status) n.set('status', f.status)
          if (f.category) n.set('category', f.category)
          if (f.site) n.set('site', f.site)
          if (n.toString()) { setParams(n, { replace: true }); setFiltersReady(true); return }
        } catch {}
      }
    }
    setFiltersReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const searchQ = params.get('search') || ''
  const statusQ = params.get('status') || ''
  const categoryQ = params.get('category') || ''
  const siteQ = params.get('site') || ''

  // ── Persist filters to sessionStorage ──
  useEffect(() => {
    if (!filtersReady) return
    const filters = {}
    if (searchQ) filters.search = searchQ
    if (statusQ) filters.status = statusQ
    if (categoryQ) filters.category = categoryQ
    if (siteQ) filters.site = siteQ
    sessionStorage.setItem('assetListFilters', JSON.stringify(filters))
  }, [searchQ, statusQ, categoryQ, siteQ, filtersReady])

  const fields = visibleFields().filter(f => !f.readOnly && f.key !== 'notes')

  const queryClient = useQueryClient()

  const { data: filterOptions = { categories: [], sites: [] } } = useQuery({
    queryKey: ['filterOptions', cc],
    queryFn: () => fetchFilterOptions(cc),
    enabled: !!cc,
    staleTime: 10 * 60 * 1000
  })

  const { data: assetsData, isLoading: loadingAssets, isError: isAssetsError, error: assetsError } = useQuery({
    queryKey: ['assets', cc, searchQ, statusQ, categoryQ, siteQ, page, pageSize],
    queryFn: () => fetchAssetsPaginated(
      { search: searchQ, status: statusQ, category: categoryQ, site: siteQ }, 
      page, 
      pageSize, 
      cc,
      getAssetSelectCols(can('view_financials'))
    ),
    enabled: !!cc && filtersReady,
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000
  })

  const assets = assetsData?.data || []
  const totalCount = assetsData?.count || 0
  const loading = loadingAssets || !filtersReady

  const { categories, sites } = filterOptions
  const totalPages = Math.ceil(totalCount / pageSize)

  const uniqueGroupNames = useMemo(() => {
    const names = new Set(assets.map(a => (a.asset_name || '').trim()).filter(Boolean))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [assets])

  function setParam(key, val) {
    const n = new URLSearchParams(params)
    if (val) n.set(key, val); else n.delete(key)
    setParams(n)
    setPage(0)
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const sorted = useMemo(() => [...assets].sort((a, b) => {
    const va = a[sortCol] || '', vb = b[sortCol] || ''
    return (sortDir === 'asc' ? 1 : -1) * String(va).localeCompare(String(vb), undefined, { numeric: true })
  }), [assets, sortCol, sortDir])

  function toggleSelect(id) { setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { setSelected(s => s.size === assets.length ? new Set() : new Set(assets.map(a => a.id))) }

  const groupedAssets = useMemo(() => {
    if (!groupingOption) return null
    const groups = {}
    sorted.forEach(asset => {
      let gKey = asset[groupingOption]
      if (!gKey) gKey = 'Uncategorized'
      
      if (!groups[gKey]) {
        groups[gKey] = {
          key: gKey,
          subgroups: {},
          activeCount: 0,
          pv: 0,
          bv: 0,
          totalAssets: 0
        }
      }
      const g = groups[gKey]
      
      let subKey = asset.asset_name || 'Unnamed Asset'
      if (!g.subgroups[subKey]) {
         g.subgroups[subKey] = {
            key: subKey,
            assets: [],
            activeCount: 0,
            quantitySum: 0,
            pv: 0,
            bv: 0
         }
      }
      const sg = g.subgroups[subKey]
      
      sg.assets.push(asset)
      if (asset.status === 'Active') {
          sg.activeCount++
          g.activeCount++
      }
      
      let qty = 1
      if (asset.quantity && !isNaN(asset.quantity)) {
          qty = Number(asset.quantity)
      } else if (asset.stock && typeof asset.stock === 'string') {
          const match = asset.stock.match(/^(\d+)/)
          if (match) qty = Number(match[1])
      }
      sg.quantitySum += qty
      
      const pVal = Number(asset.purchase_value) || 0
      const bVal = calculateBookValue(asset)
      
      sg.pv += pVal
      sg.bv += bVal
      g.pv += pVal
      g.bv += bVal
      g.totalAssets++
    })
    
    return Object.values(groups).map(g => ({
       ...g,
       subgroupsArray: Object.values(g.subgroups).sort((a,b) => String(a.key).localeCompare(String(b.key)))
    })).sort((a, b) => String(a.key).localeCompare(String(b.key)))
  }, [sorted, groupingOption])

  function toggleGroupExpanded(gKey) {
    setExpandedGroups(prev => {
      const n = new Set(prev)
      if (n.has(gKey)) n.delete(gKey)
      else n.add(gKey)
      return n
    })
  }

  function handleGroupSelectAll(groupAssets) {
    const assetIds = groupAssets.map(a => a.id)
    const allSelected = assetIds.every(id => selected.has(id))
    setSelected(prev => {
      const n = new Set(prev)
      if (allSelected) {
        assetIds.forEach(id => n.delete(id))
      } else {
        assetIds.forEach(id => n.add(id))
      }
      return n
    })
  }

  // ── Actions ───────────────────────────────────────────────────────────

  async function handleDelete(ids) {
    if (!window.confirm(`Permanently delete ${ids.length} asset(s)?`)) return
    setDeleting(true)
    try { await bulkDeleteAssets(ids, user.id); setSelected(new Set()); queryClient.invalidateQueries({ queryKey: ['assets'] }) }
    catch (e) { alert(`Error: ${e.message}`) }
    finally { setDeleting(false) }
  }

  async function handleBulkStatus() {
    if (!bulkStatusVal || !selected.size) return
    setBulkLoading(true)
    try {
      await bulkUpdateAssets([...selected], { status: bulkStatusVal }, user.id)
      setShowBulkStatus(false)
      setBulkStatusVal('')
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      alert(`Successfully updated status for ${selected.size} assets!`)
    } catch (e) { 
      alert(`Error updating status: ${e.message || e}`) 
    } finally { 
      setBulkLoading(false) 
    }
  }

  async function handleBulkTransfer() {
    if (!bulkTransferSite || !selected.size) return
    setBulkLoading(true)
    try {
      const ids = [...selected]
      for (const id of ids) {
        const asset = assets.find(a => a.id === id)
        if (asset && asset.site !== bulkTransferSite) {
          await transferAsset(id, user.id, asset.site || '', bulkTransferSite, 'Bulk transfer')
        }
      }
      setShowBulkTransfer(false)
      setBulkTransferSite('')
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      alert(`Successfully transferred ${selected.size} assets to ${bulkTransferSite}!`)
    } catch (e) { 
      alert(`Error transferring assets: ${e.message || e}`) 
    } finally { 
      setBulkLoading(false) 
    }
  }

  async function handleClone() {
    if (!cloneAsset) return
    setCloneLoading(true)
    try {
      const { id, created_at, updated_at, added_on, added_by, asset_code, ...rest } = cloneAsset
      const newCode = await generateAssetCode(rest.asset_name, rest.category)
      await createAsset({ ...rest, asset_code: newCode }, user.id)
      setCloneAsset(null); queryClient.invalidateQueries({ queryKey: ['assets'] })
    } catch (e) { alert(e.message) }
    finally { setCloneLoading(false) }
  }

  async function handleInlineSave() {
    if (!inlineEdit) return
    try {
      const { error } = await supabase.from('assets').update({ [inlineEdit.field]: inlineEdit.value }).eq('id', inlineEdit.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setInlineEdit(null)
    } catch (e) {
      alert(`Failed to save edit: ${e.message || e}`)
      console.error(e) 
    }
  }

  function handleExportDossier(asset) {
    const intel = buildAsset360(asset, { tickets: [], schedules: [], logs: [] }, { hasFinancialAccess: can('view_financials') })
    generateAssetDossierPDF(asset, intel)
  }

  async function handleAssignGroupSubmit() {
    const finalName = assignGroupTab === 'existing' ? assignGroupSelected : assignGroupNewName
    if (!finalName || !finalName.trim()) {
      alert("Please select or enter a name")
      return
    }
    setAssignGroupLoading(true)
    try {
      const ids = assignGroupAssets.map(a => a.id)
      await bulkUpdateAssets(ids, { asset_name: finalName.trim() }, user.id)
      setShowAssignGroup(false)
      setAssignGroupNewName('')
      setAssignGroupSelected('')
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      alert(`Group assigned successfully!`)
    } catch (e) {
      console.error(e)
      alert(`Failed to assign group: ${e.message || e}`)
    } finally {
      setAssignGroupLoading(false)
    }
  }


  async function exportXLSX() {
    try {
      // Fetch ALL assets matching current filters (no pagination limit)
      let q = supabase.from('assets').select('*').order('added_on', { ascending: false }).or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
      if (statusQ && statusQ !== 'All') q = q.eq('status', statusQ)
      if (categoryQ && categoryQ !== 'All') q = q.eq('category', categoryQ)
      if (siteQ && siteQ !== 'All') q = q.eq('site', siteQ)
      if (searchQ) q = q.or(`asset_code.ilike.%${searchQ}%,asset_name.ilike.%${searchQ}%,make.ilike.%${searchQ}%,site.ilike.%${searchQ}%`)
      if (cc) q = q.eq('company_code', cc)
      const { data: allAssets, error } = await q
      if (error) throw error

      const rows = (allAssets || []).map(a => ({
        'Company Name': a.company_code || 'SWG',
        'Asset Code': a.asset_code || '',
        'Asset Name': a.asset_name || '',
        'Make': a.make || '',
        'Model No': a.model_no || '',
        'Purchase Order No': a.purchase_order_no || '',
        'Serial No': a.serial_no || '',
        'Capacity': a.capacity || '',
        'Status': a.status || '',
        'Category': a.category || '',
        'Site': a.site || '',
        'Department': a.department || '',
        'Type Code': a.type_code || '',
        'Condition': a.condition || '',
        'Purchase Date': a.purchase_date || '',
        'Purchase Value': a.purchase_value || '',
        'Salvage Value': a.salvage_value || '',
        'Useful Life (Yrs)': a.useful_life_years || '',
        'Depr. Method': a.depreciation_method || '',
        'Depr. Rate %': a.depreciation_rate_percent || '',
        'Book Value': calculateBookValue(a),
        'Warranty Expiry': a.warranty_expiry || '',
        'Notes': a.notes || '',
        'Added On': a.added_on || '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Assets')
      XLSX.writeFile(wb, `assets-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) {
      console.error('Export failed:', e)
      alert('Export failed: ' + e.message)
    }
  }



  async function exportPDF(reportType = 'full') {
    const BK = [0, 0, 0]
    const GY = [100, 100, 100]
    const LG = [200, 200, 200]
    const WH = [255, 255, 255]
    const BG = [245, 245, 245]

    const fmtCur = (v) => {
      const n = Number(v); if (!v && v !== 0) return '-'; if (isNaN(n) || n === 0) return '0'
      if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr'
      if (n >= 100000) return (n / 100000).toFixed(2) + ' L'
      return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    }
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
    const pct = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0%'
    const todayShort = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const dateFile = new Date().toISOString().slice(0, 10)

    try {
      let q = supabase.from('assets').select('*').order('site').order('category').order('asset_code').or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%')
      if (statusQ && statusQ !== 'All') q = q.eq('status', statusQ)
      if (categoryQ && categoryQ !== 'All') q = q.eq('category', categoryQ)
      if (siteQ && siteQ !== 'All') q = q.eq('site', siteQ)
      if (searchQ) q = q.or(`asset_code.ilike.%${searchQ}%,asset_name.ilike.%${searchQ}%,make.ilike.%${searchQ}%,site.ilike.%${searchQ}%`)
      if (cc) q = q.eq('company_code', cc)
      const { data: allAssets, error } = await q
      if (error) throw error
      if (!allAssets?.length) { alert('No assets to export.'); return }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()
      const m = 10

      const filterParts = []
      if (siteQ && siteQ !== 'All') filterParts.push('Site: ' + siteQ)
      if (categoryQ && categoryQ !== 'All') filterParts.push('Category: ' + categoryQ)
      if (statusQ && statusQ !== 'All') filterParts.push('Status: ' + statusQ)
      const filterLabel = filterParts.length ? filterParts.join('  |  ') : 'All Sites & Categories'

      const grandPV     = allAssets.reduce((s, a) => s + (Number(a.purchase_value) || 0), 0)
      const grandBV     = allAssets.reduce((s, a) => s + calculateBookValue(a), 0)
      const grandDepr   = grandPV - grandBV
      const grandActive = allAssets.filter(a => a.status === 'Active').length
      const sites       = [...new Set(allAssets.map(a => a.site).filter(Boolean))]
      const cats        = [...new Set(allAssets.map(a => a.category).filter(Boolean))]


      // ── Load logo as grayscale ───────────────────────────
      let logoGray = null
      try {
        logoGray = await new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width; canvas.height = img.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const d = imageData.data
            for (let i = 0; i < d.length; i += 4) {
              const avg = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114
              d[i] = d[i+1] = d[i+2] = avg
            }
            ctx.putImageData(imageData, 0, 0)
            resolve(canvas.toDataURL('image/png'))
          }
          img.onerror = reject
          img.src = companyLogo
        })
      } catch { /* skip */ }

      // ── Page header ─────────────────────────────────────
      function drawPageHeader(title, subtitle) {
        // Top border line
        doc.setDrawColor(...BK)
        doc.setLineWidth(0.8)
        doc.line(m, 2, W - m, 2)

        // Logo (square, original aspect)
        const logoS = 18
        if (logoGray) {
          doc.addImage(logoGray, 'PNG', m + 1, 3, logoS, logoS)
        }
        const tx = logoGray ? m + logoS + 4 : m

        // Company name
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(...BK)
        doc.text('STRONGBUILT CONSTRUCTIONS PVT. LTD.', tx, 10)

        // Tagline
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...GY)
        doc.text('Engineering & Contracting', tx, 15)

        // Report title (right-aligned, large)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...BK)
        doc.text(title, W - m, 10, { align: 'right' })

        // Date (right)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...GY)
        doc.text(todayShort, W - m, 15, { align: 'right' })

        // Bottom border (double line)
        doc.setDrawColor(...BK)
        doc.setLineWidth(0.8)
        doc.line(m, 22, W - m, 22)
        doc.setLineWidth(0.3)
        doc.line(m, 23.2, W - m, 23.2)

        // Subtitle row
        if (subtitle) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7)
          doc.setTextColor(...GY)
          doc.text(subtitle, m, 27)
          doc.text(filterLabel, W - m, 27, { align: 'right' })
        }
      }

      function applyFooters(total) {
        for (let i = 1; i <= total; i++) {
          doc.setPage(i)
          doc.setDrawColor(...BK)
          doc.setLineWidth(0.3)
          doc.line(m, H - 8, W - m, H - 8)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6)
          doc.setTextColor(...GY)
          doc.text('Strongbuilt Constructions Pvt. Ltd.', m, H - 5)
          doc.text('Page ' + i + ' of ' + total, W / 2, H - 5, { align: 'center' })
          doc.text(todayShort, W - m, H - 5, { align: 'right' })
        }
      }

      let currentTitle = '', currentSubtitle = ''
      const tBase = {
        theme: 'grid',
        styles: { font: 'helvetica', cellPadding: 1.8, textColor: BK, lineColor: LG, lineWidth: 0.15, overflow: 'linebreak' },
        headStyles: { fillColor: BK, textColor: WH, fontStyle: 'bold', cellPadding: 2 },
        alternateRowStyles: { fillColor: BG },
        margin: { left: m, right: m, top: 10 },
        didDrawPage() {},
      }

      if (reportType === 'full') {
        drawPageHeader('FULL ASSET REGISTER', allAssets.length + ' assets  |  Active: ' + grandActive + '  |  PV: ' + fmtCur(grandPV) + '  |  BV: ' + fmtCur(grandBV))
        currentTitle = 'FULL ASSET REGISTER'; currentSubtitle = filterLabel
        autoTable(doc, { ...tBase, startY: 30,
          head: [['#', 'Asset Code', 'Asset Name', 'Make / Model', 'Site', 'PV', 'BV', 'Status']],
          body: allAssets.map((a, i) => { const bv2 = calculateBookValue(a), pv2 = Number(a.purchase_value) || 0; return [i + 1, a.asset_code || '-', a.asset_name || '-', [a.make, a.model_no].filter(Boolean).join(' / ') || '-', a.site || '-', fmtCur(pv2), fmtCur(bv2), a.status || '-'] }),
          columnStyles: { 0:{halign:'center',cellWidth:10}, 1:{cellWidth:28,}, 2:{cellWidth:38}, 3:{cellWidth:32}, 4:{cellWidth:28}, 5:{halign:'right',cellWidth:20}, 6:{halign:'right',cellWidth:20,fontStyle:'bold'}, 7:{halign:'center',cellWidth:17,fontStyle:'bold'} },
        })

      } else if (reportType === 'summary') {
        drawPageHeader('ASSET SUMMARY REPORT', 'Total: ' + allAssets.length + '  |  PV: ' + fmtCur(grandPV) + '  |  BV: ' + fmtCur(grandBV) + '  |  Depr: ' + pct(grandDepr, grandPV))
        currentTitle = 'ASSET SUMMARY REPORT'
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...BK); doc.text('SITE-WISE BREAKDOWN', m, 33)
        const bySite = {}; allAssets.forEach(a => { const s = a.site || 'No Site'; if (!bySite[s]) bySite[s] = []; bySite[s].push(a) })
        autoTable(doc, { ...tBase, startY: 35,
          head: [['Site', 'Total', 'Active', 'Inactive', 'Repair', 'Disposed', 'PV', 'BV', 'Depr. %']],
          body: Object.keys(bySite).sort().map(s => { const arr = bySite[s], pv2 = arr.reduce((t, a) => t + (Number(a.purchase_value) || 0), 0), bv2 = arr.reduce((t, a) => t + calculateBookValue(a), 0); return [s, arr.length, arr.filter(a => a.status === 'Active').length, arr.filter(a => a.status === 'Inactive').length, arr.filter(a => a.status === 'Under Repair').length, arr.filter(a => a.status === 'Disposed').length, fmtCur(pv2), fmtCur(bv2), pct(pv2 - bv2, pv2)] }),
          columnStyles: { 0:{fontStyle:'bold',cellWidth:40}, 1:{halign:'center'}, 2:{halign:'center'}, 3:{halign:'center'}, 4:{halign:'center'}, 5:{halign:'center'}, 6:{halign:'right'}, 7:{halign:'right'}, 8:{halign:'center'} },
        })
        const afterSite = doc.lastAutoTable.finalY + 6
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...BK); doc.text('CATEGORY-WISE BREAKDOWN', m, afterSite)
        const byCat = {}; allAssets.forEach(a => { const c = a.category || 'Uncategorized'; if (!byCat[c]) byCat[c] = []; byCat[c].push(a) })
        autoTable(doc, { ...tBase, startY: afterSite + 2,
          head: [['Category', 'Total', 'Active', 'Inactive', 'Repair', 'Disposed', 'PV', 'BV', 'Depr. %', '% Portfolio']],
          body: Object.keys(byCat).sort().map(c => { const arr = byCat[c], pv2 = arr.reduce((t, a) => t + (Number(a.purchase_value) || 0), 0), bv2 = arr.reduce((t, a) => t + calculateBookValue(a), 0); return [c, arr.length, arr.filter(a => a.status === 'Active').length, arr.filter(a => a.status === 'Inactive').length, arr.filter(a => a.status === 'Under Repair').length, arr.filter(a => a.status === 'Disposed').length, fmtCur(pv2), fmtCur(bv2), pct(pv2 - bv2, pv2), pct(arr.length, allAssets.length)] }),
          columnStyles: { 0:{fontStyle:'bold',cellWidth:40}, 1:{halign:'center'}, 2:{halign:'center'}, 3:{halign:'center'}, 4:{halign:'center'}, 5:{halign:'center'}, 6:{halign:'right'}, 7:{halign:'right'}, 8:{halign:'center'}, 9:{halign:'center'} },
        })

      } else if (reportType === 'depreciation') {
        drawPageHeader('DEPRECIATION & VALUATION REPORT', 'PV: ' + fmtCur(grandPV) + '  |  BV: ' + fmtCur(grandBV) + '  |  Depr: ' + fmtCur(grandDepr) + ' (' + pct(grandDepr, grandPV) + ')')
        currentTitle = 'DEPRECIATION & VALUATION REPORT'
        autoTable(doc, { ...tBase, startY: 30,
          head: [['#', 'Asset Code', 'Asset Name', 'Site', 'PV', 'Life', 'Method', 'BV', 'Depr.', '%']],
          body: allAssets.map((a, i) => { const bv2 = calculateBookValue(a), pv2 = Number(a.purchase_value) || 0; return [i + 1, a.asset_code || '-', a.asset_name || '-', a.site || '-', fmtCur(pv2), a.useful_life_years ? a.useful_life_years + 'y' : '-', a.depreciation_method || '-', fmtCur(bv2), fmtCur(pv2 - bv2), pct(pv2 - bv2, pv2)] }),
          columnStyles: { 0:{halign:'center',cellWidth:10}, 1:{cellWidth:26,}, 2:{cellWidth:34}, 3:{cellWidth:24}, 4:{halign:'right',cellWidth:18}, 5:{halign:'center',cellWidth:12}, 6:{halign:'center',cellWidth:24}, 7:{halign:'right',cellWidth:18,fontStyle:'bold'}, 8:{halign:'right',cellWidth:16}, 9:{halign:'center',cellWidth:11} },
        })

      } else if (reportType === 'status') {
        const order = ['Active', 'Inactive', 'Under Repair', 'Disposed', 'On Hire']
        const byStatus = {}; allAssets.forEach(a => { const s = a.status || 'Unknown'; if (!byStatus[s]) byStatus[s] = []; byStatus[s].push(a) })
        drawPageHeader('STATUS-WISE ASSET REPORT', order.filter(s => byStatus[s]).map(s => s + ': ' + byStatus[s].length).join('  |  '))
        currentTitle = 'STATUS-WISE ASSET REPORT'
        const bySite2 = {}; allAssets.forEach(a => { const s = a.site || 'No Site'; if (!bySite2[s]) bySite2[s] = []; bySite2[s].push(a) })
        const usedStatuses = order.filter(s => byStatus[s])
        autoTable(doc, { ...tBase, startY: 30,
          head: [['Site', ...usedStatuses, 'Total', 'PV', 'BV']],
          body: Object.keys(bySite2).sort().map(site => { const arr = bySite2[site], pv2 = arr.reduce((t, a) => t + (Number(a.purchase_value) || 0), 0), bv2 = arr.reduce((t, a) => t + calculateBookValue(a), 0); return [site, ...usedStatuses.map(st => arr.filter(a => a.status === st).length || '-'), arr.length, fmtCur(pv2), fmtCur(bv2)] }),
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
        })
        for (const st of usedStatuses) {
          const rows = byStatus[st]; doc.addPage()
          drawPageHeader(st.toUpperCase() + ' ASSETS (' + rows.length + ')', 'PV: ' + fmtCur(rows.reduce((t, a) => t + (Number(a.purchase_value) || 0), 0)) + '  |  BV: ' + fmtCur(rows.reduce((t, a) => t + calculateBookValue(a), 0)))
          autoTable(doc, { ...tBase, startY: 30,
            head: [['#', 'Asset Code', 'Asset Name', 'Make / Model', 'Site', 'PV', 'BV', 'Cond.']],
            body: rows.map((a, i) => [i + 1, a.asset_code || '-', a.asset_name || '-', [a.make, a.model_no].filter(Boolean).join(' / ') || '-', a.site || '-', fmtCur(Number(a.purchase_value) || 0), fmtCur(calculateBookValue(a)), a.condition || '-']),
            columnStyles: { 0:{halign:'center',cellWidth:10}, 1:{cellWidth:28,}, 2:{cellWidth:38}, 3:{cellWidth:32}, 4:{cellWidth:28}, 5:{halign:'right',cellWidth:20}, 6:{halign:'right',cellWidth:20,fontStyle:'bold'}, 7:{halign:'center',cellWidth:17} },
          })
        }
      }

      applyFooters(doc.internal.getNumberOfPages())
      doc.save('strongbuilt-asset-report-' + reportType + '-' + dateFile + '.pdf')
    } catch (e) {
      console.error('PDF export failed:', e)
      alert('PDF export failed: ' + e.message)
    }
  }
  // ── Derived ───────────────────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    const totalValue = assets.reduce((a, x) => a + (Number(x.purchase_value) || 0), 0)
    const bookValue = assets.reduce((a, x) => a + calculateBookValue(x), 0)
    const activeCount = assets.filter(a => a.status === 'Active').length
    const siteCount = new Set(assets.map(a => a.site).filter(Boolean)).size
    return { totalValue, bookValue, activeCount, siteCount }
  }, [assets])

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: .25, marginLeft: 2 }}>↕</span>
    return sortDir === 'asc' ? <ChevronUp size={11} style={{ display: 'inline', marginLeft: 2 }} /> : <ChevronDown size={11} style={{ display: 'inline', marginLeft: 2 }} />
  }

  const allColumns = [
    { k: 'asset_code', l: 'Asset Code' },
    { k: 'asset_name', l: 'Name' },
    { k: 'make', l: 'Make' },
    { k: 'model_no', l: 'Model' },
    { k: 'category', l: 'Category' },
    { k: 'site', l: 'Site' },
    { k: 'age', l: 'Age' },
    { k: 'health', l: 'Health' },
    { k: 'risk', l: 'Risk' },
    { k: 'condition', l: 'Condition' },
    { k: 'purchase_value', l: 'Book Value' },
    { k: 'status', l: 'Status' },
  ]
  
  const columns = allColumns.filter(col => visibleCols.includes(col.k))

  function toggleColumn(key) {
    setVisibleCols(prev => {
      const n = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      localStorage.setItem('assetpro_visible_cols', JSON.stringify(n))
      return n
    })
  }

  function saveCurrentView() {
    const viewName = prompt("Enter a name for this view:")
    if (!viewName) return
    const newView = { id: Date.now(), name: viewName, filters: { search: searchQ, status: statusQ, category: categoryQ, site: siteQ } }
    setSavedViews(prev => {
      const n = [...prev, newView]
      localStorage.setItem('assetpro_saved_views', JSON.stringify(n))
      return n
    })
  }

  async function handleBulkMaintenance(e) {
    e.preventDefault()
    if (!bulkMaintenanceForm.title) return alert("Title is required")
    setBulkLoading(true)
    try {
      await bulkCreateMaintenanceTickets([...selected], { ...bulkMaintenanceForm, reported_by: user.id })
      setShowBulkMaintenance(false)
      setBulkMaintenanceForm({ title: '', description: '', priority: 'normal', ticket_type: 'preventive' })
      setSelected(new Set())
      alert(`Successfully created ${selected.size} maintenance tickets!`)
    } catch (err) {
      alert("Error creating tickets: " + err.message)
    } finally {
      setBulkLoading(false)
    }
  }

  if (isMobile) {
    return (
      <>
        <MobileAssetList
          assets={assets}
          loading={loading}
          searchQ={searchQ}
          setLocalSearch={setLocalSearch}
          statusQ={statusQ}
          setParam={setParam}
          categoryQ={categoryQ}
          siteQ={siteQ}
          STATUSES={STATUSES}
          categories={filterOptions.categories}
          sites={filterOptions.sites}
          can={can}
          isAdmin={isAdmin}
          handleDelete={handleDelete}
          setShowHistoryAsset={setShowHistoryAsset}
        />
        <AssetRegisterModals
          showHistoryAsset={showHistoryAsset} setShowHistoryAsset={setShowHistoryAsset}
          showBulkMaintenance={showBulkMaintenance} setShowBulkMaintenance={setShowBulkMaintenance} handleBulkMaintenance={handleBulkMaintenance} bulkMaintenanceForm={bulkMaintenanceForm} setBulkMaintenanceForm={setBulkMaintenanceForm} selectedSize={selected.size}
          showPDFModal={showPDFModal} setShowPDFModal={setShowPDFModal} exportPDF={exportPDF} activeFilters={{ site: siteQ, category: categoryQ, status: statusQ }}
          showBulkStatus={showBulkStatus} setShowBulkStatus={setShowBulkStatus} bulkStatusVal={bulkStatusVal} setBulkStatusVal={setBulkStatusVal} STATUSES={STATUSES} handleBulkStatus={handleBulkStatus} bulkLoading={bulkLoading}
          showBulkTransfer={showBulkTransfer} setShowBulkTransfer={setShowBulkTransfer} bulkTransferSite={bulkTransferSite} setBulkTransferSite={setBulkTransferSite} sites={filterOptions.sites} handleBulkTransfer={handleBulkTransfer}
          showAssignGroup={showAssignGroup} setShowAssignGroup={setShowAssignGroup} assignGroupAssets={assignGroupAssets} assignGroupTab={assignGroupTab} setAssignGroupTab={setAssignGroupTab} assignGroupSearch={assignGroupSearch} setAssignGroupSearch={setAssignGroupSearch} uniqueGroupNames={uniqueGroupNames} assignGroupSelected={assignGroupSelected} setAssignGroupSelected={setAssignGroupSelected} assignGroupNewName={assignGroupNewName} setAssignGroupNewName={setAssignGroupNewName} assignGroupLoading={assignGroupLoading} handleAssignGroupSubmit={handleAssignGroupSubmit}
          cloneAsset={cloneAsset} setCloneAsset={setCloneAsset} handleClone={handleClone} cloneLoading={cloneLoading}
        />
      </>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      {/* ── Header (Premium Style) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-[var(--bg-0)] p-4 md:p-6 rounded-2xl border border-[var(--border)] shadow-sm mb-6 gap-4">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[var(--accent-glow)]">
            <Package size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[var(--text-0)] m-0 leading-tight">
              Asset Register
            </h1>
            <p className="text-xs text-[var(--text-3)] tracking-wider m-0 mt-1 font-medium leading-tight">
              {totalCount} assets
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['assets'] })} className="flex items-center justify-center w-10 h-10 md:w-auto md:px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)] transition-colors text-[var(--text-2)] hover:text-[var(--text-0)] shadow-sm">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {selected.size > 0 && isAdmin && (
            <button onClick={() => handleDelete([...selected])} className="flex-1 md:flex-none bg-[var(--red)] text-white font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all" disabled={deleting}>
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleting ? 'Deleting…' : `Delete (${selected.size})`}
            </button>
          )}
          {can('add') && (
            <Link to="/assets/new" className="flex-1 md:flex-none bg-[var(--accent)] text-white font-semibold text-sm px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] active:scale-95 transition-all shadow-sm no-underline">
              <PlusCircle size={16} /> Add Asset
            </Link>
          )}
        </div>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#fff', borderRadius: 8, padding: 4, border: '1px solid var(--border)', width: '100%', overflowX: 'auto' }}>
        {[
          { id: 'register', label: 'Asset Register', icon: Package },
          { id: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
          { id: 'map', label: 'Map View', icon: MapPin }
        ].map(tab => (
          <button key={tab.id} onClick={() => setViewMode(tab.id)}
            style={{ flex: 1, minWidth: 140, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 6,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
              background: viewMode === tab.id ? '#4285f4' : 'transparent',
              color: viewMode === tab.id ? 'white' : 'var(--text-2)' }}>
            <tab.icon size={16} /> <span className="mobile-hide">{tab.label}</span>
          </button>
        ))}
      </div>

      {isAssetsError && (
          <div style={{ padding: '16px 20px', marginBottom: 20, background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={20} />
            <div>
              <p style={{ margin: 0, }}>Failed to load assets</p>
              <p style={{ margin: 0, opacity: 0.9 }}>{assetsError?.message || 'An unexpected error occurred. Please try again later.'}</p>
            </div>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['assets'] })} className="btn-primary" style={{ marginLeft: 'auto', background: 'var(--red)', color: 'white', padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

      {/* Transfers View */}
      {viewMode === 'transfers' && (
        <AssetTransferTab
          assets={assets}
          sites={sites}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['assets'] })}
        />
      )}

      {/* Map View */}
      {viewMode === 'map' && <AssetMap assets={assets} sites={sites} />}

      {/* Depreciation Chart View */}
      {/* Register View */}
      {viewMode === 'register' && <>
      {/* Summary Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { icon: Package, label: 'Showing', val: assets.length, color: 'var(--accent)' },
          { icon: Activity, label: 'Active', val: summaryStats.activeCount, color: 'var(--green)' },
          { icon: MapPin, label: 'Sites', val: summaryStats.siteCount, color: 'var(--cyan)' },
          { icon: IndianRupee, label: 'Total Value', val: formatCurrency(summaryStats.totalValue), color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <s.icon size={16} style={{ color: s.color, flexShrink: 0 }} />
            <div>
              <div style={{ color: 'var(--text-0)' }}>{s.val}</div>
              <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <AgeIntelligenceView companyCode={cc} />

      {/* Search + Filters */}
      <AssetFilters
        searchQ={searchQ} statusQ={statusQ} categoryQ={categoryQ} siteQ={siteQ}
        localSearch={localSearch} setLocalSearch={setLocalSearch} setParam={setParam}
        showFilters={showFilters} setShowFilters={setShowFilters}
        showColDropdown={showColDropdown} setShowColDropdown={setShowColDropdown}
        visibleCols={visibleCols} toggleColumn={toggleColumn} allColumns={allColumns}
        groupingOption={groupingOption} setGroupingOption={setGroupingOption} setExpandedGroups={setExpandedGroups}
        STATUSES={STATUSES} categories={filterOptions.categories} sites={filterOptions.sites}
        savedViews={savedViews} saveCurrentView={saveCurrentView} setParams={setParams}
        pageSize={pageSize} setPageSize={setPageSize} setPage={setPage}
      />

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderRadius: 10, background: 'var(--accent-glow)', border: '1px solid var(--accent)', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--accent-light)' }}>{selected.size} selected</span>
          {can('print_stickers') && <Link to={`/stickers?ids=${[...selected].join(',')}`} className="btn-ghost" style={{ padding: '6px 14px', textDecoration: 'none' }}><Tag size={13} /> Stickers</Link>}
          {(isAdmin || isMod) && <button onClick={() => setShowBulkStatus(true)} className="btn-ghost" style={{ padding: '6px 14px' }}><Activity size={13} /> Change Status</button>}
          {(isAdmin || isMod) && <button onClick={() => setShowBulkTransfer(true)} className="btn-ghost" style={{ padding: '6px 14px' }}><MapPin size={13} /> Transfer</button>}
          {(isAdmin || isMod) && <button onClick={() => setShowBulkMaintenance(true)} className="btn-ghost" style={{ padding: '6px 14px', color: 'var(--amber)', borderColor: 'var(--amber-dim)' }}><Ticket size={13} /> Schedule Maintenance</button>}
          {can('delete') && (
            <button onClick={() => handleDelete([...selected])} className="btn-danger" disabled={deleting} style={{ padding: '6px 14px' }}>
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="btn-ghost" style={{ marginLeft: 'auto', padding: '6px 14px', border: 'none' }}>Clear</button>
        </div>
      )}

      <AssetTable
        assets={assets} loading={loading} selected={selected} toggleSelect={toggleSelect} toggleAll={toggleAll} columns={columns}
        toggleSort={toggleSort} sortCol={sortCol} sortDir={sortDir} sorted={sorted} navigate={navigate} can={can} isAdmin={isAdmin}
        setInlineEdit={setInlineEdit} inlineEdit={inlineEdit} handleInlineSave={handleInlineSave} STATUSES={STATUSES} sites={filterOptions.sites} STATUS_BADGE={STATUS_BADGE}
        calculateBookValue={calculateBookValue} formatCurrency={formatCurrency} setCloneAsset={setCloneAsset} handleDelete={handleDelete} deleting={deleting}
        setShowHistoryAsset={setShowHistoryAsset} groupedAssets={groupedAssets} expandedGroups={expandedGroups} toggleGroupExpanded={toggleGroupExpanded}
        handleGroupSelectAll={handleGroupSelectAll} totalPages={totalPages} page={page} setPage={setPage} totalCount={totalCount}
        pageSize={pageSize} setPageSize={setPageSize}
        setAssignGroupAssets={setAssignGroupAssets} setAssignGroupTab={setAssignGroupTab} setAssignGroupSearch={setAssignGroupSearch}
        setAssignGroupSelected={setAssignGroupSelected} setAssignGroupNewName={setAssignGroupNewName} setShowAssignGroup={setShowAssignGroup}
        handleExportDossier={handleExportDossier}
      />

      {/* ── MODALS & DRAWERS ── */}
      <AssetRegisterModals
        showHistoryAsset={showHistoryAsset} setShowHistoryAsset={setShowHistoryAsset}
        showBulkMaintenance={showBulkMaintenance} setShowBulkMaintenance={setShowBulkMaintenance} handleBulkMaintenance={handleBulkMaintenance} bulkMaintenanceForm={bulkMaintenanceForm} setBulkMaintenanceForm={setBulkMaintenanceForm} selectedSize={selected.size}
        showPDFModal={showPDFModal} setShowPDFModal={setShowPDFModal} exportPDF={exportPDF} activeFilters={{ site: siteQ, category: categoryQ, status: statusQ }}
        showBulkStatus={showBulkStatus} setShowBulkStatus={setShowBulkStatus} bulkStatusVal={bulkStatusVal} setBulkStatusVal={setBulkStatusVal} STATUSES={STATUSES} handleBulkStatus={handleBulkStatus} bulkLoading={bulkLoading}
        showBulkTransfer={showBulkTransfer} setShowBulkTransfer={setShowBulkTransfer} bulkTransferSite={bulkTransferSite} setBulkTransferSite={setBulkTransferSite} sites={filterOptions.sites} handleBulkTransfer={handleBulkTransfer}
        showAssignGroup={showAssignGroup} setShowAssignGroup={setShowAssignGroup} assignGroupAssets={assignGroupAssets} assignGroupTab={assignGroupTab} setAssignGroupTab={setAssignGroupTab} assignGroupSearch={assignGroupSearch} setAssignGroupSearch={setAssignGroupSearch} uniqueGroupNames={uniqueGroupNames} assignGroupSelected={assignGroupSelected} setAssignGroupSelected={setAssignGroupSelected} assignGroupNewName={assignGroupNewName} setAssignGroupNewName={setAssignGroupNewName} assignGroupLoading={assignGroupLoading} handleAssignGroupSubmit={handleAssignGroupSubmit}
        cloneAsset={cloneAsset} setCloneAsset={setCloneAsset} handleClone={handleClone} cloneLoading={cloneLoading}
      />
      </>}
      <style>{`
        @keyframes admin-fade-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  )
}


