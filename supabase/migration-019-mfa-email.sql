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
