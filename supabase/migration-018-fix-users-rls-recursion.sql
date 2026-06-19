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
