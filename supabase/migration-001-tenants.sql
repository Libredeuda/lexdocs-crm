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
INSERT INTO tenants (id, slug, name, plan, modules_enabled, trial_ends_at, max_users)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'libredeuda',
  'LibreDeuda Abogados',
  'premium',
  ARRAY['lexdocs', 'lexcrm', 'lexconsulta'],
  NULL, -- no trial, full access
  10
)
ON CONFLICT (id) DO NOTHING;

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
