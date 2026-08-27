import { supabase } from '../../../lib/supabase';
import { logEvent } from './auditService';

export const configService = {
  async getConfig() {
    const { data, error } = await supabase
      .from('maintenance_config')
      .select('*')
      .limit(1)
      .single();
    
    return { data, error };
  },

  async updateConfig(updates, userId) {
    try {
      const { data: oldData } = await this.getConfig();
      
      const { data, error } = await supabase
        .from('maintenance_config')
        .update(updates)
        .eq('id', oldData.id)
        .select()
        .single();
        
      if (error) throw error;
      await logEvent('config', oldData.id, 'updated', userId, oldData, updates);
      
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};


