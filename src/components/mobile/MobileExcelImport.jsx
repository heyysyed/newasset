import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Upload, FileSpreadsheet, XCircle, AlertTriangle,
  Download, RefreshCw, Layers, X, Trash2, PlusCircle, Loader2, CheckCircle2, Edit3, ChevronRight, Settings2
} from 'lucide-react'
import MobilePageHeader from './MobilePageHeader'

// Reusable stat pill
const StatPill = ({ label, val, colorClass, textClass }) => (
  <div className={`bg-bg-2 border border-border rounded-xl p-2.5 text-center flex-1`}>
    <div className={`text-section-title  ${colorClass}`}>{val}</div>
    <div className={`font-sans text-[10px] uppercase tracking-wider mt-1 ${textClass}`}>{label}</div>
  </div>
)

export default function MobileExcelImport({
  hasFile, fileInfo, totalRows, activeSheet, switchSheet, clearFile,
  isMapping, colInfo, userMapping, setUserMapping, excelCols, confirmMapping, DB_LABELS,
  editRows, errors, warnings, updateCell, deleteRow, addRow, autoGenerateCodes, generating,
  errCount, warnCount, readyCount, handleImport, canImport, checkingSerial, downloadTemplate,
  handleFile, manualMode, setManualMode, fileRef, ghostCount, setGhostCount,
  availableCols, addColumn, removeColumn, extraCols, allCols, availableSites
}) {
  
  const [editingRowIdx, setEditingRowIdx] = useState(null)
  const [activeTab, setActiveTab] = useState('data') // 'data', 'errors'

  // Edit Row Modal
  const renderRowEditor = () => {
    if (editingRowIdx === null) return null
    const row = editRows[editingRowIdx]
    const rowErrors = errors.filter(e => e.row === row._row)
    const rowWarns = warnings.filter(w => w.row === row._row)
    
    return (
      <div className="fixed inset-0 z-[3000] bg-black/50 flex flex-col justify-end">
        <div className="h-[90vh] flex flex-col bg-bg-1 rounded-t-3xl shadow-xl overflow-hidden">
          <div className="bg-bg-2 px-5 py-4 flex items-center justify-between border-b border-border">
            <h3 className="m-0 text-text-0 uppercase text-section-title">
              EDIT ROW {typeof row._row === 'string' ? 'NEW' : row._row}
            </h3>
            <button onClick={() => setEditingRowIdx(null)} className="p-2 text-text-3 active:text-text-0"><X size={20}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
             {/* If we have no columns mapped, fallback to Asset Code */}
            {allCols.length === 0 && (
              <div className="bg-bg-2 p-3 rounded-xl border border-border">
                 <label className="text-caption text-accent mb-1.5 block">Asset Code *</label>
                 <input type="text" className="inp bg-bg-1 w-full" value={row.asset_code || ''} onChange={e => updateCell(editingRowIdx, 'asset_code', e.target.value)} />
              </div>
            )}
            
            {allCols.map(({ db, excel }) => {
              const hasErr = rowErrors.some(e => e.field === db)
              const hasWarn = rowWarns.some(w => w.field === db)
              return (
                <div key={db} className={`p-3 rounded-xl border ${hasErr ? 'bg-danger/5 border-danger' : hasWarn ? 'bg-amber/5 border-amber' : 'bg-bg-2 border-border'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <label className={`text-caption  ${db === 'asset_code' ? 'text-accent' : 'text-text-1'}`}>
                      {excel || DB_LABELS[db]} {db === 'asset_code' ? '*' : ''}
                    </label>
                    {(hasErr || hasWarn) && (
                      <span className={`text-[10px]  ${hasErr ? 'text-danger' : 'text-amber'}`}>
                        {hasErr ? 'Error' : 'Warning'}
                      </span>
                    )}
                  </div>
                  
                  {/* Basic text input for mobile editor since CellInput requires some refactoring for mobile */}
                  <input 
                    type={['purchase_value', 'salvage_value', 'useful_life_years', 'depreciation_rate_percent'].includes(db) ? 'number' : 'text'}
                    className="inp bg-bg-1 w-full"
                    value={row[db] || ''} 
                    onChange={e => {
                      let val = e.target.value
                      if (['purchase_value', 'salvage_value', 'useful_life_years', 'depreciation_rate_percent'].includes(db)) {
                         val = val !== '' ? Number(val) : null
                      }
                      updateCell(editingRowIdx, db, val)
                    }} 
                  />
                  {hasErr && <p className="text-danger text-[11px] mt-1.5 text-body-medium">{rowErrors.find(e => e.field === db)?.msg}</p>}
                </div>
              )
            })}
          </div>
          
          <div className="p-4 bg-bg-2 border-t border-border">
             <button onClick={() => setEditingRowIdx(null)} className="btn-primary w-full py-3">Done</button>
          </div>
        </div>
      </div>
    )
  }

  // 1. Upload Step
  if (!hasFile) {
    return (
      <div className="flex flex-col min-h-screen bg-bg-1 pb-24">
        <MobilePageHeader title="Excel Import" />
        <div className="p-4 flex flex-col gap-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="rounded-[20px] border-2 border-dashed border-border p-10 text-center bg-bg-2 active:bg-bg-3 cursor-pointer transition-colors"
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }} className="hidden"/>
            <div className="w-14 h-14 rounded-2xl bg-bg-3 border-2 border-dashed border-border flex items-center justify-center mx-auto mb-3">
              <FileSpreadsheet size={24} className="text-text-3" />
            </div>
            <p className="text-body text-text-1 mb-1">
              Tap to browse file
            </p>
            <p className="text-small text-text-3 mb-4">
              .xlsx and .xls supported
            </p>
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-small">
              <Upload size={16}/> Choose File
            </span>
          </div>

          <button onClick={() => { setManualMode(true); }} className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-bg-1 border border-border text-text-1 text-small active:bg-bg-2 transition-colors">
            <PlusCircle size={18}/> Start from Scratch
          </button>
          
          <button onClick={downloadTemplate} className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl text-accent text-small active:bg-bg-2 transition-colors">
            <Download size={18}/> Download Template
          </button>
        </div>
      </div>
    )
  }

  // 2. Mapping Step
  if (isMapping) {
    return (
      <div className="flex flex-col min-h-screen bg-bg-1 pb-24">
        <MobilePageHeader title="Map Columns" showBack={true} onBack={clearFile} />
        <div className="p-4">
          <p className="text-[13px] text-text-2 mb-5 text-body-medium">Match your Excel columns to AssetPro fields.</p>
          
          <div className="flex flex-col gap-3">
            {Object.entries(DB_LABELS).map(([db, label]) => (
              <div key={db} className="bg-bg-2 border border-border rounded-xl p-3">
                <label className="block text-caption text-text-0 mb-2">
                  {label}
                </label>
                <select 
                  className="w-full bg-bg-1 border border-border text-text-0 text-[13px] rounded-lg p-2.5 outline-none focus:border-accent transition-colors"
                  value={userMapping[db] || ''}
                  onChange={e => setUserMapping(prev => ({ ...prev, [db]: e.target.value }))}
                >
                  <option value="">Select Column</option>
                  {excelCols.map((col, i) => (
                    <option key={i} value={col}>{col} (Col {i+1})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="sticky bottom-4 mt-6">
            <button onClick={confirmMapping} className="btn-primary w-full py-3.5 text-[15px] shadow-lg shadow-accent/20">
              Apply Mapping
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 3. Review Step
  return (
    <div className="flex flex-col min-h-screen bg-bg-1 pb-24">
      <MobilePageHeader title="Review Import" showBack={true} onBack={clearFile} />
      
      {/* File Info strip */}
      <div className="px-4 py-3 bg-bg-2 border-b border-border flex items-center justify-between">
         <div className="flex items-center gap-3 min-w-0">
            <FileSpreadsheet size={20} className="text-green shrink-0"/>
            <div className="min-w-0">
               <p className="text-[13px] m-0 truncate text-text-0">{fileInfo ? fileInfo.name : 'Manual Entry'}</p>
               {fileInfo?.sheets?.length > 1 && (
                  <p className="text-[11px] text-text-3 m-0 mt-0.5">Sheet: {activeSheet}</p>
               )}
            </div>
         </div>
      </div>

      <div className="p-4">
        {/* Stats */}
        <div className="flex gap-2 mb-4">
          <StatPill label="Ready" val={readyCount} colorClass="text-green" textClass="text-green" />
          <StatPill label="Errors" val={errCount} colorClass={errCount > 0 ? 'text-danger' : 'text-text-3'} textClass={errCount > 0 ? 'text-danger' : 'text-text-3'} />
          <StatPill label="Warnings" val={warnCount} colorClass={warnCount > 0 ? 'text-amber' : 'text-text-3'} textClass={warnCount > 0 ? 'text-amber' : 'text-text-3'} />
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 mb-4">
           <button onClick={addRow} className="flex-1 flex items-center justify-center gap-2 p-3 bg-bg-2 border border-border rounded-xl text-text-1 text-caption active:bg-bg-3 transition-colors">
             <PlusCircle size={16} /> Add Row
           </button>
           {editRows.some(r => !r.asset_code) && (
             <button onClick={autoGenerateCodes} disabled={generating} className="flex-1 flex items-center justify-center gap-2 p-3 bg-green/10 border border-green/30 rounded-xl text-green text-caption active:bg-green/20 transition-colors">
               {generating ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />} Auto-Code
             </button>
           )}
        </div>
        
        {/* Ghost row alert */}
        {ghostCount > 0 && (
          <div className="bg-amber/10 border border-amber/20 p-3 rounded-xl flex items-start gap-3 mb-4">
             <AlertTriangle size={18} className="text-amber shrink-0" />
             <div className="flex-1">
                <p className="text-caption text-amber mb-1 m-0">{ghostCount} empty rows skipped</p>
                <button onClick={() => setGhostCount(0)} className="text-amber/70 text-[10px] uppercase tracking-wider p-0 bg-transparent border-none">Dismiss</button>
             </div>
          </div>
        )}

        {/* Tabs for Data vs Errors */}
        <div className="flex border-b border-border mb-4">
          <button onClick={() => setActiveTab('data')} className={`flex-1 p-3 text-small  border-b-2 transition-colors ${activeTab === 'data' ? 'border-accent text-text-0' : 'border-transparent text-text-3'}`}>
             All Data ({totalRows})
          </button>
          <button onClick={() => setActiveTab('errors')} className={`flex-1 p-3 text-small  flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'errors' ? 'border-danger text-text-0' : 'border-transparent text-text-3'}`}>
             Issues {errCount + warnCount > 0 && <span className="bg-danger text-white px-2 py-0.5 rounded-full text-[10px]">{errCount + warnCount}</span>}
          </button>
        </div>

        {/* Rows List */}
        <div className="flex flex-col gap-3 pb-24">
          {editRows.map((row, idx) => {
             const rowErrors = errors.filter(e => e.row === row._row)
             const rowWarns = warnings.filter(w => w.row === row._row)
             const rowErr = rowErrors.length > 0
             const rowWarn = rowWarns.length > 0 && !rowErr
             
             if (activeTab === 'errors' && !rowErr && !rowWarn) return null

             return (
               <div key={row._row} className={`bg-bg-2 border rounded-xl overflow-hidden ${rowErr ? 'border-danger' : rowWarn ? 'border-amber' : 'border-border'}`}>
                  <div className="p-3 flex items-start justify-between gap-3">
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {rowErr ? <XCircle size={16} className="text-danger"/> : rowWarn ? <AlertTriangle size={16} className="text-amber"/> : <CheckCircle2 size={16} className="text-green" />}
                          <span className="text-[15px] text-text-0">{row.asset_code || 'No Code'}</span>
                        </div>
                        <p className="text-caption text-text-2 m-0 truncate">
                           {row.asset_name || 'Unnamed Asset'}
                        </p>
                        
                        {(rowErr || rowWarn) && (
                           <div className="mt-2 flex flex-col gap-1">
                             {rowErrors.map((e, i) => <span key={i} className="text-[11px] text-danger text-body-medium">• {e.msg}</span>)}
                             {rowWarns.map((w, i) => <span key={i} className="text-[11px] text-amber text-body-medium">• {w.msg}</span>)}
                           </div>
                        )}
                     </div>
                     <div className="flex flex-col gap-2 shrink-0">
                       <button onClick={() => setEditingRowIdx(idx)} className="p-2.5 bg-bg-3 border border-border rounded-lg text-text-1 active:bg-bg-2">
                          <Edit3 size={16} />
                       </button>
                       <button onClick={() => { if(window.confirm('Delete this row?')) deleteRow(idx) }} className="p-2.5 bg-danger/10 border border-danger/20 rounded-lg text-danger active:bg-danger/20">
                          <Trash2 size={16} />
                       </button>
                     </div>
                  </div>
               </div>
             )
          })}
          {editRows.length === 0 && <p className="text-center text-text-3 text-small py-6">No rows data.</p>}
          {activeTab === 'errors' && editRows.length > 0 && errCount === 0 && warnCount === 0 && <p className="text-center text-green text-small py-6">No issues found! 🎉</p>}
        </div>
      </div>

      {/* Sticky Import Footer */}
      <div className="fixed bottom-[72px] left-0 right-0 p-4 bg-bg-2 border-t border-border shadow-[0_-4px_16px_rgba(0,0,0,0.1)] z-10">
        {errCount > 0 && (
          <p className="text-caption text-danger text-center m-0 mb-2">Fix {errCount} errors before importing.</p>
        )}
        <button 
          onClick={handleImport} 
          disabled={!canImport} 
          className={`btn-primary w-full py-3.5 text-[15px]  shadow-lg flex items-center justify-center gap-2 ${!canImport ? 'opacity-40' : 'shadow-accent/20'}`}
        >
          {checkingSerial ? <><Loader2 size={18} className="animate-spin"/> Checking Serials...</> : <><Upload size={18}/> Import {readyCount} Assets</>}
        </button>
      </div>

      {renderRowEditor()}
    </div>
  )
}
