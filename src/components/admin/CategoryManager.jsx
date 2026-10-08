import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Check, X, AlertTriangle } from 'lucide-react'
import { fetchCategories, addCategory, renameCategory, deleteCategory } from '../../lib/supabase'

export default function CategoryManager() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [newCatName, setNewCatName] = useState('')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCategories()
      setCategories(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newCatName.trim()) return
    setAdding(true)
    try {
      await addCategory(newCatName.trim())
      setNewCatName('')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(cat) {
    if (!editName.trim() || editName.trim() === cat.name) {
      setEditingId(null)
      return
    }
    setSaving(true)
    try {
      await renameCategory(cat.name, editName.trim())
      setEditingId(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this category? This will fail if any assets are currently using it.')) return
    try {
      await deleteCategory(id)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="card overflow-hidden">

      {/* Add New Category Header */}
      <div className="p-4 sm:p-5 bg-bg-2 border-b border-border">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-[12px]">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            className="inp flex-1 bg-bg-1"
            placeholder="New Category Name..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            disabled={adding}
          />
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={adding || !newCatName.trim()}>
            <Plus size={16} /> Add Category
          </button>
        </form>
      </div>

      {/* Categories List */}
      <div>
        {loading ? (
          <div className="text-center text-text-3 text-[13px] py-10">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="text-center text-text-3 text-[13px] py-10">No categories found.</div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categories.map((c) => {
                const isEditing = editingId === c.id
                return (
                  <div 
                    key={c.id} 
                    className={`group relative flex items-center p-3.5 sm:p-4 bg-bg-1 border rounded-xl transition-all duration-300 ${
                      isEditing 
                        ? 'border-accent ring-1 ring-accent/30 shadow-sm' 
                        : 'border-border hover:border-accent/40 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-0.5'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
                        <input
                          type="text"
                          className="inp flex-1 bg-bg-2 border-border/50 focus:border-accent/50 text-[14px]"
                          style={{ padding: '8px 12px', minHeight: 36 }}
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit(c)}
                          disabled={saving}
                        />
                        <button 
                          onClick={() => handleSaveEdit(c)} 
                          className="h-9 w-9 flex shrink-0 items-center justify-center rounded-lg bg-green-500/10 hover:bg-green-500/20 text-status-success transition-colors" 
                          disabled={saving}
                          title="Save"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={() => setEditingId(null)} 
                          className="h-9 w-9 flex shrink-0 items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-status-danger transition-colors" 
                          disabled={saving}
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Category Icon */}
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center text-accent shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                          <span className="font-bold text-[15px]">{c.name.charAt(0).toUpperCase()}</span>
                        </div>
                        
                        {/* Category Title */}
                        <div className="ml-3.5 pr-14 flex-1 min-w-0">
                          <h3 className="text-[14px] font-semibold text-text-0 truncate" title={c.name}>{c.name}</h3>
                        </div>
                        
                        {/* Gradient Fade for Long Text on Hover */}
                        <div className="absolute right-0 inset-y-0 w-24 bg-gradient-to-l from-bg-1 via-bg-1 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300 rounded-r-xl"></div>

                        {/* Actions Overlay */}
                        <div className="absolute right-3.5 flex items-center gap-1.5 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-10">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setEditName(c.name) }} 
                            className="p-2 rounded-lg bg-bg-2 border border-border/50 text-text-2 hover:text-accent hover:border-accent/40 hover:bg-accent/10 transition-all shadow-sm"
                            title="Edit Category"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}
                            className="p-2 rounded-lg bg-bg-2 border border-border/50 text-text-2 hover:text-status-danger hover:border-red-500/40 hover:bg-red-500/10 transition-all shadow-sm"
                            title="Delete Category"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
