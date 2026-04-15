import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - get current org details
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', req.orgId)
      .single();
    if (error) return res.status(404).json({ success: false, error: 'Organization not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT / - update org
router.put('/', async (req, res) => {
  try {
    const { name, logo_url, primary_color, settings } = req.body;
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update({ name, logo_url, primary_color, settings })
      .eq('id', req.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
