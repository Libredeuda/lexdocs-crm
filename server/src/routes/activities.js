import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - list activities
router.get('/', async (req, res) => {
  try {
    const { entity_type, entity_id, page = 1, limit = 25 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('activities')
      .select('*', { count: 'exact' })
      .eq('org_id', req.orgId);

    if (entity_type) query = query.eq('entity_type', entity_type);
    if (entity_id) query = query.eq('entity_id', entity_id);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ success: false, error: error.message });

    res.json({
      success: true,
      data,
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
