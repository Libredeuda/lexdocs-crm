import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';
import { logActivity } from '../services/supabase.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - list cases
router.get('/', async (req, res) => {
  try {
    const {
      status, phase, case_type, assigned_lawyer_id, contact_id, search,
      page = 1, limit = 25,
    } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin.from('cases').select('*, contacts(full_name, email)', { count: 'exact' }).eq('org_id', req.orgId);

    if (status) query = query.eq('status', status);
    if (phase) query = query.eq('phase', phase);
    if (case_type) query = query.eq('case_type', case_type);
    if (assigned_lawyer_id) query = query.eq('assigned_lawyer_id', assigned_lawyer_id);
    if (contact_id) query = query.eq('contact_id', contact_id);
    if (search) query = query.or(`title.ilike.%${search}%,case_number.ilike.%${search}%`);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ success: false, error: error.message });

    res.json({ success: true, data, total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil(count / limit) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST / - create case
router.post('/', async (req, res) => {
  try {
    const caseNumber = `CASE-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabaseAdmin
      .from('cases')
      .insert({ ...req.body, org_id: req.orgId, case_number: caseNumber })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await logActivity(req.orgId, 'case', data.id, 'created', `Case ${caseNumber} created`, req.userId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('cases')
      .select('*, contacts(full_name, email, phone)')
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .single();
    if (error) return res.status(404).json({ success: false, error: 'Case not found' });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('cases')
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

// GET /:id/documents
router.get('/:id/documents', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('case_id', req.params.id)
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:id/payments
router.get('/:id/payments', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('case_id', req.params.id)
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:id/activities
router.get('/:id/activities', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('activities')
      .select('*')
      .eq('entity_type', 'case')
      .eq('entity_id', req.params.id)
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
