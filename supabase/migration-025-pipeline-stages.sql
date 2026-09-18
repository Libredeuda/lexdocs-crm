-- =============================================================================
-- Migration 025: etapas de pipeline configurables por despacho
-- =============================================================================
--
-- Petición de José (2026-09-18): las columnas del Kanban de Contactos ya no son
-- fijas (Nuevo lead/Contactado/Cualificado/Cliente/Perdido) — cada despacho debe
-- poder añadir, quitar, renombrar, recolorear y reordenar sus propias etapas.
-- La configuración inicial que pidió: Nuevo lead, Seguimiento IA, No contesta
-- IA, Seguimiento, Llamada, Videollamada, Pendiente de cierre, Descartado, Venta.
--
-- El esquema base (schema.sql) ya tenía una tabla `pipeline_stages` colgando de
-- `pipelines` (org → pipeline → stages), pero nunca se llegó a usar: el Kanban
-- real (ContactPipeline.jsx) siempre trabajó directamente contra `contacts.status`
-- con 5 columnas fijas en el código. Esta migración adapta esa tabla existente
-- (en vez de crear una nueva) para que cuelgue directamente de `org_id` — más
-- simple, sin el nivel intermedio de "pipelines" que nadie usa — y sea la fuente
-- real de las columnas del Kanban.
--
-- contacts.status sigue siendo texto libre (guarda la "key" de la etapa), pero
-- deja de estar restringido a una lista fija de 6 valores: ahora cualquier key
-- definida en pipeline_stages es válida.
--
-- Dos keys son "especiales" y no cambian de significado en el resto del
-- sistema (el botón "Convertir a cliente" sigue escribiendo 'client'; los
-- leads llegan con 'lead' por defecto; nada más del backend depende de las
-- demás etapas intermedias, así que renombrarlas/añadirlas es seguro):
--   - 'lead'   → siempre existe, es el estado por defecto de un contacto nuevo.
--   - 'client' → is_won = true (se usa al convertir un lead en cliente).
--   - 'lost'   → is_lost = true (se usa al marcar un lead como perdido).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. contacts.status deja de estar limitado a 6 valores fijos
-- -----------------------------------------------------------------------------
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_status_check;

-- -----------------------------------------------------------------------------
-- 2. Adaptar pipeline_stages: cuelga de org_id directamente (no de pipeline_id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS org_id      uuid REFERENCES public.organizations ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS key         text,
  ADD COLUMN IF NOT EXISTS is_won      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_lost     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- Nunca se usó en producción (el Kanban real no leía de aquí): partimos de cero
-- con la configuración pedida en vez de intentar migrar las 5 etapas de muestra.
DELETE FROM public.pipeline_stages;

DROP POLICY IF EXISTS "Users can view own org pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can insert own org pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can update own org pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can delete own org pipeline stages" ON public.pipeline_stages;

ALTER TABLE public.pipeline_stages DROP COLUMN IF EXISTS pipeline_id;
ALTER TABLE public.pipeline_stages RENAME COLUMN name TO label;

ALTER TABLE public.pipeline_stages ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN key SET NOT NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN color SET NOT NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN color SET DEFAULT '#3b82f6';

ALTER TABLE public.pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_org_key_unique;
ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_org_key_unique UNIQUE (org_id, key);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org ON public.pipeline_stages (org_id, position);

DROP TRIGGER IF EXISTS trg_pipeline_stages_updated_at ON public.pipeline_stages;
CREATE TRIGGER trg_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE POLICY "Users can view own org data" ON public.pipeline_stages
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "Users can insert own org data" ON public.pipeline_stages
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "Users can update own org data" ON public.pipeline_stages
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "Users can delete own org data" ON public.pipeline_stages
  FOR DELETE USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "mfa_email_gate" ON public.pipeline_stages;
CREATE POLICY "mfa_email_gate" ON public.pipeline_stages
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- -----------------------------------------------------------------------------
-- 3. Sembrar la configuración inicial pedida, para despachos existentes...
-- -----------------------------------------------------------------------------
INSERT INTO public.pipeline_stages (org_id, key, label, color, position, is_won, is_lost)
SELECT o.id, s.key, s.label, s.color, s.position, s.is_won, s.is_lost
FROM public.organizations o
CROSS JOIN (VALUES
  ('lead',             'Nuevo lead',           '#3b82f6', 0, false, false),
  ('seguimiento_ia',   'Seguimiento IA',       '#06b6d4', 1, false, false),
  ('no_contesta_ia',   'No contesta IA',       '#f97316', 2, false, false),
  ('seguimiento',      'Seguimiento',          '#f59e0b', 3, false, false),
  ('llamada',          'Llamada',              '#8b5cf6', 4, false, false),
  ('videollamada',     'Videollamada',         '#00897B', 5, false, false),
  ('pendiente_cierre', 'Pendiente de cierre',  '#eab308', 6, false, false),
  ('lost',             'Descartado',           '#ef4444', 7, false, true),
  ('client',           'Venta',                '#22c55e', 8, true,  false)
) AS s(key, label, color, position, is_won, is_lost)
ON CONFLICT (org_id, key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. ...y para despachos nuevos a partir de ahora
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_pipeline_stages()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.pipeline_stages (org_id, key, label, color, position, is_won, is_lost) VALUES
    (NEW.id, 'lead',             'Nuevo lead',          '#3b82f6', 0, false, false),
    (NEW.id, 'seguimiento_ia',   'Seguimiento IA',      '#06b6d4', 1, false, false),
    (NEW.id, 'no_contesta_ia',   'No contesta IA',      '#f97316', 2, false, false),
    (NEW.id, 'seguimiento',      'Seguimiento',         '#f59e0b', 3, false, false),
    (NEW.id, 'llamada',          'Llamada',             '#8b5cf6', 4, false, false),
    (NEW.id, 'videollamada',     'Videollamada',        '#00897B', 5, false, false),
    (NEW.id, 'pendiente_cierre', 'Pendiente de cierre', '#eab308', 6, false, false),
    (NEW.id, 'lost',             'Descartado',          '#ef4444', 7, false, true),
    (NEW.id, 'client',           'Venta',               '#22c55e', 8, true,  false);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_default_pipeline_stages ON public.organizations;
CREATE TRIGGER trg_seed_default_pipeline_stages
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_pipeline_stages();
