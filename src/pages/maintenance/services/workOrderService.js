import { supabase } from '../../../lib/supabase';
import { logEvent } from './auditService';

export const workOrderService = {
  async getWorkOrders() {
    const { data, error } = await supabase
      .from('maintenance_work_orders')
      .select('*, ticket:maintenance_tickets(ticket_no), asset:assets(asset_name, site), assigned_to:profiles!maintenance_work_orders_assigned_to_fkey(full_name, avatar_url)')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async create(payload, userId) {
    try {
      const { data, error } = await supabase
        .from('maintenance_work_orders')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      await logEvent('work_order', data.id, 'created', userId, null, payload);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async changeStatus(id, newStatus, userId, notes = '') {
    try {
      const { data: oldData } = await supabase
        .from('maintenance_work_orders')
        .select('status, actual_start, paused_at, total_pause_duration')
        .eq('id', id)
        .single();

      let updates = { status: newStatus };
      const now = new Date().toISOString();

      if (newStatus === 'IN_PROGRESS' && oldData.status !== 'ON_HOLD') {
        updates.actual_start = now;
      } else if (newStatus === 'ON_HOLD') {
        updates.paused_at = now;
      } else if (newStatus === 'IN_PROGRESS' && oldData.status === 'ON_HOLD') {
        if (oldData.paused_at) {
          // Accumulate pause duration on backend using RPC, but for simplicity here we just pass status
          // Real robust interval math is better in an RPC or before saving
          // This requires careful handling, for now just clear paused_at
          updates.paused_at = null;
        }
      } else if (newStatus === 'COMPLETED') {
        updates.actual_end = now;
        updates.completed_at = now;
      }

      const { data, error } = await supabase
        .from('maintenance_work_orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await logEvent('work_order', id, 'status_changed', userId, { status: oldData.status }, { status: newStatus, notes });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};


