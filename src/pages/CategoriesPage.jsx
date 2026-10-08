import React, { useState, useEffect } from 'react'
import { Plus, Info, ChevronRight, ChevronDown, Trash2, AlertTriangle, Save, Loader2 } from 'lucide-react'
import { fetchCategories, addCategory, renameCategory, deleteCategory } from '../lib/supabase'

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [extendedProps, setExtendedProps] = useState(() => {
    try { return JSON.parse(localStorage.getItem('categoryExtendedProps') || '{}') } catch { return {} }
  })

  const [schemaFields, setSchemaFields] = useState(() => {
    try { return JSON.parse(localStorage.getItem('categorySchemaFields') || '{}') } catch { return {} }
  })

  const [selectedCat, setSelectedCat] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [formData, setFormData] = useState({})

  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

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

  useEffect(() => { localStorage.setItem('categoryExtendedProps', JSON.stringify(extendedProps)) }, [extendedProps])
  useEffect(() => { localStorage.setItem('categorySchemaFields', JSON.stringify(schemaFields)) }, [schemaFields])

  useEffect(() => {
    if (selectedCat) {
      // Find actual latest category data to ensure we have the correct name
      const freshCat = categories.find(c => c.id === selectedCat.id) || selectedCat
      const ext = extendedProps[freshCat.id] || {}
      setFormData({
        name: freshCat.name,
        code: ext.code || '',
        parent_id: ext.parent_id || '',
        schema: ext.schema || '',
        usefulLife: ext.usefulLife || '',
        serviceInterval: ext.serviceInterval || ''
      })
    } else {
      setFormData({})
    }
  }, [selectedCat, extendedProps, categories])

  const handleSave = async () => {
    if (!selectedCat) return
    setSaving(true)
    setError(null)
    try {
      if (formData.name && formData.name.trim() !== selectedCat.name) {
        await renameCategory(selectedCat.name, formData.name.trim())
        await load() // refresh categories
      }

      setExtendedProps(prev => ({
        ...prev,
        [selectedCat.id]: {
          code: formData.code,
          parent_id: formData.parent_id,
          schema: formData.schema,
          usefulLife: formData.usefulLife,
          serviceInterval: formData.serviceInterval
        }
      }))

      // Update selected cat locally so UI doesn't jump
      setSelectedCat(prev => ({...prev, name: formData.name.trim()}))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddCategory = async () => {
    const name = prompt("Enter new category name:")
    if (!name || !name.trim()) return
    try {
      setLoading(true)
      const newCat = await addCategory(name)
      await load()
      if (newCat) setSelectedCat(newCat)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  const handleAddSubcategory = async () => {
    if (!selectedCat) return
    const name = prompt(`Enter subcategory name under ${selectedCat.name}:`)
    if (!name || !name.trim()) return
    try {
      setLoading(true)
      const newCat = await addCategory(name)
      if (newCat) {
        setExtendedProps(prev => ({ ...prev, [newCat.id]: { parent_id: selectedCat.id } }))
        setExpanded(prev => ({ ...prev, [selectedCat.id]: true }))
        setSelectedCat(newCat)
      }
      await load()
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return
    try {
      setLoading(true)
      await deleteCategory(id)
      if (selectedCat?.id === id) setSelectedCat(null)
      await load()
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  const toggleExpand = (id, e) => {
    e.stopPropagation()
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAddSchemaField = () => {
    if (!selectedCat) return
    const catFields = schemaFields[selectedCat.id] || []
    setSchemaFields(prev => ({
      ...prev,
      [selectedCat.id]: [...catFields, { id: Date.now().toString(), name: 'New Field', type: 'Text', unit: '', required: 'No', inherited: selectedCat.name }]
    }))
  }

  const handleUpdateSchemaField = (fieldId, key, value) => {
    setSchemaFields(prev => {
      const catFields = prev[selectedCat.id] || []
      return {
        ...prev,
        [selectedCat.id]: catFields.map(f => f.id === fieldId ? { ...f, [key]: value } : f)
      }
    })
  }

  const handleDeleteSchemaField = (fieldId) => {
    setSchemaFields(prev => {
      const catFields = prev[selectedCat.id] || []
      return {
        ...prev,
        [selectedCat.id]: catFields.filter(f => f.id !== fieldId)
      }
    })
  }

  const buildTree = () => {
    const map = {}
    const roots = []
    categories.forEach(c => {
      const ext = extendedProps[c.id] || {}
      map[c.id] = { ...c, ...ext, children: [] }
    })
    categories.forEach(c => {
      const node = map[c.id]
      if (node.parent_id && map[node.parent_id]) {
        map[node.parent_id].children.push(node)
      } else {
        roots.push(node)
      }
    })
    return roots
  }

  const renderTree = (nodes, level = 0) => {
    return nodes.map(node => {
      const isSelected = selectedCat?.id === node.id
      const hasChildren = node.children && node.children.length > 0
      const isExpanded = expanded[node.id]

      return (
        <div key={node.id} className="select-none">
          <div
            onClick={() => setSelectedCat(node)}
            className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer text-[13px] group ${isSelected ? 'bg-[#f1f5f9] font-semibold text-slate-900' : 'text-slate-700 hover:bg-slate-50 font-medium'}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            {hasChildren ? (
              <button onClick={(e) => toggleExpand(node.id, e)} className="p-0.5 hover:bg-slate-200 rounded text-slate-400">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-4 inline-block" />
            )}
            <span className="truncate flex-1">{node.name}</span>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(node.id) }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 px-1 transition-opacity">
              <Trash2 size={12} />
            </button>
          </div>
          {hasChildren && isExpanded && (
            <div className="mt-1">
              {renderTree(node.children, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  let parentName = "None"
  if (selectedCat && formData.parent_id) {
    const p = categories.find(c => c.id === formData.parent_id)
    if (p) parentName = p.name
  }

  const currentSchemaFields = selectedCat ? (schemaFields[selectedCat.id] || []) : []

  return (
    <div className="flex flex-col pb-10 w-full max-w-[1400px] font-sans bg-[#f4f6f8] min-h-screen px-4 md:px-8">
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-[13px] flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6 mt-4">
        <div>
          <div className="text-[13px] text-[#647582] mb-2">Categories / Strongbuilt Industries</div>
          <h1 className="text-[28px] font-semibold text-[#172a38] m-0 tracking-tight">Asset categories</h1>
          <p className="text-[#647582] text-[13px] mt-1.5">
            Maintain your asset taxonomy, field schemas and lifecycle defaults.
          </p>
        </div>
        <div className="mt-2 md:mt-0 flex items-center gap-3">
          {loading && <Loader2 size={16} className="text-slate-400 animate-spin" />}
          <button onClick={handleAddCategory} className="flex items-center gap-2 px-4 py-2 bg-[#147d92] text-white rounded-md text-[13px] font-medium shadow-sm hover:bg-[#106778] transition-colors">
            <Plus size={16} /> Add category
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left Col: Tree */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col min-h-[400px]">
            <h3 className="text-[15px] font-semibold text-slate-900 mb-4">Category tree</h3>

            <div className="flex-1 overflow-y-auto mb-4 space-y-1">
              {categories.length === 0 && !loading && (
                <div className="text-[13px] text-slate-500 text-center py-10">No categories found. Click "Add category" to create one.</div>
              )}
              {renderTree(buildTree())}
            </div>

            <button onClick={handleAddSubcategory} disabled={!selectedCat} className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-slate-200 rounded-md text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus size={16} /> Add subcategory
            </button>
          </div>
        </div>

        {/* Right Col: Details */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">

          {/* Details Form */}
          {selectedCat ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-[18px] font-semibold text-slate-900">{formData.name || 'Unnamed Category'}</h2>
                  <p className="text-[13px] text-slate-500 mt-1">
                    {formData.code || 'CAT-XXXX'} · {formData.parent_id ? `Child of ${parentName}` : 'Top-level category'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mb-6">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Category name *</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#137986] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Parent category</label>
                  <select
                    value={formData.parent_id || ''}
                    onChange={e => setFormData({...formData, parent_id: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#137986] focus:border-transparent appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                  >
                    <option value="">None (Top level)</option>
                    {categories.filter(c => c.id !== selectedCat.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Category code</label>
                  <input
                    type="text"
                    value={formData.code || ''}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                    placeholder="e.g. EQ-AIR"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#137986] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Custom field schema</label>
                  <input
                    type="text"
                    value={formData.schema || ''}
                    onChange={e => setFormData({...formData, schema: e.target.value})}
                    placeholder="e.g. Equipment / Air systems"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#137986] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Useful life</label>
                  <input
                    type="text"
                    value={formData.usefulLife || ''}
                    onChange={e => setFormData({...formData, usefulLife: e.target.value})}
                    placeholder="e.g. 5 years"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#137986] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Service interval</label>
                  <input
                    type="text"
                    value={formData.serviceInterval || ''}
                    onChange={e => setFormData({...formData, serviceInterval: e.target.value})}
                    placeholder="e.g. 500 operating hours"
                    className="w-full px-3 py-2 bg-white border border-[#dfe6ea] rounded-md text-[13px] text-[#172a38] focus:outline-none focus:ring-2 focus:ring-[#147d92] focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-[#e8f4f6] border border-[#dfe6ea] rounded-md p-3.5 flex items-start gap-3 mb-6">
                <Info size={16} className="text-[#147d92] mt-0.5 shrink-0" />
                <p className="text-[13px] text-[#172a38] m-0 leading-relaxed">
                  Changing defaults affects newly created assets only. Existing asset records retain their lifecycle settings.
                </p>
              </div>

              <button disabled={saving} onClick={handleSave} className="flex items-center gap-2 px-5 py-2 bg-[#147d92] text-white rounded-md text-[13px] font-medium shadow-sm hover:bg-[#106778] transition-colors disabled:opacity-70">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save category
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#dfe6ea] shadow-sm p-6 text-center text-[#647582] text-[13px]">
              Select a category to edit its details.
            </div>
          )}

          {/* Assigned Field Schema Table */}
          {selectedCat && (
            <div className="bg-white rounded-xl border border-[#dfe6ea] shadow-sm overflow-hidden flex flex-col mt-2">
              <div className="p-5 border-b border-[#dfe6ea] flex justify-between items-center">
                <h3 className="text-[15px] font-semibold text-[#172a38]">Assigned field schema</h3>
                <button onClick={handleAddSchemaField} className="text-[13px] font-medium text-[#147d92] hover:text-[#106778] flex items-center gap-1 bg-[#147d92]/10 px-3 py-1.5 rounded-md transition-colors">
                  <Plus size={14} /> Add field
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] whitespace-nowrap">
                  <thead className="bg-[#f4f6f8] border-b border-[#dfe6ea] text-[#647582]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Field ↕</th>
                      <th className="px-5 py-3 font-medium">Data type ↕</th>
                      <th className="px-5 py-3 font-medium">Unit ↕</th>
                      <th className="px-5 py-3 font-medium">Required ↕</th>
                      <th className="px-5 py-3 font-medium">Inherited from ↕</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dfe6ea]">
                    {currentSchemaFields.length === 0 && (
                      <tr><td colSpan="6" className="px-5 py-8 text-center text-[#9eb1bc]">No schema fields assigned. Click "Add field" to create one.</td></tr>
                    )}
                    {currentSchemaFields.map(f => (
                      <tr key={f.id} className="hover:bg-[#f4f6f8] group">
                        <td className="px-3 py-2">
                          <input type="text" value={f.name} onChange={e => handleUpdateSchemaField(f.id, 'name', e.target.value)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-[#dfe6ea] focus:border-[#147d92] focus:bg-white rounded focus:outline-none focus:ring-1 focus:ring-[#147d92]" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={f.type} onChange={e => handleUpdateSchemaField(f.id, 'type', e.target.value)} className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-[#dfe6ea] focus:border-[#147d92] focus:bg-white rounded focus:outline-none appearance-none">
                            <option>Number</option><option>Text</option><option>Dropdown</option><option>Date</option><option>Boolean</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={f.unit} onChange={e => handleUpdateSchemaField(f.id, 'unit', e.target.value)} placeholder="-" className="w-16 px-2 py-1.5 bg-transparent border border-transparent hover:border-[#dfe6ea] focus:border-[#147d92] focus:bg-white rounded focus:outline-none focus:ring-1 focus:ring-[#147d92]" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={f.required} onChange={e => handleUpdateSchemaField(f.id, 'required', e.target.value)} className="w-20 px-2 py-1.5 bg-transparent border border-transparent hover:border-[#dfe6ea] focus:border-[#147d92] focus:bg-white rounded focus:outline-none appearance-none">
                            <option>Yes</option><option>No</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">{f.inherited}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => handleDeleteSchemaField(f.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3.5 border-t border-slate-100 flex justify-between items-center text-[13px] text-slate-500 bg-white">
                <div>Showing {currentSchemaFields.length > 0 ? 1 : 0}–{currentSchemaFields.length} of {currentSchemaFields.length} records</div>
                <span>All records loaded</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
