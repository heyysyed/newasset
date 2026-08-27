import { supabase } from '../../../lib/supabase';

export const logEvent = async (entityType, entityId, action, actorId, oldValue = null, newValue = null, metadata = null) => {
  try {
    const { error } = await supabase
      .from('maintenance_audit_events')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        action,
        actor_id: actorId,
        old_value: oldValue,
        new_value: newValue,
        metadata
      });
    if (error) throw error;
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};


