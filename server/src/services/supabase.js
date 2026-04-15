import { supabaseAdmin } from '../config/supabase.js';

export async function getOrgId(userId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('org_id')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data?.org_id;
}

export async function logActivity(orgId, entityType, entityId, action, description, performedBy, metadata = {}) {
  const { error } = await supabaseAdmin.from('activities').insert({
    org_id: orgId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    description,
    performed_by: performedBy,
    metadata,
  });
  if (error) console.error('Failed to log activity:', error);
}
