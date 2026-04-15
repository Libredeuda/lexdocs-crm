import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - list API keys (without actual key)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, key_prefix, is_active, last_used_at, created_at')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / - generate new API key
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const rawKey = `lxd_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 8);

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        org_id: req.orgId,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        created_by: req.userId,
        is_active: true,
      })
      .select('id, name, key_prefix, is_active, created_at')
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    // Return the raw key only once
    res.status(201).json({ success: true, data: { ...data, key: rawKey } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:id - deactivate API key
router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select('id, name, is_active')
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
