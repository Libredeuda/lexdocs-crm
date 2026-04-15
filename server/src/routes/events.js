import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';
import { logActivity } from '../services/supabase.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - list events
router.get('/', async (req, res) => {
  try {
    const { case_id, event_type, start_date, end_date } = req.query;
    let query = supabaseAdmin.from('events').select('*').eq('org_id', req.orgId);
    if (case_id) query = query.eq('case_id', case_id);
    if (event_type) query = query.eq('event_type', event_type);
    if (start_date) query = query.gte('start_time', start_date);
    if (end_date) query = query.lte('start_time', end_date);
    query = query.order('start_time', { ascending: true });

    const { data, error } = await query;
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / - create event
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({ ...req.body, org_id: req.orgId, created_by: req.userId })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await logActivity(req.orgId, 'event', data.id, 'created', `Event "${data.title}" created`, req.userId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id - update event
router.put('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('events')
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

// PUT /:id/complete
router.put('/:id/complete', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('events')
      .update({ is_completed: true })
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await logActivity(req.orgId, 'event', data.id, 'completed', `Event "${data.title}" completed`, req.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', req.params.id)
      .eq('org_id', req.orgId);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: { message: 'Event deleted' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
