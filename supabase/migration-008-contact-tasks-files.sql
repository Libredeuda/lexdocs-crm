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
