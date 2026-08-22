import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getProfile, getSettings } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// Default field definitions
export const DEFAULT_FIELDS = [
  { key: 'asset_code',        label: 'Asset Code',        required: true,  system: true },
  { key: 'asset_name',        label: 'Asset Name',        required: true,  system: true },
  { key: 'make',              label: 'Make',              required: false, system: true },
  { key: 'model_no',          label: 'Model No',          required: false, system: true },
  { key: 'purchase_order_no', label: 'Purchase Order No', required: false, system: true },
  { key: 'serial_no',         label: 'Serial No',         required: false, system: true },
  { key: 'capacity',          label: 'Capacity',          required: false, system: true },
  { key: 'status',            label: 'Status',            required: false, system: true },
  { key: 'category',          label: 'Category',          required: false, system: true },
  { key: 'site',              label: 'Site / Location',   required: false, system: true },
  { key: 'type_code',         label: 'Type Code',         required: false, system: true },
  { key: 'purchase_date',     label: 'Purchase Date',     required: false, system: true },
  { key: 'purchase_value',    label: 'Purchase Value',    required: false, system: true },
  { key: 'salvage_value',     label: 'Salvage Value',     required: false, system: true },
  { key: 'useful_life_years', label: 'Useful Life (Yrs)', required: false, system: true },
  { key: 'depreciation_method', label: 'Depr. Method',    required: false, system: true },
  { key: 'depreciation_rate_percent', label: 'Depr. Rate %', required: false, system: true },
  { key: 'notes',             label: 'Notes',             required: false, system: true },
  { key: 'added_on',          label: 'Added On',          required: false, system: true, readOnly: true },
]

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userSites, setUserSites] = useState([]) // sites assigned to this user

  async function forceSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSettings(null)
    setUserSites([])
    window.location.href = '/#/login?deactivated=1'
  }

  async function loadProfile(uid) {
    try {
      const p = await getProfile(uid)
      if (p && p.is_active === false) {
        await forceSignOut()
        return
      }
      setProfile(p)
      // Load assigned sites for site-level isolation
      if (p && (p.role === 'moderator' || p.role === 'user')) {
        const { data } = await supabase
          .from('user_site_assignments')
          .select('site_name')
          .eq('user_id', uid)
        setUserSites((data || []).map(d => d.site_name))
      } else {
        setUserSites([]) // admins/super_admins see all
      }
    } catch (e) {
      console.error('Profile load failed', e)
    }
  }

  async function loadSettings() {
    try {
      const s = await getSettings()
      setSettings(s)
    } catch (e) {
      console.error('Settings load failed', e)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        Promise.all([loadProfile(session.user.id), loadSettings()]).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const timeout = setTimeout(() => { setLoading(false) }, 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
        loadSettings()
      } else {
        setProfile(null)
        setSettings(null)
        setUserSites([])
      }
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  // Realtime listener: auto-sign-out when profile is deactivated
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('profile-deactivation')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new.is_active === false) forceSignOut()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const refreshSettings = () => loadSettings()
  const refreshProfile  = (uid) => loadProfile(uid || user?.id)
  const patchProfile    = (updates) => setProfile(p => p ? { ...p, ...updates } : updates)

  // ── Role helpers ───────────────────────────────────────
  const role         = profile?.role || 'user'
  const isSuperAdmin = role === 'super_admin'
  const isAdmin      = role === 'admin' || role === 'super_admin'
  const isMod        = role === 'moderator'
  const isUser       = role === 'user'

  // Does this user have global visibility (no site restriction)?
  const hasGlobalAccess = isSuperAdmin || role === 'admin'

  // Get effective permissions
  const modPerms  = settings?.moderator_permissions || {}
  const userPerms = settings?.user_permissions      || {}

  function can(action) {
    if (isAdmin) return true // super_admin & admin can do everything
    if (isMod) {
      const map = {
        add:                modPerms.can_add,
        edit:               modPerms.can_edit_all,
        edit_location:      modPerms.can_edit_location,
        edit_status:        modPerms.can_edit_status,
        delete:             modPerms.can_delete,
        export:             modPerms.can_export,
        import:             modPerms.can_import,
        print_stickers:     modPerms.can_print_stickers,
        audit:              modPerms.can_access_audit,
        maintenance:        modPerms.can_access_maintenance,
        inventory:          modPerms.can_access_inventory,
        checklists:         modPerms.can_access_checklists,
      }
      return !!map[action]
    }
    if (isUser) {
      const map = {
        view_assets:  userPerms.can_view_assets,
        checklists:   userPerms.can_access_checklists,
        maintenance:  userPerms.can_access_maintenance,
      }
      return !!map[action]
    }
    return false
  }

  // Which fields are visible to this role
  function visibleFields() {
    const hidden = settings?.hidden_fields || []
    const customFields = settings?.custom_fields || []
    const all = [...DEFAULT_FIELDS, ...customFields.map(f => ({ ...f, custom: true }))]
    if (isAdmin) return all
    return all.filter(f => !hidden.includes(f.key))
  }

  function canEditField(fieldKey) {
    if (isAdmin) return true
    if (!isMod) return false
    if (modPerms.can_edit_all) return true
    if (fieldKey === 'site') return modPerms.can_edit_location
    if (fieldKey === 'status') return modPerms.can_edit_status
    return false
  }

  // Site-level data filter: returns true if asset/item belongs to user's assigned sites
  function canAccessSite(siteName) {
    if (hasGlobalAccess) return true
    if (!siteName) return true // items without a site are visible to all
    return userSites.includes(siteName)
  }

  // Filter an array of items by site access
  function filterBySite(items, siteKey = 'site') {
    if (hasGlobalAccess) return items
    return items.filter(item => {
      const s = item[siteKey]
      return !s || userSites.includes(s)
    })
  }

  const currentCompany = { code: settings?.company_code || 'SBC' }

  return (
    <AuthCtx.Provider value={{
      user, profile, settings, loading,
      role, isSuperAdmin, isAdmin, isMod, isUser,
      hasGlobalAccess, userSites,
      can, visibleFields, canEditField, canAccessSite, filterBySite,
      refreshSettings, refreshProfile, patchProfile,
      currentCompany,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}
