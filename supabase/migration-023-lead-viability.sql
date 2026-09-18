-- =============================================================================
-- Migration 023: formulario de viabilidad LSO + informe de viabilidad con IA
-- =============================================================================
--
-- Petición de José (2026-09-18): el setter/closer rellena un formulario con los
-- datos del lead (situación económica, patrimonio, deuda pública, acreedores,
-- requisitos de buena fe...) y, con un botón "Crear informe", esos datos se
-- envían a Claude para redactar un informe de viabilidad jurídico-económica de
-- la Ley de Segunda Oportunidad (arts. 486 y ss. del TRLC), siguiendo el modelo
-- de informe real del despacho. El informe se guarda en la ficha del lead
-- (tabla documents, igual que un archivo subido a mano) y se puede descargar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Formulario de viabilidad (uno por contacto)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_viability_forms (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  contact_id                  uuid NOT NULL REFERENCES public.contacts ON DELETE CASCADE UNIQUE,

  -- Situación personal
  localidad                   text,
  perfil                      text CHECK (perfil IS NULL OR perfil IN ('no_empresario', 'empresario')),
  estado_civil                text CHECK (estado_civil IS NULL OR estado_civil IN ('soltero', 'casado', 'separado', 'divorciado', 'viudo', 'pareja_de_hecho')),
  regimen_matrimonial         text CHECK (regimen_matrimonial IS NULL OR regimen_matrimonial IN ('gananciales', 'separacion_bienes', 'participacion', 'no_aplica')),

  -- Situación económica
  ingresos_mensuales          numeric,
  origen_ingresos             text,
  deuda_total_estimada        numeric,
  origen_endeudamiento_anio   integer,

  -- Patrimonio
  tiene_vivienda               boolean NOT NULL DEFAULT false,
  valor_vivienda                numeric,
  tiene_vehiculos               boolean NOT NULL DEFAULT false,
  otros_bienes                  text,

  -- Deuda pública
  deuda_aeat                    numeric NOT NULL DEFAULT 0,
  deuda_tgss                    numeric NOT NULL DEFAULT 0,

  -- Situación procesal
  embargos_activos              boolean NOT NULL DEFAULT false,
  detalle_embargos              text,

  -- Requisitos de buena fe (art. 487 TRLC)
  condena_penal_10anios         boolean NOT NULL DEFAULT false,
  concurso_culpable_previo      boolean NOT NULL DEFAULT false,
  sancion_grave_10anios         boolean NOT NULL DEFAULT false,
  exoneracion_previa_5anios     boolean NOT NULL DEFAULT false,
  acuerdo_extrajudicial_previo  boolean NOT NULL DEFAULT false,

  -- Acreedores: [{ "nombre": "...", "tipo": "bancario"|"tarjeta"|"publico"|"otro", "importe": 1000 }]
  acreedores                    jsonb NOT NULL DEFAULT '[]'::jsonb,

  notas_setter                  text,

  completado_por                uuid REFERENCES public.users ON DELETE SET NULL,
  completado_at                 timestamptz,

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_viability_forms_contact ON public.lead_viability_forms (contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_viability_forms_org ON public.lead_viability_forms (org_id);

CREATE TRIGGER trg_lead_viability_forms_updated_at
  BEFORE UPDATE ON public.lead_viability_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.lead_viability_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON public.lead_viability_forms
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "Users can insert own org data" ON public.lead_viability_forms
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "Users can update own org data" ON public.lead_viability_forms
  FOR UPDATE USING (org_id = auth_org_id());
CREATE POLICY "Users can delete own org data" ON public.lead_viability_forms
  FOR DELETE USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "mfa_email_gate" ON public.lead_viability_forms;
CREATE POLICY "mfa_email_gate" ON public.lead_viability_forms
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- -----------------------------------------------------------------------------
-- 2. Informes de viabilidad generados (histórico; el más reciente es "el" informe)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_viability_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  contact_id    uuid NOT NULL REFERENCES public.contacts ON DELETE CASCADE,
  form_id       uuid REFERENCES public.lead_viability_forms ON DELETE SET NULL,
  content       text NOT NULL,                                        -- informe en markdown
  document_id   uuid REFERENCES public.documents ON DELETE SET NULL,  -- versión descargable (tabla documents)
  generated_by  uuid REFERENCES public.users ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_viability_reports_contact ON public.lead_viability_reports (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_viability_reports_org ON public.lead_viability_reports (org_id);

ALTER TABLE public.lead_viability_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org data" ON public.lead_viability_reports
  FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "Users can insert own org data" ON public.lead_viability_reports
  FOR INSERT WITH CHECK (org_id = auth_org_id());
CREATE POLICY "Users can delete own org data" ON public.lead_viability_reports
  FOR DELETE USING (org_id = auth_org_id());

DROP POLICY IF EXISTS "mfa_email_gate" ON public.lead_viability_reports;
CREATE POLICY "mfa_email_gate" ON public.lead_viability_reports
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_email_ok())) WITH CHECK ((SELECT public.mfa_email_ok()));

-- -----------------------------------------------------------------------------
-- 3. Plantillas de prompts de IA (contenido, no esquema)
-- -----------------------------------------------------------------------------
-- Aquí vive el informe modelo real que usa generate-viability-report como
-- ejemplo de estilo para Claude. Va en una tabla y no en el código de la Edge
-- Function a propósito: ese informe modelo contiene datos de un caso real de
-- un cliente (nombre, cifras, fecha) y el repositorio de este proyecto es
-- público en GitHub. Sin políticas para 'authenticated': solo accesible desde
-- las Edge Functions (service_role), nunca desde el navegador.
CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  key         text PRIMARY KEY,
  content     text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
