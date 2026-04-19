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
