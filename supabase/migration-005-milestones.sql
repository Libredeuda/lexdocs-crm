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
