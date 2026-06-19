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
