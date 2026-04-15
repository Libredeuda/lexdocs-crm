import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';
import { logActivity } from '../services/supabase.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - list contacts
router.get('/', async (req, res) => {
  try {
    const {
      status, source, assigned_to, search, pipeline_stage_id,
      page = 1, limit = 25, sort_by = 'created_at', sort_order = 'desc',
    } = req.query;

    const offset = (page - 1) * limit;
    let query = supabaseAdmin.from('contacts').select('*', { count: 'exact' }).eq('org_id', req.orgId);

    if (status) query = query.eq('status', status);
    if (source) query = query.eq('source', source);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (pipeline_stage_id) query = query.eq('pipeline_stage_id', pipeline_stage_id);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);

    query = query.order(sort_by, { ascending: sort_order === 'asc' }).range(offset, offset + limit - 1);

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

// POST / - create contact
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert({ ...req.body, org_id: req.orgId })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await logActivity(req.orgId, 'contact', data.id, 'created', `Contact ${data.full_name} created`, req.userId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .select('*, contact_tags(tag_id, tags(*))')
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .single();
    if (error) return res.status(404).json({ success: false, error: 'Contact not found' });
    res.json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  try {
    // Check for status change
    const { data: existing } = await supabaseAdmin
      .from('contacts').select('status').eq('id', req.params.id).eq('org_id', req.orgId).single();

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    if (existing && req.body.status && existing.status !== req.body.status) {
      await logActivity(req.orgId, 'contact', data.id, 'status_changed', `Status changed from ${existing.status} to ${req.body.status}`, req.userId);
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update({ status: 'archived' })
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });
    await logActivity(req.orgId, 'contact', data.id, 'archived', `Contact archived`, req.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:id/convert - convert to client
router.post('/:id/convert', async (req, res) => {
  try {
    const { data: contact, error: cErr } = await supabaseAdmin
      .from('contacts')
      .update({ status: 'client' })
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();
    if (cErr) return res.status(400).json({ success: false, error: cErr.message });

    const caseNumber = `CASE-${Date.now().toString(36).toUpperCase()}`;
    const { data: newCase, error: caseErr } = await supabaseAdmin
      .from('cases')
      .insert({
        org_id: req.orgId,
        contact_id: contact.id,
        case_number: caseNumber,
        title: `Case for ${contact.full_name}`,
        status: 'open',
        ...req.body,
      })
      .select()
      .single();
    if (caseErr) return res.status(500).json({ success: false, error: caseErr.message });

    await logActivity(req.orgId, 'contact', contact.id, 'converted', `Contact converted to client, case ${caseNumber} created`, req.userId);
    res.json({ success: true, data: { contact, case_id: newCase.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
