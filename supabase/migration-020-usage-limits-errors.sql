-- =============================================================================
-- Migration 020: límites de uso de las funciones de IA + registro de errores
-- =============================================================================
--
-- 1. usage_counters + consume_usage(): contador atómico por usuario y por
--    despacho, en ventanas de un minuto y de un día. Lo usan carlota-chat y
--    verify-document (vía _shared/limites.ts) ANTES de llamar a Anthropic, para
--    que ni un abuso ni un bucle disparen la factura.
-- 2. function_errors: las Edge Functions guardan aquí sus excepciones
--    (vía _shared/errores.ts) para que no se pierdan en logs que nadie mira.
--
-- Ambas tablas solo las toca service_role (Edge Functions): RLS activado sin
-- políticas para el cliente, más el candado mfa_email_gate (ver migration-019).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Contadores de uso
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_counters (
  feature      text        NOT NULL,                 -- 'carlota' | 'verify-document' | ...
  subject      text        NOT NULL,                 -- 'user:<uuid>' | 'org:<uuid>'
  org_id       uuid        REFERENCES public.organizations ON DELETE CASCADE,
  window_kind  text        NOT NULL CHECK (window_kind IN ('minute', 'day')),
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (feature, subject, window_kind, window_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_window ON public.usage_counters (window_start);
CREATE INDEX IF NOT EXISTS idx_usage_counters_org ON public.usage_counters (org_id, feature, window_start);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfa_email_gate" ON public.usage_counters;
CREATE POLICY "mfa_email_gate" ON public.usage_counters
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- Suma 1 a los contadores y dice si la llamada entra en los límites.
-- Un límite NULL o <= 0 no se aplica. Se comprueba en orden: usuario/minuto,
-- usuario/día, despacho/día; al primer límite superado devuelve allowed=false
-- (esa llamada también cuenta, así que insistir no ayuda). Día natural en
-- hora de Madrid.
CREATE OR REPLACE FUNCTION public.consume_usage(
  p_feature       text,
  p_user_id       uuid,
  p_org_id        uuid,
  p_user_per_min  integer,
  p_user_per_day  integer,
  p_org_per_day   integer
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min  timestamptz := date_trunc('minute', now());
  v_day  timestamptz := date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid';
  v_n    integer;
  r      record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('user:' || p_user_id, 'minute', v_min, p_user_per_min, 'user_minute', 60),
      ('user:' || p_user_id, 'day',    v_day, p_user_per_day, 'user_day',
         extract(epoch FROM (v_day + interval '1 day' - now()))::int),
      ('org:'  || p_org_id,  'day',    v_day, p_org_per_day,  'org_day',
         extract(epoch FROM (v_day + interval '1 day' - now()))::int)
    ) AS t(subject, kind, start, lim, reason, retry)
  LOOP
    CONTINUE WHEN r.lim IS NULL OR r.lim <= 0 OR r.subject IS NULL;

    INSERT INTO public.usage_counters AS u (feature, subject, org_id, window_kind, window_start, count)
    VALUES (p_feature, r.subject, p_org_id, r.kind, r.start, 1)
    ON CONFLICT (feature, subject, window_kind, window_start)
      DO UPDATE SET count = u.count + 1
    RETURNING u.count INTO v_n;

    IF v_n > r.lim THEN
      RETURN jsonb_build_object('allowed', false, 'reason', r.reason, 'limit', r.lim, 'retry_after', r.retry);
    END IF;
  END LOOP;

  -- Limpieza ocasional de ventanas viejas (≈1 de cada 100 llamadas)
  IF random() < 0.01 THEN
    DELETE FROM public.usage_counters WHERE window_start < now() - interval '3 days';
  END IF;

  RETURN jsonb_build_object('allowed', true);
END $$;

REVOKE ALL ON FUNCTION public.consume_usage(text, uuid, uuid, integer, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_usage(text, uuid, uuid, integer, integer, integer) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Registro de errores de Edge Functions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.function_errors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text        NOT NULL,
  org_id        uuid        REFERENCES public.organizations ON DELETE SET NULL,
  user_id       uuid,
  message       text        NOT NULL,
  context       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_function_errors_created ON public.function_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_function_errors_fn ON public.function_errors (function_name, created_at DESC);

ALTER TABLE public.function_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mfa_email_gate" ON public.function_errors;
CREATE POLICY "mfa_email_gate" ON public.function_errors
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

SELECT 'Migration 020 OK: límites de uso de IA + registro de errores' AS status;
