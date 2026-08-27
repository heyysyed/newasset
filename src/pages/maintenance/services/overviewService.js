import { supabase } from '../../../lib/supabase';

/**
 * Service dedicated to retrieving aggregated metrics and focused data for the Maintenance Overview Command Center.
 * Designed to minimize payload sizes and prevent massive log loading in the browser.
 */
export const overviewService = {
  /**
   * Fetches the core KPIs (counts) for the Overview dashboard
   */
  async getKPIs() {
    // 1. Open Tickets (Not resolved/closed)
    const { count: openTicketsCount, error: openError } = await supabase
      .from('maintenance_tickets')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("resolved","closed")');

    if (openError) throw new Error(`Failed to fetch open tickets: ${openError.message}`);

    // 2. Active Work Orders
    const { count: activeWorkOrdersCount, error: woError } = await supabase
      .from('maintenance_work_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['SCHEDULED', 'IN_PROGRESS', 'ON_HOLD']);

    if (woError) throw new Error(`Failed to fetch active work orders: ${woError.message}`);

    // 3. Pending Approvals
    const { count: pendingApprovalsCount, error: approvalError } = await supabase
      .from('maintenance_work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'AWAITING_APPROVAL');

    if (approvalError) throw new Error(`Failed to fetch pending approvals: ${approvalError.message}`);

    // 4. Overdue PMs
    const today = new Date().toISOString().split('T')[0];
    const { count: overduePMCount, error: pmError } = await supabase
      .from('maintenance_schedules')
      .select('*', { count: 'exact', head: true })
      .lt('next_due', today)
      .eq('status', 'active');

    if (pmError) throw new Error(`Failed to fetch overdue PMs: ${pmError.message}`);

    return {
      openTickets: openTicketsCount || 0,
      activeWorkOrders: activeWorkOrdersCount || 0,
      pendingApprovals: pendingApprovalsCount || 0,
      overduePMs: overduePMCount || 0
    };
  },

  /**
   * Fetches active items that need SLA attention (Tickets & Work Orders)
   */
  async getActiveSLARecords() {
    // Get unresolved tickets
    const { data: tickets, error: ticketError } = await supabase
      .from('maintenance_tickets')
      .select('id, title, status, priority, created_at, asset_id, assets:assets(asset_name, site)')
      .not('status', 'in', '("resolved","closed")');

    if (ticketError) throw new Error(ticketError.message);

    // Get active work orders
    const { data: workOrders, error: woError } = await supabase
      .from('maintenance_work_orders')
      .select('id, status, priority, created_at, asset_id, assigned_to, profiles:profiles!maintenance_work_orders_assigned_to_fkey(full_name), assets:assets(asset_name, site), ticket:maintenance_tickets(title)')
      .in('status', ['SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_APPROVAL']);

    if (woError) throw new Error(woError.message);

    const mappedTickets = (tickets || []).map(t => ({
      ...t,
      assets: t.assets ? {
        name: t.assets.asset_name,
        sites: {
          name: t.assets.site
        }
      } : null
    }));

    const mappedWorkOrders = (workOrders || []).map(wo => ({
      ...wo,
      title: wo.ticket?.title || `Work Order ${wo.id.substring(0, 8).toUpperCase()}`,
      status: wo.status?.toLowerCase(),
      assets: wo.assets ? {
        name: wo.assets.asset_name,
        sites: {
          name: wo.assets.site
        }
      } : null
    }));

    return { tickets: mappedTickets, workOrders: mappedWorkOrders };
  },

  /**
   * Fetches PM Schedules for the forecast
   */
  async getPMForecast() {
    const { data, error } = await supabase
      .from('maintenance_schedules')
      .select('id, title, frequency, next_due, status, asset_id, assets:assets(asset_name, site)')
      .eq('status', 'active')
      .order('next_due', { ascending: true })
      .limit(30);

    if (error) throw new Error(error.message);
    
    return (data || []).map(item => ({
      ...item,
      next_due_date: item.next_due,
      is_active: item.status === 'active',
      assets: item.assets ? {
        name: item.assets.asset_name,
        sites: {
          name: item.assets.site
        }
      } : null
    }));
  },

  /**
   * Fetches active Work Orders specifically for the Active Work Orders table
   */
  async getActiveWorkOrders() {
    const { data, error } = await supabase
      .from('maintenance_work_orders')
      .select(`
        id, 
        status, 
        priority, 
        created_at, 
        estimated_cost,
        assets:assets(asset_name, site),
        profiles:profiles!maintenance_work_orders_assigned_to_fkey(full_name),
        ticket:maintenance_tickets(title)
      `)
      .in('status', ['SCHEDULED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_APPROVAL'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message);
    
    return (data || []).map(wo => ({
      ...wo,
      title: wo.ticket?.title || `Work Order ${wo.id.substring(0, 8).toUpperCase()}`,
      status: wo.status?.toLowerCase(),
      profiles: { full_name: wo.profiles?.full_name },
      assets: wo.assets ? {
        name: wo.assets.asset_name,
        sites: {
          name: wo.assets.site
        }
      } : null
    }));
  },

  /**
   * Fetches cost aggregates
   */
  async getCostSnapshot() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data, error } = await supabase
      .from('maintenance_work_orders')
      .select('actual_cost')
      .eq('status', 'COMPLETED')
      .gte('completed_at', thirtyDaysAgo.toISOString());

    if (error) throw new Error(error.message);
    
    const currentPeriodSpend = (data || []).reduce((sum, wo) => sum + (Number(wo.actual_cost) || 0), 0);
    
    return {
      currentPeriodSpend,
      completedJobs: data?.length || 0,
      averageCost: data?.length ? currentPeriodSpend / data.length : 0
    };
  }
};


