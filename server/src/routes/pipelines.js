import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - list pipelines with stages
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('pipelines')
      .select('*, pipeline_stages(*)')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / - create pipeline
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('pipelines')
      .insert({ ...req.body, org_id: req.orgId })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:id/stages - list stages
router.get('/:id/stages', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', req.params.id)
      .order('position', { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:id/stages - create stage
router.post('/:id/stages', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('pipeline_stages')
      .insert({ ...req.body, pipeline_id: req.params.id })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /stages/:id - update stage
router.put('/stages/:id', async (req, res) => {
  try {
    const { name, position, color } = req.body;
    const { data, error } = await supabaseAdmin
      .from('pipeline_stages')
      .update({ name, position, color })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /stages/:id
router.delete('/stages/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('pipeline_stages')
      .delete()
      .eq('id', req.params.id);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: { message: 'Stage deleted' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
