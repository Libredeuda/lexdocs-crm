-- =============================================================================
-- Migration 009: Embudos de ventas + Automatizaciones IA + Agentes IA
-- =============================================================================

-- 1. Agentes IA (una config reutilizable: persona + objetivo + reglas handoff)
CREATE TABLE IF NOT EXISTS ai_agents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  description         text,
  role                text DEFAULT 'sales',             -- sales | qualifier | support
  system_prompt       text NOT NULL,
  tone                text DEFAULT 'profesional',       -- profesional | cercano | directo
  goal                text,                             -- objetivo del agente (ej: "cualificar lead y reservar cita")
  handoff_conditions  text,                             -- cuándo pasar a humano (texto libre o JSON)
  channels            text[] DEFAULT ARRAY['email'],    -- email, whatsapp
  max_messages        integer DEFAULT 5,                -- límite antes de handoff obligatorio
  model               text DEFAULT 'claude-sonnet-4-5',
  is_active           boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_agents_org ON ai_agents(org_id);
ALTER TABLE ai_agents DISABLE ROW LEVEL SECURITY;

-- 2. Embudos / workflows automatizados
CREATE TABLE IF NOT EXISTS automation_workflows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  trigger_type    text NOT NULL CHECK (trigger_type IN (
    'contact_created','status_changed','tag_added','stage_entered','manual','inactivity'
  )),
  trigger_config  jsonb DEFAULT '{}'::jsonb,            -- { status: 'lead', source: 'website' } etc.
  ai_agent_id     uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  is_active       boolean DEFAULT true,
  stats_runs      integer DEFAULT 0,
  stats_completed integer DEFAULT 0,
  stats_converted integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_org ON automation_workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_trigger ON automation_workflows(trigger_type, is_active);
ALTER TABLE automation_workflows DISABLE ROW LEVEL SECURITY;

-- 3. Pasos del workflow (secuenciales)
CREATE TABLE IF NOT EXISTS automation_steps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id    uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
  step_order     integer NOT NULL,
  action_type    text NOT NULL CHECK (action_type IN (
    'wait','send_email','send_whatsapp','create_task','change_status',
    'add_tag','ai_score','ai_message','ai_analyze_reply','assign_to','notify_team','end'
  )),
  action_config  jsonb DEFAULT '{}'::jsonb,
  delay_minutes  integer DEFAULT 0,                    -- delay antes de ejecutar este paso
  condition      jsonb,                                 -- { if_reply: 'positive' -> goto_step: 5 }
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_steps_workflow ON automation_steps(workflow_id, step_order);
ALTER TABLE automation_steps DISABLE ROW LEVEL SECURITY;

-- 4. Ejecuciones (una por contact que entra al workflow)
CREATE TABLE IF NOT EXISTS automation_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id      uuid NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
  contact_id       uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  current_step     integer DEFAULT 0,
  status           text DEFAULT 'running' CHECK (status IN ('running','paused','completed','failed','handoff')),
  next_run_at      timestamptz DEFAULT now(),
  last_action_at   timestamptz,
  last_error       text,
  context          jsonb DEFAULT '{}'::jsonb,           -- variables del run
  started_at       timestamptz DEFAULT now(),
  completed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_due ON automation_runs(status, next_run_at) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_automation_runs_contact ON automation_runs(contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_runs_active ON automation_runs(workflow_id, contact_id) WHERE status = 'running';
ALTER TABLE automation_runs DISABLE ROW LEVEL SECURITY;

-- 5. Conversaciones IA (cada agente con cada lead)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id        uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES automation_runs(id) ON DELETE SET NULL,
  channel         text DEFAULT 'email' CHECK (channel IN ('email','whatsapp')),
  status          text DEFAULT 'active' CHECK (status IN ('active','paused','handoff','closed')),
  handoff_reason  text,
  handoff_to      uuid REFERENCES users(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  message_count   integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conv_contact ON ai_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_status ON ai_conversations(status, org_id);
ALTER TABLE ai_conversations DISABLE ROW LEVEL SECURITY;

-- 6. Mensajes IA (cada turno del agente o lead)
CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('agent','lead','system')),
  content         text NOT NULL,
  channel         text,
  sentiment       text,                                 -- positive | neutral | negative | objection
  intent          text,                                 -- interested | ask_price | objection | schedule | unsubscribe
  metadata        jsonb,
  sent_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, sent_at);
ALTER TABLE ai_messages DISABLE ROW LEVEL SECURITY;

-- 7. Lead scoring (añadir columnas a contacts)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_score integer;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_tier text CHECK (ai_tier IS NULL OR ai_tier IN ('hot','warm','cold'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_score_reasoning text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_score_updated_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_next_action text;

-- 8. Plantillas de email/WhatsApp reutilizables
CREATE TABLE IF NOT EXISTS message_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       text NOT NULL,
  channel    text NOT NULL CHECK (channel IN ('email','whatsapp')),
  subject    text,                                       -- solo email
  body       text NOT NULL,                              -- soporta {{variables}}
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_templates_org ON message_templates(org_id);
ALTER TABLE message_templates DISABLE ROW LEVEL SECURITY;

SELECT 'Migration 009 OK: automation + ai agents' AS status;
