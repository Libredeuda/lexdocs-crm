-- =============================================================================
-- Migration 024: gastos mensuales, hijos menores y personas dependientes en el
-- formulario de viabilidad LSO
-- =============================================================================
--
-- Petición de José (2026-09-18): el informe de viabilidad necesita analizar
-- insolvencia con ingresos Y gastos (no solo ingresos), y tener en cuenta si
-- hay hijos menores o personas dependientes a cargo (relevante para la
-- estrategia y para estimar el mínimo inembargable/cargas familiares).
-- =============================================================================

ALTER TABLE public.lead_viability_forms
  ADD COLUMN IF NOT EXISTS gastos_mensuales           numeric,
  ADD COLUMN IF NOT EXISTS tiene_hijos_menores         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS num_hijos_menores           integer,
  ADD COLUMN IF NOT EXISTS tiene_personas_dependientes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS detalle_dependientes        text;
