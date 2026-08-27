import { supabase } from '../../../lib/supabase';
import { logEvent } from './auditService';

export const scheduleService = {
  async getSchedules() {
    const { data, error } = await supabase
      .from('maintenance_schedules')
      .select('*, asset:assets(asset_name)')
      .order('next_due', { ascending: true });
    return { data, error };
  },

  async create(payload, userId) {
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      await logEvent('schedule', data.id, 'created', userId, null, payload);
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  /**
   * Triggers the idempotent server-side function to generate tickets 
   * for overdue or due PM schedules up to the target date.
   */
  async generateDuePMTasks(targetDateStr, userId) {
    try {
      const { data, error } = await supabase.rpc('fn_generate_pm_occurrences', {
        p_due_date: targetDateStr
      });
      if (error) throw error;
      
      // Log manual trigger
      await logEvent('config', 'system', 'pm_generated_manual', userId, null, { target_date: targetDateStr, count: data });
      
      return { count: data, error: null };
    } catch (error) {
      return { count: 0, error };
    }
  }
};


