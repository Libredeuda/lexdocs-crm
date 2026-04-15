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

-- Helper: reusable sub-select for the caller's org_id
-- (used inside every policy expression)

-- ---- organizations --------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org" ON organizations
  FOR SELECT USING (id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org" ON organizations
  FOR UPDATE USING (id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---- users ----------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON users
  FOR SELECT USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org data" ON users
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org data" ON users
  FOR UPDATE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org data" ON users
  FOR DELETE USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

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
