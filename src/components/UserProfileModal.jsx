import React, { useState, useEffect, useMemo } from 'react'
import {
  X, Camera, RotateCcw, Save, CheckCircle2, UserCircle2, Upload,
  AlertCircle, Loader, ChevronDown, ChevronUp, Plus, Trash2, MapPin
} from 'lucide-react'
import { supabase, updateProfile, fetchSites } from '../lib/supabase'
import { validatePersonPhoto, validateSignatureImage } from '../lib/imageValidation'

// Country, State, City lists for interactive fields
const COUNTRIES = ['India', 'United Arab Emirates', 'Oman', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Andorra']

const STATES_BY_COUNTRY = {
  'India': ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Uttar Pradesh'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'],
  'Oman': ['Muscat', 'Dhofar', 'Ad Dakhiliyah'],
}

const CITIES_BY_STATE = {
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
  'Delhi': ['New Delhi', 'Noida', 'Gurgaon'],
  'Karnataka': ['Bengaluru', 'Mysore', 'Mangalore'],
  'Dubai': ['Dubai City', 'Jebel Ali', 'Deira'],
  'Abu Dhabi': ['Abu Dhabi City', 'Al Ain'],
  'Muscat': ['Muscat', 'Seeb'],
}

const ROLES = [
  { key: 'super_admin', label: 'Super Administrator' },
  { key: 'admin', label: 'Administrator' },
  { key: 'moderator', label: 'Moderator / Checker' },
  { key: 'user', label: 'Standard User' }
]

const DEPARTMENTS = ['Civil', 'Mechanical', 'Electrical', 'Safety', 'Administration', 'Procurement']
const USER_GROUPS = ['GRP001 - Administrators', 'GRP002 - Staff / Technicians', 'GRP003 - Subcontractors']
const ESTABLISHMENT_TYPES = ['Permanent', 'Contractual', 'Temporary']
const COMPANIES = ['Skyway Group', 'L&T Construction', 'Shapoorji Pallonji', 'Strong Built Eng.']

function Toggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: 42, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
      transition: 'background 0.2s', position: 'relative', flexShrink: 0,
      background: on ? 'var(--accent)' : 'var(--bg-4)',
      boxShadow: on ? '0 0 8px var(--accent)40' : 'none',
    }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', position: 'absolute', top: 4, left: on ? 24 : 4, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
    </button>
  )
}

// Header Title component
function AccordionHeader({ id, title, sub, isCollapsed, onToggle }) {
  return (
    <div
      onClick={() => onToggle(id)}
      className="profile-section-header"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', background: 'var(--bg-3)', border: '1px solid var(--border)',
        borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none'
      }}
    >
      <div>
        <h4 style={{ letterSpacing: '0.05em', color: '#3b82f6', margin: 0, textTransform: 'uppercase' }}>
          {title}
        </h4>
        <span style={{ color: 'var(--text-3)', display: 'block', marginTop: 2 }}>{sub}</span>
      </div>
      {isCollapsed ? <ChevronDown size={16} style={{ color: 'var(--text-3)' }} /> : <ChevronUp size={16} style={{ color: 'var(--text-3)' }} />}
    </div>
  )
}

export default function UserProfileModal({ user, onClose, onSaved }) {
  const databaseColumns = useMemo(() => Object.keys(user), [user])

  // Load fallback metadata from localStorage if not present on profile row
  const fallbackMetadata = useMemo(() => {
    try {
      const data = localStorage.getItem(`profile_metadata_${user.id}`)
      console.log(`[UserProfileModal] Loaded fallbackMetadata for ${user.id}:`, data)
      return JSON.parse(data || '{}')
    } catch (e) {
      console.error('[UserProfileModal] Error loading fallbackMetadata:', e)
      return {}
    }
  }, [user.id])

  const meta = useMemo(() => {
    let dbDetails = {}
    let dbMeta = {}
    if (user.details) {
      if (typeof user.details === 'string') {
        try { dbDetails = JSON.parse(user.details) } catch {}
      } else { dbDetails = user.details }
    }
    if (user.metadata) {
      if (typeof user.metadata === 'string') {
        try { dbMeta = JSON.parse(user.metadata) } catch {}
      } else { dbMeta = user.metadata }
    }
    const merged = {
      ...fallbackMetadata,
      ...dbDetails,
      ...dbMeta
    }
    console.log(`[UserProfileModal] Merged meta for ${user.id}:`, merged)
    return merged
  }, [user.details, user.metadata, fallbackMetadata, user.id])

  // 1. Personal Information State
  const [ownCompany, setOwnCompany] = useState(user.own_company ?? meta.own_company ?? true)
  const [subContractorCompany, setSubContractorCompany] = useState(user.sub_contractor_company ?? meta.sub_contractor_company ?? '')
  const [userCode, setUserCode] = useState(user.user_code ?? meta.user_code ?? '')
  const [role, setRole] = useState(user.role ?? 'user')
  const [firstName, setFirstName] = useState(user.first_name ?? meta.first_name ?? (user.full_name ? user.full_name.split(' ')[0] : ''))
  const [lastName, setLastName] = useState(user.last_name ?? meta.last_name ?? (user.full_name ? user.full_name.split(' ').slice(1).join(' ') : ''))
  const [rfid, setRfid] = useState(user.rfid ?? meta.rfid ?? '')
  const [isActive, setIsActive] = useState(user.is_active ?? true)

  // 2. Login Information State
  const [email, setEmail] = useState(user.email ?? '')

  // 3. Contact Information State
  const [address1, setAddress1] = useState(user.address_1 ?? meta.address_1 ?? '')
  const [address2, setAddress2] = useState(user.address_2 ?? meta.address_2 ?? '')
  const [zipcode, setZipcode] = useState(user.zipcode ?? meta.zipcode ?? '')
  const [country, setCountry] = useState(user.country ?? meta.country ?? '')
  const [phoneCode, setPhoneCode] = useState(user.phone_code ?? meta.phone_code ?? 'AD (+376)')
  const [phoneNo, setPhoneNo] = useState(user.phone ?? user.phone_no ?? meta.phone_no ?? '')
  const [whatsappCode, setWhatsappCode] = useState(user.whatsapp_code ?? meta.whatsapp_code ?? 'AD (+376)')
  const [whatsappNo, setWhatsappNo] = useState(user.whatsapp_no ?? meta.whatsapp_no ?? '')
  const [state, setState] = useState(user.state ?? meta.state ?? '')
  const [city, setCity] = useState(user.city ?? meta.city ?? '')

  // 4. Timezone State
  const [timezone, setTimezone] = useState(user.timezone ?? meta.timezone ?? '(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi')

  // 5. Other Settings State
  const [type, setType] = useState(user.type ?? meta.type ?? '')
  const [hourlyRate, setHourlyRate] = useState(user.hourly_rate ?? meta.hourly_rate ?? '')
  const [department, setDepartment] = useState(user.department ?? meta.department ?? '')
  const [userGroup, setUserGroup] = useState(user.user_group ?? meta.user_group ?? '')
  const [establishmentType, setEstablishmentType] = useState(user.establishment_type ?? meta.establishment_type ?? '')
  const [locations, setLocations] = useState(user.locations ?? meta.locations ?? [])
  const [includeChildLocation, setIncludeChildLocation] = useState(user.include_child_location ?? meta.include_child_location ?? false)
  const [currency, setCurrency] = useState(user.currency ?? meta.currency ?? 'INR')
  const [reportingManager, setReportingManager] = useState(user.reporting_manager ?? meta.reporting_manager ?? '')
  const [allowRescheduling, setAllowRescheduling] = useState(user.allow_rescheduling ?? meta.allow_rescheduling ?? false)

  // 6. Files & Signature State
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(user.photo_url || null)
  const [photoError, setPhotoError] = useState('')
  const [photoChecking, setPhotoChecking] = useState(false)

  const [sigFile, setSigFile] = useState(null)
  const [sigPreview, setSigPreview] = useState(user.signature_url || null)
  const [sigError, setSigError] = useState('')
  const [sigChecking, setSigChecking] = useState(false)

  const [otherFile, setOtherFile] = useState(null)
  const [otherFileName, setOtherFileName] = useState(meta.document_name || null)

  // 7. Notification Settings State
  const [notifyAssignment, setNotifyAssignment] = useState(user.notify_assignment ?? meta.notify_assignment ?? false)
  const [notifyStatusChange, setNotifyStatusChange] = useState(user.notify_status_change ?? meta.notify_status_change ?? false)
  const [notifyCompletion, setNotifyCompletion] = useState(user.notify_completion ?? meta.notify_completion ?? false)
  const [notifyTaskCompleted, setNotifyTaskCompleted] = useState(user.notify_task_completed ?? meta.notify_task_completed ?? false)
  const [notifyOnlineOffline, setNotifyOnlineOffline] = useState(user.notify_online_offline ?? meta.notify_online_offline ?? false)

  // General UI States
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [allSites, setAllSites] = useState([])
  const [selectedSiteToAdd, setSelectedSiteToAdd] = useState('')

  const modalRef = React.useRef(null)
  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus()
    }
  }, [])

  // Collapsible Accordion sections state
  const [collapsed, setCollapsed] = useState({
    personal: false,
    login: false,
    contact: false,
    timezone: false,
    other: false,
    files: false,
    notifications: false
  })

  const toggleSection = (section) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Fetch Sites for multi-select location tagging
  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSites()
        setAllSites(data || [])
      } catch (e) {
        console.error('Failed to load sites', e)
      }
    }
    load()
  }, [])

  // Auto-fill state and city options based on country
  const states = useMemo(() => STATES_BY_COUNTRY[country] || [], [country])
  const cities = useMemo(() => CITIES_BY_STATE[state] || [], [state])

  // Reset dependent fields when parent fields change
  useEffect(() => {
    if (country && !STATES_BY_COUNTRY[country]?.includes(state)) {
      setState('')
      setCity('')
    }
  }, [country])

  useEffect(() => {
    if (state && !CITIES_BY_STATE[state]?.includes(city)) {
      setCity('')
    }
  }, [state])

  // RFID Generator
  function handleGenerateRfid() {
    const hex = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('')
    setRfid(`RFID-${hex}`)
  }

  // File Handlers
  async function handlePhotoFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoError('')
    setPhotoChecking(true)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
    try {
      await validatePersonPhoto(file)
      setPhotoFile(file)
    } catch (err) {
      setPhotoError(err.message)
      setPhotoFile(null)
      setPhotoPreview(user.photo_url || null)
    } finally {
      setPhotoChecking(false)
    }
  }

  async function handleSigFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setSigError('')
    setSigChecking(true)
    const reader = new FileReader()
    reader.onload = ev => setSigPreview(ev.target.result)
    reader.readAsDataURL(file)
    try {
      await validateSignatureImage(file)
      setSigFile(file)
    } catch (err) {
      setSigError(err.message)
      setSigFile(null)
      setSigPreview(user.signature_url || null)
    } finally {
      setSigChecking(false)
    }
  }

  function handleOtherFile(e) {
    const file = e.target.files[0]
    if (file) {
      setOtherFile(file)
      setOtherFileName(file.name)
    }
  }

  // Location selector helper
  const availableSites = allSites.filter(s => !locations.includes(s.name))

  function handleAddLocation() {
    if (selectedSiteToAdd === 'all') {
      const remainingNames = availableSites.map(s => s.name)
      setLocations(prev => [...prev, ...remainingNames])
      setSelectedSiteToAdd('')
    } else if (selectedSiteToAdd && !locations.includes(selectedSiteToAdd)) {
      setLocations(prev => [...prev, selectedSiteToAdd])
      setSelectedSiteToAdd('')
    }
  }

  function handleRemoveLocation(name) {
    setLocations(prev => prev.filter(l => l !== name))
  }

  // Save changes
  async function handleSave() {
    console.log('handleSave called! photoError:', photoError, 'sigError:', sigError);
    if (photoError || sigError) {
      console.warn('handleSave returned early due to image errors');
      return;
    }
    setSaving(true);
    try {
      console.log('Starting save process. User ID:', user.id);
      const updates = {}
      const localMeta = {}

      // Handle photo upload
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const path = `profiles/${user.id}/photo.${ext}`
        const { error } = await supabase.storage.from('checklist-uploads').upload(path, photoFile, { upsert: true })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
        updates.photo_url = `${publicUrl}?t=${Date.now()}`
      }

      // Handle signature upload
      if (sigFile) {
        const ext = sigFile.name.split('.').pop()
        const path = `profiles/${user.id}/signature.${ext}`
        const { error } = await supabase.storage.from('checklist-uploads').upload(path, sigFile, { upsert: true })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
        updates.signature_url = `${publicUrl}?t=${Date.now()}`
      }

      // Handle other file upload
      if (otherFile) {
        const ext = otherFile.name.split('.').pop()
        const path = `profiles/${user.id}/other_doc.${ext}`
        const { error } = await supabase.storage.from('checklist-uploads').upload(path, otherFile, { upsert: true })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('checklist-uploads').getPublicUrl(path)
        localMeta.document_url = publicUrl
        localMeta.document_name = otherFile.name
      } else if (otherFileName) {
        localMeta.document_name = otherFileName
        localMeta.document_url = meta.document_url
      }

      // Map local states to top-level fields (if DB supports them) or inside metadata fallback
      const fields = {
        own_company: ownCompany,
        sub_contractor_company: subContractorCompany,
        user_code: userCode,
        role: role,
        first_name: firstName,
        last_name: lastName,
        rfid: rfid,
        is_active: isActive,
        email: email,
        address_1: address1,
        address_2: address2,
        zipcode: zipcode,
        country: country,
        phone_code: phoneCode,
        phone_no: phoneNo,
        whatsapp_code: whatsappCode,
        whatsapp_no: whatsappNo,
        state: state,
        city: city,
        timezone: timezone,
        type: type,
        hourly_rate: hourlyRate,
        department: department,
        user_group: userGroup,
        establishment_type: establishmentType,
        locations: locations,
        include_child_location: includeChildLocation,
        currency: currency,
        reporting_manager: reportingManager,
        allow_rescheduling: allowRescheduling,
        notify_assignment: notifyAssignment,
        notify_status_change: notifyStatusChange,
        notify_completion: notifyCompletion,
        notify_task_completed: notifyTaskCompleted,
        notify_online_offline: notifyOnlineOffline,
      }

      // Sync combined name to standard full_name column
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
      if (databaseColumns.includes('full_name')) {
        updates.full_name = fullName || user.full_name
      }

      Object.entries(fields).forEach(([k, val]) => {
        // Convert empty string to null for numeric columns (e.g. hourly_rate) to prevent Postgres type errors
        let finalVal = val
        if (val === '') {
          if (k === 'hourly_rate') {
            finalVal = null
          }
        }

        if (databaseColumns.includes(k)) {
          updates[k] = finalVal
        } else {
          localMeta[k] = finalVal
        }
      })

      // Map phone specifically if column exists in database
      if (databaseColumns.includes('phone')) {
        updates.phone = phoneNo
      }

      // ALWAYS save to localStorage first as a reliable fallback sync
      console.log(`[UserProfileModal] Saving localMeta to localStorage under profile_metadata_${user.id}:`, localMeta)
      localStorage.setItem(`profile_metadata_${user.id}`, JSON.stringify(localMeta))

      // Also sync to DB columns if they are present in the table schema
      if (databaseColumns.includes('metadata')) {
        let currentMetadata = {}
        if (user.metadata) {
          if (typeof user.metadata === 'string') {
            try { currentMetadata = JSON.parse(user.metadata) } catch {}
          } else { currentMetadata = user.metadata }
        }
        updates.metadata = { ...currentMetadata, ...localMeta }
      }
      if (databaseColumns.includes('details')) {
        let currentDetails = {}
        if (user.details) {
          if (typeof user.details === 'string') {
            try { currentDetails = JSON.parse(user.details) } catch {}
          } else { currentDetails = user.details }
        }
        updates.details = { ...currentDetails, ...localMeta }
      }

      console.log('Sending updates to updateProfile:', updates);
      const savedResult = await updateProfile(user.id, updates)
      console.log('Profile updated successfully:', savedResult);
      setSaved(true)
      if (onSaved) onSaved(savedResult)
      setTimeout(() => { setSaved(false); onClose() }, 1000)
    } catch (err) {
      console.error('Failed to save profile error:', err);
      alert('Failed to save profile: ' + err.message)
    } finally {
      setSaving(false)
      console.log('handleSave finished, setSaving(false)');
    }
  }



  return (
    <div className="modal-bg" style={{ zIndex: 2200 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}
         onKeyDown={e => { if (e.key === 'Escape') onClose() }} tabIndex={-1} ref={modalRef}>
      <div className="modal" style={{ maxWidth: 960, width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: 16, overflow: 'hidden' }}>
        
        {/* Header (Fixed) */}
        <div className="card-header" style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 7, background: 'rgba(59,130,246,0.12)', borderRadius: 9, color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
              <UserCircle2 size={16} />
            </div>
            <div>
              <h3 style={{ letterSpacing: '0.05em', color: 'var(--text-0)', margin: 0 }}>USER PROFILE SETTINGS</h3>
              <p style={{ color: 'var(--text-3)', margin: 0 }}>Configure details, locations, credentials & notification parameters</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}><X size={16}/></button>
        </div>

        {/* Scrollable Form Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-2)' }}>

          {/* 1. PERSONAL INFORMATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AccordionHeader id="personal" title="Personal Information" sub="Personal Details & Identity parameters" isCollapsed={collapsed.personal} onToggle={toggleSection} />
            {!collapsed.personal && (
              <div style={{ padding: 18, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                
                {/* Own Company Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="own_company" checked={ownCompany} onChange={e => setOwnCompany(e.target.checked)} style={{ cursor: 'pointer', width: 15, height: 15 }} />
                  <label htmlFor="own_company" className="lbl" style={{ margin: 0, cursor: 'pointer' }}>Own Company</label>
                </div>

                {/* Sub Contractor Company */}
                <div>
                  <label className="lbl">Sub Contractor Company</label>
                  <select className="sel" value={subContractorCompany} onChange={e => setSubContractorCompany(e.target.value)} disabled={ownCompany}>
                    <option value="">Select Company</option>
                    {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* User Code */}
                <div>
                  <label className="lbl">User Code *</label>
                  <input className="inp" placeholder="e.g. U001" value={userCode} onChange={e => setUserCode(e.target.value)} required />
                </div>

                {/* User Role */}
                <div>
                  <label className="lbl">User Role *</label>
                  <select className="sel" value={role} onChange={e => setRole(e.target.value)}>
                    {ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>

                {/* First Name */}
                <div>
                  <label className="lbl">First Name *</label>
                  <input className="inp" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                </div>

                {/* Last Name */}
                <div>
                  <label className="lbl">Last Name *</label>
                  <input className="inp" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} required />
                </div>

                {/* RFID */}
                <div>
                  <label className="lbl">RFID</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input className="inp" placeholder="RFID tag string" value={rfid} onChange={e => setRfid(e.target.value)} />
                    <button type="button" onClick={handleGenerateRfid} style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', width: 'fit-content', padding: 0 }}>
                      Auto-Generate RFID
                    </button>
                  </div>
                </div>

                {/* Active Checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ cursor: 'pointer', width: 15, height: 15 }} />
                  <label htmlFor="isActive" className="lbl" style={{ margin: 0, cursor: 'pointer' }}>Active Status</label>
                </div>

              </div>
            )}
          </div>

          {/* 2. LOGIN INFORMATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AccordionHeader id="login" title="Login Information" sub="Login Credentials & Account login details" isCollapsed={collapsed.login} onToggle={toggleSection} />
            {!collapsed.login && (
              <div style={{ padding: 18, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ maxWidth: 450 }}>
                  <label className="lbl">Email / Username *</label>
                  <input className="inp" type="email" value={email} readOnly style={{ background: 'var(--bg-3)', cursor: 'not-allowed', color: 'var(--text-3)' }} />
                  <span style={{ color: 'var(--text-3)', display: 'block', marginTop: 4 }}>Login Email is set upon account invitation. Contact administrator to update email.</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. CONTACT INFORMATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AccordionHeader id="contact" title="Contact Information" sub="Contact Details & Address information" isCollapsed={collapsed.contact} onToggle={toggleSection} />
            {!collapsed.contact && (
              <div style={{ padding: 18, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                
                {/* Address 1 */}
                <div>
                  <label className="lbl">Address 1</label>
                  <input className="inp" placeholder="Address 1" value={address1} onChange={e => setAddress1(e.target.value)} />
                </div>

                {/* ZipCode */}
                <div>
                  <label className="lbl">ZipCode</label>
                  <input className="inp" placeholder="ZipCode" value={zipcode} onChange={e => setZipcode(e.target.value)} />
                </div>

                {/* Address 2 */}
                <div>
                  <label className="lbl">Address 2</label>
                  <input className="inp" placeholder="Address 2" value={address2} onChange={e => setAddress2(e.target.value)} />
                </div>

                {/* Country */}
                <div>
                  <label className="lbl">Country</label>
                  <select className="sel" value={country} onChange={e => setCountry(e.target.value)}>
                    <option value="">Choose country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Phone No */}
                <div>
                  <label className="lbl">Phone No</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="sel" value={phoneCode} onChange={e => setPhoneCode(e.target.value)} style={{ width: '110px', flexShrink: 0 }}>
                      <option value="AD (+376)">AD (+376)</option>
                      <option value="IN (+91)">IN (+91)</option>
                      <option value="AE (+971)">AE (+971)</option>
                      <option value="OM (+968)">OM (+968)</option>
                    </select>
                    <input className="inp" placeholder="Phone No" value={phoneNo} onChange={e => setPhoneNo(e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>

                {/* State */}
                <div>
                  <label className="lbl">State</label>
                  <select className="sel" value={state} onChange={e => setState(e.target.value)} disabled={!country}>
                    <option value="">Choose state</option>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Whatsapp No */}
                <div>
                  <label className="lbl">Whatsapp No</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select className="sel" value={whatsappCode} onChange={e => setWhatsappCode(e.target.value)} style={{ width: '110px', flexShrink: 0 }}>
                      <option value="AD (+376)">AD (+376)</option>
                      <option value="IN (+91)">IN (+91)</option>
                      <option value="AE (+971)">AE (+971)</option>
                      <option value="OM (+968)">OM (+968)</option>
                    </select>
                    <input className="inp" placeholder="Whatsapp No" value={whatsappNo} onChange={e => setWhatsappNo(e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>

                {/* City */}
                <div>
                  <label className="lbl">City</label>
                  <select className="sel" value={city} onChange={e => setCity(e.target.value)} disabled={!state}>
                    <option value="">Choose city</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

              </div>
            )}
          </div>

          {/* 4. TIMEZONE INFORMATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AccordionHeader id="timezone" title="System Settings & Timezone" sub="Regional preferences & operational timezone" isCollapsed={collapsed.timezone} onToggle={toggleSection} />
            {!collapsed.timezone && (
              <div style={{ padding: 18, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ maxWidth: 450 }}>
                  <label className="lbl">Timezone *</label>
                  <select className="sel" value={timezone} onChange={e => setTimezone(e.target.value)}>
                    <option value="(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi">(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi</option>
                    <option value="(UTC+04:00) Abu Dhabi, Muscat">(UTC+04:00) Abu Dhabi, Muscat</option>
                    <option value="(UTC+03:00) Riyadh, Baghdad">(UTC+03:00) Riyadh, Baghdad</option>
                    <option value="(UTC+00:00) London, Dublin">(UTC+00:00) London, Dublin</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 5. OTHER SETTINGS INFORMATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AccordionHeader id="other" title="Other Settings" sub="Rates, departments, groups & structural assignments" isCollapsed={collapsed.other} onToggle={toggleSection} />
            {!collapsed.other && (
              <div style={{ padding: 18, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                
                {/* Left Fields Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  
                  {/* Type */}
                  <div>
                    <label className="lbl">Type</label>
                    <select className="sel" value={type} onChange={e => setType(e.target.value)}>
                      <option value="">Select options</option>
                      <option value="Staff">Staff</option>
                      <option value="Contractor">Contractor</option>
                      <option value="Visitor">Visitor</option>
                    </select>
                  </div>

                  {/* Hourly Rate */}
                  <div>
                    <label className="lbl">Hourly Rate</label>
                    <input className="inp" type="number" min="0" placeholder="Hourly Rate" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
                  </div>

                  {/* Department */}
                  <div>
                    <label className="lbl">Department</label>
                    <select className="sel" value={department} onChange={e => setDepartment(e.target.value)}>
                      <option value="">Select options</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {/* User Group */}
                  <div>
                    <label className="lbl">User Group</label>
                    <select className="sel" value={userGroup} onChange={e => setUserGroup(e.target.value)}>
                      <option value="">Select options</option>
                      {USER_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  {/* Establishment Type */}
                  <div>
                    <label className="lbl">Establishment Type</label>
                    <select className="sel" value={establishmentType} onChange={e => setEstablishmentType(e.target.value)}>
                      <option value="">Select options</option>
                      {ESTABLISHMENT_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
                    </select>
                  </div>

                </div>

                {/* Right Fields Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  
                  {/* Location (Sites assigned) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label className="lbl" style={{ margin: 0 }}>Location</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" onClick={() => setLocations(allSites.map(s => s.name))} style={{ border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0, }}>
                          Select All
                        </button>
                        <span style={{ color: 'var(--border)', }}>|</span>
                        <button type="button" onClick={() => setLocations([])} style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', padding: 0, }}>
                          Clear All
                        </button>
                      </div>
                    </div>
                    
                    {/* Render assigned tags list */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, padding: '8px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, minHeight: 60 }}>
                      {locations.length === 0 ? (
                        <span style={{ color: 'var(--text-3)', alignSelf: 'center' }}>No location assigned</span>
                      ) : (
                        locations.map(loc => (
                          <span key={loc} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px',
                            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16,
                            color: 'var(--text-0)', }}>
                            <button type="button" onClick={() => handleRemoveLocation(loc)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center' }}>
                              <X size={10} />
                            </button>
                            {loc}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Add tag dropdown */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select className="sel" value={selectedSiteToAdd} onChange={e => setSelectedSiteToAdd(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Select a location to add...</option>
                        {availableSites.length > 0 && <option value="all">Add All Locations ({availableSites.length})</option>}
                        {availableSites.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                      <button type="button" onClick={handleAddLocation} className="btn-primary" style={{ padding: '6px 12px', minHeight: 38, gap: 4 }}>
                        <Plus size={13} /> Add
                      </button>
                    </div>
                  </div>

                  {/* Include Child Location */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <input type="checkbox" id="includeChild" checked={includeChildLocation} onChange={e => setIncludeChildLocation(e.target.checked)} style={{ cursor: 'pointer', width: 15, height: 15 }} />
                    <label htmlFor="includeChild" className="lbl" style={{ margin: 0, cursor: 'pointer' }}>Include Child Location</label>
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="lbl">Currency</label>
                    <select className="sel" value={currency} onChange={e => setCurrency(e.target.value)}>
                      <option value="INR">INR</option>
                      <option value="AED">AED</option>
                      <option value="OMR">OMR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>

                  {/* Reporting Manager */}
                  <div>
                    <label className="lbl">Reporting Manager</label>
                    <input className="inp" placeholder="Reporting Manager Name" value={reportingManager} onChange={e => setReportingManager(e.target.value)} />
                  </div>

                  {/* Allow Rescheduling Work order Checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <input type="checkbox" id="allowRescheduling" checked={allowRescheduling} onChange={e => setAllowRescheduling(e.target.checked)} style={{ cursor: 'pointer', width: 15, height: 15 }} />
                    <label htmlFor="allowRescheduling" className="lbl" style={{ margin: 0, cursor: 'pointer' }}>Allow Rescheduling Work order?:</label>
                  </div>

                </div>

              </div>
            )}
          </div>

          {/* 6. FILES INFORMATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AccordionHeader id="files" title="Profile Images & Signature" sub="User photo, electronic signature, and additional documents" isCollapsed={collapsed.files} onToggle={toggleSection} />
            {!collapsed.files && (
              <div style={{ padding: 18, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                <div style={{ color: 'var(--text-3)', display: 'flex', gap: 6, alignItems: 'flex-start', background: 'var(--bg-3)', padding: '8px 12px', borderRadius: 8 }}>
                  <AlertCircle size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                  Images must be clear and readable. PDF, JPG, PNG & WEBP formats are supported.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
                  
                  {/* Profile Image (Avatar) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center', background: 'var(--bg-2)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                    <span className="lbl">Profile Image</span>
                    <div style={{ position: 'relative', margin: '8px 0' }}>
                      {photoPreview ? (
                        <img src={photoPreview} alt="Profile" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }} />
                      ) : (
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                          <UserCircle2 size={40} />
                        </div>
                      )}
                      {photoChecking && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Loader size={16} className="spin" style={{ color: 'white' }} />
                        </div>
                      )}
                    </div>
                    {photoError && <span style={{ color: 'var(--red)', display: 'block' }}>{photoError}</span>}
                    <label className="btn-primary" style={{ padding: '6px 12px', cursor: 'pointer', gap: 4 }}>
                      <Camera size={12} /> Choose a file
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFile} disabled={photoChecking} />
                    </label>
                  </div>

                  {/* Signature */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center', background: 'var(--bg-2)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                    <span className="lbl">Signature</span>
                    <div style={{ position: 'relative', margin: '8px 0', width: 140, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', borderRadius: 8, border: '1px solid var(--border)' }}>
                      {sigPreview ? (
                        <img src={sigPreview} alt="Signature" style={{ maxHeight: 70, maxWidth: '90%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ color: 'var(--text-3)' }}>No Signature</span>
                      )}
                      {sigChecking && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Loader size={16} className="spin" style={{ color: 'white' }} />
                        </div>
                      )}
                    </div>
                    {sigError && <span style={{ color: 'var(--red)', display: 'block' }}>{sigError}</span>}
                    <label className="btn-primary" style={{ padding: '6px 12px', cursor: 'pointer', gap: 4 }}>
                      <Upload size={12} /> Choose a file
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSigFile} disabled={sigChecking} />
                    </label>
                  </div>

                  {/* Files Attachment */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center', background: 'var(--bg-2)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                    <span className="lbl">Files / Attachment</span>
                    <div style={{ margin: '14px 0', minHeight: 68, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      {otherFileName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--bg-3)', borderRadius: 8 }}>
                          <span style={{ color: 'var(--text-1)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherFileName}</span>
                          <button type="button" onClick={() => { setOtherFile(null); setOtherFileName(null) }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--red)' }}><X size={12}/></button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-3)' }}>No additional files</span>
                      )}
                    </div>
                    <label className="btn-primary" style={{ padding: '6px 12px', cursor: 'pointer', gap: 4 }}>
                      <Upload size={12} /> Choose a file
                      <input type="file" accept=".pdf,.doc,.docx,.jpg,.png" style={{ display: 'none' }} onChange={handleOtherFile} />
                    </label>
                  </div>

                </div>

              </div>
            )}
          </div>

          {/* 7. NOTIFICATIONS INFORMATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AccordionHeader id="notifications" title="System Notification Preferences" sub="Control alerts for tasks, online status & completions" isCollapsed={collapsed.notifications} onToggle={toggleSection} />
            {!collapsed.notifications && (
              <div style={{ padding: 18, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {/* Notify on Assignment */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ color: 'var(--text-0)' }}>Notify On Assignment:</span>
                    <p style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>Receive alerts when tickets or audit sessions are assigned to you</p>
                  </div>
                  <Toggle on={notifyAssignment} onChange={setNotifyAssignment} />
                </div>

                {/* Notify on Status Change */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ color: 'var(--text-0)' }}>Notify On Status Change:</span>
                    <p style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>Receive alerts when your reported assets or tickets change status</p>
                  </div>
                  <Toggle on={notifyStatusChange} onChange={setNotifyStatusChange} />
                </div>

                {/* Notify on Work Order Completion */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ color: 'var(--text-0)' }}>Notify On Work Order Completion:</span>
                    <p style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>Receive alerts when a maintenance work order is completed</p>
                  </div>
                  <Toggle on={notifyCompletion} onChange={setNotifyCompletion} />
                </div>

                {/* Notify on Task Completed */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ color: 'var(--text-0)' }}>Notify On Task Completed:</span>
                    <p style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>Receive alerts when individual checklist tasks are submitted</p>
                  </div>
                  <Toggle on={notifyTaskCompleted} onChange={setNotifyTaskCompleted} />
                </div>

                {/* Notify on Online Offline */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ color: 'var(--text-0)' }}>Notify On Online Offline:</span>
                    <p style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>Receive system reports about user synchronization and network state changes</p>
                  </div>
                  <Toggle on={notifyOnlineOffline} onChange={setNotifyOnlineOffline} />
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Footer (Fixed) */}
        <div style={{ padding: '14px 24px', background: 'var(--bg-3)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ padding: '8px 16px', }}>Cancel</button>
          
          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', color: 'var(--green)' }}>
              <CheckCircle2 size={14} />
              <span >Saved!</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved || photoChecking || sigChecking}
            className="btn-primary"
            style={{
              padding: '9px 22px', gap: 6,
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)',
              boxShadow: '0 4px 12px var(--accent-glow)'
            }}
          >
            {saving ? (
              <>
                <Loader size={14} className="spin" /> Saving…
              </>
            ) : (
              <>
                <Save size={14} /> Save Profile
              </>
            )}
          </button>
        </div>

      </div>
      
      <style>{`
        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}


