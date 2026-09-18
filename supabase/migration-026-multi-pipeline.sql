-- =============================================================================
-- Migration 026: varios pipelines por despacho (selector tipo "secuencias")
-- =============================================================================
--
-- Petición de José (2026-09-18): tiene que poder haber más de un pipeline
-- (como los "sequences" de GHL) y elegir cuál ver con un desplegable, con
-- opción de crear uno nuevo. La tabla `pipelines` ya existía en el esquema
-- base (sin usar todavía); esta migración la activa de verdad: cada etapa
-- (pipeline_stages) pasa a colgar de un pipeline concreto, y cada contacto
-- pasa a pertenecer a un pipeline concreto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. pipeline_stages vuelve a colgar de un pipeline (antes: directo de org_id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.pipelines ON DELETE CASCADE;

-- Las etapas sembradas en la migración 025 van al pipeline "Embudo principal" de cada despacho.
UPDATE public.pipeline_stages ps
SET pipeline_id = p.id
FROM public.pipelines p
WHERE ps.org_id = p.org_id AND p.is_default = true AND ps.pipeline_id IS NULL;

ALTER TABLE public.pipeline_stages ALTER COLUMN pipeline_id SET NOT NULL;

ALTER TABLE public.pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_org_key_unique;
ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_pipeline_key_unique UNIQUE (pipeline_id, key);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON public.pipeline_stages (pipeline_id, position);

-- -----------------------------------------------------------------------------
-- 2. Cada contacto pertenece a un pipeline concreto
-- -----------------------------------------------------------------------------
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.pipelines ON DELETE SET NULL;

UPDATE public.contacts c
SET pipeline_id = p.id
FROM public.pipelines p
WHERE c.org_id = p.org_id AND p.is_default = true AND c.pipeline_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_pipeline ON public.contacts (pipeline_id);

-- Nuevo contacto sin pipeline explícito -> el pipeline por defecto del despacho.
CREATE OR REPLACE FUNCTION public.default_contact_pipeline()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.pipeline_id IS NULL THEN
    SELECT id INTO NEW.pipeline_id FROM public.pipelines WHERE org_id = NEW.org_id AND is_default = true LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_default_contact_pipeline ON public.contacts;
CREATE TRIGGER trg_default_contact_pipeline
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.default_contact_pipeline();

-- -----------------------------------------------------------------------------
-- 3. mfa_email_gate en pipelines (no lo tenía: es anterior a esa regla)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "mfa_email_gate" ON public.pipelines;
CREATE POLICY "mfa_email_gate" ON public.pipelines
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- -----------------------------------------------------------------------------
-- 4. Sembrar automáticamente el pipeline por defecto de un despacho nuevo
--    (antes lo hacía _seed_despacho.sql a mano; ahora también por trigger,
--    igual que pipeline_stages en la migración 025)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_pipeline()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_pipeline_id uuid;
BEGIN
  INSERT INTO public.pipelines (org_id, name, is_default)
  VALUES (NEW.id, 'Embudo principal', true)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.pipeline_stages (org_id, pipeline_id, key, label, color, position, is_won, is_lost) VALUES
    (NEW.id, v_pipeline_id, 'lead',             'Nuevo lead',          '#3b82f6', 0, false, false),
    (NEW.id, v_pipeline_id, 'seguimiento_ia',   'Seguimiento IA',      '#06b6d4', 1, false, false),
    (NEW.id, v_pipeline_id, 'no_contesta_ia',   'No contesta IA',      '#f97316', 2, false, false),
    (NEW.id, v_pipeline_id, 'seguimiento',      'Seguimiento',         '#f59e0b', 3, false, false),
    (NEW.id, v_pipeline_id, 'llamada',          'Llamada',             '#8b5cf6', 4, false, false),
    (NEW.id, v_pipeline_id, 'videollamada',     'Videollamada',        '#00897B', 5, false, false),
    (NEW.id, v_pipeline_id, 'pendiente_cierre', 'Pendiente de cierre', '#eab308', 6, false, false),
    (NEW.id, v_pipeline_id, 'lost',             'Descartado',          '#ef4444', 7, false, true),
    (NEW.id, v_pipeline_id, 'client',           'Venta',               '#22c55e', 8, true,  false);
  RETURN NEW;
END $$;

-- Sustituye al trigger de la migración 025, que sembraba etapas sin pipeline_id.
DROP TRIGGER IF EXISTS trg_seed_default_pipeline_stages ON public.organizations;
DROP TRIGGER IF EXISTS trg_seed_default_pipeline ON public.organizations;
CREATE TRIGGER trg_seed_default_pipeline
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_pipeline();
