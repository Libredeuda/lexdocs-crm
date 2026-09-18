-- ── Reset limpio del schema public (proyecto NUEVO, sin datos reales) ──
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- =============================================================================
-- LexDocs - Complete PostgreSQL Schema for Supabase
-- Multi-tenant Legal CRM/ERP SaaS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Trigger function: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 2. Organizations
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  logo_url    text,
  primary_color text,
  plan        text NOT NULL DEFAULT 'free'
              CHECK (plan IN ('free', 'pro', 'enterprise')),
  settings    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  role        text NOT NULL DEFAULT 'staff'
              CHECK (role IN ('owner', 'admin', 'lawyer', 'staff', 'client')),
  avatar_url  text,
  phone       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Pipelines & Pipeline Stages
-- ---------------------------------------------------------------------------
CREATE TABLE pipelines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name        text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pipeline_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES pipelines ON DELETE CASCADE,
  name        text NOT NULL,
  position    integer NOT NULL DEFAULT 0,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5. Contacts
-- ---------------------------------------------------------------------------
CREATE TABLE contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  first_name        text NOT NULL,
  last_name         text,
  email             text,
  phone             text,
  company           text,
  source            text DEFAULT 'manual'
                    CHECK (source IN ('website', 'referral', 'ads', 'manual', 'whatsapp', 'api')),
  status            text NOT NULL DEFAULT 'lead'
                    CHECK (status IN ('lead', 'contacted', 'qualified', 'client', 'lost', 'archived')),
  assigned_to       uuid REFERENCES users ON DELETE SET NULL,
  pipeline_stage_id uuid REFERENCES pipeline_stages ON DELETE SET NULL,
  custom_fields     jsonb DEFAULT '{}'::jsonb,
  notes_text        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Cases
-- ---------------------------------------------------------------------------
CREATE TABLE cases (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  contact_id         uuid NOT NULL REFERENCES contacts ON DELETE CASCADE,
  case_number        text,
  case_type          text NOT NULL DEFAULT 'other'
                     CHECK (case_type IN ('lso', 'concurso', 'other')),
  phase              text NOT NULL DEFAULT 'intake'
                     CHECK (phase IN (
                       'intake', 'document_collection', 'lawyer_review',
                       'drafting', 'filed', 'hearing', 'closed'
                     )),
  assigned_lawyer_id uuid REFERENCES users ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  progress           integer NOT NULL DEFAULT 0
                     CHECK (progress >= 0 AND progress <= 100),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Document Types (knowledge-base / checklist definitions)
-- ---------------------------------------------------------------------------
CREATE TABLE document_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  case_type       text,
  name            text NOT NULL,
  category        text,
  cat_num         integer,
  required        boolean NOT NULL DEFAULT false,
  kb_criteria     text,
  kb_issuer       text,
  kb_validity     text,
  kb_where_to_get text,
  sort_order      integer NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- 8. Documents
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid NOT NULL REFERENCES cases ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  doc_type_id     uuid REFERENCES document_types ON DELETE SET NULL,
  name            text NOT NULL,
  file_path       text,
  file_size       bigint,
  mime_type       text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'uploaded', 'review', 'approved', 'rejected')),
  ai_verification jsonb,
  uploaded_by     uuid REFERENCES users ON DELETE SET NULL,
  reviewed_by     uuid REFERENCES users ON DELETE SET NULL,
  review_note     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Payments
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           uuid NOT NULL REFERENCES cases ON DELETE CASCADE,
  org_id            uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  amount            numeric(10,2) NOT NULL,
  concept           text,
  due_date          date,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'upcoming', 'paid', 'failed', 'refunded')),
  payment_method    text
                    CHECK (payment_method IS NULL OR payment_method IN ('card', 'direct_debit', 'transfer', 'other')),
  invoice_number    text,
  paid_at           timestamptz,
  stripe_payment_id text,
  stripe_invoice_id text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 10. Events (calendar / tasks)
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       uuid REFERENCES cases ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  event_type    text NOT NULL
                CHECK (event_type IN ('call', 'deadline', 'meeting', 'hearing', 'task')),
  event_date    date NOT NULL,
  event_time    time,
  assigned_to   uuid REFERENCES users ON DELETE SET NULL,
  is_completed  boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES users ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 11. Notes
-- ---------------------------------------------------------------------------
CREATE TABLE notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid REFERENCES cases ON DELETE CASCADE,
  contact_id  uuid REFERENCES contacts ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES users ON DELETE CASCADE,
  content     text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 12. Activities (audit log)
-- ---------------------------------------------------------------------------
CREATE TABLE activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  entity_type   text NOT NULL
                CHECK (entity_type IN ('contact', 'case', 'document', 'payment', 'event')),
  entity_id     uuid NOT NULL,
  action        text NOT NULL
                CHECK (action IN (
                  'created', 'updated', 'status_changed', 'uploaded',
                  'approved', 'rejected', 'payment_received', 'note_added', 'assigned'
                )),
  description   text,
  performed_by  uuid REFERENCES users ON DELETE SET NULL,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 13. Tags & Contact-Tags (many-to-many)
-- ---------------------------------------------------------------------------
CREATE TABLE tags (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id  uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name    text NOT NULL,
  color   text,
  UNIQUE (org_id, name)
);

CREATE TABLE contact_tags (
  contact_id uuid NOT NULL REFERENCES contacts ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES tags ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- 14. API Keys
-- ---------------------------------------------------------------------------
CREATE TABLE api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name        text NOT NULL,
  key_hash    text NOT NULL UNIQUE,
  permissions jsonb DEFAULT '{}'::jsonb,
  last_used_at timestamptz,
  expires_at  timestamptz,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES users ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- contacts
CREATE INDEX idx_contacts_org_id      ON contacts (org_id);
CREATE INDEX idx_contacts_status      ON contacts (status);
CREATE INDEX idx_contacts_assigned_to ON contacts (assigned_to);
CREATE INDEX idx_contacts_email       ON contacts (email);

-- cases
CREATE INDEX idx_cases_org_id             ON cases (org_id);
CREATE INDEX idx_cases_contact_id         ON cases (contact_id);
CREATE INDEX idx_cases_assigned_lawyer_id ON cases (assigned_lawyer_id);
CREATE INDEX idx_cases_status             ON cases (status);

-- documents
CREATE INDEX idx_documents_case_id ON documents (case_id);
CREATE INDEX idx_documents_org_id  ON documents (org_id);
CREATE INDEX idx_documents_status  ON documents (status);

-- payments
CREATE INDEX idx_payments_case_id  ON payments (case_id);
CREATE INDEX idx_payments_org_id   ON payments (org_id);
CREATE INDEX idx_payments_status   ON payments (status);
CREATE INDEX idx_payments_due_date ON payments (due_date);

-- activities
CREATE INDEX idx_activities_org_id      ON activities (org_id);
CREATE INDEX idx_activities_entity      ON activities (entity_type, entity_id);
CREATE INDEX idx_activities_created_at  ON activities (created_at DESC);

-- api_keys
CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Helper SECURITY DEFINER: el org_id del usuario actual. Bypassa RLS, lo que
-- evita recursión infinita cuando una policy de `users` necesita consultar
-- `users` (migration-010 lo redefine igual; CREATE OR REPLACE es idempotente).
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid()
$$;

-- ---- organizations --------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org" ON organizations
  FOR SELECT USING (id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org" ON organizations
  FOR UPDATE USING (id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- users ----------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Usa auth_org_id() (SECURITY DEFINER) en vez de una subconsulta a `users`:
-- esa subconsulta dispararía esta misma policy → recursión infinita (42P17).
CREATE POLICY "Users can view own org data" ON users
  FOR SELECT USING (id = auth.uid() OR org_id = auth_org_id());

CREATE POLICY "Users can insert own org data" ON users
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "Users can update own org data" ON users
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "Users can delete own org data" ON users
  FOR DELETE USING (org_id = auth_org_id());

-- ---- pipelines ------------------------------------------------------------
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON pipelines
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON pipelines
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON pipelines
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON pipelines
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- pipeline_stages ------------------------------------------------------
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org pipeline stages" ON pipeline_stages
  FOR SELECT USING (
    pipeline_id IN (SELECT id FROM pipelines WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
  );

CREATE POLICY "Users can insert own org pipeline stages" ON pipeline_stages
  FOR INSERT WITH CHECK (
    pipeline_id IN (SELECT id FROM pipelines WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
  );

CREATE POLICY "Users can update own org pipeline stages" ON pipeline_stages
  FOR UPDATE USING (
    pipeline_id IN (SELECT id FROM pipelines WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
  );

CREATE POLICY "Users can delete own org pipeline stages" ON pipeline_stages
  FOR DELETE USING (
    pipeline_id IN (SELECT id FROM pipelines WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
  );

-- ---- contacts -------------------------------------------------------------
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON contacts
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON contacts
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON contacts
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON contacts
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- cases ----------------------------------------------------------------
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON cases
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON cases
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON cases
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON cases
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- document_types -------------------------------------------------------
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON document_types
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON document_types
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON document_types
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON document_types
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- documents ------------------------------------------------------------
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON documents
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON documents
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON documents
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON documents
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- payments -------------------------------------------------------------
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON payments
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON payments
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON payments
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON payments
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- events ---------------------------------------------------------------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON events
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON events
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON events
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON events
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- notes ----------------------------------------------------------------
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON notes
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON notes
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON notes
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON notes
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- activities -----------------------------------------------------------
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON activities
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON activities
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON activities
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON activities
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- tags -----------------------------------------------------------------
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON tags
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON tags
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON tags
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON tags
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- contact_tags ---------------------------------------------------------
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org contact tags" ON contact_tags
  FOR SELECT USING (
    contact_id IN (SELECT id FROM contacts WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
  );

CREATE POLICY "Users can insert own org contact tags" ON contact_tags
  FOR INSERT WITH CHECK (
    contact_id IN (SELECT id FROM contacts WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
  );

CREATE POLICY "Users can delete own org contact tags" ON contact_tags
  FOR DELETE USING (
    contact_id IN (SELECT id FROM contacts WHERE org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
  );

-- ---- api_keys -------------------------------------------------------------
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON api_keys
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON api_keys
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON api_keys
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON api_keys
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));


-- ============================================================================
-- Migration 001: Add tenants table + link to organizations
-- LibreApp Suite SaaS Multi-tenant
-- ============================================================================

-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#5B6BF0',
  secondary_color text DEFAULT '#7C5BF0',
  plan text NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'starter', 'pro', 'premium', 'enterprise')),
  modules_enabled text[] NOT NULL DEFAULT ARRAY['lexdocs'],
  carlota_enabled boolean NOT NULL DEFAULT true,
  carlota_settings jsonb DEFAULT '{}'::jsonb,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  max_users integer NOT NULL DEFAULT 3,
  max_cases integer NOT NULL DEFAULT 50,
  max_carlota_messages_per_day integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add trigger for updated_at
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Add tenant_id to organizations (link existing orgs to tenants)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- 4. Create default tenant for existing data

-- 5. Link existing organization to the tenant
UPDATE organizations
SET tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- 6. Disable RLS on tenants (same as organizations - accessed via auth.uid() lookup)
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- 7. Create index
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_tenant_id ON organizations(tenant_id);

-- 8. Carlota tables
CREATE TABLE IF NOT EXISTS carlota_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL DEFAULT 'general'
    CHECK (module IN ('lexdocs', 'lexcrm', 'lexconsulta', 'general')),
  context jsonb DEFAULT '{}'::jsonb,
  title text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carlota_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES carlota_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  tools_used jsonb,
  sources_cited jsonb,
  tokens_used integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for Carlota
CREATE INDEX IF NOT EXISTS idx_carlota_conv_tenant ON carlota_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_carlota_conv_user ON carlota_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_carlota_msgs_conv ON carlota_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_carlota_msgs_created ON carlota_messages(created_at DESC);

-- Disable RLS on Carlota tables (protected by tenant_id + user_id in queries)
ALTER TABLE carlota_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE carlota_messages DISABLE ROW LEVEL SECURITY;

-- Done!
SELECT 'Migration 001 completed: tenants + carlota tables created' AS status;


-- ============================================================================
-- Migration 002: LexConsulta - Jurisprudencia + Legislación + pgvector
-- ============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Jurisprudence table (shared - NOT per tenant, public legal data)
CREATE TABLE IF NOT EXISTS jurisprudence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'cendoj'
    CHECK (source IN ('cendoj', 'tribunal_constitucional', 'tjue', 'manual')),
  tribunal text,
  sala text,
  reference text UNIQUE,
  case_date date,
  ponente text,
  matter text[] DEFAULT '{}',
  summary text,
  full_text text,
  url text,
  embedding vector(1024),
  indexed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Full-text search index (Spanish)
CREATE INDEX IF NOT EXISTS idx_juris_fts
  ON jurisprudence
  USING gin(to_tsvector('spanish', coalesce(summary, '') || ' ' || coalesce(full_text, '')));

-- Vector similarity index
CREATE INDEX IF NOT EXISTS idx_juris_embedding
  ON jurisprudence
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Regular indexes
CREATE INDEX IF NOT EXISTS idx_juris_source ON jurisprudence(source);
CREATE INDEX IF NOT EXISTS idx_juris_tribunal ON jurisprudence(tribunal);
CREATE INDEX IF NOT EXISTS idx_juris_date ON jurisprudence(case_date DESC);
CREATE INDEX IF NOT EXISTS idx_juris_matter ON jurisprudence USING gin(matter);
CREATE INDEX IF NOT EXISTS idx_juris_reference ON jurisprudence(reference);

-- 3. Legislation table (shared - public legal data from BOE)
CREATE TABLE IF NOT EXISTS legislation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'boe'
    CHECK (source IN ('boe', 'eurlex', 'ccaa', 'manual')),
  title text NOT NULL,
  reference text UNIQUE,
  body text,
  publication_date date,
  effective_date date,
  status text DEFAULT 'vigente'
    CHECK (status IN ('vigente', 'derogada', 'modificada', 'pendiente')),
  category text,
  url text,
  embedding vector(1024),
  indexed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legis_fts
  ON legislation
  USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(body, '')));

CREATE INDEX IF NOT EXISTS idx_legis_embedding
  ON legislation
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_legis_source ON legislation(source);
CREATE INDEX IF NOT EXISTS idx_legis_status ON legislation(status);
CREATE INDEX IF NOT EXISTS idx_legis_date ON legislation(publication_date DESC);

-- 4. Procedural knowledge (PER tenant - curated by each firm)
CREATE TABLE IF NOT EXISTS procedural_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  embedding vector(1024),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proc_knowledge_tenant ON procedural_knowledge(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proc_knowledge_fts
  ON procedural_knowledge
  USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, '')));

-- 5. Search history (per tenant, for analytics)
CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query text NOT NULL,
  filters jsonb DEFAULT '{}',
  results_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_history_tenant ON search_history(tenant_id);

-- 6. Saved searches / bookmarks
CREATE TABLE IF NOT EXISTS saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('jurisprudence', 'legislation', 'knowledge')),
  item_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);

-- 7. Disable RLS on shared tables (public legal data)
ALTER TABLE jurisprudence DISABLE ROW LEVEL SECURITY;
ALTER TABLE legislation DISABLE ROW LEVEL SECURITY;
ALTER TABLE procedural_knowledge DISABLE ROW LEVEL SECURITY;
ALTER TABLE search_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items DISABLE ROW LEVEL SECURITY;

-- 8. Seed: sample jurisprudence for LSO/concursal

-- 9. Seed: sample legislation for LSO/concursal

-- Done!
SELECT 'Migration 002 completed: LexConsulta tables + seed data created' AS status;


-- =============================================================================
-- Migration 003: Equipo legal - abogados, procuradores, datos colegiales
-- =============================================================================

-- 1. Añadir columnas profesionales a users
ALTER TABLE users ADD COLUMN IF NOT EXISTS colegio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS colegiado_num text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_title text;

-- 2. Permitir role 'procurador' (drop & recreate del check constraint)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'admin', 'lawyer', 'procurador', 'staff', 'client'));

-- 3. Hacer opcional la FK a auth.users (permite añadir miembros del equipo
--    aunque no tengan cuenta de login todavía). Mantenemos el ID como UUID.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 4. Añadir assigned_procurador_id a cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_procurador_id uuid REFERENCES users ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cases_assigned_procurador ON cases(assigned_procurador_id);

-- 5. Añadir email único pero permitiendo duplicados de UUID
-- (la tabla users ya tiene email no único; lo dejamos así)

-- 6. Insertar los 3 profesionales del equipo
-- Si ya existen por email, no los duplica



SELECT 'Migration 003 completed: equipo legal añadido' AS status;


-- =============================================================================
-- Migration 004: Mensajes cliente-abogado + WhatsApp interno
-- =============================================================================

-- 1. Añadir whatsapp/teléfono interno a users (phone ya existe)
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp text;
COMMENT ON COLUMN users.phone IS 'Teléfono interno - NUNCA visible a clientes';
COMMENT ON COLUMN users.whatsapp IS 'Número WhatsApp interno - NUNCA visible a clientes';

-- 2. Tabla messages: comunicación entre cliente (contact) y staff (user)
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  case_id uuid REFERENCES cases(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,

  -- Quién envía: o un user (staff/abogado/procurador) o un contact (cliente)
  from_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,

  -- Quién recibe (puede ser un user o un contact)
  to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  to_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,

  content text NOT NULL,
  attachment_url text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- 3. Tabla notifications_log: para auditar emails/WhatsApp enviados
CREATE TABLE IF NOT EXISTS notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'in_app')),
  event_type text NOT NULL,
  recipient_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_email text,
  recipient_phone text,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_org ON notifications_log(org_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_created ON notifications_log(created_at DESC);
ALTER TABLE notifications_log DISABLE ROW LEVEL SECURITY;

SELECT 'Migration 004 completed: messages + notifications + whatsapp field' AS status;


-- =============================================================================
-- Migration 005: Milestones + Review documental + Campos workflow
-- =============================================================================

-- 1. Añadir campos a cases para milestones y timing workflow
ALTER TABLE cases ADD COLUMN IF NOT EXISTS milestone_shown jsonb DEFAULT '{}'::jsonb;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS phase_changed_at timestamptz;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS completion_notified_at timestamptz;
COMMENT ON COLUMN cases.milestone_shown IS 'Guarda qué milestones % ya se han mostrado al cliente (ej: {"25":true, "50":true})';

-- 2. Añadir campos a documents para workflow review
-- (status ya existe con check pending/uploaded/review/approved/rejected)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path text;
COMMENT ON COLUMN documents.review_note IS 'Comentario del letrado al aprobar/rechazar';
COMMENT ON COLUMN documents.storage_path IS 'Ruta en Supabase Storage (bucket documents)';

-- 3. Añadir invoice_url a payments para Stripe
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_url text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
COMMENT ON COLUMN payments.invoice_url IS 'URL Stripe hosted invoice para descarga PDF';

-- 4. Añadir service_description a payments (qué incluye cada cuota)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS service_description text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS services_included jsonb;
COMMENT ON COLUMN payments.services_included IS 'Array de servicios incluidos en esa cuota para mostrar desglose al cliente';

-- 5. Función para recalcular progress de un caso
CREATE OR REPLACE FUNCTION recalculate_case_progress(p_case_id uuid)
RETURNS integer AS $$
DECLARE
  v_total_docs integer;
  v_approved_docs integer;
  v_new_progress integer;
  v_case_org_id uuid;
  v_case_type text;
BEGIN
  -- Obtener org_id y case_type del caso
  SELECT org_id, case_type INTO v_case_org_id, v_case_type
  FROM cases WHERE id = p_case_id;

  IF v_case_org_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Contar documentos requeridos según document_types para este tipo de caso y org
  SELECT COUNT(*) INTO v_total_docs
  FROM document_types
  WHERE org_id = v_case_org_id
    AND case_type = v_case_type
    AND required = true;

  -- Contar documentos aprobados/entregados del caso
  SELECT COUNT(*) INTO v_approved_docs
  FROM documents
  WHERE case_id = p_case_id
    AND status IN ('approved', 'uploaded');

  IF v_total_docs = 0 THEN
    v_new_progress := 0;
  ELSE
    v_new_progress := LEAST(100, ROUND((v_approved_docs::numeric / v_total_docs::numeric) * 100));
  END IF;

  UPDATE cases SET progress = v_new_progress, updated_at = now()
  WHERE id = p_case_id;

  RETURN v_new_progress;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger: al aprobar/rechazar un doc, recalcular progress y cambiar fase si llega al 100
CREATE OR REPLACE FUNCTION on_document_status_change()
RETURNS TRIGGER AS $$
DECLARE
  new_progress integer;
  current_phase text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    new_progress := recalculate_case_progress(NEW.case_id);

    -- Si llega al 100, pasar fase a lawyer_review (solo si estaba en document_collection)
    SELECT phase INTO current_phase FROM cases WHERE id = NEW.case_id;
    IF new_progress >= 100 AND current_phase = 'document_collection' THEN
      UPDATE cases
      SET phase = 'lawyer_review',
          phase_changed_at = now()
      WHERE id = NEW.case_id;

      -- Log activity
      INSERT INTO activities (org_id, entity_type, entity_id, action, description, metadata)
      SELECT org_id, 'case', id, 'status_changed',
             'Documentación completa. Pasada a revisión letrada.',
             jsonb_build_object('new_phase', 'lawyer_review', 'progress', 100)
      FROM cases WHERE id = NEW.case_id;
    END IF;

    -- Log actividad de aprobación/rechazo
    IF NEW.status = 'approved' THEN
      INSERT INTO activities (org_id, entity_type, entity_id, action, description, performed_by)
      VALUES (NEW.org_id, 'document', NEW.id, 'approved',
              'Documento aprobado: ' || COALESCE(NEW.name, 'Sin nombre'),
              NEW.reviewed_by);
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO activities (org_id, entity_type, entity_id, action, description, performed_by, metadata)
      VALUES (NEW.org_id, 'document', NEW.id, 'rejected',
              'Documento rechazado: ' || COALESCE(NEW.name, 'Sin nombre'),
              NEW.reviewed_by,
              jsonb_build_object('review_note', NEW.review_note));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_status_change ON documents;
CREATE TRIGGER trg_documents_status_change
  AFTER UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION on_document_status_change();

-- 7. Crear bucket de storage para documentos (si no existe)
-- NOTA: Los buckets se crean mediante Storage API, no SQL. Este comentario recuerda crearlo desde Supabase Dashboard:
-- Dashboard → Storage → New bucket → name: "documents" → public: false

-- 8. Seed: servicios incluidos en las cuotas existentes de María (LSO)
UPDATE payments
SET services_included = jsonb_build_array(
  'Análisis de viabilidad del caso',
  'Revisión inicial de deuda',
  'Primera consulta con letrado'
),
service_description = 'Fase inicial del procedimiento'
WHERE case_id = 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee'
  AND concept LIKE '%Análisis%';

UPDATE payments
SET services_included = jsonb_build_array(
  'Recogida y verificación documental con IA',
  'Preparación del expediente',
  'Atención continuada vía plataforma'
),
service_description = 'Gestión mensual durante la fase documental'
WHERE case_id = 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee'
  AND concept LIKE '%Mensualidad%';

SELECT 'Migration 005 completed: milestones + review + payments enhancements' AS status;


-- =============================================================================
-- Migration 006: Estado "No aplica" para documentos
-- Permite que cliente/letrado marquen un documento como no necesario para
-- ese caso concreto (ej: un cliente sin empresa no necesita escrituras societarias).
-- =============================================================================

-- 1. Ampliar el CHECK de status para permitir 'not_applicable'
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('pending', 'uploaded', 'review', 'approved', 'rejected', 'not_applicable'));

-- 2. Campo para guardar por qué se marcó como no aplica (opcional)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS not_applicable_reason text;
COMMENT ON COLUMN documents.not_applicable_reason IS 'Razón por la que el documento no es necesario (ej: "No es autónomo")';

-- 3. Refinar función recalculate_case_progress:
--    - Ignorar docs marcados como 'not_applicable' del denominador
--    - Contar aprobados/entregados en numerador
CREATE OR REPLACE FUNCTION recalculate_case_progress(p_case_id uuid)
RETURNS integer AS $$
DECLARE
  v_total_required integer;
  v_completed integer;
  v_not_applicable integer;
  v_new_progress integer;
  v_case_org_id uuid;
  v_case_type text;
BEGIN
  SELECT org_id, case_type INTO v_case_org_id, v_case_type
  FROM cases WHERE id = p_case_id;

  IF v_case_org_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Total de document_types requeridos para este tipo de caso
  SELECT COUNT(*) INTO v_total_required
  FROM document_types
  WHERE org_id = v_case_org_id
    AND case_type = v_case_type
    AND required = true;

  -- Cuántos docs del caso han sido marcados como not_applicable
  SELECT COUNT(*) INTO v_not_applicable
  FROM documents
  WHERE case_id = p_case_id
    AND status = 'not_applicable';

  -- Cuántos están aprobados o entregados
  SELECT COUNT(*) INTO v_completed
  FROM documents
  WHERE case_id = p_case_id
    AND status IN ('approved', 'uploaded');

  -- Denominador = requeridos totales - los marcados no aplica
  v_total_required := GREATEST(0, v_total_required - v_not_applicable);

  IF v_total_required = 0 THEN
    -- Si todos son not_applicable, consideramos caso completo
    v_new_progress := 100;
  ELSE
    v_new_progress := LEAST(100, ROUND((v_completed::numeric / v_total_required::numeric) * 100));
  END IF;

  UPDATE cases SET progress = v_new_progress, updated_at = now()
  WHERE id = p_case_id;

  RETURN v_new_progress;
END;
$$ LANGUAGE plpgsql;

-- 4. Refinar trigger: que también se dispare al marcar/desmarcar not_applicable
-- (el trigger actual ya se dispara en cualquier cambio de status, así que va bien)

SELECT 'Migration 006 completed: estado not_applicable a\u00f1adido a documents' AS status;


-- =============================================================================
-- Migration 007: Tareas con calendario, recordatorios, push y Google Calendar
-- =============================================================================

-- 1. Ampliar tabla events para tareas/recordatorios/recurrencia
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence text
  CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_until date;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_minutes_before integer DEFAULT 30;
ALTER TABLE events ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 30;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location text;

CREATE INDEX IF NOT EXISTS idx_events_assigned_to ON events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_pending_reminder ON events(event_date, event_time)
  WHERE notification_sent_at IS NULL AND is_completed = false;

-- 2. Web Push subscriptions (suscripciones del navegador del usuario)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;

-- 3. Centro de notificaciones in-app (bell icon)
CREATE TABLE IF NOT EXISTS notifications_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  icon text,
  type text,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_inbox_user_unread
  ON notifications_inbox(user_id, is_read, created_at DESC);
ALTER TABLE notifications_inbox DISABLE ROW LEVEL SECURITY;

-- 4. Conexiones Google Calendar (OAuth tokens por usuario)
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  google_email text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  calendar_id text DEFAULT 'primary',
  block_busy_slots boolean DEFAULT true,
  sync_tasks boolean DEFAULT false,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE google_calendar_connections DISABLE ROW LEVEL SECURITY;

-- 5. Función para crear próxima ocurrencia de tarea recurrente
CREATE OR REPLACE FUNCTION create_next_recurrence(p_event_id uuid)
RETURNS uuid AS $$
DECLARE
  r_case_id uuid;
  r_org_id uuid;
  r_title text;
  r_description text;
  r_event_type text;
  r_event_date date;
  r_event_time time;
  r_assigned_to uuid;
  r_created_by uuid;
  r_recurrence text;
  r_recurrence_until date;
  r_reminder integer;
  r_priority text;
  r_duration integer;
  r_location text;
  r_parent_id uuid;
  v_new_id uuid;
  v_next_date date;
BEGIN
  SELECT case_id, org_id, title, description, event_type, event_date, event_time,
         assigned_to, created_by, recurrence, recurrence_until, reminder_minutes_before,
         priority, duration_minutes, location, recurrence_parent_id
  INTO r_case_id, r_org_id, r_title, r_description, r_event_type, r_event_date, r_event_time,
       r_assigned_to, r_created_by, r_recurrence, r_recurrence_until, r_reminder,
       r_priority, r_duration, r_location, r_parent_id
  FROM events WHERE id = p_event_id;

  IF r_recurrence IS NULL THEN RETURN NULL; END IF;

  IF r_recurrence = 'daily' THEN
    v_next_date := r_event_date + INTERVAL '1 day';
  ELSIF r_recurrence = 'weekly' THEN
    v_next_date := r_event_date + INTERVAL '1 week';
  ELSIF r_recurrence = 'monthly' THEN
    v_next_date := r_event_date + INTERVAL '1 month';
  ELSE
    RETURN NULL;
  END IF;

  IF r_recurrence_until IS NOT NULL AND v_next_date > r_recurrence_until THEN
    RETURN NULL;
  END IF;

  INSERT INTO events (
    case_id, org_id, title, description, event_type, event_date, event_time,
    assigned_to, created_by, recurrence, recurrence_until, reminder_minutes_before,
    priority, duration_minutes, location, recurrence_parent_id
  )
  VALUES (
    r_case_id, r_org_id, r_title, r_description, r_event_type,
    v_next_date, r_event_time, r_assigned_to, r_created_by,
    r_recurrence, r_recurrence_until, r_reminder,
    r_priority, r_duration, r_location,
    COALESCE(r_parent_id, p_event_id)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger: al marcar tarea recurrente como completed, crear la siguiente
CREATE OR REPLACE FUNCTION on_event_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_completed = true AND (OLD.is_completed IS DISTINCT FROM true) THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
    IF NEW.recurrence IS NOT NULL THEN
      PERFORM create_next_recurrence(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_completed ON events;
CREATE TRIGGER trg_event_completed
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION on_event_completed();

-- 7. pg_cron para disparar el cron de recordatorios cada 5 minutos
-- NOTA: Si pg_cron no está disponible en tu plan, comenta este bloque y usa GitHub Actions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    -- Asume que existe la extension http o pg_net. Probar primero pg_net.
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
      CREATE EXTENSION IF NOT EXISTS pg_net;
    END IF;
  END IF;
END $$;

SELECT 'Migration 007 completed: tareas, recordatorios, push, GCal y recurrencia' AS status;


-- =============================================================================
-- Migration 008: Tareas, reuniones y archivos vinculados a contactos (leads)
-- =============================================================================

-- 1. Eventos pueden estar vinculados a un contact (lead) sin caso aún
ALTER TABLE events ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE events ALTER COLUMN case_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_contact_id ON events(contact_id);

-- 2. Documentos pueden estar vinculados a un contact (sin caso)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE documents ALTER COLUMN case_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_contact_id ON documents(contact_id);

-- Garantizar que un documento esté ligado al menos a un caso o un contacto
ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_documents_parent;
ALTER TABLE documents ADD CONSTRAINT chk_documents_parent
  CHECK (case_id IS NOT NULL OR contact_id IS NOT NULL);

ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_events_parent;
ALTER TABLE events ADD CONSTRAINT chk_events_parent
  CHECK (case_id IS NOT NULL OR contact_id IS NOT NULL);

SELECT 'Migration 008 completed: contact tasks + files' AS status;


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


-- =============================================================================
-- Migration 011: Storage policies para bucket "documents"
-- =============================================================================
-- Convención de paths: <org_id>/<entity_type>/<entity_id>/<filename>
-- Ejemplo: "aaaa-...-bbbb/contacts/cccc-...-dddd/1729012345-factura.pdf"
--
-- Las policies usan storage.foldername(name) que descompone el path en
-- segmentos. El primer segmento debe ser el UUID de la organización del
-- usuario autenticado.
-- =============================================================================

-- Asegurar que existe el bucket (idempotente). Privado: requiere signed URL o
-- policy explícita para cualquier acceso.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Helper: org_id del usuario autenticado como texto (para comparar con foldername)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_org_id_text()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id::text FROM public.users WHERE id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- Policies sobre storage.objects filtradas por bucket 'documents'
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "docs: select own org" ON storage.objects;
CREATE POLICY "docs: select own org" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.auth_org_id_text()
  );

DROP POLICY IF EXISTS "docs: insert own org" ON storage.objects;
CREATE POLICY "docs: insert own org" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.auth_org_id_text()
  );

DROP POLICY IF EXISTS "docs: update own org" ON storage.objects;
CREATE POLICY "docs: update own org" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.auth_org_id_text()
  );

DROP POLICY IF EXISTS "docs: delete own org" ON storage.objects;
CREATE POLICY "docs: delete own org" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.auth_org_id_text()
  );

-- Nota: las Edge Functions que usan SUPABASE_SERVICE_ROLE_KEY bypassan estas
-- policies, igual que con las tablas. Para clientes cliente-final (contactos
-- accediendo a sus propios docs), conviene generar signed URLs desde una Edge
-- Function que valide que el caller es el contact dueño, en lugar de dar
-- acceso directo al bucket.

SELECT 'Migration 011 OK: storage policies bucket documents' AS status;


-- =============================================================================
-- Migration 012: Datos de facturación a nivel de contacto (cliente)
-- =============================================================================
-- Permite guardar método de pago preferido, IBAN para domiciliación y estado
-- del mandato SEPA. Así el portal cliente muestra y permite modificar su
-- configuración de facturación de forma persistente.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_payment_method text
  CHECK (preferred_payment_method IS NULL OR preferred_payment_method IN
    ('direct_debit', 'card', 'transfer'));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS billing_iban text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS billing_account_holder text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sepa_mandate_signed_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sepa_mandate_reference text;

-- Índice para búsquedas por IBAN (raro, pero útil para auditoría de cobros)
CREATE INDEX IF NOT EXISTS idx_contacts_iban ON contacts(billing_iban)
  WHERE billing_iban IS NOT NULL;

SELECT 'Migration 012 OK: billing fields on contacts' AS status;


-- =============================================================================
-- Migration 013: Campos de facturación del tenant (licencias SaaS)
-- =============================================================================
-- Permite que el admin del despacho gestione su suscripción a LibreApp:
-- ciclo (mensual/anual), número de licencias contratadas (plan team),
-- renovación automática, fecha de fin del periodo actual y última notificación
-- de renovación enviada.

-- Nuevos planes que admitirá la columna tenants.plan:
--   trial             — periodo de prueba
--   individual        — 1 licencia (120€/mes o 99€/mes anual)
--   team              — hasta 5 licencias (79€/mes por licencia o 59€/mes anual)
--   enterprise        — sobre medida (se mantiene)
-- Planes legacy (starter/pro/premium) siguen siendo válidos para no romper
-- tenants existentes.

-- Ciclo de facturación
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle text
  CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'yearly'));

-- Nº de licencias contratadas (solo aplica a plan "team"; para "individual" es 1)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_count integer NOT NULL DEFAULT 1
  CHECK (license_count >= 1 AND license_count <= 100);

-- Renovación automática
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;

-- Fin del periodo actual (cuando termina la suscripción vigente)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- Última fecha en que se notificó la renovación próxima al admin
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS renewal_notified_at timestamptz;

-- Estado de la suscripción (viene del webhook de Stripe)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status text
  CHECK (subscription_status IS NULL OR subscription_status IN
    ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'));

-- Índice para cron job de recordatorios (buscar tenants con renovación cercana)
CREATE INDEX IF NOT EXISTS idx_tenants_renewal
  ON tenants (current_period_end)
  WHERE auto_renew = true AND subscription_status = 'active';

SELECT 'Migration 013 OK: tenant billing fields' AS status;


-- =============================================================================
-- Migration 014: Enforcement de licencias + programación del cron de renovación
-- =============================================================================
--
-- 1. Trigger BEFORE INSERT en users que bloquea si se excede license_count
--    del tenant (cuenta staff + lawyer; los contact/client NO consumen licencia).
-- 2. Programa el cron diario para renewal-reminders-cron (pg_cron + pg_net).
--
-- Nota: rol "client" / "contact" no ocupa licencia (son usuarios del portal
-- del cliente, no del despacho). Sólo "admin", "owner", "lawyer", "staff",
-- "sales" cuentan.

-- -----------------------------------------------------------------------------
-- 1. TRIGGER — enforce license_count
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_license_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_license_count integer;
  v_current_count integer;
BEGIN
  -- Los roles que consumen licencia (ajustar si añades roles nuevos)
  IF NEW.role IS NULL OR NEW.role NOT IN ('admin','owner','lawyer','staff','sales','procurador') THEN
    RETURN NEW;
  END IF;

  SELECT o.tenant_id, t.license_count
    INTO v_tenant_id, v_license_count
  FROM organizations o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE o.id = NEW.org_id;

  IF v_license_count IS NULL THEN
    -- Tenant sin license_count seteado → dejar pasar (trial u onboarding)
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int
    INTO v_current_count
  FROM users u
  JOIN organizations o ON o.id = u.org_id
  WHERE o.tenant_id = v_tenant_id
    AND u.role IN ('admin','owner','lawyer','staff','sales','procurador');

  IF v_current_count >= v_license_count THEN
    RAISE EXCEPTION 'Límite de licencias alcanzado (%/%). Amplía tu plan en Configuración → Facturación.',
      v_current_count, v_license_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_license_limit ON users;
CREATE TRIGGER trg_enforce_license_limit
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_license_limit();

-- -----------------------------------------------------------------------------
-- 2. Cron diario para recordatorios de renovación
-- -----------------------------------------------------------------------------
-- Requiere extensiones pg_cron + pg_net (disponibles en Supabase Pro).
-- Si no están disponibles, este bloque no falla — solo emite un aviso.

DO $$
DECLARE
  v_supabase_url text;
  v_cron_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no disponible. Programa el cron manualmente desde un servicio externo (GitHub Actions, Upstash, etc.)';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  -- Eliminar job previo si existe
  PERFORM cron.unschedule('renewal-reminders-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'renewal-reminders-daily');

  -- Programar diario a las 09:00 UTC (10:00 hora España en invierno, 11:00 en verano)
  -- Nota: sustituye <PROJECT_REF> y <CRON_SECRET> por valores reales tras aplicar la migración.
  -- Este bloque DEJA el cron programado con placeholders; hay que ACTUALIZARLO con el
  -- secreto real desde el SQL Editor una vez definas CRON_SECRET en los secrets de
  -- Edge Functions. Ver instrucciones en el commit.
  RAISE NOTICE 'Para activar el cron, ejecuta manualmente (sustituyendo los valores):';
  RAISE NOTICE '  SELECT cron.schedule(';
  RAISE NOTICE '    ''renewal-reminders-daily'',';
  RAISE NOTICE '    ''0 9 * * *'',';
  RAISE NOTICE '    $cron$ SELECT net.http_post(';
  RAISE NOTICE '      url := ''https://<PROJECT_REF>.supabase.co/functions/v1/renewal-reminders-cron'',';
  RAISE NOTICE '      headers := jsonb_build_object(''X-Cron-Secret'', ''<CRON_SECRET>''),';
  RAISE NOTICE '      body := ''{}''::jsonb';
  RAISE NOTICE '    ); $cron$';
  RAISE NOTICE '  );';
END $$;

SELECT 'Migration 014 OK: license enforcement + cron template' AS status;


-- =============================================================================
-- Migration 015: Enforcement de licencias también en UPDATE de role/org
-- =============================================================================
--
-- La migración 014 solo valida el límite de licencias en BEFORE INSERT. Eso deja
-- un hueco: promover un usuario existente (p.ej. role 'contact' → 'lawyer') vía
-- UPDATE no dispara la comprobación y permite superar el plan contratado sin
-- pagar. Esta migración añade un trigger BEFORE UPDATE que cierra ese hueco.
--
-- Lógica: solo se valida cuando el cambio AÑADE un asiento de licencia a un
-- tenant, es decir, cuando NEW.role es de pago y, o bien el rol anterior no
-- consumía licencia, o el usuario se mueve a otra organización/tenant.
-- El recuento excluye al propio usuario (u.id <> NEW.id) para no contarlo dos
-- veces.

CREATE OR REPLACE FUNCTION enforce_license_limit_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_license_count integer;
  v_current_count integer;
  v_licensed_roles text[] := ARRAY['admin','owner','lawyer','staff','sales','procurador'];
BEGIN
  -- El nuevo rol no consume licencia → nada que validar.
  IF NEW.role IS NULL OR NOT (NEW.role = ANY(v_licensed_roles)) THEN
    RETURN NEW;
  END IF;

  -- Ya consumía un asiento en la MISMA organización → no se añade asiento nuevo.
  IF OLD.role = ANY(v_licensed_roles) AND OLD.org_id IS NOT DISTINCT FROM NEW.org_id THEN
    RETURN NEW;
  END IF;

  SELECT o.tenant_id, t.license_count
    INTO v_tenant_id, v_license_count
  FROM organizations o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE o.id = NEW.org_id;

  IF v_license_count IS NULL THEN
    RETURN NEW; -- Tenant sin license_count (trial/onboarding) → dejar pasar.
  END IF;

  SELECT COUNT(*)::int
    INTO v_current_count
  FROM users u
  JOIN organizations o ON o.id = u.org_id
  WHERE o.tenant_id = v_tenant_id
    AND u.role = ANY(v_licensed_roles)
    AND u.id <> NEW.id;

  IF v_current_count >= v_license_count THEN
    RAISE EXCEPTION 'Límite de licencias alcanzado (%/%). Amplía tu plan en Configuración → Facturación.',
      v_current_count, v_license_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_license_limit_update ON users;
CREATE TRIGGER trg_enforce_license_limit_update
  BEFORE UPDATE OF role, org_id ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_license_limit_on_update();

SELECT 'Migration 015 OK: license enforcement en UPDATE' AS status;


-- =============================================================================
-- Migration 016: search_history privado por usuario (cierra fuga intra-tenant)
-- =============================================================================
--
-- La policy SELECT de la migración 010 usa OR:
--   USING (user_id = auth.uid() OR tenant_id = auth_tenant_id())
-- El segundo término permite que CUALQUIER miembro del despacho lea el historial
-- de búsquedas de TODOS sus compañeros (estrategia legal, nombres de clientes,
-- líneas de investigación). El historial de búsqueda debe ser privado de cada
-- usuario. Fix: restringir SELECT a las búsquedas propias.
--
-- Nota: las filas con user_id NULL (búsquedas de sistema/anónimas que permite la
-- policy de INSERT) dejan de ser legibles vía cliente, que es el comportamiento
-- correcto para datos sin dueño. El service_role sigue viéndolas (bypassa RLS).

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sh own select" ON search_history;
CREATE POLICY "sh own select" ON search_history
  FOR SELECT USING (user_id = auth.uid());

SELECT 'Migration 016 OK: search_history privado por usuario' AS status;


-- =============================================================================
-- Migration 017: lookup público (pre-login) del tenant por slug
-- =============================================================================
--
-- El frontend necesita resolver el despacho (marca/branding) ANTES de iniciar
-- sesión, pero la tabla tenants tiene RLS (id = auth_tenant_id()), no legible de
-- forma anónima. En vez de abrir toda la tabla al rol anon (lo que expondría
-- stripe_customer_id, settings, etc.), exponemos una función SECURITY DEFINER que
-- devuelve SOLO los campos de marca de un tenant activo.

CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  plan text,
  modules_enabled text[],
  carlota_enabled boolean,
  carlota_settings jsonb,
  trial_ends_at timestamptz,
  is_active boolean,
  max_users integer,
  max_cases integer,
  max_carlota_messages_per_day integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, slug, name, logo_url, primary_color, secondary_color,
         plan, modules_enabled, carlota_enabled, carlota_settings,
         trial_ends_at, is_active, max_users, max_cases, max_carlota_messages_per_day
  FROM public.tenants
  WHERE slug = p_slug AND is_active = true
$$;

-- Solo ejecutable (no expone la tabla). Disponible para anónimos y autenticados.
REVOKE ALL ON FUNCTION public.get_tenant_by_slug(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug(text) TO anon, authenticated;

SELECT 'Migration 017 OK: get_tenant_by_slug (lookup pre-login seguro)' AS status;


-- =============================================================================
-- Migration 018: corrige recursión infinita en las policies de `users`
-- =============================================================================
--
-- schema.sql definió las policies de users con una subconsulta a la PROPIA tabla
-- users:  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()))
-- Eso dispara la policy de users dentro de sí misma → error 42P17 (recursión) en
-- CUALQUIER lectura de users (incluido el login / fetchProfile).
--
-- Fix: usar auth_org_id() (SECURITY DEFINER → bypassa RLS, no recursa). Definida
-- en migration-010. Un usuario ve su propia fila y las de su organización.

DROP POLICY IF EXISTS "Users can view own org data"   ON users;
DROP POLICY IF EXISTS "Users can insert own org data" ON users;
DROP POLICY IF EXISTS "Users can update own org data" ON users;
DROP POLICY IF EXISTS "Users can delete own org data" ON users;

CREATE POLICY "Users can view own org data" ON users
  FOR SELECT USING (id = auth.uid() OR org_id = auth_org_id());

CREATE POLICY "Users can insert own org data" ON users
  FOR INSERT WITH CHECK (org_id = auth_org_id());

CREATE POLICY "Users can update own org data" ON users
  FOR UPDATE USING (org_id = auth_org_id());

CREATE POLICY "Users can delete own org data" ON users
  FOR DELETE USING (org_id = auth_org_id());

SELECT 'Migration 018 OK: recursión RLS de users corregida' AS status;


-- =============================================================================
-- Migration 019: verificación en dos pasos por email (código de 6 dígitos)
-- =============================================================================
--
-- Cómo funciona:
--   1. Cada usuario puede activar el MFA por email para su cuenta
--      (mfa_email_settings). Solo la Edge Function `mfa-email` lo cambia, y solo
--      tras verificar un código enviado a ese email.
--   2. Al iniciar sesión, `mfa-email` envía un código y guarda su hash en
--      mfa_email_challenges, ligado al `session_id` del JWT de esa sesión.
--   3. mfa_email_ok() es true si el usuario no tiene el MFA por email activado,
--      si la sesión ya es aal2 (TOTP) o si la sesión tiene un reto verificado.
--   4. Una política RESTRICTIVA "mfa_email_gate" en TODAS las tablas de public
--      con RLS (y en storage.objects) exige mfa_email_ok() al rol authenticated.
--      Las restrictivas se combinan con AND con las políticas existentes: el
--      aislamiento por org_id sigue igual y, además, una sesión con contraseña
--      pero sin código no puede leer ni escribir nada.
--
-- IMPORTANTE: una tabla nueva creada DESPUÉS de esta migración no hereda la
-- política. Toda migración que cree una tabla debe añadir también su
-- "mfa_email_gate" (o volver a ejecutar el bloque DO del final).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mfa_email_settings (
  user_id    uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  enabled    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mfa_email_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  session_id  uuid NOT NULL,
  purpose     text NOT NULL DEFAULT 'login'
              CHECK (purpose IN ('login', 'enroll', 'disable')),
  code_hash   text NOT NULL,
  attempts    int  NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_email_challenges_user_session
  ON public.mfa_email_challenges (user_id, session_id, created_at DESC);

-- RLS: el navegador puede leer su propio estado; nadie escribe salvo service_role
-- (Edge Function). Los retos no tienen ninguna política → invisibles al cliente.
ALTER TABLE public.mfa_email_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_email_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfa_email_settings own select" ON public.mfa_email_settings;
CREATE POLICY "mfa_email_settings own select" ON public.mfa_email_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 2. Funciones
-- -----------------------------------------------------------------------------
-- ¿Puede esta sesión acceder a datos? SECURITY DEFINER para leer las tablas de
-- MFA sin pasar por su RLS (y sin tocar `users`, así no hay recursión).
CREATE OR REPLACE FUNCTION public.mfa_email_ok()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.mfa_email_settings s
      WHERE s.user_id = auth.uid() AND s.enabled
    )
    OR coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    OR EXISTS (
      SELECT 1 FROM public.mfa_email_challenges c
      WHERE c.user_id = auth.uid()
        AND c.session_id::text = auth.jwt() ->> 'session_id'
        AND c.purpose IN ('login', 'enroll')
        AND c.verified_at IS NOT NULL
    )
$$;

-- Estado para el frontend (se consulta justo después de la contraseña, cuando
-- la política restrictiva aún bloquea las tablas).
CREATE OR REPLACE FUNCTION public.mfa_email_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', coalesce((SELECT s.enabled FROM public.mfa_email_settings s
                         WHERE s.user_id = auth.uid()), false),
    'verified', public.mfa_email_ok()
  )
$$;

REVOKE ALL ON FUNCTION public.mfa_email_ok()     FROM public, anon;
REVOKE ALL ON FUNCTION public.mfa_email_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mfa_email_ok()     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mfa_email_status() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Candado: política restrictiva en todas las tablas de public con RLS
-- -----------------------------------------------------------------------------
-- `(SELECT public.mfa_email_ok())` se evalúa una vez por consulta, no por fila.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "mfa_email_gate" ON public.%I', r.relname);
    EXECUTE format(
      'CREATE POLICY "mfa_email_gate" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()))',
      r.relname);
  END LOOP;
END $$;

-- Documentos en Storage (bucket privado, migration-011)
DROP POLICY IF EXISTS "mfa_email_gate" ON storage.objects;
CREATE POLICY "mfa_email_gate" ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok()))
  WITH CHECK ((SELECT public.mfa_email_ok()));

SELECT 'Migration 019 OK: MFA por email (' ||
       (SELECT count(*) FROM pg_policies
        WHERE policyname = 'mfa_email_gate' AND schemaname = 'public') ||
       ' tablas protegidas)' AS status;


-- =============================================================================
-- Migration 020: límites de uso de las funciones de IA + registro de errores
-- =============================================================================
--
-- 1. usage_counters + consume_usage(): contador atómico por usuario y por
--    despacho, en ventanas de un minuto y de un día. Lo usan carlota-chat y
--    verify-document (vía _shared/limites.ts) ANTES de llamar a Anthropic, para
--    que ni un abuso ni un bucle disparen la factura.
-- 2. function_errors: las Edge Functions guardan aquí sus excepciones
--    (vía _shared/errores.ts) para que no se pierdan en logs que nadie mira.
--
-- Ambas tablas solo las toca service_role (Edge Functions): RLS activado sin
-- políticas para el cliente, más el candado mfa_email_gate (ver migration-019).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Contadores de uso
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_counters (
  feature      text        NOT NULL,                 -- 'carlota' | 'verify-document' | ...
  subject      text        NOT NULL,                 -- 'user:<uuid>' | 'org:<uuid>'
  org_id       uuid        REFERENCES public.organizations ON DELETE CASCADE,
  window_kind  text        NOT NULL CHECK (window_kind IN ('minute', 'day')),
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (feature, subject, window_kind, window_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_window ON public.usage_counters (window_start);
CREATE INDEX IF NOT EXISTS idx_usage_counters_org ON public.usage_counters (org_id, feature, window_start);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfa_email_gate" ON public.usage_counters;
CREATE POLICY "mfa_email_gate" ON public.usage_counters
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- Suma 1 a los contadores y dice si la llamada entra en los límites.
-- Un límite NULL o <= 0 no se aplica. Se comprueba en orden: usuario/minuto,
-- usuario/día, despacho/día; al primer límite superado devuelve allowed=false
-- (esa llamada también cuenta, así que insistir no ayuda). Día natural en
-- hora de Madrid.
CREATE OR REPLACE FUNCTION public.consume_usage(
  p_feature       text,
  p_user_id       uuid,
  p_org_id        uuid,
  p_user_per_min  integer,
  p_user_per_day  integer,
  p_org_per_day   integer
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min  timestamptz := date_trunc('minute', now());
  v_day  timestamptz := date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid';
  v_n    integer;
  r      record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('user:' || p_user_id, 'minute', v_min, p_user_per_min, 'user_minute', 60),
      ('user:' || p_user_id, 'day',    v_day, p_user_per_day, 'user_day',
         extract(epoch FROM (v_day + interval '1 day' - now()))::int),
      ('org:'  || p_org_id,  'day',    v_day, p_org_per_day,  'org_day',
         extract(epoch FROM (v_day + interval '1 day' - now()))::int)
    ) AS t(subject, kind, start, lim, reason, retry)
  LOOP
    CONTINUE WHEN r.lim IS NULL OR r.lim <= 0 OR r.subject IS NULL;

    INSERT INTO public.usage_counters AS u (feature, subject, org_id, window_kind, window_start, count)
    VALUES (p_feature, r.subject, p_org_id, r.kind, r.start, 1)
    ON CONFLICT (feature, subject, window_kind, window_start)
      DO UPDATE SET count = u.count + 1
    RETURNING u.count INTO v_n;

    IF v_n > r.lim THEN
      RETURN jsonb_build_object('allowed', false, 'reason', r.reason, 'limit', r.lim, 'retry_after', r.retry);
    END IF;
  END LOOP;

  -- Limpieza ocasional de ventanas viejas (≈1 de cada 100 llamadas)
  IF random() < 0.01 THEN
    DELETE FROM public.usage_counters WHERE window_start < now() - interval '3 days';
  END IF;

  RETURN jsonb_build_object('allowed', true);
END $$;

REVOKE ALL ON FUNCTION public.consume_usage(text, uuid, uuid, integer, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_usage(text, uuid, uuid, integer, integer, integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Registro de errores de Edge Functions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.function_errors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text        NOT NULL,
  org_id        uuid        REFERENCES public.organizations ON DELETE SET NULL,
  user_id       uuid,
  message       text        NOT NULL,
  context       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_function_errors_created ON public.function_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_function_errors_fn ON public.function_errors (function_name, created_at DESC);

ALTER TABLE public.function_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfa_email_gate" ON public.function_errors;
CREATE POLICY "mfa_email_gate" ON public.function_errors
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

SELECT 'Migration 020 OK: límites de uso de IA + registro de errores' AS status;


-- =============================================================================
-- Migration 021: catálogo de planes 2026-09 (Starter / Company / Team / Top 10 / A medida)
-- =============================================================================
--
-- 1. tenants.plan admitía solo trial/starter/pro/premium/enterprise: los planes
--    "individual" y "team" de migration-013 nunca se habrían podido guardar desde
--    el webhook de Stripe. Se admite el catálogo nuevo y se conservan los antiguos
--    para no romper despachos existentes (libredeuda está en "pro").
-- 2. tenants.subscription_status no admitía "incomplete_expired" ni "paused",
--    estados reales de Stripe: el webhook fallaba al recibirlos.
--
-- license_count lo fija el webhook según el plan (1, 3, 5 o 10 usuarios del
-- despacho); los clientes del portal no consumen licencia (migration-014).
-- =============================================================================

ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_plan_check CHECK (plan IN (
  'trial', 'starter', 'company', 'team', 'top10', 'custom',
  'pro', 'premium', 'enterprise', 'individual'   -- antiguos
));

ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_subscription_status_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_subscription_status_check CHECK (
  subscription_status IS NULL OR subscription_status IN (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
  )
);

SELECT 'Migration 021 OK: catálogo de planes Starter/Company/Team/Top 10/A medida' AS status;


-- =============================================================================
-- Migration 022: datos para el resumen de dirección (dashboard de CEO)
-- =============================================================================
--
-- Decisiones de José (2026-09-13):
--   - Venta cerrada = contrato firmado Y primer pago recibido (se muestran también
--     por separado).
--   - Resultados de expediente: ganado, parcial, desestimado, desistido.
--   - El resumen solo lo ven administradores y titulares.
--
-- 1. contacts: primer contacto (automático), contrato firmado, origen de campaña
--    (UTM de la web y campaña/anuncio de Meta).
-- 2. events: asistencia a reuniones y llamadas (para la tasa de asistencia).
-- 3. cases: fecha de presentación (automática al pasar a "presentado"), última
--    notificación del juzgado, resultado y fecha de resolución.
-- 4. marketing_spend: gasto diario por campaña/anuncio (lo llenará la conexión
--    con Meta; solo escribe service_role).
-- 5. ceo_summary(desde, hasta): todos los indicadores en una llamada. SECURITY
--    INVOKER: RLS limita los datos al despacho del usuario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Contactos
-- -----------------------------------------------------------------------------
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS contacted_at       timestamptz;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS contract_signed_at timestamptz;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS utm_source         text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS utm_medium         text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS utm_campaign       text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS utm_content        text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS meta_campaign_id   text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS meta_campaign_name text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS meta_ad_id         text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS meta_ad_name       text;

CREATE INDEX IF NOT EXISTS idx_contacts_org_created ON public.contacts (org_id, created_at);

-- Primer contacto: la primera vez que el lead deja de estar en "lead"
CREATE OR REPLACE FUNCTION public.set_contact_contacted_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contacted_at IS NULL AND NEW.status IS DISTINCT FROM 'lead'
     AND (TG_OP = 'INSERT' OR OLD.status = 'lead') THEN
    NEW.contacted_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contacts_contacted_at ON public.contacts;
CREATE TRIGGER trg_contacts_contacted_at
  BEFORE INSERT OR UPDATE OF status ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_contact_contacted_at();

-- -----------------------------------------------------------------------------
-- 2. Asistencia a citas
-- -----------------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS attendance text
  CHECK (attendance IS NULL OR attendance IN ('attended', 'no_show'));

-- -----------------------------------------------------------------------------
-- 3. Datos judiciales del expediente
-- -----------------------------------------------------------------------------
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS filed_at             date;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS last_court_notice_at date;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS outcome              text
  CHECK (outcome IS NULL OR outcome IN ('won', 'partial', 'dismissed', 'withdrawn'));
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS resolved_at          date;

CREATE OR REPLACE FUNCTION public.set_case_court_dates()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.phase IN ('filed', 'hearing') AND NEW.filed_at IS NULL THEN
    NEW.filed_at := current_date;
  END IF;
  IF NEW.outcome IS NOT NULL AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := current_date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cases_court_dates ON public.cases;
CREATE TRIGGER trg_cases_court_dates
  BEFORE INSERT OR UPDATE OF phase, outcome ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_case_court_dates();

-- -----------------------------------------------------------------------------
-- 4. Gasto en publicidad
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_spend (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  date           date NOT NULL,
  platform       text NOT NULL DEFAULT 'meta',
  campaign_id    text,
  campaign_name  text,
  ad_id          text,
  ad_name        text,
  spend          numeric(12,2) NOT NULL DEFAULT 0,
  impressions    integer NOT NULL DEFAULT 0,
  clicks         integer NOT NULL DEFAULT 0,
  platform_leads integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, date, platform, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_spend_org_date ON public.marketing_spend (org_id, date);

ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_spend org select" ON public.marketing_spend;
CREATE POLICY "marketing_spend org select" ON public.marketing_spend
  FOR SELECT USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "mfa_email_gate" ON public.marketing_spend;
CREATE POLICY "mfa_email_gate" ON public.marketing_spend
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- -----------------------------------------------------------------------------
-- 5. Resumen de dirección
-- -----------------------------------------------------------------------------
-- Fechas en hora de Madrid; el periodo [p_desde, p_hasta] incluye ambos días.
CREATE OR REPLACE FUNCTION public.ceo_summary(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'owner')) THEN
    RAISE EXCEPTION 'El resumen de dirección solo está disponible para administradores y titulares'
      USING ERRCODE = '42501';
  END IF;

  WITH
  leads AS (
    SELECT c.* FROM public.contacts c
    WHERE (c.created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN p_desde AND p_hasta
  ),
  primer_pago AS (
    SELECT ca.contact_id, min(p.paid_at) AS pagado_at
    FROM public.payments p JOIN public.cases ca ON ca.id = p.case_id
    WHERE p.status = 'paid' AND p.paid_at IS NOT NULL
    GROUP BY ca.contact_id
  ),
  cierres AS (
    SELECT c.id AS contact_id,
      (c.contract_signed_at AT TIME ZONE 'Europe/Madrid')::date AS fecha_contrato,
      (pp.pagado_at AT TIME ZONE 'Europe/Madrid')::date AS fecha_pago,
      CASE WHEN c.contract_signed_at IS NOT NULL AND pp.pagado_at IS NOT NULL
        THEN (greatest(c.contract_signed_at, pp.pagado_at) AT TIME ZONE 'Europe/Madrid')::date END AS fecha_cierre
    FROM public.contacts c LEFT JOIN primer_pago pp ON pp.contact_id = c.id
  ),
  citas AS (
    SELECT e.* FROM public.events e WHERE e.event_type IN ('meeting', 'call')
  ),
  citas_pasadas AS (
    SELECT * FROM citas WHERE event_date BETWEEN p_desde AND least(p_hasta, current_date)
  ),
  -- Marketing: por campaña y por anuncio (Meta o UTM de la web)
  leads_mkt AS (
    SELECT l.*, ci.fecha_cierre,
      coalesce(nullif(l.meta_campaign_id, ''), nullif(l.utm_campaign, '')) AS campana_clave,
      coalesce(nullif(l.meta_campaign_name, ''), nullif(l.utm_campaign, '')) AS campana_nombre,
      coalesce(nullif(l.meta_ad_id, ''), nullif(l.utm_content, '')) AS anuncio_clave,
      coalesce(nullif(l.meta_ad_name, ''), nullif(l.utm_content, '')) AS anuncio_nombre
    FROM leads l LEFT JOIN cierres ci ON ci.contact_id = l.id
  ),
  gasto AS (
    SELECT * FROM public.marketing_spend WHERE date BETWEEN p_desde AND p_hasta
  ),
  por_campana AS (
    SELECT coalesce(a.clave, g.clave) AS clave,
      coalesce(a.nombre, g.nombre, 'Sin nombre') AS nombre,
      coalesce(a.leads, 0) AS leads, coalesce(a.ventas, 0) AS ventas,
      g.gasto
    FROM (
      SELECT campana_clave AS clave, max(campana_nombre) AS nombre, count(*) AS leads,
        count(*) FILTER (WHERE fecha_cierre IS NOT NULL) AS ventas
      FROM leads_mkt WHERE campana_clave IS NOT NULL GROUP BY campana_clave
    ) a
    FULL OUTER JOIN (
      SELECT campaign_id AS clave, max(campaign_name) AS nombre, sum(spend) AS gasto
      FROM gasto WHERE campaign_id IS NOT NULL GROUP BY campaign_id
    ) g ON g.clave = a.clave
  ),
  por_anuncio AS (
    SELECT coalesce(a.clave, g.clave) AS clave,
      coalesce(a.nombre, g.nombre, 'Sin nombre') AS nombre,
      coalesce(a.campana, g.campana) AS campana,
      coalesce(a.leads, 0) AS leads, coalesce(a.ventas, 0) AS ventas,
      g.gasto
    FROM (
      SELECT anuncio_clave AS clave, max(anuncio_nombre) AS nombre, max(campana_nombre) AS campana,
        count(*) AS leads, count(*) FILTER (WHERE fecha_cierre IS NOT NULL) AS ventas
      FROM leads_mkt WHERE anuncio_clave IS NOT NULL GROUP BY anuncio_clave
    ) a
    FULL OUTER JOIN (
      SELECT ad_id AS clave, max(ad_name) AS nombre, max(campaign_name) AS campana, sum(spend) AS gasto
      FROM gasto WHERE ad_id IS NOT NULL GROUP BY ad_id
    ) g ON g.clave = a.clave
  ),
  presentados AS (
    SELECT ca.*, coalesce(ca.last_court_notice_at, ca.filed_at, ca.phase_changed_at::date, ca.updated_at::date) AS ultima_novedad
    FROM public.cases ca
    WHERE ca.phase IN ('filed', 'hearing') AND ca.outcome IS NULL AND ca.status <> 'archived'
  ),
  resueltos AS (
    SELECT * FROM public.cases WHERE outcome IS NOT NULL AND resolved_at BETWEEN p_desde AND p_hasta
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'ventas', jsonb_build_object(
      'leads_nuevos',         (SELECT count(*) FROM leads),
      'contactados',          (SELECT count(*) FROM leads WHERE contacted_at IS NOT NULL),
      'horas_hasta_contacto', (SELECT round((percentile_cont(0.5) WITHIN GROUP (
                                 ORDER BY extract(epoch FROM contacted_at - created_at) / 3600))::numeric, 1)
                               FROM leads WHERE contacted_at IS NOT NULL),
      'contratos_firmados',   (SELECT count(*) FROM cierres WHERE fecha_contrato BETWEEN p_desde AND p_hasta),
      'primeros_pagos',       (SELECT count(*) FROM cierres WHERE fecha_pago BETWEEN p_desde AND p_hasta),
      'ventas_cerradas',      (SELECT count(*) FROM cierres WHERE fecha_cierre BETWEEN p_desde AND p_hasta),
      'reuniones_agendadas',  (SELECT count(*) FROM citas WHERE event_type = 'meeting'
                                 AND (created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN p_desde AND p_hasta),
      'llamadas_agendadas',   (SELECT count(*) FROM citas WHERE event_type = 'call'
                                 AND (created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN p_desde AND p_hasta),
      'asistidas',            (SELECT count(*) FROM citas_pasadas WHERE attendance = 'attended'),
      'no_asistidas',         (SELECT count(*) FROM citas_pasadas WHERE attendance = 'no_show'),
      'sin_marcar',           (SELECT count(*) FROM citas_pasadas WHERE attendance IS NULL)
    ),
    'marketing', jsonb_build_object(
      'hay_gasto', EXISTS (SELECT 1 FROM gasto),
      'leads_sin_campana', (SELECT count(*) FROM leads_mkt WHERE campana_clave IS NULL),
      'campanas', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.leads DESC, x.gasto DESC NULLS LAST), '[]'::jsonb)
                   FROM (SELECT * FROM por_campana ORDER BY leads DESC LIMIT 50) x),
      'anuncios', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.leads DESC, x.gasto DESC NULLS LAST), '[]'::jsonb)
                   FROM (SELECT * FROM por_anuncio ORDER BY leads DESC LIMIT 100) x)
    ),
    'expedientes', jsonb_build_object(
      'pendientes_documentacion', (SELECT count(*) FROM public.cases
                                    WHERE status = 'active' AND phase IN ('intake', 'document_collection')),
      'presentados',   (SELECT count(*) FROM presentados),
      'sin_noticias',  (SELECT count(*) FROM presentados WHERE ultima_novedad <= current_date - 90),
      'ganados',       (SELECT count(*) FROM resueltos WHERE outcome = 'won'),
      'parciales',     (SELECT count(*) FROM resueltos WHERE outcome = 'partial'),
      'desestimados',  (SELECT count(*) FROM resueltos WHERE outcome = 'dismissed'),
      'desistidos',    (SELECT count(*) FROM resueltos WHERE outcome = 'withdrawn'),
      'alertas', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.dias DESC), '[]'::jsonb) FROM (
                    SELECT p.id, p.case_number, p.case_type, p.filed_at, p.last_court_notice_at,
                      (current_date - p.ultima_novedad) AS dias,
                      trim(coalesce(ct.first_name, '') || ' ' || coalesce(ct.last_name, '')) AS cliente
                    FROM presentados p LEFT JOIN public.contacts ct ON ct.id = p.contact_id
                    WHERE p.ultima_novedad <= current_date - 90
                    ORDER BY dias DESC LIMIT 20) x)
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END $$;

REVOKE ALL ON FUNCTION public.ceo_summary(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ceo_summary(date, date) TO authenticated;

SELECT 'Migration 022 OK: datos y resumen de dirección' AS status;


-- =============================================================================
-- Migration 023: formulario de viabilidad LSO + informe de viabilidad con IA
-- =============================================================================
--
-- Petición de José (2026-09-18): el setter/closer rellena un formulario con los
-- datos del lead (situación económica, patrimonio, deuda pública, acreedores,
-- requisitos de buena fe...) y, con un botón "Crear informe", esos datos se
-- envían a Claude para redactar un informe de viabilidad jurídico-económica de
-- la Ley de Segunda Oportunidad (arts. 486 y ss. del TRLC), siguiendo el modelo
-- de informe real del despacho. El informe se guarda en la ficha del lead
-- (tabla documents, igual que un archivo subido a mano) y se puede descargar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Formulario de viabilidad (uno por contacto)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_viability_forms (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  contact_id                  uuid NOT NULL REFERENCES public.contacts ON DELETE CASCADE UNIQUE,

  -- Situación personal
  localidad                   text,
  perfil                      text CHECK (perfil IS NULL OR perfil IN ('no_empresario', 'empresario')),
  estado_civil                text CHECK (estado_civil IS NULL OR estado_civil IN ('soltero', 'casado', 'separado', 'divorciado', 'viudo', 'pareja_de_hecho')),
  regimen_matrimonial         text CHECK (regimen_matrimonial IS NULL OR regimen_matrimonial IN ('gananciales', 'separacion_bienes', 'participacion', 'no_aplica')),

  -- Situación económica
  ingresos_mensuales          numeric,
  origen_ingresos             text,
  deuda_total_estimada        numeric,
  origen_endeudamiento_anio   integer,

  -- Patrimonio
  tiene_vivienda               boolean NOT NULL DEFAULT false,
  valor_vivienda                numeric,
  tiene_vehiculos               boolean NOT NULL DEFAULT false,
  otros_bienes                  text,

  -- Deuda pública
  deuda_aeat                    numeric NOT NULL DEFAULT 0,
  deuda_tgss                    numeric NOT NULL DEFAULT 0,

  -- Situación procesal
  embargos_activos              boolean NOT NULL DEFAULT false,
  detalle_embargos              text,

  -- Requisitos de buena fe (art. 487 TRLC)
  condena_penal_10anios         boolean NOT NULL DEFAULT false,
  concurso_culpable_previo      boolean NOT NULL DEFAULT false,
  sancion_grave_10anios         boolean NOT NULL DEFAULT false,
  exoneracion_previa_5anios     boolean NOT NULL DEFAULT false,
  acuerdo_extrajudicial_previo  boolean NOT NULL DEFAULT false,

  -- Acreedores: [{ "nombre": "...", "tipo": "bancario"|"tarjeta"|"publico"|"otro", "importe": 1000 }]
  acreedores                    jsonb NOT NULL DEFAULT '[]'::jsonb,

  notas_setter                  text,

  completado_por                uuid REFERENCES public.users ON DELETE SET NULL,
  completado_at                 timestamptz,

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_viability_forms_contact ON public.lead_viability_forms (contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_viability_forms_org ON public.lead_viability_forms (org_id);

CREATE TRIGGER trg_lead_viability_forms_updated_at
  BEFORE UPDATE ON public.lead_viability_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.lead_viability_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON public.lead_viability_forms
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "Users can insert own org data" ON public.lead_viability_forms
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "Users can update own org data" ON public.lead_viability_forms
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "Users can delete own org data" ON public.lead_viability_forms
  FOR DELETE USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "mfa_email_gate" ON public.lead_viability_forms;
CREATE POLICY "mfa_email_gate" ON public.lead_viability_forms
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- -----------------------------------------------------------------------------
-- 2. Informes de viabilidad generados (histórico; el más reciente es "el" informe)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_viability_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  contact_id    uuid NOT NULL REFERENCES public.contacts ON DELETE CASCADE,
  form_id       uuid REFERENCES public.lead_viability_forms ON DELETE SET NULL,
  content       text NOT NULL,                                        -- informe en markdown
  document_id   uuid REFERENCES public.documents ON DELETE SET NULL,  -- versión descargable (tabla documents)
  generated_by  uuid REFERENCES public.users ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_viability_reports_contact ON public.lead_viability_reports (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_viability_reports_org ON public.lead_viability_reports (org_id);

ALTER TABLE public.lead_viability_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON public.lead_viability_reports
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "Users can insert own org data" ON public.lead_viability_reports
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "Users can delete own org data" ON public.lead_viability_reports
  FOR DELETE USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "mfa_email_gate" ON public.lead_viability_reports;
CREATE POLICY "mfa_email_gate" ON public.lead_viability_reports
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- -----------------------------------------------------------------------------
-- 3. Plantillas de prompts de IA (contenido, no esquema)
-- -----------------------------------------------------------------------------
-- Aquí vive el informe modelo real que usa generate-viability-report como
-- ejemplo de estilo para Claude. Va en una tabla y no en el código de la Edge
-- Function a propósito: ese informe modelo contiene datos de un caso real de
-- un cliente (nombre, cifras, fecha) y el repositorio de este proyecto es
-- público en GitHub. Sin políticas para 'authenticated': solo accesible desde
-- las Edge Functions (service_role), nunca desde el navegador.
CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  key         text PRIMARY KEY,
  content     text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- Migration 024: gastos mensuales, hijos menores y personas dependientes en el
-- formulario de viabilidad LSO
-- =============================================================================
--
-- Petición de José (2026-09-18): el informe de viabilidad necesita analizar
-- insolvencia con ingresos Y gastos (no solo ingresos), y tener en cuenta si
-- hay hijos menores o personas dependientes a cargo (relevante para la
-- estrategia y para estimar el mínimo inembargable/cargas familiares).
-- =============================================================================

ALTER TABLE public.lead_viability_forms
  ADD COLUMN IF NOT EXISTS gastos_mensuales           numeric,
  ADD COLUMN IF NOT EXISTS tiene_hijos_menores         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS num_hijos_menores           integer,
  ADD COLUMN IF NOT EXISTS tiene_personas_dependientes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS detalle_dependientes        text;


-- =============================================================================
-- Migration 025: etapas de pipeline configurables por despacho
-- =============================================================================
--
-- Petición de José (2026-09-18): las columnas del Kanban de Contactos ya no son
-- fijas (Nuevo lead/Contactado/Cualificado/Cliente/Perdido) — cada despacho debe
-- poder añadir, quitar, renombrar, recolorear y reordenar sus propias etapas.
-- La configuración inicial que pidió: Nuevo lead, Seguimiento IA, No contesta
-- IA, Seguimiento, Llamada, Videollamada, Pendiente de cierre, Descartado, Venta.
--
-- El esquema base (schema.sql) ya tenía una tabla `pipeline_stages` colgando de
-- `pipelines` (org → pipeline → stages), pero nunca se llegó a usar: el Kanban
-- real (ContactPipeline.jsx) siempre trabajó directamente contra `contacts.status`
-- con 5 columnas fijas en el código. Esta migración adapta esa tabla existente
-- (en vez de crear una nueva) para que cuelgue directamente de `org_id` — más
-- simple, sin el nivel intermedio de "pipelines" que nadie usa — y sea la fuente
-- real de las columnas del Kanban.
--
-- contacts.status sigue siendo texto libre (guarda la "key" de la etapa), pero
-- deja de estar restringido a una lista fija de 6 valores: ahora cualquier key
-- definida en pipeline_stages es válida.
--
-- Dos keys son "especiales" y no cambian de significado en el resto del
-- sistema (el botón "Convertir a cliente" sigue escribiendo 'client'; los
-- leads llegan con 'lead' por defecto; nada más del backend depende de las
-- demás etapas intermedias, así que renombrarlas/añadirlas es seguro):
--   - 'lead'   → siempre existe, es el estado por defecto de un contacto nuevo.
--   - 'client' → is_won = true (se usa al convertir un lead en cliente).
--   - 'lost'   → is_lost = true (se usa al marcar un lead como perdido).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. contacts.status deja de estar limitado a 6 valores fijos
-- -----------------------------------------------------------------------------
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_status_check;

-- -----------------------------------------------------------------------------
-- 2. Adaptar pipeline_stages: cuelga de org_id directamente (no de pipeline_id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS org_id      uuid REFERENCES public.organizations ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS key         text,
  ADD COLUMN IF NOT EXISTS is_won      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lost     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- Nunca se usó en producción (el Kanban real no leía de aquí): partimos de cero
-- con la configuración pedida en vez de intentar migrar las 5 etapas de muestra.
DELETE FROM public.pipeline_stages;

DROP POLICY IF EXISTS "Users can view own org pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can insert own org pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can update own org pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can delete own org pipeline stages" ON public.pipeline_stages;

ALTER TABLE public.pipeline_stages DROP COLUMN IF EXISTS pipeline_id;
ALTER TABLE public.pipeline_stages RENAME COLUMN name TO label;

ALTER TABLE public.pipeline_stages ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN key SET NOT NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN color SET NOT NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN color SET DEFAULT '#3b82f6';

ALTER TABLE public.pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_org_key_unique;
ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_org_key_unique UNIQUE (org_id, key);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org ON public.pipeline_stages (org_id, position);

DROP TRIGGER IF EXISTS trg_pipeline_stages_updated_at ON public.pipeline_stages;
CREATE TRIGGER trg_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE POLICY "Users can view own org data" ON public.pipeline_stages
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "Users can insert own org data" ON public.pipeline_stages
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "Users can update own org data" ON public.pipeline_stages
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "Users can delete own org data" ON public.pipeline_stages
  FOR DELETE USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "mfa_email_gate" ON public.pipeline_stages;
CREATE POLICY "mfa_email_gate" ON public.pipeline_stages
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- -----------------------------------------------------------------------------
-- 3. Sembrar la configuración inicial pedida, para despachos existentes...
-- -----------------------------------------------------------------------------
INSERT INTO public.pipeline_stages (org_id, key, label, color, position, is_won, is_lost)
SELECT o.id, s.key, s.label, s.color, s.position, s.is_won, s.is_lost
FROM public.organizations o
CROSS JOIN (VALUES
  ('lead',             'Nuevo lead',           '#3b82f6', 0, false, false),
  ('seguimiento_ia',   'Seguimiento IA',       '#06b6d4', 1, false, false),
  ('no_contesta_ia',   'No contesta IA',       '#f97316', 2, false, false),
  ('seguimiento',      'Seguimiento',          '#f59e0b', 3, false, false),
  ('llamada',          'Llamada',              '#8b5cf6', 4, false, false),
  ('videollamada',     'Videollamada',         '#00897B', 5, false, false),
  ('pendiente_cierre', 'Pendiente de cierre',  '#eab308', 6, false, false),
  ('lost',             'Descartado',           '#ef4444', 7, false, true),
  ('client',           'Venta',                '#22c55e', 8, true,  false)
) AS s(key, label, color, position, is_won, is_lost)
ON CONFLICT (org_id, key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. ...y para despachos nuevos a partir de ahora
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_pipeline_stages()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.pipeline_stages (org_id, key, label, color, position, is_won, is_lost) VALUES
    (NEW.id, 'lead',             'Nuevo lead',          '#3b82f6', 0, false, false),
    (NEW.id, 'seguimiento_ia',   'Seguimiento IA',      '#06b6d4', 1, false, false),
    (NEW.id, 'no_contesta_ia',   'No contesta IA',      '#f97316', 2, false, false),
    (NEW.id, 'seguimiento',      'Seguimiento',         '#f59e0b', 3, false, false),
    (NEW.id, 'llamada',          'Llamada',             '#8b5cf6', 4, false, false),
    (NEW.id, 'videollamada',     'Videollamada',        '#00897B', 5, false, false),
    (NEW.id, 'pendiente_cierre', 'Pendiente de cierre', '#eab308', 6, false, false),
    (NEW.id, 'lost',             'Descartado',          '#ef4444', 7, false, true),
    (NEW.id, 'client',           'Venta',               '#22c55e', 8, true,  false);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_default_pipeline_stages ON public.organizations;
CREATE TRIGGER trg_seed_default_pipeline_stages
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_pipeline_stages();


-- ── VERIFICACIÓN (el editor muestra el resultado de esta última consulta) ──
select
  (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tablas,
  (select count(*) from pg_tables where schemaname='public' and rowsecurity) as con_rls,
  (select count(*) from pg_tables where schemaname='public' and not rowsecurity) as sin_rls;
