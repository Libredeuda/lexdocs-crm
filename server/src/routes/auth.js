import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { orgContext } from '../middleware/orgContext.js';

const router = Router();

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ success: false, error: error.message });
    res.json({ success: true, data: { session: data.session, user: data.user } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, org_name } = req.body;
    if (!email || !password || !full_name || !org_name) {
      return res.status(400).json({ success: false, error: 'email, password, full_name, and org_name are required' });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name },
    });
    if (authError) return res.status(400).json({ success: false, error: authError.message });

    // Create organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: org_name })
      .select()
      .single();
    if (orgError) return res.status(500).json({ success: false, error: orgError.message });

    // Create user record
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      full_name,
      org_id: org.id,
      role: 'admin',
    });
    if (userError) return res.status(500).json({ success: false, error: userError.message });

    // Sign in to get session
    const { data: session, error: signInError } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (signInError) return res.status(500).json({ success: false, error: signInError.message });

    res.status(201).json({ success: true, data: { session: session.session, user: session.user, org } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /magic-link
router.post('/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    const { error } = await supabaseAdmin.auth.signInWithOtp({ email });
    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, data: { message: 'Magic link sent' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /me
router.get('/me', authenticate, orgContext, async (req, res) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*, organizations(*)')
      .eq('id', req.userId)
      .single();
    if (error) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
