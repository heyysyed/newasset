import { supabase } from '../../../lib/supabase';
import { logEvent } from './auditService';

export const ticketService = {
  async getTickets() {
    try {
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .select(`
          *,
          asset:assets(id, asset_name, asset_code),
          work_orders:maintenance_work_orders(id, status, assigned_to)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async create(payload, userId) {
    try {
      const { data, error } = await supabase
        .from('maintenance_tickets')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      await logEvent('ticket', data.id, 'created', userId, null, payload);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  async update(id, updates, userId, action = 'updated') {
    try {
      const { data: oldData } = await supabase
        .from('maintenance_tickets')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('maintenance_tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await logEvent('ticket', id, action, userId, oldData, updates);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};


