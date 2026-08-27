import { supabase } from '../../../lib/supabase';

export const inventoryService = {
  /**
   * Consume a maintenance part atomically using the database RPC
   */
  async consumePart(itemId, quantity, workOrderId, technicianId, isOverride = false, overrideReason = null) {
    try {
      const { data, error } = await supabase.rpc('fn_consume_maintenance_part', {
        p_item_id: itemId,
        p_quantity: quantity,
        p_work_order_id: workOrderId,
        p_technician_id: technicianId,
        p_is_override: isOverride,
        p_override_reason: overrideReason
      });

      if (error) throw error;
      return { success: true, transactionId: data.transaction_id, error: null };
    } catch (error) {
      console.error('Inventory consumption error:', error);
      return { success: false, error };
    }
  }
};


