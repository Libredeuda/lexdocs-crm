-- =============================================================================
-- Migration 014: Enforcement de licencias + programación del cron de renovación
-- =============================================================================
--
-- 1. Trigger BEFORE INSERT en users que bloquea si se excede license_count
--    del tenant (cuenta staff + lawyer; los contact/client NO consumen licencia).
-- 2. Programa el cron diario para renewal-reminders-cron (pg_cron + pg_net).
--
-- Nota: rol "client" / "contact" no ocupa licencia (son usuarios del portal
-- del cliente, no del despacho). Sólo "admin", "owner", "lawyer", "staff",
-- "sales" cuentan.

-- -----------------------------------------------------------------------------
-- 1. TRIGGER — enforce license_count
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_license_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_license_count integer;
  v_current_count integer;
BEGIN
  -- Los roles que consumen licencia (ajustar si añades roles nuevos)
  IF NEW.role IS NULL OR NEW.role NOT IN ('admin','owner','lawyer','staff','sales','procurador') THEN
    RETURN NEW;
  END IF;

  SELECT o.tenant_id, t.license_count
    INTO v_tenant_id, v_license_count
  FROM organizations o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE o.id = NEW.org_id;

  IF v_license_count IS NULL THEN
    -- Tenant sin license_count seteado → dejar pasar (trial u onboarding)
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int
    INTO v_current_count
  FROM users u
  JOIN organizations o ON o.id = u.org_id
  WHERE o.tenant_id = v_tenant_id
    AND u.role IN ('admin','owner','lawyer','staff','sales','procurador');

  IF v_current_count >= v_license_count THEN
    RAISE EXCEPTION 'Límite de licencias alcanzado (%/%). Amplía tu plan en Configuración → Facturación.',
      v_current_count, v_license_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_license_limit ON users;
CREATE TRIGGER trg_enforce_license_limit
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_license_limit();

-- -----------------------------------------------------------------------------
-- 2. Cron diario para recordatorios de renovación
-- -----------------------------------------------------------------------------
-- Requiere extensiones pg_cron + pg_net (disponibles en Supabase Pro).
-- Si no están disponibles, este bloque no falla — solo emite un aviso.

DO $$
DECLARE
  v_supabase_url text;
  v_cron_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no disponible. Programa el cron manualmente desde un servicio externo (GitHub Actions, Upstash, etc.)';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  -- Eliminar job previo si existe
  PERFORM cron.unschedule('renewal-reminders-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'renewal-reminders-daily');

  -- Programar diario a las 09:00 UTC (10:00 hora España en invierno, 11:00 en verano)
  -- Nota: sustituye <PROJECT_REF> y <CRON_SECRET> por valores reales tras aplicar la migración.
  -- Este bloque DEJA el cron programado con placeholders; hay que ACTUALIZARLO con el
  -- secreto real desde el SQL Editor una vez definas CRON_SECRET en los secrets de
  -- Edge Functions. Ver instrucciones en el commit.
  RAISE NOTICE 'Para activar el cron, ejecuta manualmente (sustituyendo los valores):';
  RAISE NOTICE '  SELECT cron.schedule(';
  RAISE NOTICE '    ''renewal-reminders-daily'',';
  RAISE NOTICE '    ''0 9 * * *'',';
  RAISE NOTICE '    $cron$ SELECT net.http_post(';
  RAISE NOTICE '      url := ''https://<PROJECT_REF>.supabase.co/functions/v1/renewal-reminders-cron'',';
  RAISE NOTICE '      headers := jsonb_build_object(''X-Cron-Secret'', ''<CRON_SECRET>''),';
  RAISE NOTICE '      body := ''{}''::jsonb';
  RAISE NOTICE '    ); $cron$';
  RAISE NOTICE '  );';
END $$;

SELECT 'Migration 014 OK: license enforcement + cron template' AS status;
