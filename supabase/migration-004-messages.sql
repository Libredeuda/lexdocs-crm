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
