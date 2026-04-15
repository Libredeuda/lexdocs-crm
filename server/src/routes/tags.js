import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - list tags
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tags')
      .select('*')
      .eq('org_id', req.orgId)
      .order('name', { ascending: true });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / - create tag
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tags')
      .insert({ ...req.body, org_id: req.orgId })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:id - delete tag
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('tags')
      .delete()
      .eq('id', req.params.id)
      .eq('org_id', req.orgId);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: { message: 'Tag deleted' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /contacts/:contactId - add tag to contact
router.post('/contacts/:contactId', async (req, res) => {
  try {
    const { tag_id } = req.body;
    const { data, error } = await supabaseAdmin
      .from('contact_tags')
      .insert({ contact_id: req.params.contactId, tag_id })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /contacts/:contactId/:tagId - remove tag from contact
router.delete('/contacts/:contactId/:tagId', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('contact_tags')
      .delete()
      .eq('contact_id', req.params.contactId)
      .eq('tag_id', req.params.tagId);
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: { message: 'Tag removed from contact' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
