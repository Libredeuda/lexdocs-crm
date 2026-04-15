import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];

    // JWT auth
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
      }
      req.user = user;
      req.userId = user.id;
      return next();
    }

    // API key auth
    if (apiKeyHeader) {
      const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
      const { data: apiKey, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, org_id, is_active')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single();

      if (error || !apiKey) {
        return res.status(401).json({ success: false, error: 'Invalid API key' });
      }

      req.orgId = apiKey.org_id;
      req.apiKeyId = apiKey.id;

      // Update last_used_at in background
      supabaseAdmin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', apiKey.id).then();

      return next();
    }

    return res.status(401).json({ success: false, error: 'Unauthorized - provide Bearer token or API key' });
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ success: false, error: 'Authentication failed' });
  }
}
