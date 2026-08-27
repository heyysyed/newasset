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
    <div className="pt-2">

      <div>
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-[12px]">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            type="text"
            className="inp flex-1"
            placeholder="New Category Name..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            disabled={adding}
          />
          <button type="submit" className="btn-primary" disabled={adding || !newCatName.trim()}>
            <Plus size={14} /> Add
          </button>
        </form>

        {loading ? (
          <div className="text-center text-text-3 text-[12px] py-8">Loading categories...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map(c => {
              const isEditing = editingId === c.id
              return (
                <div key={c.id} className="p-3 bg-bg-1 border border-border rounded-lg flex items-center justify-between group">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        className="inp w-full"
                        style={{ padding: '4px 8px', minHeight: 28 }}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleSaveEdit(c)}
                        disabled={saving}
                      />
                      <button onClick={() => handleSaveEdit(c)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-green-500/10 transition-colors" disabled={saving}>
                        <Check size={16} className="text-status-success" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/10 transition-colors" disabled={saving}>
                        <X size={16} className="text-text-3 hover:text-status-danger" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-[13px] font-medium text-text-1">{c.name}</span>
                      <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditingId(c.id); setEditName(c.name) }} 
                          className="w-8 h-8 flex items-center justify-center rounded text-text-2 hover:text-accent hover:bg-accent/10 transition-colors"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDelete(c.id)}
                          className="w-8 h-8 flex items-center justify-center rounded text-text-2 hover:text-status-danger hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
