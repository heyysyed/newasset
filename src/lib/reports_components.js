import { supabase } from './supabase'

export async function getComponentRegisterReport(filters) {
  let query = supabase.from('serialized_components').select(`
    *,
    assets:current_asset_id(asset_code, asset_name, site, location)
  `).order('created_at', { ascending: false });

  if (filters?.site && filters.site !== 'All') {
    // Note: since components are global until installed, if site is specified, we filter to those currently installed at the site
    query = query.eq('assets.site', filters.site);
  }

  const { data, error } = await query;
  if (error) return { status: 'ERROR', message: error.message };

  return {
    status: 'SUCCESS',
    data: data.map(item => ({
      ID: item.part_number,
      Name: item.name,
      'Serial Number': item.serial_number,
      Category: item.category,
      Status: item.status,
      'Purchase Cost': item.purchase_cost,
      'Current Asset': item.assets?.asset_code || 'None',
      Location: item.current_location || (item.assets ? `${item.assets.site} - ${item.assets.location}` : 'Inventory'),
      'Created At': new Date(item.created_at).toLocaleDateString()
    }))
  };
}

export async function getComponentReplacementReport(filters) {
  const { data, error } = await supabase.from('component_replacements').select(`
    *,
    old_comp:old_component_id(name, serial_number, purchase_cost),
    new_comp:new_component_id(name, serial_number, purchase_cost),
    assets:asset_id(asset_code, asset_name, site),
    profiles:replaced_by(full_name),
    work_order:work_order_id(work_order_number)
  `).order('replaced_at', { ascending: false });

  if (error) return { status: 'ERROR', message: error.message };

  return {
    status: 'SUCCESS',
    data: data.map(r => ({
      'Asset': r.assets?.asset_code || 'Unknown',
      'Site': r.assets?.site || '-',
      'Position': r.position || '-',
      'Old Component': r.old_comp ? `${r.old_comp.name} (${r.old_comp.serial_number})` : '-',
      'New Component': r.new_comp ? `${r.new_comp.name} (${r.new_comp.serial_number})` : '-',
      'Cost Impact': (r.new_comp?.purchase_cost || 0) - (r.old_comp?.purchase_cost || 0),
      'Reason': r.reason,
      'Work Order': r.work_order?.work_order_number || '-',
      'Replaced By': r.profiles?.full_name || '-',
      'Date': new Date(r.replaced_at).toLocaleDateString()
    }))
  };
}

export async function getScrappedComponentsReport(filters) {
  const { data, error } = await supabase.from('serialized_components')
    .select('*')
    .eq('status', 'SCRAPPED')
    .order('updated_at', { ascending: false });

  if (error) return { status: 'ERROR', message: error.message };

  const totalLoss = data.reduce((sum, c) => sum + (c.purchase_cost || 0), 0);

  return {
    status: 'SUCCESS',
    kpis: [
      { label: 'Total Scrapped Components', value: data.length },
      { label: 'Total Value Lost', value: totalLoss, isCurrency: true }
    ],
    data: data.map(item => ({
      Name: item.name,
      'Serial Number': item.serial_number,
      Category: item.category,
      Manufacturer: item.manufacturer,
      'Purchase Cost': item.purchase_cost,
      'Scrap Date': new Date(item.updated_at).toLocaleDateString()
    }))
  };
}

export async function getComponentCostAnalysis(filters) {
  const { data, error } = await supabase.from('serialized_components').select('*');
  if (error) return { status: 'ERROR', message: error.message };

  const categoryCosts = {};
  data.forEach(c => {
    if (!categoryCosts[c.category]) categoryCosts[c.category] = 0;
    categoryCosts[c.category] += (c.purchase_cost || 0);
  });

  return {
    status: 'SUCCESS',
    data: Object.entries(categoryCosts).map(([category, cost]) => ({
      name: category || 'Uncategorized',
      value: cost
    }))
  };
}

export async function getComponentLifecycleHistory(filters) {
  const { data, error } = await supabase.from('component_lifecycle_events').select(`
    *,
    components:component_id(name, serial_number),
    assets:asset_id(asset_code, site),
    profiles:performed_by(full_name),
    work_order:work_order_id(work_order_number)
  `).order('event_time', { ascending: true });
  
  if (error) return { status: 'ERROR', message: error.message };

  return {
    status: 'SUCCESS',
    data: data.map(e => ({
      Date: new Date(e.event_time).toLocaleString(),
      Component: e.components ? `${e.components.name} (${e.components.serial_number})` : '-',
      Event: e.event_type,
      Asset: e.assets?.asset_code || '-',
      Location: e.location_id || e.assets?.site || '-',
      'Work Order': e.work_order?.work_order_number || '-',
      User: e.profiles?.full_name || '-',
      Reason: e.reason || '-',
      Disposition: e.disposition || '-'
    }))
  };
}

export async function getAssetComponentChangeHistory(filters) {
  const { data, error } = await supabase.from('asset_components').select(`
    *,
    assets:asset_id(asset_code, site),
    components:component_id(name, serial_number, purchase_cost),
    install_prof:installed_by(full_name),
    remove_prof:removed_by(full_name),
    install_wo:install_work_order_id(work_order_number),
    remove_wo:remove_work_order_id(work_order_number)
  `).order('installed_at', { ascending: false });

  if (error) return { status: 'ERROR', message: error.message };

  const formatted = [];
  data.forEach(r => {
    formatted.push({
      Date: new Date(r.installed_at).toLocaleDateString(),
      Asset: r.assets?.asset_code || '-',
      Position: r.position || '-',
      Action: 'INSTALLED',
      Component: r.components ? `${r.components.name} (${r.components.serial_number})` : '-',
      Cost: r.components?.purchase_cost || 0,
      Reason: '-',
      'Work Order': r.install_wo?.work_order_number || '-',
      Technician: r.install_prof?.full_name || '-'
    });
    if (r.removed_at) {
      formatted.push({
        Date: new Date(r.removed_at).toLocaleDateString(),
        Asset: r.assets?.asset_code || '-',
        Position: r.position || '-',
        Action: 'REMOVED',
        Component: r.components ? `${r.components.name} (${r.components.serial_number})` : '-',
        Cost: r.components?.purchase_cost || 0,
        Reason: r.removal_reason || '-',
        'Work Order': r.remove_wo?.work_order_number || '-',
        Technician: r.remove_prof?.full_name || '-'
      });
    }
  });

  formatted.sort((a, b) => new Date(b.Date) - new Date(a.Date));

  return {
    status: 'SUCCESS',
    data: formatted
  };
}

export async function getSerializedComponentInventory(filters) {
  const { data, error } = await supabase.from('serialized_components').select(`
    *,
    assets:current_asset_id(asset_code)
  `).order('status');

  if (error) return { status: 'ERROR', message: error.message };

  return {
    status: 'SUCCESS',
    data: data.map(item => ({
      Status: item.status,
      Component: item.name,
      'Serial Number': item.serial_number,
      'Part Number': item.part_number || '-',
      Manufacturer: item.manufacturer || '-',
      'Purchase Cost': item.purchase_cost || 0,
      'Current Asset': item.assets?.asset_code || '-',
      'Current Location': item.current_location || '-'
    }))
  };
}

export async function getCompleteAssetLifecycle(filters) {
  const { data: assets, error } = await supabase.from('assets').select(`
    *,
    maintenance_logs(cost),
    asset_components(
      component_id,
      components:component_id(purchase_cost, included_in_asset_cost)
    )
  `);

  if (error) return { status: 'ERROR', message: error.message };

  const data = assets.map(asset => {
    const acqCost = asset.purchase_cost || 0;
    const maintCost = asset.maintenance_logs?.reduce((sum, log) => sum + (log.cost || 0), 0) || 0;
    
    // Calculate unique components installed over lifetime that are not included in asset cost
    const uniqueComps = {};
    asset.asset_components?.forEach(ac => {
      if (ac.components && !ac.components.included_in_asset_cost) {
        uniqueComps[ac.component_id] = ac.components.purchase_cost || 0;
      }
    });
    const compCost = Object.values(uniqueComps).reduce((sum, cost) => sum + cost, 0);
    const totalCost = acqCost + maintCost + compCost;

    return {
      Asset: asset.asset_code,
      Name: asset.asset_name,
      'Acquisition Cost': acqCost,
      'Component Expenditure': compCost,
      'Maintenance Expenditure': maintCost,
      'Total Lifecycle Cost': totalCost
    };
  });

  return {
    status: 'SUCCESS',
    data
  };
}

export async function getComponentMovementReport(filters) {
  const { data, error } = await supabase.from('component_lifecycle_events')
    .select(`
      *,
      components:component_id(name, serial_number),
      assets:asset_id(asset_code, site),
      profiles:performed_by(full_name),
      work_order:work_order_id(work_order_number)
    `)
    .in('event_type', ['INSTALLED', 'REMOVED', 'MOVED'])
    .order('event_time', { ascending: false });

  if (error) return { status: 'ERROR', message: error.message };

  return {
    status: 'SUCCESS',
    data: data.map(e => ({
      Component: e.components?.name || '-',
      'Serial Number': e.components?.serial_number || '-',
      Date: new Date(e.event_time).toLocaleString(),
      Action: e.event_type,
      Asset: e.assets?.asset_code || '-',
      Location: e.location_id || e.assets?.site || '-',
      'Work Order': e.work_order?.work_order_number || '-',
      User: e.profiles?.full_name || '-'
    }))
  };
}


