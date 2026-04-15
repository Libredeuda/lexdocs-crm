import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';
import { logActivity } from '../services/supabase.js';

const router = Router();
router.use(authenticate, orgContext);

// GET / - list documents
router.get('/', async (req, res) => {
  try {
    const { case_id, status } = req.query;
    let query = supabaseAdmin.from('documents').select('*').eq('org_id', req.orgId);
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

// POST / - create document record
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({ ...req.body, org_id: req.orgId, uploaded_by: req.userId })
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await logActivity(req.orgId, 'document', data.id, 'uploaded', `Document "${data.name}" uploaded`, req.userId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id/approve
router.put('/:id/approve', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .update({ status: 'approved', reviewed_by: req.userId, reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await logActivity(req.orgId, 'document', data.id, 'approved', `Document "${data.name}" approved`, req.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /:id/reject
router.put('/:id/reject', async (req, res) => {
  try {
    const { review_note } = req.body;
    const { data, error } = await supabaseAdmin
      .from('documents')
      .update({ status: 'rejected', review_note, reviewed_by: req.userId, reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .select()
      .single();
    if (error) return res.status(400).json({ success: false, error: error.message });

    await logActivity(req.orgId, 'document', data.id, 'rejected', `Document "${data.name}" rejected: ${review_note}`, req.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /:id/verify - AI verification placeholder
router.post('/:id/verify', async (req, res) => {
  try {
    const { data: doc, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', req.params.id)
      .eq('org_id', req.orgId)
      .single();
    if (error) return res.status(404).json({ success: false, error: 'Document not found' });

    // Mock AI verification result
    const verificationResult = {
      document_id: doc.id,
      verified: true,
      confidence: 0.95,
      checks: [
        { name: 'format_valid', passed: true },
        { name: 'content_complete', passed: true },
        { name: 'signatures_present', passed: true },
      ],
      message: 'Document passed all verification checks (mock)',
    };

    await logActivity(req.orgId, 'document', doc.id, 'verified', 'AI verification completed', req.userId, verificationResult);
    res.json({ success: true, data: verificationResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
