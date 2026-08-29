import { supabase } from '../lib/supabase';

// -------------------------------------------------------------
// Component Retrieval
// -------------------------------------------------------------

export async function fetchSerializedComponents(filters = {}) {
  let query = supabase.from('serialized_components').select(`
    *,
    assets:current_asset_id (asset_code, asset_name)
  `);
  
  if (filters.status && filters.status !== 'All') query = query.eq('status', filters.status);
  if (filters.category && filters.category !== 'All') query = query.eq('category', filters.category);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getComponentById(id) {
  const { data, error } = await supabase.from('serialized_components').select(`
    *,
    assets:current_asset_id (asset_code, asset_name, location, site)
  `).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getAssetComponents(assetId) {
  const { data, error } = await supabase.from('asset_components').select(`
    *,
    serialized_components (
      id, serial_number, part_number, name, category, manufacturer, status, purchase_cost, currency
    ),
    profiles:installed_by (full_name),
    removed_profiles:removed_by (full_name),
    install_work_order:install_work_order_id (work_order_number),
    remove_work_order:remove_work_order_id (work_order_number)
  `).eq('asset_id', assetId).order('installed_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function getComponentLifecycle(componentId) {
  const { data, error } = await supabase.from('component_lifecycle_events').select(`
    *,
    assets:asset_id (asset_code, asset_name),
    maintenance_work_orders:work_order_id (work_order_number),
    profiles:performed_by (full_name)
  `).eq('component_id', componentId).order('event_time', { ascending: false });
  if (error) throw error;
  return data;
}

// -------------------------------------------------------------
// Component Lifecycle Actions (Atomic RPCs)
// -------------------------------------------------------------

export async function receiveComponent(payload) {
  // payload: { serial_number, part_number, name, category, manufacturer, model, purchase_cost, vendor_id, po_number, current_location, user_id }
  
  // 1. Insert into serialized_components
  const { data: comp, error: compErr } = await supabase.from('serialized_components').insert({
    serial_number: payload.serial_number,
    part_number: payload.part_number,
    name: payload.name,
    category: payload.category,
    manufacturer: payload.manufacturer,
    model: payload.model,
    purchase_cost: payload.purchase_cost || 0,
    vendor_id: payload.vendor_id || null,
    po_number: payload.po_number,
    current_location: payload.current_location,
    status: 'AVAILABLE'
  }).select().single();
  
  if (compErr) throw compErr;

  // 2. Insert into lifecycle events
  await supabase.from('component_lifecycle_events').insert({
    component_id: comp.id,
    event_type: 'RECEIVED',
    new_status: 'AVAILABLE',
    performed_by: payload.user_id,
    location_id: payload.current_location
  });

  // 3. Insert inventory transaction
  await supabase.from('inventory_transactions').insert({
    component_id: comp.id,
    transaction_type: 'receipt',
    quantity: 1,
    to_location: payload.current_location,
    performed_by: payload.user_id,
    notes: 'COMPONENT_RECEIPT'
  });

  return comp;
}

export async function installComponent(componentId, assetId, position, woId, userId, location) {
  const { data, error } = await supabase.rpc('rpc_install_component', {
    p_component_id: componentId,
    p_asset_id: assetId,
    p_position: position || null,
    p_wo_id: woId || null,
    p_user_id: userId,
    p_location: location || null
  });
  if (error) throw error;
  return data;
}

export async function removeComponent(componentId, woId, reason, disposition, userId, newStatus) {
  const { data, error } = await supabase.rpc('rpc_remove_component', {
    p_component_id: componentId,
    p_wo_id: woId || null,
    p_reason: reason || null,
    p_disposition: disposition || null,
    p_user_id: userId,
    p_new_status: newStatus || null,
    p_scrap_value: null
  });
  if (error) throw error;
  return data;
}

export async function replaceComponent(oldId, newId, assetId, position, woId, reason, disposition, userId, oldNewStatus) {
  const { data, error } = await supabase.rpc('rpc_replace_component', {
    p_old_id: oldId,
    p_new_id: newId,
    p_asset_id: assetId,
    p_position: position || null,
    p_wo_id: woId || null,
    p_reason: reason || null,
    p_disposition: disposition || null,
    p_user_id: userId,
    p_old_new_status: oldNewStatus || null,
    p_scrap_value: null
  });
  if (error) throw error;
  return data;
}

export async function scrapComponent(componentId, reason, value, userId) {
  const { data, error } = await supabase.rpc('rpc_scrap_component', {
    p_component_id: componentId,
    p_reason: reason,
    p_value: value,
    p_user_id: userId
  });
  if (error) throw error;
  return data;
}


