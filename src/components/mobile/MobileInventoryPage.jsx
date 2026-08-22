import React, { useState } from 'react'
import { Package, Search, Plus, DollarSign, ArchiveX, ShieldAlert, ArrowRightLeft, MoreVertical, Edit2, Download, Hammer, Trash2, ArrowRight, AlertTriangle, CheckCircle2, Eye, Send } from 'lucide-react'
import MobileEmptyState from './MobileEmptyState'
import MobileSearchBar from './MobileSearchBar'
import MobileActionSheet from './MobileActionSheet'

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0)

export default function MobileInventoryPage({
  tab, setTab,
  loading,
  search, setSearch,
  summary,
  filteredStock = [],
  stockViewMode, setStockViewMode,
  groupedStockByItem,
  canWrite,
  openTx,
  setEditStockRecord, setShowEditStockModal
}) {
  const [actionStock, setActionStock] = useState(null)
  const [stockFilter, setStockFilter] = useState('all') // 'all' | 'low' | 'out'
  
  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-44 bg-bg-1 border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  // Calculate stock attention metrics
  const lowStockCount = filteredStock.filter(s => Number(s.usable_qty || 0) > 0 && Number(s.usable_qty || 0) < 25).length
  const outOfStockCount = filteredStock.filter(s => Number(s.usable_qty || 0) === 0).length
  const normalStockCount = filteredStock.filter(s => Number(s.usable_qty || 0) >= 25).length

  const displayList = filteredStock.filter(s => {
    const qty = Number(s.usable_qty || 0)
    if (stockFilter === 'low') return qty > 0 && qty < 25
    if (stockFilter === 'out') return qty === 0
    return true
  })

  return (
    <div className="flex flex-col min-h-screen bg-bg-0 pb-28">
      {/* ── Search & Attention Chips ── */}
      <div className="bg-bg-1 sticky top-0 z-30 shadow-sm border-b border-border">
        <div className="p-4 pb-2">
          <MobileSearchBar 
            value={search} 
            onChange={setSearch} 
            placeholder="Search item, SKU code, or site..." 
          />
        </div>
        
        {/* Top Attention Strip: Low Stock, Out of Stock, Healthy */}
        <div className="px-4 py-2 grid grid-cols-3 gap-2">
          <button
            onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
            className={`flex flex-col p-2 rounded-lg border text-center transition-all ${
              stockFilter === 'low' ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400/30' : 'bg-amber-50 border-amber-200'
            }`}
          >
            <span className="text-[10px] text-amber-800 uppercase tracking-tight">Low Stock</span>
            <span className="text-body font-mono text-amber-700 leading-tight mt-0.5">{lowStockCount}</span>
          </button>

          <button
            onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
            className={`flex flex-col p-2 rounded-lg border text-center transition-all ${
              stockFilter === 'out' ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-400/30' : 'bg-rose-50 border-rose-200'
            }`}
          >
            <span className="text-[10px] text-rose-800 uppercase tracking-tight">Out of Stock</span>
            <span className="text-body font-mono text-rose-700 leading-tight mt-0.5">{outOfStockCount}</span>
          </button>

          <button
            onClick={() => setStockFilter('all')}
            className={`flex flex-col p-2 rounded-lg border text-center transition-all ${
              stockFilter === 'all' ? 'bg-bg-2 border-accent ring-2 ring-accent/20' : 'bg-bg-0 border-border'
            }`}
          >
            <span className="text-[10px] text-text-3 uppercase tracking-tight">All Items</span>
            <span className="text-body font-mono text-text-0 leading-tight mt-0.5">{filteredStock.length}</span>
          </button>
        </div>
      </div>

      {/* ── Stock Cards List ── */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {displayList.length === 0 ? (
          <MobileEmptyState 
            icon={Package} 
            title="No Stock Items Found" 
            description={stockFilter !== 'all' ? "No items matching the selected health filter." : "Try adjusting your search query."} 
          />
        ) : (
          displayList.map(s => {
            const usableQty = Number(s.usable_qty || 0)
            const inUseQty = Number(s.in_use_qty || 0)
            const scrapQty = Number(s.scrap_qty || 0)
            const isOut = usableQty === 0
            const isLow = usableQty > 0 && usableQty < 25

            return (
              <div 
                key={s.id}
                className="bg-bg-1 border border-border rounded-xl p-4 shadow-sm active:border-accent transition-colors flex flex-col gap-3 relative"
              >
                {/* Top: SKU & Health Status */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-caption text-text-2 bg-bg-2 px-2 py-0.5 rounded">
                    {s.bulk_items?.item_code || 'SKU'}
                  </span>

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px]  border ${
                    isOut 
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : isLow
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOut ? 'bg-rose-600' : isLow ? 'bg-amber-500' : 'bg-emerald-600'}`} />
                    {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Healthy'}
                  </span>
                </div>

                {/* Item Name & Site */}
                <div>
                  <h3 className="text-[15px] text-text-0 leading-tight m-0">
                    {s.bulk_items?.item_name || 'Inventory Item'}
                  </h3>
                  <div className="text-caption text-text-2 mt-1">
                    Deployment Site: <span className="text-text-0">{s.site || 'Main Yard'}</span>
                  </div>
                </div>

                {/* Stock Quantities 3-Column Grid */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-border-light text-center">
                  <div className="p-2 bg-bg-0 rounded-lg">
                    <span className="text-[10px] uppercase text-text-3 block">Usable</span>
                    <span className={`font-mono text-small  block mt-0.5 ${isOut ? 'text-danger' : isLow ? 'text-amber' : 'text-green'}`}>
                      {fmt(usableQty)}
                    </span>
                    <span className="text-[10px] text-text-3">{s.bulk_items?.unit || 'units'}</span>
                  </div>

                  <div className="p-2 bg-bg-0 rounded-lg">
                    <span className="text-[10px] uppercase text-text-3 block">In Use</span>
                    <span className="font-mono text-small text-text-1 block mt-0.5">
                      {fmt(inUseQty)}
                    </span>
                    <span className="text-[10px] text-text-3">{s.bulk_items?.unit || 'units'}</span>
                  </div>

                  <div className="p-2 bg-bg-0 rounded-lg">
                    <span className="text-[10px] uppercase text-text-3 block">Scrap</span>
                    <span className="font-mono text-small text-danger block mt-0.5">
                      {fmt(scrapQty)}
                    </span>
                    <span className="text-[10px] text-text-3">{s.bulk_items?.unit || 'units'}</span>
                  </div>
                </div>

                {/* Actions: Issue Stock & View */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => openTx && openTx('issue', s)}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-accent text-white hover:bg-accent-hover active:bg-accent-active text-caption rounded-lg shadow-sm"
                  >
                    <Send size={13} />
                    <span>Issue Stock</span>
                  </button>

                  <button
                    onClick={() => {
                      if (setEditStockRecord && setShowEditStockModal) {
                        setEditStockRecord(s)
                        setShowEditStockModal(true)
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-bg-0 hover:bg-bg-2 border border-border text-text-0 active:bg-bg-3 text-caption rounded-lg"
                  >
                    <Eye size={14} className="text-accent" />
                    <span>Adjust / View</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
