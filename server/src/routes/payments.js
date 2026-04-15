import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';
import { logActivity } from '../services/supabase.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - list payments
router.get('/', async (req, res) => {
  try {
    const { case_id, status } = req.query;
    let query = supabaseAdmin.from('payments').select('*').eq('org_id', req.orgId);
    if (case_id) query = query.eq('case_id', case_id);
    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / - create payment
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert({ ...req.body, org_id: req.orgId })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await logActivity(req.orgId, 'payment', data.id, 'created', `Payment of ${data.amount} created`, req.userId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id - update payment
router.put('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id/mark-received
router.put('/:id/mark-received', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await logActivity(req.orgId, 'payment', data.id, 'paid', `Payment marked as received`, req.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
