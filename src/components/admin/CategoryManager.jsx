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
              {categories.map((c, i) => {
                const isEditing = editingId === c.id
                return (
                  <div key={c.id} className="flex flex-col p-4 bg-bg-1 border border-border rounded-xl hover:shadow-md transition-shadow group relative">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 w-full">
                        <input
                          type="text"
                          className="inp w-full"
                          style={{ padding: '6px 10px', minHeight: 32 }}
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit(c)}
                          disabled={saving}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(c)} className="flex-1 h-9 flex items-center justify-center rounded-lg bg-green-500/10 hover:bg-green-500/20 text-status-success transition-colors" disabled={saving}>
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="flex-1 h-9 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-text-3 hover:text-status-danger transition-colors" disabled={saving}>
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                            <span className="font-semibold">{c.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="text-[14px] font-medium text-text-0 truncate" title={c.name}>{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditingId(c.id); setEditName(c.name) }} 
                            className="flex-1 py-1.5 flex justify-center items-center gap-1.5 rounded-lg text-text-2 hover:text-accent hover:bg-accent/10 transition-colors text-[12px] font-medium"
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(c.id)}
                            className="flex-1 py-1.5 flex justify-center items-center gap-1.5 rounded-lg text-text-2 hover:text-status-danger hover:bg-red-500/10 transition-colors text-[12px] font-medium"
                          >
                            <Trash2 size={13} /> Delete
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
