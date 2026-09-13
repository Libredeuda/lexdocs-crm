-- =============================================================================
-- Migration 022: datos para el resumen de dirección (dashboard de CEO)
-- =============================================================================
--
-- Decisiones de José (2026-09-13):
--   - Venta cerrada = contrato firmado Y primer pago recibido (se muestran también
--     por separado).
--   - Resultados de expediente: ganado, parcial, desestimado, desistido.
--   - El resumen solo lo ven administradores y titulares.
--
-- 1. contacts: primer contacto (automático), contrato firmado, origen de campaña
--    (UTM de la web y campaña/anuncio de Meta).
-- 2. events: asistencia a reuniones y llamadas (para la tasa de asistencia).
-- 3. cases: fecha de presentación (automática al pasar a "presentado"), última
--    notificación del juzgado, resultado y fecha de resolución.
-- 4. marketing_spend: gasto diario por campaña/anuncio (lo llenará la conexión
--    con Meta; solo escribe service_role).
-- 5. ceo_summary(desde, hasta): todos los indicadores en una llamada. SECURITY
--    INVOKER: RLS limita los datos al despacho del usuario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Contactos
-- -----------------------------------------------------------------------------
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS contacted_at       timestamptz;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS contract_signed_at timestamptz;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS utm_source         text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS utm_medium         text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS utm_campaign       text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS utm_content        text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS meta_campaign_id   text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS meta_campaign_name text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS meta_ad_id         text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS meta_ad_name       text;

CREATE INDEX IF NOT EXISTS idx_contacts_org_created ON public.contacts (org_id, created_at);

-- Primer contacto: la primera vez que el lead deja de estar en "lead"
CREATE OR REPLACE FUNCTION public.set_contact_contacted_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.contacted_at IS NULL AND NEW.status IS DISTINCT FROM 'lead'
     AND (TG_OP = 'INSERT' OR OLD.status = 'lead') THEN
    NEW.contacted_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contacts_contacted_at ON public.contacts;
CREATE TRIGGER trg_contacts_contacted_at
  BEFORE INSERT OR UPDATE OF status ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_contact_contacted_at();

-- -----------------------------------------------------------------------------
-- 2. Asistencia a citas
-- -----------------------------------------------------------------------------
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS attendance text
  CHECK (attendance IS NULL OR attendance IN ('attended', 'no_show'));

-- -----------------------------------------------------------------------------
-- 3. Datos judiciales del expediente
-- -----------------------------------------------------------------------------
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS filed_at             date;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS last_court_notice_at date;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS outcome              text
  CHECK (outcome IS NULL OR outcome IN ('won', 'partial', 'dismissed', 'withdrawn'));
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS resolved_at          date;

CREATE OR REPLACE FUNCTION public.set_case_court_dates()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.phase IN ('filed', 'hearing') AND NEW.filed_at IS NULL THEN
    NEW.filed_at := current_date;
  END IF;
  IF NEW.outcome IS NOT NULL AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := current_date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cases_court_dates ON public.cases;
CREATE TRIGGER trg_cases_court_dates
  BEFORE INSERT OR UPDATE OF phase, outcome ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_case_court_dates();

-- -----------------------------------------------------------------------------
-- 4. Gasto en publicidad
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_spend (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  date           date NOT NULL,
  platform       text NOT NULL DEFAULT 'meta',
  campaign_id    text,
  campaign_name  text,
  ad_id          text,
  ad_name        text,
  spend          numeric(12,2) NOT NULL DEFAULT 0,
  impressions    integer NOT NULL DEFAULT 0,
  clicks         integer NOT NULL DEFAULT 0,
  platform_leads integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, date, platform, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_spend_org_date ON public.marketing_spend (org_id, date);

ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_spend org select" ON public.marketing_spend;
CREATE POLICY "marketing_spend org select" ON public.marketing_spend
  FOR SELECT USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "mfa_email_gate" ON public.marketing_spend;
CREATE POLICY "mfa_email_gate" ON public.marketing_spend
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- -----------------------------------------------------------------------------
-- 5. Resumen de dirección
-- -----------------------------------------------------------------------------
-- Fechas en hora de Madrid; el periodo [p_desde, p_hasta] incluye ambos días.
CREATE OR REPLACE FUNCTION public.ceo_summary(p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'owner')) THEN
    RAISE EXCEPTION 'El resumen de dirección solo está disponible para administradores y titulares'
      USING ERRCODE = '42501';
  END IF;

  WITH
  leads AS (
    SELECT c.* FROM public.contacts c
    WHERE (c.created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN p_desde AND p_hasta
  ),
  primer_pago AS (
    SELECT ca.contact_id, min(p.paid_at) AS pagado_at
    FROM public.payments p JOIN public.cases ca ON ca.id = p.case_id
    WHERE p.status = 'paid' AND p.paid_at IS NOT NULL
    GROUP BY ca.contact_id
  ),
  cierres AS (
    SELECT c.id AS contact_id,
      (c.contract_signed_at AT TIME ZONE 'Europe/Madrid')::date AS fecha_contrato,
      (pp.pagado_at AT TIME ZONE 'Europe/Madrid')::date AS fecha_pago,
      CASE WHEN c.contract_signed_at IS NOT NULL AND pp.pagado_at IS NOT NULL
        THEN (greatest(c.contract_signed_at, pp.pagado_at) AT TIME ZONE 'Europe/Madrid')::date END AS fecha_cierre
    FROM public.contacts c LEFT JOIN primer_pago pp ON pp.contact_id = c.id
  ),
  citas AS (
    SELECT e.* FROM public.events e WHERE e.event_type IN ('meeting', 'call')
  ),
  citas_pasadas AS (
    SELECT * FROM citas WHERE event_date BETWEEN p_desde AND least(p_hasta, current_date)
  ),
  -- Marketing: por campaña y por anuncio (Meta o UTM de la web)
  leads_mkt AS (
    SELECT l.*, ci.fecha_cierre,
      coalesce(nullif(l.meta_campaign_id, ''), nullif(l.utm_campaign, '')) AS campana_clave,
      coalesce(nullif(l.meta_campaign_name, ''), nullif(l.utm_campaign, '')) AS campana_nombre,
      coalesce(nullif(l.meta_ad_id, ''), nullif(l.utm_content, '')) AS anuncio_clave,
      coalesce(nullif(l.meta_ad_name, ''), nullif(l.utm_content, '')) AS anuncio_nombre
    FROM leads l LEFT JOIN cierres ci ON ci.contact_id = l.id
  ),
  gasto AS (
    SELECT * FROM public.marketing_spend WHERE date BETWEEN p_desde AND p_hasta
  ),
  por_campana AS (
    SELECT coalesce(a.clave, g.clave) AS clave,
      coalesce(a.nombre, g.nombre, 'Sin nombre') AS nombre,
      coalesce(a.leads, 0) AS leads, coalesce(a.ventas, 0) AS ventas,
      g.gasto
    FROM (
      SELECT campana_clave AS clave, max(campana_nombre) AS nombre, count(*) AS leads,
        count(*) FILTER (WHERE fecha_cierre IS NOT NULL) AS ventas
      FROM leads_mkt WHERE campana_clave IS NOT NULL GROUP BY campana_clave
    ) a
    FULL OUTER JOIN (
      SELECT campaign_id AS clave, max(campaign_name) AS nombre, sum(spend) AS gasto
      FROM gasto WHERE campaign_id IS NOT NULL GROUP BY campaign_id
    ) g ON g.clave = a.clave
  ),
  por_anuncio AS (
    SELECT coalesce(a.clave, g.clave) AS clave,
      coalesce(a.nombre, g.nombre, 'Sin nombre') AS nombre,
      coalesce(a.campana, g.campana) AS campana,
      coalesce(a.leads, 0) AS leads, coalesce(a.ventas, 0) AS ventas,
      g.gasto
    FROM (
      SELECT anuncio_clave AS clave, max(anuncio_nombre) AS nombre, max(campana_nombre) AS campana,
        count(*) AS leads, count(*) FILTER (WHERE fecha_cierre IS NOT NULL) AS ventas
      FROM leads_mkt WHERE anuncio_clave IS NOT NULL GROUP BY anuncio_clave
    ) a
    FULL OUTER JOIN (
      SELECT ad_id AS clave, max(ad_name) AS nombre, max(campaign_name) AS campana, sum(spend) AS gasto
      FROM gasto WHERE ad_id IS NOT NULL GROUP BY ad_id
    ) g ON g.clave = a.clave
  ),
  presentados AS (
    SELECT ca.*, coalesce(ca.last_court_notice_at, ca.filed_at, ca.phase_changed_at::date, ca.updated_at::date) AS ultima_novedad
    FROM public.cases ca
    WHERE ca.phase IN ('filed', 'hearing') AND ca.outcome IS NULL AND ca.status <> 'archived'
  ),
  resueltos AS (
    SELECT * FROM public.cases WHERE outcome IS NOT NULL AND resolved_at BETWEEN p_desde AND p_hasta
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta),
    'ventas', jsonb_build_object(
      'leads_nuevos',         (SELECT count(*) FROM leads),
      'contactados',          (SELECT count(*) FROM leads WHERE contacted_at IS NOT NULL),
      'horas_hasta_contacto', (SELECT round((percentile_cont(0.5) WITHIN GROUP (
                                 ORDER BY extract(epoch FROM contacted_at - created_at) / 3600))::numeric, 1)
                               FROM leads WHERE contacted_at IS NOT NULL),
      'contratos_firmados',   (SELECT count(*) FROM cierres WHERE fecha_contrato BETWEEN p_desde AND p_hasta),
      'primeros_pagos',       (SELECT count(*) FROM cierres WHERE fecha_pago BETWEEN p_desde AND p_hasta),
      'ventas_cerradas',      (SELECT count(*) FROM cierres WHERE fecha_cierre BETWEEN p_desde AND p_hasta),
      'reuniones_agendadas',  (SELECT count(*) FROM citas WHERE event_type = 'meeting'
                                 AND (created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN p_desde AND p_hasta),
      'llamadas_agendadas',   (SELECT count(*) FROM citas WHERE event_type = 'call'
                                 AND (created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN p_desde AND p_hasta),
      'asistidas',            (SELECT count(*) FROM citas_pasadas WHERE attendance = 'attended'),
      'no_asistidas',         (SELECT count(*) FROM citas_pasadas WHERE attendance = 'no_show'),
      'sin_marcar',           (SELECT count(*) FROM citas_pasadas WHERE attendance IS NULL)
    ),
    'marketing', jsonb_build_object(
      'hay_gasto', EXISTS (SELECT 1 FROM gasto),
      'leads_sin_campana', (SELECT count(*) FROM leads_mkt WHERE campana_clave IS NULL),
      'campanas', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.leads DESC, x.gasto DESC NULLS LAST), '[]'::jsonb)
                   FROM (SELECT * FROM por_campana ORDER BY leads DESC LIMIT 50) x),
      'anuncios', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.leads DESC, x.gasto DESC NULLS LAST), '[]'::jsonb)
                   FROM (SELECT * FROM por_anuncio ORDER BY leads DESC LIMIT 100) x)
    ),
    'expedientes', jsonb_build_object(
      'pendientes_documentacion', (SELECT count(*) FROM public.cases
                                    WHERE status = 'active' AND phase IN ('intake', 'document_collection')),
      'presentados',   (SELECT count(*) FROM presentados),
      'sin_noticias',  (SELECT count(*) FROM presentados WHERE ultima_novedad <= current_date - 90),
      'ganados',       (SELECT count(*) FROM resueltos WHERE outcome = 'won'),
      'parciales',     (SELECT count(*) FROM resueltos WHERE outcome = 'partial'),
      'desestimados',  (SELECT count(*) FROM resueltos WHERE outcome = 'dismissed'),
      'desistidos',    (SELECT count(*) FROM resueltos WHERE outcome = 'withdrawn'),
      'alertas', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.dias DESC), '[]'::jsonb) FROM (
                    SELECT p.id, p.case_number, p.case_type, p.filed_at, p.last_court_notice_at,
                      (current_date - p.ultima_novedad) AS dias,
                      trim(coalesce(ct.first_name, '') || ' ' || coalesce(ct.last_name, '')) AS cliente
                    FROM presentados p LEFT JOIN public.contacts ct ON ct.id = p.contact_id
                    WHERE p.ultima_novedad <= current_date - 90
                    ORDER BY dias DESC LIMIT 20) x)
    )
  ) INTO v_resultado;

  RETURN v_resultado;
END $$;

REVOKE ALL ON FUNCTION public.ceo_summary(date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ceo_summary(date, date) TO authenticated;

SELECT 'Migration 022 OK: datos y resumen de dirección' AS status;
