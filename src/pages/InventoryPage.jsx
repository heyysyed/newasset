import React, { useEffect, useState, useMemo } from 'react'
import {
  Package, Boxes, ArrowRightLeft, History, Plus, Search,
  Loader2, Download, Hammer, Trash2, Pencil, ArchiveX, RotateCcw,
  Send, FileText, AlertCircle, DollarSign, Layers, Building2,
  ChevronDown, ChevronRight, Filter, RefreshCw, Eye, X, Save
} from 'lucide-react'
import { supabase, fetchGatePasses, fetchSites } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../lib/depreciation'
import { isSiteMatch } from '../lib/siteMatcher'
import * as XLSX from 'xlsx'
import BulkItemForm from '../components/bulk/BulkItemForm'
import BulkTransactionModal from '../components/bulk/BulkTransactionModal'
import GatePassTab from '../components/inventory/GatePassTab'
import IssueSlipTab from '../components/materials/IssueSlipTab'
import { useIsMobile } from '../hooks/useBreakpoint'
import MobileInventoryPage from '../components/mobile/MobileInventoryPage'
import SerializedComponentsTab from '../components/inventory/SerializedComponentsTab'

const TabBtn = ({ active, icon: Icon, label, onClick }) => (
  <button onClick={onClick} className={`tab-btn ${active ? 'active' : ''}`}>
    <Icon size={14} /> {label}
  </button>
)

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

function InventoryPageContent() {
  const { user, isAdmin, isMod, can } = useAuth()
  const canWrite = isAdmin || isMod || (typeof can === 'function' && can('inventory'))
  const isMobile = useIsMobile()

  const [tab, setTab] = useState('stock')
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [stock, setStock] = useState([])
  const [transactions, setTransactions] = useState([])
  const [gatePasses, setGatePasses] = useState([])
  const [assets, setAssets] = useState([])
  const [sites, setSites] = useState([])
  const [search, setSearch] = useState('')

  // View & Filtering
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [siteFilter, setSiteFilter] = useState('All')
  const [stockViewMode, setStockViewMode] = useState('by_site') // 'by_site' | 'by_item'
  const [expandedItems, setExpandedItems] = useState(new Set())

  // Custom Category Management
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('assetpro_custom_inventory_categories')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {}
    return ['Consumables', 'Electrical', 'Hand Machines', 'Materials', 'Safety Equipment', 'Scaffolding', 'Shuttering', 'Tools']
  })
  const [showManageCategories, setShowManageCategories] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [editingCatName, setEditingCatName] = useState(null)
  const [renameInputValue, setRenameInputValue] = useState('')

  const saveCategoriesList = (newList) => {
    const unique = Array.from(new Set(newList.map(c => c.trim()).filter(Boolean))).sort()
    setCustomCategories(unique)
    try {
      localStorage.setItem('assetpro_custom_inventory_categories', JSON.stringify(unique))
    } catch (e) {}
  }

  const handleAddCategory = (name) => {
    if (!name.trim()) return
    saveCategoriesList([...customCategories, name])
    setNewCatInput('')
  }

  const handleRenameCategory = async (oldName, newName) => {
    if (!newName.trim() || oldName === newName) return
    const updatedName = newName.trim()
    try {
      await supabase.from('bulk_items').update({ category: updatedName }).eq('category', oldName)
      const nextList = customCategories.map(c => c === oldName ? updatedName : c)
      saveCategoriesList(nextList)
      if (categoryFilter === oldName) setCategoryFilter(updatedName)
      refreshAll()
    } catch (e) {
      alert('Error updating category: ' + e.message)
    }
  }

  const handleDeleteCategory = (catToDelete) => {
    if (!confirm(`Remove "${catToDelete}" category? Items with this category will remain.`)) return
    const nextList = customCategories.filter(c => c !== catToDelete)
    saveCategoriesList(nextList)
    if (categoryFilter === catToDelete) setCategoryFilter('All')
  }

  const [showEditStockModal, setShowEditStockModal] = useState(false)
  const [editStockRecord, setEditStockRecord] = useState(null)

  const handleSaveStockRecord = async (stockId, updates) => {
    setLoading(true)
    try {
      const { error } = await supabase.from('bulk_site_stock').update(updates).eq('id', stockId)
      if (error) throw error
      setShowEditStockModal(false)
      setEditStockRecord(null)
      refreshAll()
    } catch (e) {
      alert('Error updating stock record: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Modals
  const [showItemForm, setShowItemForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  
  const [showTxModal, setShowTxModal] = useState(false)
  const [txType, setTxType] = useState('transfer') // transfer, deploy, scrap, consume, return

  const [loadedKeys, setLoadedKeys] = useState(new Set())
  const [txDefaultItem, setTxDefaultItem] = useState('')
  const [txDefaultSite, setTxDefaultSite] = useState('')

  const [selectedStock, setSelectedStock] = useState(new Set())
  const [selectedMaster, setSelectedMaster] = useState(new Set())

  useEffect(() => {
    loadDataForTab(tab)
  }, [tab])

  async function loadDataForTab(currentTab, force = false) {
    const toLoad = new Set(['items']) // Always need items/stock
    if (currentTab === 'transactions') toLoad.add('txns')
    if (currentTab === 'gate_pass') { toLoad.add('gp'); toLoad.add('assets') }
    
    const needsLoading = force ? Array.from(toLoad) : Array.from(toLoad).filter(k => !loadedKeys.has(k))
    if (needsLoading.length === 0) return

    setLoading(true)
    try {
      let currentSites = [...sites]
      
      if (needsLoading.includes('items')) {
        const [iRes, sRes, masterSites] = await Promise.all([
          supabase.from('bulk_items').select('*').eq('is_active', true).order('item_name'),
          supabase.from('bulk_site_stock').select('*, bulk_items(item_name, item_code, unit, category, unit_price, unit_weight_kg, image_url)').order('site'),
          fetchSites().catch(() => [])
        ])
        setItems(iRes.data || [])
        setStock(sRes.data || [])
        const siteMasterNames = (masterSites || []).map(s => s.name).filter(Boolean)
        const stockSiteNames = (sRes.data || []).map(s => s.site).filter(Boolean)
        currentSites = [...currentSites, ...siteMasterNames, ...stockSiteNames]
      }

      if (needsLoading.includes('txns')) {
        const tRes = await supabase.from('bulk_transactions').select('*, bulk_items(item_name, item_code, unit, unit_price), profiles(full_name)').order('transaction_at', { ascending: false }).limit(500)
        setTransactions(tRes.data || [])
      }

      if (needsLoading.includes('gp')) {
        const gpRes = await fetchGatePasses()
        setGatePasses(gpRes || [])
      }

      if (needsLoading.includes('assets')) {
        const aRes = await supabase.from('assets').select('id, asset_name, asset_code, category, status, site').not('site', 'is', null).or('notes.is.null,notes.not.ilike.%[Migrated to Bulk Module]%').order('asset_name')
        setAssets(aRes.data || [])
        currentSites = [...currentSites, ...(aRes.data || []).map(a => a.site).filter(Boolean)]
      }

      if (needsLoading.includes('items') || needsLoading.includes('assets')) {
        setSites([...new Set(currentSites)].sort())
      }

      setLoadedKeys(prev => {
        const next = new Set(prev)
        needsLoading.forEach(k => next.add(k))
        return next
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const refreshAll = () => {
    setLoadedKeys(new Set())
    loadDataForTab(tab, true)
  }

  const openTx = (type, itemId = '', site = '') => {
    setTxType(type)
    setTxDefaultItem(itemId)
    setTxDefaultSite(site)
    setShowTxModal(true)
  }

  const toggleExpandItem = (itemId) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  // Categories list derived from items & custom categories
  const categoriesList = useMemo(() => {
    const safeCustom = Array.isArray(customCategories) ? customCategories.map(c => (typeof c === 'string' ? c : (c?.name || ''))).filter(Boolean) : []
    const existingCats = Array.isArray(items) ? items.map(i => (typeof i?.category === 'string' ? i.category : (i?.category?.name || ''))).filter(Boolean) : []
    const combined = Array.from(new Set([...safeCustom, ...existingCats])).map(c => String(c).trim()).filter(Boolean).sort()
    return ['All', ...combined]
  }, [items, customCategories])

  const allManageableCategories = useMemo(() => {
    const safeCustom = Array.isArray(customCategories) ? customCategories.map(c => (typeof c === 'string' ? c : (c?.name || ''))).filter(Boolean) : []
    const existingCats = Array.isArray(items) ? items.map(i => (typeof i?.category === 'string' ? i.category : (i?.category?.name || ''))).filter(Boolean) : []
    return Array.from(new Set([...safeCustom, ...existingCats])).map(c => String(c).trim()).filter(Boolean).sort()
  }, [items, customCategories])

  const handleOpenCategoryManager = (targetCat = null) => {
    const active = targetCat || (categoryFilter !== 'All' ? categoryFilter : null)
    if (active) {
      const activeStr = String(active)
      setEditingCatName(activeStr)
      setRenameInputValue(activeStr)
    } else {
      setEditingCatName(null)
      setRenameInputValue('')
    }
    setShowManageCategories(true)
  }

  // Derived filtered stock
  const filteredStock = useMemo(() => {
    return stock.filter(r => {
      const matchSearch = !search || (
        r.bulk_items?.item_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.bulk_items?.item_code?.toLowerCase().includes(search.toLowerCase()) ||
        r.site?.toLowerCase().includes(search.toLowerCase())
      )
      const matchCat = categoryFilter === 'All' || r.bulk_items?.category === categoryFilter
      const matchSite = siteFilter === 'All' || isSiteMatch(r.site, siteFilter)
      return matchSearch && matchCat && matchSite
    })
  }, [stock, search, categoryFilter, siteFilter])

  // Grouped Stock by Item Master (Multi-site distribution)
  const groupedStockByItem = useMemo(() => {
    const map = {}
    filteredStock.forEach(s => {
      const itemId = s.item_id
      if (!map[itemId]) {
        map[itemId] = {
          item: s.bulk_items,
          item_id: itemId,
          totalUsable: 0,
          totalInUse: 0,
          totalScrap: 0,
          totalValuation: 0,
          siteBreakdown: []
        }
      }
      const unitPrice = Number(s.bulk_items?.unit_price || s.unit_price || 0)
      const usableQty = Number(s.usable_qty || 0)
      const siteValuation = usableQty * unitPrice

      map[itemId].totalUsable += usableQty
      map[itemId].totalInUse += Number(s.in_use_qty || 0)
      map[itemId].totalScrap += Number(s.scrap_qty || 0)
      map[itemId].totalValuation += siteValuation
      map[itemId].siteBreakdown.push({
        ...s,
        unitPrice,
        siteValuation
      })
    })
    return Object.values(map)
  }, [filteredStock])

  const filteredItems = useMemo(() => {
    return items.filter(r => {
      const matchSearch = !search || (
        r.item_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.item_code?.toLowerCase().includes(search.toLowerCase()) ||
        r.category?.toLowerCase().includes(search.toLowerCase())
      )
      const matchCat = categoryFilter === 'All' || r.category === categoryFilter
      return matchSearch && matchCat
    })
  }, [items, search, categoryFilter])

  const filteredTxns = useMemo(() => {
    if (!search) return transactions
    const s = search.toLowerCase()
    return transactions.filter(t => 
      t.bulk_items?.item_name?.toLowerCase().includes(s) ||
      t.from_site?.toLowerCase().includes(s) ||
      t.to_site?.toLowerCase().includes(s) ||
      t.transaction_type?.toLowerCase().includes(s)
    )
  }, [transactions, search])

  // Handlers
  async function handleDeleteItem(id) {
    if (!confirm('Archive this master item? Stock will remain.')) return
    try {
      await supabase.from('bulk_items').update({ is_active: false }).eq('id', id)
      refreshAll()
    } catch(e) { alert(e.message) }
  }

  const handleBulkArchiveItems = async () => {
    if (!selectedMaster.size) return
    if (!confirm(`Are you sure you want to archive ${selectedMaster.size} master item(s)? Stock will remain.`)) return
    setLoading(true)
    try {
      const ids = Array.from(selectedMaster)
      const { error } = await supabase.from('bulk_items').update({ is_active: false }).in('id', ids)
      if (error) throw error
      setSelectedMaster(new Set())
      refreshAll()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const exportStock = () => {
    const data = filteredStock.map(s => {
      const unitPrice = Number(s.bulk_items?.unit_price || s.unit_price || 0)
      const usableQty = Number(s.usable_qty || 0)
      const siteValuation = usableQty * unitPrice
      return {
        'Item Name': s.bulk_items?.item_name,
        'Code / SKU': s.bulk_items?.item_code,
        'Category': s.bulk_items?.category,
        'Site': s.site,
        'Usable Qty': usableQty,
        'In Use Qty': Number(s.in_use_qty),
        'Scrap Qty': Number(s.scrap_qty),
        'UOM / Unit': s.bulk_items?.unit,
        'Unit Price (INR)': unitPrice,
        'Total Site Valuation (INR)': siteValuation,
        'Unit Weight (kg)': Number(s.bulk_items?.unit_weight_kg),
        'Total Usable Weight (kg)': usableQty * Number(s.bulk_items?.unit_weight_kg || 0),
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Stock")
    XLSX.writeFile(wb, `Inventory_Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleImportMaster = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      
      if (!rows.length) throw new Error("No data found in Excel.");
      
      const toInsert = rows.map(r => ({
        item_code: String(r['Code'] || r['Item Code'] || r['SKU'] || '').trim(),
        item_name: String(r['Item Name'] || r['Name'] || '').trim(),
        category: String(r['Category'] || 'Scaffolding').trim(),
        unit: String(r['Unit'] || r['UOM'] || 'nos').trim(),
        unit_price: Number(r['Unit Price'] || r['Rate'] || r['Price'] || 0),
        unit_weight_kg: Number(r['Unit Weight (kg)'] || r['Weight'] || 0)
      })).filter(r => r.item_code && r.item_name);

      if (!toInsert.length) throw new Error("Could not find required columns: 'Item Code'/'Code' and 'Item Name'/'Name'");

      const { error } = await supabase.from('bulk_items').upsert(toInsert, { onConflict: 'item_code' });
      if (error) throw error;
      alert(`Successfully imported ${toInsert.length} master items!`);
      refreshAll();
    } catch (err) {
      alert("Error importing: " + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handleImportStock = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      
      if (!rows.length) throw new Error("No data found in Excel.");
      
      const { data: allItems } = await supabase.from('bulk_items').select('id, item_code');
      const codeToId = {};
      allItems?.forEach(i => codeToId[i.item_code] = i.id);

      const toInsert = rows.map(r => {
        const code = String(r['Code'] || r['Item Code'] || '').trim();
        const site = String(r['Site'] || '').trim();
        if (!code || !site) return null;
        const itemId = codeToId[code];
        if (!itemId) return null; 

        return {
          item_id: itemId,
          site: site,
          usable_qty: Number(r['Usable Qty'] || r['Quantity'] || 0),
          in_use_qty: Number(r['In Use Qty'] || 0),
          scrap_qty: Number(r['Scrap Qty'] || 0)
        };
      }).filter(Boolean);

      if (!toInsert.length) throw new Error("No valid stock rows found. Make sure 'Code' matches existing Master Items and 'Site' is provided.");

      const { error } = await supabase.from('bulk_site_stock').upsert(toInsert, { onConflict: 'item_id,site' });
      if (error) throw error;
      alert(`Successfully imported ${toInsert.length} stock records!`);
      refreshAll();
    } catch (err) {
      alert("Error importing: " + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const downloadMasterTemplate = () => {
    const data = [{
      'Item Code': 'SBC/SCAF/001',
      'Item Name': 'Scaffolding Vertical 3m',
      'Category': 'Scaffolding',
      'Unit': 'nos',
      'Unit Price': 10,
      'Unit Weight (kg)': 15.5
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Items Template");
    XLSX.writeFile(wb, "Master_Items_Template.xlsx");
  };

  const downloadStockTemplate = () => {
    const data = [{
      'Item Code': 'SBC/SCAF/001',
      'Site': 'P148_AAKASA',
      'Usable Qty': 100,
      'In Use Qty': 50,
      'Scrap Qty': 5
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Template");
    XLSX.writeFile(wb, "Site_Stock_Template.xlsx");
  };

  // Summary Metrics Calculation
  const summary = useMemo(() => {
    let totalUsable = 0, totalInUse = 0, totalScrap = 0, totalValuation = 0
    const uniqueItems = new Set()
    stock.forEach(s => {
      const usableQty = Number(s.usable_qty || 0)
      const unitPrice = Number(s.bulk_items?.unit_price || s.unit_price || 0)
      
      totalUsable += usableQty
      totalInUse += Number(s.in_use_qty || 0)
      totalScrap += Number(s.scrap_qty || 0)
      totalValuation += usableQty * unitPrice
      uniqueItems.add(s.item_id)
    })
    return { uniqueItems: uniqueItems.size, totalUsable, totalInUse, totalScrap, totalValuation }
  }, [stock])

  const globalStockByItem = useMemo(() => {
    const map = {}
    stock.forEach(s => {
      map[s.item_id] = (map[s.item_id] || 0) + Number(s.usable_qty)
    })
    return map
  }, [stock])

  // ── Render Stock Views ────────────────────────────────────────────────────────
  const renderStock = () => (
    <div className="animate-fade-up">
      {/* KPI Summary Cards - 2-col on mobile, 5-col on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-5" style={{ gap: 14, marginBottom: 20 }}>
        <div className="stat-card">
          <div style={{ color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', }}>Catalog Items</div>
          <div style={{ color: 'var(--text-0)', marginTop: 4 }}>{summary.uniqueItems}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <DollarSign size={13} /> Stock Valuation
          </div>
          <div style={{ color: 'var(--text-0)', marginTop: 4 }}>
            {formatCurrency(summary.totalValuation)}
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--green)' }}>
          <div style={{ color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', }}>Usable Stock</div>
          <div style={{ color: 'var(--green)', marginTop: 4 }}>{fmt(summary.totalUsable)}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--amber)' }}>
          <div style={{ color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', }}>Deployed</div>
          <div style={{ color: 'var(--amber)', marginTop: 4 }}>{fmt(summary.totalInUse)}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div style={{ color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', }}>Scrapped</div>
          <div style={{ color: 'var(--red)', marginTop: 4 }}>{fmt(summary.totalScrap)}</div>
        </div>
      </div>

      {/* Stock View Switcher Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Grouping:</span>
          <div className="tab-container" style={{ margin: 0, padding: 3, height: 'auto' }}>
            <button 
              onClick={() => setStockViewMode('by_site')} 
              className={`tab-btn ${stockViewMode === 'by_site' ? 'active' : ''}`}
              style={{ padding: '4px 12px', }}
            >
              <Building2 size={13} /> Flat Site Stock
            </button>
            <button 
              onClick={() => setStockViewMode('by_item')} 
              className={`tab-btn ${stockViewMode === 'by_item' ? 'active' : ''}`}
              style={{ padding: '4px 12px', }}
            >
              <Layers size={13} /> Multi-Site Master Grouping
            </button>
          </div>
        </div>

        <div style={{ color: 'var(--text-3)', }}>
          Showing <strong>{stockViewMode === 'by_site' ? filteredStock.length : groupedStockByItem.length}</strong> records
        </div>
      </div>

      {/* ── MODE 1: FLAT SITE STOCK TABLE & MOBILE CARDS ── */}
      {stockViewMode === 'by_site' && (
        <>
          <div className="card desktop-table" style={{ overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table className="tbl" style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    {canWrite && <th style={{ width: 40, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        onChange={e => {
                          if (e.target.checked) setSelectedStock(new Set(filteredStock.map(s => s.id)))
                          else setSelectedStock(new Set())
                        }} 
                        checked={filteredStock.length > 0 && selectedStock.size === filteredStock.length} 
                      />
                    </th>}
                    <th>Item Details</th>
                    <th>Category</th>
                    <th>Site Location</th>
                    <th style={{ textAlign:'right' }}>Usable Stock</th>
                    <th style={{ textAlign:'right' }}>Unit Rate (₹)</th>
                    <th style={{ textAlign:'right' }}>Site Valuation (₹)</th>
                    <th style={{ textAlign:'right' }}>Deployed</th>
                    <th style={{ textAlign:'right' }}>Scrap</th>
                    {canWrite && <th style={{ textAlign:'right', paddingRight: 16 }}>Quick Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map(s => {
                    const unitPrice = Number(s.bulk_items?.unit_price || s.unit_price || 0)
                    const usableQty = Number(s.usable_qty || 0)
                    const siteValuation = usableQty * unitPrice
                    const isLowStock = usableQty < 25;
                    const rowBg = selectedStock.has(s.id) ? 'var(--bg-2)' : 'transparent';

                    return (
                      <tr key={s.id} style={{ background: rowBg, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'} onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                        {canWrite && (
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedStock.has(s.id)} 
                              onChange={e => {
                                const n = new Set(selectedStock)
                                if (e.target.checked) n.add(s.id)
                                else n.delete(s.id)
                                setSelectedStock(n)
                              }} 
                            />
                          </td>
                        )}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {s.bulk_items?.image_url ? (
                              <img src={s.bulk_items.image_url} alt={s.bulk_items.item_name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-2)', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package size={16} color="var(--text-3)" />
                              </div>
                            )}
                            <div>
                              <div style={{ color:'var(--text-0)', }}>{s.bulk_items?.item_name}</div>
                              <div style={{ color:'var(--text-3)', }}>{s.bulk_items?.item_code}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ padding:'3px 8px', borderRadius:6, background:'var(--accent-soft)', color:'var(--accent)', border:'1px solid var(--accent-soft)', }}>
                            {s.bulk_items?.category || 'General'}
                          </span>
                        </td>
                        <td>
                          <span style={{ padding:'3px 10px', borderRadius:6, background:'var(--bg-2)', border:'1px solid var(--border)', color: 'var(--text-0)' }}>
                            {s.site}
                          </span>
                        </td>
                        <td style={{ textAlign:'right' }}>
                          <div style={{ color: isLowStock ? 'var(--red)' : 'var(--green)', fontWeight: 500 }}>
                            {fmt(usableQty)} <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: '0.9em' }}>{s.bulk_items?.unit || 'nos'}</span>
                          </div>
                          {isLowStock && <div style={{ color: 'var(--red)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}><AlertCircle size={12}/> Low Stock</div>}
                        </td>
                        <td style={{ textAlign:'right', color:'var(--text-1)' }}>
                          {unitPrice > 0 ? `₹${fmt(unitPrice)}` : <span style={{ color: 'var(--text-3)' }}>-</span>}
                        </td>
                        <td style={{ textAlign:'right', color:'var(--text-0)' }}>
                          {siteValuation > 0 ? formatCurrency(siteValuation) : <span style={{ color: 'var(--text-3)', }}>₹0</span>}
                        </td>
                        <td style={{ textAlign:'right' }}>
                          <div style={{ color:'var(--amber)' }}>
                            {fmt(s.in_use_qty)} <span style={{ color:'var(--text-3)' }}>{s.bulk_items?.unit || 'nos'}</span>
                          </div>
                        </td>
                        <td style={{ textAlign:'right' }}>
                          <div style={{ color:'var(--red)' }}>
                            {fmt(s.scrap_qty)} <span style={{ color:'var(--text-3)' }}>{s.bulk_items?.unit || 'nos'}</span>
                          </div>
                        </td>
                        {canWrite && (
                          <td style={{ textAlign:'right', paddingRight: 16 }}>
                            <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                              <button onClick={() => { setEditStockRecord({ ...s, unit_price: unitPrice }); setShowEditStockModal(true); }} className="btn-ghost" style={{ padding:'6px', color: 'var(--text-1)' }} title="Edit Stock Details">
                                <Pencil size={15}/>
                              </button>
                              <button onClick={() => openTx('transfer', s.item_id, s.site)} className="btn-ghost" style={{ padding:'6px', color: 'var(--accent)' }} title="Transfer">
                                <ArrowRightLeft size={15}/>
                              </button>
                              <button onClick={() => openTx('deploy', s.item_id, s.site)} className="btn-ghost" style={{ padding:'6px', color: 'var(--green)' }} title="Deploy">
                                <Hammer size={15}/>
                              </button>
                              <button onClick={() => openTx('scrap', s.item_id, s.site)} className="btn-ghost" style={{ padding:'6px', color: 'var(--red)' }} title="Scrap">
                                <Trash2 size={15}/>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {filteredStock.length === 0 && (
                    <tr><td colSpan={canWrite ? 10 : 9} style={{ padding:60, textAlign:'center', color:'var(--text-3)' }}>No stock records found matching filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredStock.length === 0 && (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
                <Package size={32} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
                No stock records found.
              </div>
            )}
            {filteredStock.map(s => {
              const unitPrice = Number(s.bulk_items?.unit_price || s.unit_price || 0)
              const usableQty = Number(s.usable_qty || 0)
              const siteValuation = usableQty * unitPrice
              const isLowStock = usableQty < 25

              return (
                <div key={s.id} className="card" style={{ padding: '16px', borderLeft: isLowStock ? '4px solid var(--red)' : '4px solid var(--accent)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-0)', }}>{s.bulk_items?.item_name}</div>
                      <div style={{ color: 'var(--text-3)', marginTop: 2 }}>{s.bulk_items?.item_code}</div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 20, background: 'var(--bg-2)', border: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-0)' }}>
                      {s.site}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usable</div>
                      <div style={{ color: isLowStock ? 'var(--red)' : 'var(--green)', marginTop: 2 }}>
                        {fmt(usableQty)}
                      </div>
                      <div style={{ color: 'var(--text-3)' }}>{s.bulk_items?.unit || 'nos'}</div>
                    </div>
                    <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rate (₹)</div>
                      <div style={{ color: 'var(--text-0)', marginTop: 2 }}>
                        ₹{fmt(unitPrice)}
                      </div>
                      <div style={{ color: 'var(--text-3)' }}>per {s.bulk_items?.unit || 'unit'}</div>
                    </div>
                    <div style={{ background: 'var(--accent-soft)', borderRadius: 10, padding: '8px 10px', textAlign: 'center', border: '1px solid var(--accent-soft)' }}>
                      <div style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valuation</div>
                      <div style={{ color: 'var(--accent)', marginTop: 2 }}>
                        {formatCurrency(siteValuation)}
                      </div>
                    </div>
                  </div>

                  {canWrite && (
                    <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <button onClick={() => openTx('transfer', s.item_id, s.site)} className="btn-primary" style={{ flex: 1, padding: '8px 10px', minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <ArrowRightLeft size={13}/> Transfer
                      </button>
                      <button onClick={() => openTx('deploy', s.item_id, s.site)} className="btn-ghost" style={{ flex: 1, padding: '8px 10px', minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <Hammer size={13}/> Deploy
                      </button>
                      <button onClick={() => openTx('scrap', s.item_id, s.site)} className="btn-ghost" style={{ padding: '8px 10px', minHeight: 36, color: 'var(--red)', border: '1px solid var(--status-danger-soft)' }}>
                        <Trash2 size={14}/> Scrap
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── MODE 2: MULTI-SITE MASTER GROUPING VIEW ── */}
      {stockViewMode === 'by_item' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groupedStockByItem.length === 0 && (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)' }}>
              No inventory records found.
            </div>
          )}

          {groupedStockByItem.map(group => {
            const isExpanded = expandedItems.has(group.item_id)
            const item = group.item || {}
            const unitPrice = Number(item.unit_price || 0)

            return (
              <div key={group.item_id} className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {/* Master Item Header Row */}
                <div 
                  onClick={() => toggleExpandItem(group.item_id)} 
                  style={{ padding: '16px 20px', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', flexWrap: 'wrap', gap: 12, borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {isExpanded ? <ChevronDown size={18} color="var(--accent)" /> : <ChevronRight size={18} color="var(--text-3)" />}
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.item_name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-3)', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} color="var(--accent)" />
                      </div>
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-0)', letterSpacing: '0.02em' }}>
                          {item.item_name || 'Master Item'}
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-soft)', }}>
                          {item.category || 'General'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-3)', marginTop: 2 }}>
                        SKU: {item.item_code} | UOM: <strong>{item.unit || 'nos'}</strong> | Unit Rate: <strong>₹{fmt(unitPrice)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Summary Totals for this Item */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', }}>Sites Present</div>
                      <div style={{ color: 'var(--text-0)' }}>
                        {group.siteBreakdown.length} Sites
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', }}>Global Usable Stock</div>
                      <div style={{ color: 'var(--green)' }}>
                        {fmt(group.totalUsable)} <span >{item.unit || 'nos'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', background: 'var(--accent-soft)', padding: '6px 14px', borderRadius: 10, border: '1px solid var(--accent-soft)' }}>
                      <div style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', }}>Total Valuation</div>
                      <div style={{ color: 'var(--accent)' }}>
                        {formatCurrency(group.totalValuation)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multi-Site Quantity Breakdown Table */}
                {isExpanded && (
                  <div style={{ background: 'var(--bg-1)', padding: 16 }}>
                    <div style={{ color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={14} color="var(--accent)" /> Multi-Site Quantity & Valuation Breakdown
                    </div>
                    
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tbl" style={{ width: '100%', minWidth: 700 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-2)' }}>
                            <th>Site Location</th>
                            <th style={{ textAlign: 'right' }}>Usable Quantity</th>
                            <th style={{ textAlign: 'right' }}>Unit Price (₹)</th>
                            <th style={{ textAlign: 'right' }}>Site Valuation (₹)</th>
                            <th style={{ textAlign: 'right' }}>Deployed</th>
                            <th style={{ textAlign: 'right' }}>Scrap</th>
                            {canWrite && <th style={{ textAlign: 'right' }}>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {group.siteBreakdown.map(sb => {
                            const isLow = Number(sb.usable_qty) < 25
                            return (
                              <tr key={sb.id}>
                                <td>
                                  <span style={{ color: 'var(--text-0)', }}>
                                    {sb.site}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ color: isLow ? 'var(--red)' : 'var(--green)' }}>
                                    {fmt(sb.usable_qty)} <span >{item.unit || 'nos'}</span>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right', }}>
                                  ₹{fmt(sb.unitPrice)}
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--accent)' }}>
                                  {formatCurrency(sb.siteValuation)}
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--amber)' }}>
                                  {fmt(sb.in_use_qty)}
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--red)' }}>
                                  {fmt(sb.scrap_qty)}
                                </td>
                                {canWrite && (
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                      <button onClick={() => { setEditStockRecord({ id: sb.id, site: sb.site, usable_qty: sb.usable_qty, in_use_qty: sb.in_use_qty, scrap_qty: sb.scrap_qty, unit_price: sb.unitPrice, bulk_items: item }); setShowEditStockModal(true); }} className="btn-ghost" style={{ padding: '6px', color: 'var(--text-1)' }} title="Edit">
                                        <Pencil size={15} />
                                      </button>
                                      <button onClick={() => openTx('transfer', sb.item_id, sb.site)} className="btn-ghost" style={{ padding: '6px', color: 'var(--accent)' }} title="Transfer">
                                        <ArrowRightLeft size={15} />
                                      </button>
                                      <button onClick={() => openTx('scrap', sb.item_id, sb.site)} className="btn-ghost" style={{ padding: '6px', color: 'var(--red)' }} title="Scrap">
                                        <Trash2 size={15} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── Render Master Items Table ────────────────────────────────────────────────
  const renderItems = () => (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table className="tbl" style={{ minWidth: 700 }}>
          <thead>
            <tr>
              {canWrite && <th style={{ width: 40, textAlign: 'center' }}>
                <input 
                  type="checkbox" 
                  onChange={e => {
                    if (e.target.checked) setSelectedMaster(new Set(filteredItems.map(i => i.id)))
                    else setSelectedMaster(new Set())
                  }} 
                  checked={filteredItems.length > 0 && selectedMaster.size === filteredItems.length} 
                />
              </th>}
              <th>Item / SKU</th>
              <th>Category</th>
              <th>UOM</th>
              <th style={{ textAlign:'right' }}>Unit Cost (₹)</th>
              <th style={{ textAlign:'right' }}>Global Usable Stock</th>
              <th style={{ textAlign:'right' }}>Global Valuation (₹)</th>
              <th style={{ textAlign:'right' }}>Unit Weight (kg)</th>
              {canWrite && <th style={{ textAlign:'right', paddingRight: 16 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(i => {
              const globalQty = globalStockByItem[i.id] || 0
              const unitPrice = Number(i.unit_price || 0)
              const globalValuation = globalQty * unitPrice

              return (
                <tr key={i.id} style={{ background: selectedMaster.has(i.id) ? 'var(--bg-2)' : 'transparent' }}>
                  {canWrite && (
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedMaster.has(i.id)} 
                        onChange={e => {
                          const n = new Set(selectedMaster)
                          if (e.target.checked) n.add(i.id)
                          else n.delete(i.id)
                          setSelectedMaster(n)
                        }} 
                      />
                    </td>
                  )}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {i.image_url ? (
                        <img src={i.image_url} alt={i.item_name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-2)', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={16} color="var(--text-3)" />
                        </div>
                      )}
                      <div>
                        <div style={{ color:'var(--text-0)', }}>{i.item_name}</div>
                        <div style={{ color:'var(--text-3)', }}>{i.item_code}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ padding:'3px 8px', borderRadius:6, background:'var(--accent-soft)', color:'var(--accent)', border:'1px solid var(--accent-soft)', }}>
                      {i.category || 'General'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-1)' }}>
                    {i.unit || 'nos'}
                  </td>
                  <td style={{ textAlign:'right', }}>
                    ₹{fmt(unitPrice)}
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <div style={{ color: globalQty > 0 ? 'var(--green)' : 'var(--text-3)' }}>
                      {fmt(globalQty)} <span style={{ color:'var(--text-3)' }}>{i.unit}</span>
                    </div>
                  </td>
                  <td style={{ textAlign:'right', color:'var(--text-0)' }}>
                    {formatCurrency(globalValuation)}
                  </td>
                  <td style={{ textAlign:'right', }}>{fmt(i.unit_weight_kg)}</td>
                  {canWrite && (
                    <td style={{ textAlign:'right', paddingRight: 16 }}>
                      <button onClick={() => { setEditItem(i); setShowItemForm(true) }} className="btn-ghost" style={{ padding:6 }}><Pencil size={14}/></button>
                      <button onClick={() => handleDeleteItem(i.id)} className="btn-ghost" style={{ padding:6, color:'var(--red)', marginLeft:4 }}><Trash2 size={14}/></button>
                    </td>
                  )}
                </tr>
              )
            })}
            {filteredItems.length === 0 && (
              <tr><td colSpan={canWrite ? 9 : 8} style={{ padding:60, textAlign:'center', color:'var(--text-3)' }}>No master items found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const txTypeColors = {
    receipt: { bg: 'rgba(0,185,107,0.12)', color: 'var(--green)' },
    transfer: { bg: 'var(--accent-soft)', color: 'var(--accent)' },
    deploy: { bg: 'rgba(6,182,212,0.12)', color: 'var(--cyan)' },
    dismantle: { bg: 'rgba(139,92,246,0.12)', color: 'var(--purple)' },
    scrap: { bg: 'var(--status-danger-soft)', color: 'var(--red)' },
    consume: { bg: 'var(--status-warning-soft)', color: 'var(--amber)' },
    return: { bg: 'rgba(0,185,107,0.12)', color: 'var(--green)' },
  }

  const renderTransactions = () => (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table className="tbl" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Type</th>
              <th>Item</th>
              <th>From → To</th>
              <th style={{ textAlign:'right' }}>Quantity</th>
              <th style={{ textAlign:'right' }}>Est. Value Impact</th>
              <th style={{ textAlign:'right' }}>Total Wt (kg)</th>
              <th>Performed By</th>
            </tr>
          </thead>
          <tbody>
            {filteredTxns.map(t => {
              const dt = new Date(t.transaction_at)
              const colors = txTypeColors[t.transaction_type] || { bg: 'var(--bg-3)', color: 'var(--text-2)' }
              const unitPrice = Number(t.bulk_items?.unit_price || 0)
              const valImpact = Number(t.quantity || 0) * unitPrice

              return (
                <tr key={t.id}>
                  <td>
                    <div style={{ color:'var(--text-1)', }}>
                      {dt.toLocaleDateString('en-GB')}
                    </div>
                    <div style={{ color:'var(--text-3)' }}>
                      {dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td>
                    <span style={{ padding:'3px 8px', borderRadius:6, background: colors.bg, color: colors.color, textTransform:'uppercase', border: `1px solid ${colors.color}40` }}>
                      {t.transaction_type}
                    </span>
                  </td>
                  <td>
                    <div style={{ color:'var(--text-1)', }}>{t.bulk_items?.item_name}</div>
                    <div style={{ color:'var(--text-3)', }}>{t.bulk_items?.item_code}</div>
                  </td>
                  <td style={{ color:'var(--text-1)' }}>
                    {t.from_site || '-'} {t.to_site && t.from_site ? '→' : ''} {t.to_site || ''}
                  </td>
                  <td style={{ textAlign:'right', }}>
                    {fmt(t.quantity)} <span style={{ color:'var(--text-3)' }}>{t.bulk_items?.unit || 'nos'}</span>
                  </td>
                  <td style={{ textAlign:'right', color: 'var(--text-0)' }}>
                    {valImpact > 0 ? formatCurrency(valImpact) : '-'}
                  </td>
                  <td style={{ textAlign:'right', color:'var(--text-2)' }}>
                    {t.total_weight_kg ? fmt(t.total_weight_kg) : '-'}
                  </td>
                  <td style={{ color:'var(--text-2)' }}>{t.profiles?.full_name || 'System'}</td>
                </tr>
              )
            })}
            {filteredTxns.length === 0 && (
              <tr><td colSpan={8} style={{ padding:60, textAlign:'center', color:'var(--text-3)' }}>No transactions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <>
      {isMobile ? (
        <MobileInventoryPage
          tab={tab} setTab={setTab}
          loading={loading}
          search={search} setSearch={setSearch}
          summary={summary}
          filteredStock={filteredStock}
          stockViewMode={stockViewMode} setStockViewMode={setStockViewMode}
          groupedStockByItem={groupedStockByItem}
          canWrite={canWrite}
          openTx={openTx}
          setEditStockRecord={setEditStockRecord}
          setShowEditStockModal={setShowEditStockModal}
        />
      ) : (
      <div className="animate-fade-up">
        {/* ── Header (Premium Style) ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-[var(--bg-0)] p-4 md:p-6 rounded-2xl border border-[var(--border)] shadow-sm mb-6 gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[var(--accent-glow)]">
              <Boxes size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[var(--text-0)] m-0 leading-tight">
                Bulk Inventory & Materials
              </h1>
              <p className="text-xs text-[var(--text-3)] tracking-wider m-0 mt-1 font-medium leading-tight hidden md:block">
                Multi-site stock distribution, UOM rates, site transfers, and scrapping.
              </p>
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs - scrollable on mobile */}
        <div className="inv-tabs" style={{ marginBottom: 16, overflowX: 'auto' }}>
          <div className="tab-container" style={{ overflow: 'visible', flexWrap: 'nowrap', minWidth: 'max-content' }}>
            <TabBtn active={tab === 'stock'} icon={Boxes} label="Site Stock" onClick={() => setTab('stock')} />
            <TabBtn active={tab === 'master'} icon={Package} label="Master Catalog" onClick={() => setTab('master')} />
            <TabBtn active={tab === 'components'} icon={Layers} label="Serialized Components" onClick={() => setTab('components')} />
            <TabBtn active={tab === 'transactions'} icon={History} label="Transaction History" onClick={() => setTab('transactions')} />
            
            <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '4px', flexShrink: 0 }} />
            
            <TabBtn active={tab === 'gate_pass'} icon={FileText} label="Gate Pass" onClick={() => setTab('gate_pass')} />
            {canWrite && <TabBtn active={tab === 'issue_slips'} icon={Send} label="Issue Slips" onClick={() => setTab('issue_slips')} />}
          </div>
        </div>

        {/* Toolbar & Search */}
        <div className="inv-toolbar" style={{ display:'flex', justifyContent:'space-between', marginBottom:16, gap:10, flexWrap:'wrap', alignItems: 'center' }}>
          {(tab === 'stock' || tab === 'master' || tab === 'transactions') ? (
            <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 200, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search input */}
              <div style={{ position:'relative', flex:1, minWidth: 160, maxWidth: 300 }}>
                <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }} />
                <input type="text" className="inp" placeholder="Search item, code, site..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:34 }} />
              </div>

              {/* Category Dropdown & Manage Button */}
              {(tab === 'stock' || tab === 'master') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <select className="inp" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
                    <option value="All">All Categories ({categoriesList.length - 1})</option>
                    {categoriesList.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {canWrite && (
                    <button 
                      onClick={() => handleOpenCategoryManager()} 
                      className="btn-ghost" 
                      style={{ padding: '8px 10px', height: 38, minHeight: 38, borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }} 
                      title="Edit / Manage Categories"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Site Dropdown */}
              {tab === 'stock' && (
                <select className="inp" value={siteFilter} onChange={e => setSiteFilter(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
                  <option value="All">All Sites ({sites.length})</option>
                  {sites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          ) : <div />}
          
          {tab === 'stock' && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems: 'center' }}>
              {canWrite && (
                <>
                  <label className="btn-ghost" style={{ padding:'6px 12px', minHeight: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Plus size={13}/> <span className="inv-btn-label">Import Stock</span>
                    <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportStock} />
                  </label>
                  <button onClick={downloadStockTemplate} className="btn-ghost" style={{ padding:'6px 12px', minHeight: 38, display: 'flex', alignItems: 'center', gap: 5 }} title="Download Excel template to import stock">
                    <Download size={13}/> <span className="inv-btn-label">Stock Template</span>
                  </button>
                </>
              )}
              <button onClick={exportStock} className="btn-ghost" style={{ padding:'6px 12px', minHeight: 38, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Download size={13}/> <span className="inv-btn-label">Export Excel</span>
              </button>
              
              {canWrite && (
                <button onClick={() => openTx('receipt')} className="btn-primary" style={{ padding:'6px 14px', minHeight: 38, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Plus size={13}/> Receive Stock
                </button>
              )}
            </div>
          )}
          
          {tab === 'master' && canWrite && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {selectedMaster.size > 0 && (
                <button onClick={handleBulkArchiveItems} className="btn-danger" style={{ padding:'6px 14px', minHeight: 38, background: 'var(--amber)', color: 'white', borderRadius: 12, border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArchiveX size={14}/> Archive Selected
                </button>
              )}
              <label className="btn-ghost" style={{ padding:'6px 14px', minHeight: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14}/> Import Excel
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportMaster} />
              </label>
              <button onClick={downloadMasterTemplate} className="btn-ghost" style={{ padding:'6px 14px', minHeight: 38, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={14}/> Template
              </button>
              <button onClick={() => { setEditItem(null); setShowItemForm(true) }} className="btn-primary" style={{ padding:'8px 16px' }}>
                <Plus size={14}/> Add Master Item
              </button>
            </div>
          )}
        </div>

        {/* Tab Content Rendering */}
        {loading ? (
          <div style={{ padding:100, textAlign:'center' }}>
            <Loader2 size={32} style={{ animation:'spin 1s linear infinite', color:'var(--accent)', margin:'0 auto' }} />
          </div>
        ) : (
          <>
            {tab === 'stock' && renderStock()}
            {tab === 'master' && renderItems()}
            {tab === 'components' && <SerializedComponentsTab sites={sites} />}
            {tab === 'transactions' && renderTransactions()}
            
            {tab === 'gate_pass' && (
              <GatePassTab 
                gatePasses={gatePasses} 
                items={items} 
                assets={assets} 
                sites={sites} 
                onRefresh={refreshAll} 
              />
            )}

            {tab === 'issue_slips' && canWrite && (
              <IssueSlipTab 
                items={items} 
                stock={stock} 
                sites={sites} 
                onRefresh={refreshAll} 
              />
            )}
          </>
        )}

      </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <BulkItemForm
          isOpen={showItemForm}
          onClose={() => { setShowItemForm(false); setEditItem(null); }}
          item={editItem}
          availableCategories={allManageableCategories}
          onSaved={refreshAll}
        />
      )}

      {/* Transaction Modal (Transfer, Deploy, Scrap, Consume, Receive) */}
      {showTxModal && (
        <BulkTransactionModal
          isOpen={showTxModal}
          onClose={() => setShowTxModal(false)}
          txType={txType}
          items={items}
          stock={stock}
          allConfiguredSites={sites}
          defaultItem={txDefaultItem}
          defaultSite={txDefaultSite}
          onSaved={refreshAll}
          user={user}
          onViewGatePass={() => {
            setShowTxModal(false)
            setTab('gate_pass')
            setLoadedKeys(prev => { const n = new Set(prev); n.delete('gp'); return n })
          }}
        />
      )}

      {/* Manage Categories Full Page Drawer */}
      {showManageCategories && (
        <div className="modal-bg" style={{ zIndex: 2300 }} onClick={() => setShowManageCategories(false)}>
          <div 
            className="modal" 
            style={{ maxWidth: 580, width: '100%', display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-1)' }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Top Bar Header */}
            <div style={{ padding: '20px 24px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-soft)' }}>
                  <Layers size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Manage Categories
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent)', }}>
                      {allManageableCategories.length} Total
                    </span>
                  </h2>
                  <p style={{ margin: 0, color: 'var(--text-3)', }}>
                    Add, rename, or delete bulk inventory item categories
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowManageCategories(false)} 
                className="btn-ghost" 
                style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 10, 
                  border: '1px solid var(--border)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justify: 'center',
                  color: 'var(--text-0)',
                  background: 'var(--bg-3)',
                  cursor: 'pointer'
                }}
                title="Close Drawer"
              >
                <X size={18} color="var(--text-0)" />
              </button>
            </div>

            {/* Main Full-Height Body */}
            <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Add New Category Box */}
              <div style={{ padding: 20, background: 'var(--bg-2)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <label className="lbl" style={{ marginBottom: 8, display: 'block', }}>Add New Category</label>
                <form onSubmit={(e) => { e.preventDefault(); handleAddCategory(newCatInput); }} style={{ display: 'flex', gap: 10 }}>
                  <input 
                    type="text" 
                    className="inp" 
                    placeholder="e.g. Formwork, Plumbing, Scaffolding Material..." 
                    value={newCatInput} 
                    onChange={e => setNewCatInput(e.target.value)} 
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Plus size={16} /> Add Category
                  </button>
                </form>
              </div>

              {/* Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <h4 style={{ margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-1)' }}>
                  Existing Categories List
                </h4>
                <span style={{ color: 'var(--text-3)' }}>
                  Renaming updates all associated items in Supabase
                </span>
              </div>

              {/* Category Items Full List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {allManageableCategories.map(cat => {
                  const catStr = String(cat || '').trim()
                  if (!catStr) return null
                  const isEditing = editingCatName === catStr

                  // Count items in this category
                  const count = items.filter(i => i.category === catStr).length

                  return (
                    <div 
                      key={catStr} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justify: 'space-between', 
                        padding: '14px 18px', 
                        background: isEditing ? 'var(--accent-soft)' : 'var(--bg-2)', 
                        borderRadius: 12, 
                        border: isEditing ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                          <input 
                            type="text" 
                            className="inp" 
                            value={renameInputValue ?? ''} 
                            onChange={e => setRenameInputValue(e.target.value)} 
                            autoFocus
                            style={{ flex: 1, padding: '8px 12px', }}
                          />
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation()
                              await handleRenameCategory(catStr, renameInputValue)
                              setEditingCatName(null)
                            }} 
                            className="btn-primary" 
                            style={{ padding: '8px 16px', }}
                          >
                            Save
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditingCatName(null); }} 
                            className="btn-ghost" 
                            style={{ padding: '8px 14px', }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ color: 'var(--text-0)', }}>
                              {catStr}
                            </span>
                            <span style={{ padding: '2px 8px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                              {count} {count === 1 ? 'item' : 'items'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setEditingCatName(catStr); setRenameInputValue(catStr); }} 
                              className="btn-ghost" 
                              style={{ padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)' }} 
                              title="Rename Category"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteCategory(catStr); }} 
                              className="btn-ghost" 
                              style={{ padding: '8px 12px', borderRadius: 8, color: 'var(--red)', border: '1px solid var(--status-danger-soft)', display: 'flex', alignItems: 'center', gap: 5 }} 
                              title="Delete Category"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', background: 'var(--bg-2)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowManageCategories(false)} 
                className="btn-primary" 
                style={{ padding: '10px 24px', }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Stock Record Modal */}
      {showEditStockModal && editStockRecord && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 2300,
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            padding: '16px'
          }} 
          onClick={() => setShowEditStockModal(false)}
        >
          <div 
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              maxWidth: 500,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)' }}>
              <h3 style={{ margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-0)', display: 'flex', alignItems: 'center', gap: 8, }}>
                <Pencil size={18} color="var(--accent)" /> EDIT SITE STOCK RECORD
              </h3>
              <button onClick={() => setShowEditStockModal(false)} className="btn-ghost" style={{ padding: 6, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} color="var(--text-0)" /></button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              await handleSaveStockRecord(editStockRecord.id, {
                usable_qty: Number(editStockRecord.usable_qty || 0),
                in_use_qty: Number(editStockRecord.in_use_qty || 0),
                scrap_qty: Number(editStockRecord.scrap_qty || 0),
                unit_price: Number(editStockRecord.unit_price || 0),
                site: editStockRecord.site
              })
            }} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              
              <div style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-0)', }}>{editStockRecord.bulk_items?.item_name || 'Item'}</div>
                <div style={{ color: 'var(--text-3)', marginTop: 2 }}>{editStockRecord.bulk_items?.item_code || ''} • Location: {editStockRecord.site ?? ''}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="lbl">Usable Quantity</label>
                  <input 
                    type="number" 
                    step="any" 
                    className="inp" 
                    required 
                    value={editStockRecord.usable_qty ?? ''} 
                    onChange={e => setEditStockRecord({ ...editStockRecord, usable_qty: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="lbl">Unit Rate / Price (₹)</label>
                  <input 
                    type="number" 
                    step="any" 
                    className="inp" 
                    value={editStockRecord.unit_price ?? ''} 
                    onChange={e => setEditStockRecord({ ...editStockRecord, unit_price: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="lbl">Deployed Quantity</label>
                  <input 
                    type="number" 
                    step="any" 
                    className="inp" 
                    value={editStockRecord.in_use_qty ?? ''} 
                    onChange={e => setEditStockRecord({ ...editStockRecord, in_use_qty: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="lbl">Scrap Quantity</label>
                  <input 
                    type="number" 
                    step="any" 
                    className="inp" 
                    value={editStockRecord.scrap_qty ?? ''} 
                    onChange={e => setEditStockRecord({ ...editStockRecord, scrap_qty: e.target.value })} 
                  />
                </div>
              </div>

              <div>
                <label className="lbl">Site Location</label>
                <input 
                  type="text" 
                  className="inp" 
                  required 
                  value={editStockRecord.site ?? ''} 
                  onChange={e => setEditStockRecord({ ...editStockRecord, site: e.target.value })} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowEditStockModal(false)} className="btn-ghost" style={{ padding: '10px 18px', borderRadius: 10 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '10px 22px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, }}>
                  <Save size={15} /> Save Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

class InventoryErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error("InventoryPage error:", error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-1)', borderRadius: 16, border: '1px solid var(--border)', margin: 20 }}>
          <AlertCircle size={36} color="var(--red)" style={{ marginBottom: 12 }} />
          <h3 style={{ color: 'var(--text-0)', margin: '0 0 8px 0', }}>Inventory Module Encountered an Issue</h3>
          <p style={{ color: 'var(--text-2)', marginBottom: 16 }}>{this.state.error?.message || 'An unexpected rendering error occurred.'}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }} className="btn-primary" style={{ padding: '8px 20px' }}>
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function InventoryPage(props) {
  return (
    <InventoryErrorBoundary>
      <InventoryPageContent {...props} />
    </InventoryErrorBoundary>
  )
}


