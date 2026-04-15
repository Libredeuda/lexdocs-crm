import { supabaseAdmin } from '../config/supabase.js';

export async function orgContext(req, res, next) {
  try {
    // Already set by API key auth
    if (req.orgId) return next();

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('org_id, role')
      .eq('id', req.userId)
      .single();

    if (error || !user) {
      return res.status(403).json({ success: false, error: 'User not associated with any organization' });
    }

    req.orgId = user.org_id;
    req.userRole = user.role;
    return next();
  } catch (err) {
    console.error('OrgContext middleware error:', err);
    return res.status(500).json({ success: false, error: 'Failed to resolve organization context' });
  }
}
