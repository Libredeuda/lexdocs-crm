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
