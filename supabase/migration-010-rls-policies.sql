-- =============================================================================
-- Migration 010: Row Level Security en todas las tablas pendientes
-- =============================================================================
-- Tablas cubiertas (18):
--   org_id:     messages, notifications_log, push_subscriptions,
--               notifications_inbox, google_calendar_connections,
--               ai_agents, automation_workflows, automation_steps,
--               automation_runs, ai_conversations, ai_messages,
--               message_templates
--   tenant_id:  tenants, carlota_conversations, carlota_messages,
--               procedural_knowledge, search_history, saved_items
--   public:     jurisprudence, legislation (lectura abierta, escritura solo
--               service_role)
--
-- Las Edge Functions que usan SUPABASE_SERVICE_ROLE_KEY siguen pudiendo
-- leer/escribir todo (el service_role bypassa RLS). El cliente con ANON_KEY
-- solo puede ver/modificar filas de su propia organización / tenant / usuario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (IMMUTABLE no, STABLE sí; se pueden usar dentro de policies)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.tenant_id
  FROM public.users u
  JOIN public.organizations o ON o.id = u.org_id
  WHERE u.id = auth.uid()
$$;

-- =============================================================================
-- GRUPO 1 — Tablas con org_id (modelo CRM)
-- =============================================================================

-- messages -------------------------------------------------------------------
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages org select" ON messages;
DROP POLICY IF EXISTS "messages org insert" ON messages;
DROP POLICY IF EXISTS "messages org update" ON messages;
DROP POLICY IF EXISTS "messages org delete" ON messages;
CREATE POLICY "messages org select" ON messages
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "messages org insert" ON messages
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "messages org update" ON messages
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "messages org delete" ON messages
  FOR DELETE USING (org_id = auth_org_id());

-- notifications_log ----------------------------------------------------------
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_log org select" ON notifications_log;
DROP POLICY IF EXISTS "notif_log org insert" ON notifications_log;
CREATE POLICY "notif_log org select" ON notifications_log
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "notif_log org insert" ON notifications_log
  FOR INSERT WITH CHECK (org_id = auth_org_id());
-- update/delete: solo service_role

-- push_subscriptions (solo el dueño del navegador) ----------------------------
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subs own select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs own insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs own update" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs own delete" ON push_subscriptions;
CREATE POLICY "push_subs own select" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_subs own insert" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_subs own update" ON push_subscriptions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "push_subs own delete" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- notifications_inbox (cada usuario ve SOLO sus notificaciones) ---------------
ALTER TABLE notifications_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_inbox own select" ON notifications_inbox;
DROP POLICY IF EXISTS "notif_inbox own update" ON notifications_inbox;
DROP POLICY IF EXISTS "notif_inbox own delete" ON notifications_inbox;
CREATE POLICY "notif_inbox own select" ON notifications_inbox
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_inbox own update" ON notifications_inbox
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notif_inbox own delete" ON notifications_inbox
  FOR DELETE USING (user_id = auth.uid());
-- insert: solo service_role (las crean Edge Functions / triggers)

-- google_calendar_connections (tokens OAuth — ultra sensible) ----------------
ALTER TABLE google_calendar_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gcal own select" ON google_calendar_connections;
DROP POLICY IF EXISTS "gcal own insert" ON google_calendar_connections;
DROP POLICY IF EXISTS "gcal own update" ON google_calendar_connections;
DROP POLICY IF EXISTS "gcal own delete" ON google_calendar_connections;
CREATE POLICY "gcal own select" ON google_calendar_connections
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "gcal own insert" ON google_calendar_connections
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "gcal own update" ON google_calendar_connections
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "gcal own delete" ON google_calendar_connections
  FOR DELETE USING (user_id = auth.uid());

-- ai_agents ------------------------------------------------------------------
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_agents org select" ON ai_agents;
DROP POLICY IF EXISTS "ai_agents org insert" ON ai_agents;
DROP POLICY IF EXISTS "ai_agents org update" ON ai_agents;
DROP POLICY IF EXISTS "ai_agents org delete" ON ai_agents;
CREATE POLICY "ai_agents org select" ON ai_agents
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "ai_agents org insert" ON ai_agents
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "ai_agents org update" ON ai_agents
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "ai_agents org delete" ON ai_agents
  FOR DELETE USING (org_id = auth_org_id());

-- automation_workflows -------------------------------------------------------
ALTER TABLE automation_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aw org select" ON automation_workflows;
DROP POLICY IF EXISTS "aw org insert" ON automation_workflows;
DROP POLICY IF EXISTS "aw org update" ON automation_workflows;
DROP POLICY IF EXISTS "aw org delete" ON automation_workflows;
CREATE POLICY "aw org select" ON automation_workflows
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "aw org insert" ON automation_workflows
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "aw org update" ON automation_workflows
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "aw org delete" ON automation_workflows
  FOR DELETE USING (org_id = auth_org_id());

-- automation_steps (vía workflow) --------------------------------------------
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "as wf select" ON automation_steps;
DROP POLICY IF EXISTS "as wf insert" ON automation_steps;
DROP POLICY IF EXISTS "as wf update" ON automation_steps;
DROP POLICY IF EXISTS "as wf delete" ON automation_steps;
CREATE POLICY "as wf select" ON automation_steps
  FOR SELECT USING (
    workflow_id IN (SELECT id FROM automation_workflows WHERE org_id = auth_org_id())
  );
CREATE POLICY "as wf insert" ON automation_steps
  FOR INSERT WITH CHECK (
    workflow_id IN (SELECT id FROM automation_workflows WHERE org_id = auth_org_id())
  );
CREATE POLICY "as wf update" ON automation_steps
  FOR UPDATE USING (
    workflow_id IN (SELECT id FROM automation_workflows WHERE org_id = auth_org_id())
  );
CREATE POLICY "as wf delete" ON automation_steps
  FOR DELETE USING (
    workflow_id IN (SELECT id FROM automation_workflows WHERE org_id = auth_org_id())
  );

-- automation_runs ------------------------------------------------------------
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ar org select" ON automation_runs;
DROP POLICY IF EXISTS "ar org insert" ON automation_runs;
DROP POLICY IF EXISTS "ar org update" ON automation_runs;
DROP POLICY IF EXISTS "ar org delete" ON automation_runs;
CREATE POLICY "ar org select" ON automation_runs
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "ar org insert" ON automation_runs
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "ar org update" ON automation_runs
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "ar org delete" ON automation_runs
  FOR DELETE USING (org_id = auth_org_id());

-- ai_conversations -----------------------------------------------------------
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aic org select" ON ai_conversations;
DROP POLICY IF EXISTS "aic org insert" ON ai_conversations;
DROP POLICY IF EXISTS "aic org update" ON ai_conversations;
DROP POLICY IF EXISTS "aic org delete" ON ai_conversations;
CREATE POLICY "aic org select" ON ai_conversations
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "aic org insert" ON ai_conversations
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "aic org update" ON ai_conversations
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "aic org delete" ON ai_conversations
  FOR DELETE USING (org_id = auth_org_id());

-- ai_messages (vía conversation) ---------------------------------------------
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aim conv select" ON ai_messages;
DROP POLICY IF EXISTS "aim conv insert" ON ai_messages;
DROP POLICY IF EXISTS "aim conv update" ON ai_messages;
DROP POLICY IF EXISTS "aim conv delete" ON ai_messages;
CREATE POLICY "aim conv select" ON ai_messages
  FOR SELECT USING (
    conversation_id IN (SELECT id FROM ai_conversations WHERE org_id = auth_org_id())
  );
CREATE POLICY "aim conv insert" ON ai_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (SELECT id FROM ai_conversations WHERE org_id = auth_org_id())
  );
CREATE POLICY "aim conv update" ON ai_messages
  FOR UPDATE USING (
    conversation_id IN (SELECT id FROM ai_conversations WHERE org_id = auth_org_id())
  );
CREATE POLICY "aim conv delete" ON ai_messages
  FOR DELETE USING (
    conversation_id IN (SELECT id FROM ai_conversations WHERE org_id = auth_org_id())
  );

-- message_templates ----------------------------------------------------------
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mt org select" ON message_templates;
DROP POLICY IF EXISTS "mt org insert" ON message_templates;
DROP POLICY IF EXISTS "mt org update" ON message_templates;
DROP POLICY IF EXISTS "mt org delete" ON message_templates;
CREATE POLICY "mt org select" ON message_templates
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "mt org insert" ON message_templates
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "mt org update" ON message_templates
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "mt org delete" ON message_templates
  FOR DELETE USING (org_id = auth_org_id());

-- =============================================================================
-- GRUPO 2 — Tablas con tenant_id (modelo SaaS Suite)
-- =============================================================================

-- tenants (el usuario solo ve su propio tenant) -------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenants own select" ON tenants;
DROP POLICY IF EXISTS "tenants own update" ON tenants;
CREATE POLICY "tenants own select" ON tenants
  FOR SELECT USING (id = auth_tenant_id());
CREATE POLICY "tenants own update" ON tenants
  FOR UPDATE USING (id = auth_tenant_id());
-- insert/delete: solo service_role (alta/baja de clientes del SaaS)

-- carlota_conversations (tenant + user dueño) ---------------------------------
ALTER TABLE carlota_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cc own select" ON carlota_conversations;
DROP POLICY IF EXISTS "cc own insert" ON carlota_conversations;
DROP POLICY IF EXISTS "cc own update" ON carlota_conversations;
DROP POLICY IF EXISTS "cc own delete" ON carlota_conversations;
CREATE POLICY "cc own select" ON carlota_conversations
  FOR SELECT USING (user_id = auth.uid() AND tenant_id = auth_tenant_id());
CREATE POLICY "cc own insert" ON carlota_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = auth_tenant_id());
CREATE POLICY "cc own update" ON carlota_conversations
  FOR UPDATE USING (user_id = auth.uid() AND tenant_id = auth_tenant_id());
CREATE POLICY "cc own delete" ON carlota_conversations
  FOR DELETE USING (user_id = auth.uid() AND tenant_id = auth_tenant_id());

-- carlota_messages (vía conversation) -----------------------------------------
ALTER TABLE carlota_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm conv select" ON carlota_messages;
DROP POLICY IF EXISTS "cm conv insert" ON carlota_messages;
DROP POLICY IF EXISTS "cm conv delete" ON carlota_messages;
CREATE POLICY "cm conv select" ON carlota_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM carlota_conversations
      WHERE user_id = auth.uid() AND tenant_id = auth_tenant_id()
    )
  );
CREATE POLICY "cm conv insert" ON carlota_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM carlota_conversations
      WHERE user_id = auth.uid() AND tenant_id = auth_tenant_id()
    )
  );
CREATE POLICY "cm conv delete" ON carlota_messages
  FOR DELETE USING (
    conversation_id IN (
      SELECT id FROM carlota_conversations
      WHERE user_id = auth.uid() AND tenant_id = auth_tenant_id()
    )
  );

-- procedural_knowledge (conocimiento curado por cada despacho) ---------------
ALTER TABLE procedural_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pk tenant select" ON procedural_knowledge;
DROP POLICY IF EXISTS "pk tenant insert" ON procedural_knowledge;
DROP POLICY IF EXISTS "pk tenant update" ON procedural_knowledge;
DROP POLICY IF EXISTS "pk tenant delete" ON procedural_knowledge;
CREATE POLICY "pk tenant select" ON procedural_knowledge
  FOR SELECT USING (tenant_id = auth_tenant_id());
CREATE POLICY "pk tenant insert" ON procedural_knowledge
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());
CREATE POLICY "pk tenant update" ON procedural_knowledge
  FOR UPDATE USING (tenant_id = auth_tenant_id());
CREATE POLICY "pk tenant delete" ON procedural_knowledge
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- search_history (por usuario) -----------------------------------------------
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sh own select" ON search_history;
DROP POLICY IF EXISTS "sh own insert" ON search_history;
DROP POLICY IF EXISTS "sh own delete" ON search_history;
CREATE POLICY "sh own select" ON search_history
  FOR SELECT USING (user_id = auth.uid() OR tenant_id = auth_tenant_id());
CREATE POLICY "sh own insert" ON search_history
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id() AND (user_id = auth.uid() OR user_id IS NULL));
CREATE POLICY "sh own delete" ON search_history
  FOR DELETE USING (user_id = auth.uid());

-- saved_items (bookmarks por usuario) ----------------------------------------
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "si own select" ON saved_items;
DROP POLICY IF EXISTS "si own insert" ON saved_items;
DROP POLICY IF EXISTS "si own delete" ON saved_items;
CREATE POLICY "si own select" ON saved_items
  FOR SELECT USING (user_id = auth.uid() AND tenant_id = auth_tenant_id());
CREATE POLICY "si own insert" ON saved_items
  FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = auth_tenant_id());
CREATE POLICY "si own delete" ON saved_items
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- GRUPO 3 — Datos legales públicos (BOE / jurisprudencia)
-- Lectura abierta a usuarios autenticados. Escritura solo service_role.
-- =============================================================================

ALTER TABLE jurisprudence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "juris read authenticated" ON jurisprudence;
CREATE POLICY "juris read authenticated" ON jurisprudence
  FOR SELECT TO authenticated USING (true);

ALTER TABLE legislation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "legis read authenticated" ON legislation;
CREATE POLICY "legis read authenticated" ON legislation
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- Done
-- =============================================================================
SELECT 'Migration 010 OK: RLS habilitado en 18 tablas' AS status;
