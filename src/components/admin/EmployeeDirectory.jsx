import React, { useState, useMemo } from 'react'
import {
  Users, Search, List, LayoutGrid, Plus, UserPlus, UserCircle2, Edit2, Trash2,
  X, Check, AlertCircle, FileSpreadsheet, Upload, CheckCircle2, RefreshCw, Briefcase, Phone, Mail, Award
} from 'lucide-react'
import { createEmployee, updateEmployee, deleteEmployee, bulkCreateEmployees } from '../../lib/supabase'
import * as XLSX from 'xlsx'

const DEPARTMENTS = ['Civil', 'Mechanical', 'Electrical', 'Safety', 'Administration', 'Procurement', 'Finance', 'HR', 'Other']

function SectionHead({ icon: Icon, title, sub, color = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} style={{ color }}/>
      </div>
      <div>
        <h2 style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.06em', color: 'var(--text-0)', margin: 0 }}>{title}</h2>
        {sub && <p style={{ fontFamily: 'DM Sans', fontSize: '0.73rem', color: 'var(--text-3)', margin: 0, marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  )
}

export default function EmployeeDirectory({ employees, onRefresh }) {
  const [search, setSearch] = useState('')
  const [view, setView] = useState('list') // 'list' | 'grid'
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'

  // Modals state
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // Forms state
  const [form, setForm] = useState({ employee_code: '', full_name: '', email: '', phone: '', department: '', designation: '', is_active: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Excel Import state
  const [excelFile, setExcelFile] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [importOverwrite, setImportOverwrite] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSuccessMsg, setImportSuccessMsg] = useState('')

  // Excel Import Template Download helper
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Code": "EMP-101",
        "Full Name": "John Doe",
        "Designation": "Project Engineer",
        "Department": "Mechanical",
        "Email": "johndoe@company.com",
        "Phone": "+971501234567"
      }
    ]
    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Employee Template")
    XLSX.writeFile(wb, "employee_import_template.xlsx")
  }

  // Filter & Search
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = !search ||
        e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
        e.email?.toLowerCase().includes(search.toLowerCase()) ||
        e.department?.toLowerCase().includes(search.toLowerCase()) ||
        e.designation?.toLowerCase().includes(search.toLowerCase())
      
      const matchDept = deptFilter === 'all' || e.department === deptFilter
      
      const matchStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && e.is_active) || 
        (statusFilter === 'inactive' && !e.is_active)

      return matchSearch && matchDept && matchStatus
    })
  }, [employees, search, deptFilter, statusFilter])

  // Reset form helper
  const resetForm = (defaults = {}) => {
    setForm({
      employee_code: defaults.employee_code || '',
      full_name: defaults.full_name || '',
      email: defaults.email || '',
      phone: defaults.phone || '',
      department: defaults.department || '',
      designation: defaults.designation || '',
      is_active: defaults.is_active ?? true
    })
    setError('')
  }

  // Generate unique employee code
  const handleAutoGenerateCode = () => {
    const rand = Math.floor(1000 + Math.random() * 9000)
    setForm(f => ({ ...f, employee_code: `EMP-${rand}` }))
  }

  // Handle Create / Update Submit
  const handleFormSubmit = async (evt) => {
    evt.preventDefault()
    if (!form.employee_code || !form.full_name) {
      setError('Employee Code and Full Name are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, form)
        setEditingEmployee(null)
      } else {
        await createEmployee(form)
        setIsAdding(false)
      }
      onRefresh()
    } catch (err) {
      setError(err.message || 'Failed to save employee.')
    } finally {
      setSaving(false)
    }
  }

  // Handle Toggle Active
  const handleToggleActive = async (employee) => {
    try {
      await updateEmployee(employee.id, { is_active: !employee.is_active })
      onRefresh()
    } catch (err) {
      alert('Failed to change status: ' + err.message)
    }
  }

  // Handle Delete
  const handleDeleteEmployee = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete employee ${name}?`)) return
    try {
      await deleteEmployee(id)
      onRefresh()
    } catch (err) {
      alert('Failed to delete employee: ' + err.message)
    }
  }

  // Excel File upload parsing
  const handleExcelUpload = (evt) => {
    const file = evt.target.files[0]
    if (!file) return
    setExcelFile(file)
    setError('')
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rawJson = XLSX.utils.sheet_to_json(sheet)
        
        // Map raw headers to standard DB columns
        const mapped = rawJson.map((row, idx) => {
          const keys = Object.keys(row)
          const findVal = (keywords) => {
            const matchedKey = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)))
            return matchedKey ? String(row[matchedKey]).trim() : ''
          }

          return {
            employee_code: findVal(['code', 'emp_id', 'id']) || `EMP-XL-${1000 + idx}`,
            full_name: findVal(['name', 'full_name', 'employee']) || '',
            email: findVal(['email', 'mail']) || null,
            phone: findVal(['phone', 'contact', 'mobile', 'cell']) || null,
            department: findVal(['dept', 'department']) || 'Other',
            designation: findVal(['desig', 'designation', 'role', 'title']) || '',
            is_active: true
          }
        }).filter(item => item.full_name) // Skip rows without name

        setParsedRows(mapped)
      } catch (err) {
        setError('Error reading Excel file. Make sure it is a valid layout.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Submit Excel Import
  const handleConfirmImport = async () => {
    if (!parsedRows.length) return
    setImporting(true)
    setError('')
    try {
      const result = await bulkCreateEmployees(parsedRows, importOverwrite)
      setImportSuccessMsg(`Successfully imported ${result.length} employees!`)
      onRefresh()
      setTimeout(() => {
        setIsImporting(false)
        setExcelFile(null)
        setParsedRows([])
        setImportSuccessMsg('')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Import failed. Check for duplicate codes.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: 'var(--clay-shadow)' }}>
      <SectionHead icon={Users} title="EMPLOYEE DIRECTORY" sub="Manage registered employees & track asset assignments" color="var(--accent)"/>

      {/* Control bar */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Row 1: Search + View + Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees by name, code, department..."
              className="inp" style={{ paddingLeft: 32, fontSize: '0.82rem' }}/>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-3)', padding: 3, borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={() => setView('list')} style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              background: view === 'list' ? 'var(--bg-2)' : 'transparent',
              color: view === 'list' ? 'var(--text-0)' : 'var(--text-3)',
              boxShadow: view === 'list' ? 'var(--clay-shadow-sm)' : 'none',
              fontFamily: 'DM Sans', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.2s',
            }}>
              <List size={13}/> List
            </button>
            <button onClick={() => setView('grid')} style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              background: view === 'grid' ? 'var(--bg-2)' : 'transparent',
              color: view === 'grid' ? 'var(--text-0)' : 'var(--text-3)',
              boxShadow: view === 'grid' ? 'var(--clay-shadow-sm)' : 'none',
              fontFamily: 'DM Sans', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.2s',
            }}>
              <LayoutGrid size={13}/> Grid
            </button>
            <button onClick={() => setView('orgchart')} style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              background: view === 'orgchart' ? 'var(--bg-2)' : 'transparent',
              color: view === 'orgchart' ? 'var(--text-0)' : 'var(--text-3)',
              boxShadow: view === 'orgchart' ? 'var(--clay-shadow-sm)' : 'none',
              fontFamily: 'DM Sans', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.2s',
            }}>
              <Award size={13}/> Org-Chart Tree
            </button>
          </div>

          <button onClick={() => { resetForm(); setIsAdding(true) }} className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.75rem', gap: 5, flexShrink: 0 }}>
            <UserPlus size={13}/> Add Employee
          </button>
          <button onClick={() => { setIsImporting(true); setError(''); setExcelFile(null); setParsedRows([]) }} className="btn-ghost" style={{ padding: '8px 14px', fontSize: '0.75rem', gap: 5, flexShrink: 0, border: '1px solid var(--border)' }}>
            <FileSpreadsheet size={13}/> Import Excel
          </button>
        </div>

        {/* Row 2: Filter pills */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.72rem' }}>
          {/* Department Filter */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Department:</span>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="sel" style={{ padding: '3px 8px', minHeight: 26, fontSize: '0.72rem' }}>
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Status:</span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="sel" style={{ padding: '3px 8px', minHeight: 26, fontSize: '0.72rem' }}>
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontWeight: 500 }}>
            Showing {filteredEmployees.length} of {employees.length} employees
          </span>
        </div>
      </div>

      {/* Directory Content */}
      {filteredEmployees.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <Briefcase size={32} style={{ color: 'var(--text-3)', marginBottom: 12, opacity: 0.5 }}/>
          <p style={{ color: 'var(--text-2)', fontFamily: 'DM Sans', fontWeight: 600 }}>No employees found matching criteria</p>
        </div>
      ) : view === 'orgchart' ? (
        /* ORG CHART TREE VIEW */
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {DEPARTMENTS.map(dept => {
            const deptEmps = filteredEmployees.filter(e => (e.department || 'Other') === dept)
            if (deptEmps.length === 0) return null
            return (
              <div key={dept} style={{ padding: 16, borderRadius: 14, background: 'var(--bg-1)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <Award size={16} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ fontFamily: 'Oswald', fontSize: '0.95rem', margin: 0, color: 'var(--text-0)' }}>
                    DEPARTMENT: {dept.toUpperCase()} ({deptEmps.length} STAFF)
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {deptEmps.map(emp => (
                    <div key={emp.id} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid var(--accent)30', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {emp.full_name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-0)', fontFamily: 'DM Sans' }}>{emp.full_name}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontFamily: 'DM Sans' }}>{emp.designation || 'Staff'} • {emp.employee_code}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : view === 'grid' ? (
        /* GRID VIEW */
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {filteredEmployees.map(emp => (
            <div key={emp.id} style={{
              background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 16,
              padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 0.2s',
              boxShadow: 'var(--clay-shadow-sm)', opacity: emp.is_active ? 1 : 0.65
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {/* Header: Avatar / Name / Designation */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--bg-3)', border: '1.5px solid var(--border)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'Oswald', fontSize: '1.1rem' }}>
                  {emp.full_name[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: 'DM Sans', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={emp.full_name}>
                    {emp.full_name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Award size={10} style={{ flexShrink: 0 }}/>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.designation || 'No title'}</span>
                  </div>
                </div>
              </div>

              {/* Specs Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', fontSize: '0.72rem', color: 'var(--text-2)', background: 'var(--bg-3)', padding: '6px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>Code:</span>
                  <span style={{ fontFamily: 'DM Mono', fontWeight: 600 }}>{emp.employee_code}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>Dept:</span>
                  <span style={{ fontWeight: 600 }}>{emp.department}</span>
                </div>
                {emp.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Mail size={10} style={{ color: 'var(--text-3)' }}/>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.email}</span>
                  </div>
                )}
                {emp.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={10} style={{ color: 'var(--text-3)' }}/>
                    <span>{emp.phone}</span>
                  </div>
                )}
              </div>

              {/* Status Pill */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: emp.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: emp.is_active ? 'var(--green)' : 'var(--red)' }}>
                  {emp.is_active ? '● Active' : '○ Inactive'}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => { resetForm(emp); setEditingEmployee(emp) }} className="btn-ghost" style={{ padding: 4 }} title="Edit Employee">
                    <Edit2 size={12} style={{ color: 'var(--text-2)' }}/>
                  </button>
                  <button onClick={() => handleToggleActive(emp)} className="btn-ghost" style={{ padding: 4 }} title={emp.is_active ? 'Deactivate' : 'Activate'}>
                    {emp.is_active ? <X size={12} style={{ color: 'var(--red)' }}/> : <Check size={12} style={{ color: 'var(--green)' }}/>}
                  </button>
                  <button onClick={() => handleDeleteEmployee(emp.id, emp.full_name)} className="btn-ghost" style={{ padding: 4 }} title="Delete Employee">
                    <Trash2 size={12} style={{ color: 'var(--red)' }}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW (Responsive Single-Row Layout with Table Header) */
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 680 }}>
            {/* Table Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '8px 18px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)',
              fontSize: '0.66rem', fontFamily: 'Oswald', fontWeight: 700, color: 'var(--text-3)',
              letterSpacing: '0.08em', textTransform: 'uppercase'
            }}>
              <span style={{ minWidth: 180, flex: '1 1 180px' }}>EMPLOYEE PERSONNEL</span>
              <span style={{ flexShrink: 0 }}>DEPARTMENT & CONTACT DETAILS</span>
              <span style={{ flexShrink: 0 }}>ACTIONS</span>
            </div>

            {filteredEmployees.map((emp, i) => (
              <div key={emp.id} style={{
                padding: '12px 18px', borderBottom: i < filteredEmployees.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, transition: 'background 0.12s',
                background: 'transparent', opacity: emp.is_active ? 1 : 0.65
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Left Column: Avatar + Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 180px', minWidth: 180 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'Oswald', fontSize: '0.95rem', flexShrink: 0 }}>
                    {emp.full_name[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'DM Sans', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.full_name}
                    </div>
                    <div style={{ fontSize: '0.71rem', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Code: <strong style={{ fontFamily: 'DM Mono', color: 'var(--text-1)' }}>{emp.employee_code}</strong> · {emp.designation || 'Staff'}
                    </div>
                  </div>
                </div>

                {/* Middle Column: Specs Pills */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>🏢 {emp.department}</span>
                  {emp.phone && <span style={{ fontSize: '0.62rem', fontWeight: 500, padding: '2px 7px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>📞 {emp.phone}</span>}
                  {emp.email && <span style={{ fontSize: '0.62rem', fontWeight: 500, padding: '2px 7px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>✉️ {emp.email}</span>}
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: emp.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: emp.is_active ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                    {emp.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Right Column: Actions */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={() => { resetForm(emp); setEditingEmployee(emp) }} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.71rem', gap: 3, height: 30, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    <Edit2 size={11}/> Edit
                  </button>
                  <button onClick={() => handleToggleActive(emp)} className="btn-ghost"
                    style={{
                      padding: '4px 8px', fontSize: '0.71rem', gap: 3, height: 30, borderRadius: 8, border: '1px solid', whiteSpace: 'nowrap',
                      background: emp.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                      color: emp.is_active ? 'var(--red)' : 'var(--green)',
                      borderColor: emp.is_active ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)',
                    }}>
                    {emp.is_active ? <><X size={11}/> Deactivate</> : <><Check size={11}/> Activate</>}
                  </button>
                  <button onClick={() => handleDeleteEmployee(emp.id, emp.full_name)} className="btn-ghost" style={{ padding: '4px 7px', height: 30, borderRadius: 8, color: 'var(--red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }} title="Delete Employee">
                    <Trash2 size={11}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {(isAdding || editingEmployee) && (
        <div className="modal-bg" style={{ zIndex: 2200 }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            {/* Header */}
            <div className="card-header" style={{ background: 'var(--bg-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 7, background: 'rgba(59,130,246,0.12)', borderRadius: 9, color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-0)', margin: 0 }}>
                    {editingEmployee ? 'EDIT EMPLOYEE' : 'ADD NEW EMPLOYEE'}
                  </h3>
                  <p style={{ fontFamily: 'DM Sans', fontSize: '0.72rem', color: 'var(--text-3)', margin: 0 }}>
                    {editingEmployee ? 'Modify employee profile details' : 'Register a new employee without login account'}
                  </p>
                </div>
              </div>
              <button onClick={() => { setIsAdding(false); setEditingEmployee(null) }} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && (
                <div className="login-alert login-alert-error" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--red-dim)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, color: 'var(--red)' }}>
                  <AlertCircle size={13} style={{ flexShrink: 0 }}/>
                  <span style={{ fontSize: '0.78rem', fontFamily: 'DM Sans' }}>{error}</span>
                </div>
              )}

              {/* Employee Code */}
              <div>
                <label className="lbl">Employee Code *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="inp" value={form.employee_code} onChange={e => setForm({ ...form, employee_code: e.target.value })} placeholder="e.g. EMP-001" required style={{ fontFamily: 'DM Mono', fontSize: '0.82rem' }}/>
                  {!editingEmployee && (
                    <button type="button" onClick={handleAutoGenerateCode} className="btn-ghost" style={{ fontSize: '0.72rem', padding: '0 10px', height: 38, flexShrink: 0 }}>
                      Auto-Gen
                    </button>
                  )}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="lbl">Full Name *</label>
                <input className="inp" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Employee's full name" required />
              </div>

              {/* Designation */}
              <div>
                <label className="lbl">Designation</label>
                <input className="inp" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Project Manager, Mechanical Engineer" />
              </div>

              {/* Department */}
              <div>
                <label className="lbl">Department</label>
                <select className="sel" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                  <option value="">Select Department...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Contact Email */}
              <div>
                <label className="lbl">Email Address</label>
                <input className="inp" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@company.com" />
              </div>

              {/* Contact Phone */}
              <div>
                <label className="lbl">Phone / Contact No</label>
                <input className="inp" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Contact phone number" />
              </div>

              {/* Active Toggles */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input type="checkbox" id="emp_is_active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ cursor: 'pointer', width: 15, height: 15 }} />
                <label htmlFor="emp_is_active" className="lbl" style={{ margin: 0, cursor: 'pointer' }}>Active Employee Status</label>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <button type="button" onClick={() => { setIsAdding(false); setEditingEmployee(null) }} className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.82rem', gap: 6 }}>
                  {saving ? <><RefreshCw size={13} className="spin"/> Saving...</> : editingEmployee ? 'Update' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Excel Import Modal ── */}
      {isImporting && (
        <div className="modal-bg" style={{ zIndex: 2200 }}>
          <div className="modal" style={{ maxWidth: 640, width: '90vw' }}>
            {/* Header */}
            <div className="card-header" style={{ background: 'var(--bg-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ padding: 7, background: 'rgba(34,197,94,0.12)', borderRadius: 9, color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <FileSpreadsheet size={16} />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'Oswald', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-0)', margin: 0 }}>IMPORT EMPLOYEES</h3>
                  <p style={{ fontFamily: 'DM Sans', fontSize: '0.72rem', color: 'var(--text-3)', margin: 0 }}>Upload employee spreadsheet (.xlsx, .xls) to bulk register</p>
                </div>
              </div>
              <button onClick={() => { setIsImporting(false); setExcelFile(null); setParsedRows([]) }} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
            </div>

            {/* Body */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && (
                <div className="login-alert login-alert-error" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--red)' }}>
                  <AlertCircle size={13} style={{ flexShrink: 0 }}/>
                  <span style={{ fontSize: '0.78rem', fontFamily: 'DM Sans' }}>{error}</span>
                </div>
              )}
              {importSuccessMsg && (
                <div className="login-alert login-alert-success" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, color: 'var(--green)' }}>
                  <CheckCircle2 size={13} style={{ flexShrink: 0 }}/>
                  <span style={{ fontSize: '0.78rem', fontFamily: 'DM Sans', fontWeight: 600 }}>{importSuccessMsg}</span>
                </div>
              )}

              {/* Upload drop zone */}
              <div style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '24px 16px', background: 'var(--bg-1)', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                <Upload size={28} style={{ color: 'var(--text-3)', marginBottom: 8, margin: '0 auto' }}/>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-1)', margin: '4px 0' }}>
                  {excelFile ? excelFile.name : 'Select or drag employee Excel file'}
                </p>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-3)', margin: 0 }}>Supports .xlsx & .xls files. Column mapping is automatic.</p>
                <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              </div>

              {/* Template Download Link */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: 4, padding: '0 4px' }}>
                <span style={{ color: 'var(--text-3)', fontFamily: 'DM Sans' }}>Need a template spreadsheet?</span>
                <button type="button" onClick={handleDownloadTemplate} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', border: 'none', background: 'none', cursor: 'pointer' }}>
                  <FileSpreadsheet size={12} /> Download Template
                </button>
              </div>

              {/* Preview parsed rows */}
              {parsedRows.length > 0 && (
                <div>
                  <h4 style={{ fontFamily: 'Oswald', fontSize: '0.78rem', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Parsed Employee Preview ({parsedRows.length} records)
                  </h4>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table className="tbl" style={{ fontSize: '0.75rem', minWidth: '100%' }}>
                      <thead style={{ background: 'var(--bg-3)', position: 'sticky', top: 0 }}>
                        <tr>
                          <th>Code</th>
                          <th>Full Name</th>
                          <th>Designation</th>
                          <th>Department</th>
                          <th>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ fontFamily: 'DM Mono' }}>{row.employee_code}</td>
                            <td style={{ fontWeight: 600 }}>{row.full_name}</td>
                            <td>{row.designation}</td>
                            <td>{row.department}</td>
                            <td>{row.phone || row.email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Overwrite Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <input type="checkbox" id="overwrite_dup_codes" checked={importOverwrite} onChange={e => setImportOverwrite(e.target.checked)} style={{ cursor: 'pointer', width: 14, height: 14 }} />
                    <label htmlFor="overwrite_dup_codes" className="lbl" style={{ margin: 0, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-2)' }}>
                      Overwrite existing employee codes (Update details instead of throwing error)
                    </label>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <button type="button" onClick={() => { setIsImporting(false); setExcelFile(null); setParsedRows([]) }} className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>Cancel</button>
                <button type="button" onClick={handleConfirmImport} disabled={!parsedRows.length || importing} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.82rem', gap: 6, background: parsedRows.length ? undefined : 'var(--bg-4)', cursor: parsedRows.length ? 'pointer' : 'not-allowed' }}>
                  {importing ? <><RefreshCw size={13} className="spin"/> Importing...</> : <><Check size={13}/> Confirm Import</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
