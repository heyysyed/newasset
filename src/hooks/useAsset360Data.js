import { useQuery } from '@tanstack/react-query'
import { supabase, fetchAsset, fetchChildAssets, fetchAssetPhotos, fetchAssetAttachments, fetchAssetDocuments } from '../lib/supabase'
import { buildAsset360 } from '../lib/intelligence/assetIntelligence'

export function useAsset360Data(assetId, options = {}) {
  const {
    loadMaintenance = false,
    loadMovements = false,
    loadAudits = false,
    loadChecklists = false,
    loadDocuments = false,
    loadChildren = false,
  } = options

  // 1. Core Asset Query - ALWAYS LOADED
  const { data: asset, isLoading: assetLoading, error: assetError } = useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => fetchAsset(assetId),
    enabled: !!assetId,
    staleTime: 1000 * 60 * 5,
  })

  // 1b. Basic Intelligence Summaries - ALWAYS LOADED (for header/pulse)
  // We fetch JUST the maintenance tickets and movements summary for the health score and location intelligence
  const { data: baseIntel, isLoading: baseIntelLoading } = useQuery({
    queryKey: ['asset_base_intel', assetId],
    queryFn: async () => {
      const [tktRes, movRes, audRes] = await Promise.all([
        supabase.from('maintenance_tickets').select('id, status, priority, ticket_type, created_at, due_date').eq('asset_id', assetId),
        supabase.from('asset_movements').select('id, moved_at, target_site').eq('asset_id', assetId).order('moved_at', { ascending: false }).limit(5),
        supabase.from('asset_audit').select('id').eq('asset_id', assetId).limit(1)
      ])
      return { 
        tickets: tktRes.data || [], 
        movements: movRes.data || [],
        hasAudits: (audRes.data || []).length > 0
      }
    },
    enabled: !!assetId,
    staleTime: 1000 * 60 * 5,
  })

  // 2. Full Maintenance Query - LAZY LOADED
  const { data: maintenance, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['asset_maintenance', assetId],
    queryFn: async () => {
      const [tkt, sch, mlg] = await Promise.all([
        supabase.from('maintenance_tickets').select('*, profiles:profiles!reported_by(full_name)').eq('asset_id', assetId).order('created_at', { ascending: false }),
        supabase.from('maintenance_schedules').select('*').eq('asset_id', assetId).order('next_due'),
        supabase.from('maintenance_logs').select('*, profiles!performed_by(full_name)').eq('asset_id', assetId).order('performed_at', { ascending: false })
      ])
      return { tickets: tkt.data || [], schedules: sch.data || [], logs: mlg.data || [] }
    },
    enabled: !!assetId && loadMaintenance,
  })

  // 3. Full Movements Query - LAZY LOADED
  const { data: movements, isLoading: movementsLoading } = useQuery({
    queryKey: ['asset_movements', assetId],
    queryFn: async () => {
      const res = await supabase.from('asset_movements').select('*, profiles:profiles!moved_by(full_name)').eq('asset_id', assetId).order('moved_at', { ascending: false })
      return res.data || []
    },
    enabled: !!assetId && loadMovements,
  })

  // 4. Audits & Checklists Query - LAZY LOADED
  const { data: auditData, isLoading: auditsLoading } = useQuery({
    queryKey: ['asset_audits', assetId],
    queryFn: async () => {
      const p = []
      if (loadAudits) {
        p.push(supabase.from('asset_audit').select('*, profiles!user_id(full_name)').eq('asset_id', assetId).order('created_at', { ascending: false }).then(r => ({ audits: r.data || [] })))
      } else {
        p.push(Promise.resolve({ audits: [] }))
      }
      if (loadChecklists) {
        p.push(supabase.from('maintenance_audit_submissions').select('*, checklist:maintenance_checklists(id, name, frequency), checker_profile:profiles!checker_id(full_name), hod_profile:profiles!hod_id(full_name)').eq('asset_id', assetId).order('submitted_at', { ascending: false }).then(r => ({ checklists: r.data || [] })))
      } else {
        p.push(Promise.resolve({ checklists: [] }))
      }
      const [a, c] = await Promise.all(p)
      return { audits: a.audits, checklists: c.checklists }
    },
    enabled: !!assetId && (loadAudits || loadChecklists),
  })

  // 5. Documents & Photos Query - LAZY LOADED
  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ['asset_files', assetId],
    queryFn: async () => {
      const [photos, attachments, documents] = await Promise.all([
        fetchAssetPhotos(assetId),
        fetchAssetAttachments(assetId),
        fetchAssetDocuments(assetId)
      ])
      return { photos, attachments, documents }
    },
    enabled: !!assetId && loadDocuments,
  })

  // 6. Child & Parent Assets Query - LAZY LOADED
  const { data: relationships, isLoading: relationshipsLoading } = useQuery({
    queryKey: ['asset_relationships', assetId, asset?.parent_asset_id],
    queryFn: async () => {
      const children = await fetchChildAssets(assetId)
      let parent = null
      if (asset?.parent_asset_id) {
        const { data } = await supabase.from('assets').select('id, asset_code, asset_name, status, category, site').eq('id', asset.parent_asset_id).single()
        parent = data
      }
      return { children: children || [], parent }
    },
    enabled: !!assetId && loadChildren,
  })

  // 7. Utilities - LAZY LOADED (Can group with maintenance)
  const { data: utilities } = useQuery({
    queryKey: ['asset_utilities', assetId],
    queryFn: async () => {
      const utl = await supabase.from('utility_readings').select('*, profiles!recorded_by(full_name)').eq('asset_id', assetId).order('reading_date', { ascending: false })
      return utl.data || []
    },
    enabled: !!assetId && loadMaintenance,
  })

  // 8. Linked Checklists Matcher - LAZY LOADED
  const { data: linkedChecklists } = useQuery({
    queryKey: ['asset_linked_checklists', assetId, asset?.asset_name, asset?.category, asset?.checklist_template_id],
    queryFn: async () => {
      if (!asset) return { daily: null, weekly: null, monthly: null }
      const assetName = asset.asset_name || ''
      const { data: newCl } = await supabase.from('maintenance_checklists').select('*')
      const { data: oldCl } = await supabase.from('checklist_templates').select('*').eq('is_active', true)
      const all = [...(newCl || []), ...(oldCl || [])]
      const matched = { daily: null, weekly: null, monthly: null }
      for (const cl of all) {
        const names = cl.linked_asset_names || []
        const isLinked = names.some(n => n.toLowerCase() === assetName.toLowerCase()) ||
          (cl.category && asset.category && cl.category.toLowerCase() === asset.category.toLowerCase()) ||
          (asset.checklist_template_id && cl.id === asset.checklist_template_id)
        if (isLinked) {
          const freq = cl.frequency || 'monthly'
          if (!matched[freq]) matched[freq] = cl
        }
      }
      return matched
    },
    enabled: !!assetId && !!asset && loadChecklists,
  })

  // Build the intelligence layer
  // We use the basic intel summary to build the 360 profile, but if full data is loaded, we use that instead
  let asset360 = null
  if (asset) {
    asset360 = buildAsset360(asset, {
      tickets: maintenance?.tickets || baseIntel?.tickets || [],
      movements: movements || baseIntel?.movements || [],
      audits: auditData?.audits || []
    })
  }

  return {
    // Raw Data
    asset,
    maintenance: maintenance || { tickets: [], schedules: [], logs: [] },
    movements: movements || [],
    audits: auditData?.audits || [],
    checklistHistory: auditData?.checklists || [],
    linkedChecklists: linkedChecklists || { daily: null, weekly: null, monthly: null },
    utilities: utilities || [],
    photos: files?.photos || [],
    attachments: files?.attachments || [],
    documents: files?.documents || [],
    childAssets: relationships?.children || [],
    parentAsset: relationships?.parent || null,
    
    // Intelligence
    asset360,

    // Loading States
    isLoading: assetLoading || baseIntelLoading,
    isBackgroundLoading: maintenanceLoading || movementsLoading || auditsLoading || filesLoading || relationshipsLoading,
    error: assetError
  }
}
