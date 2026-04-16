-- ============================================================================
-- Migration 002: LexConsulta - Jurisprudencia + Legislación + pgvector
-- ============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Jurisprudence table (shared - NOT per tenant, public legal data)
CREATE TABLE IF NOT EXISTS jurisprudence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'cendoj'
    CHECK (source IN ('cendoj', 'tribunal_constitucional', 'tjue', 'manual')),
  tribunal text,
  sala text,
  reference text UNIQUE,
  case_date date,
  ponente text,
  matter text[] DEFAULT '{}',
  summary text,
  full_text text,
  url text,
  embedding vector(1024),
  indexed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Full-text search index (Spanish)
CREATE INDEX IF NOT EXISTS idx_juris_fts
  ON jurisprudence
  USING gin(to_tsvector('spanish', coalesce(summary, '') || ' ' || coalesce(full_text, '')));

-- Vector similarity index
CREATE INDEX IF NOT EXISTS idx_juris_embedding
  ON jurisprudence
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Regular indexes
CREATE INDEX IF NOT EXISTS idx_juris_source ON jurisprudence(source);
CREATE INDEX IF NOT EXISTS idx_juris_tribunal ON jurisprudence(tribunal);
CREATE INDEX IF NOT EXISTS idx_juris_date ON jurisprudence(case_date DESC);
CREATE INDEX IF NOT EXISTS idx_juris_matter ON jurisprudence USING gin(matter);
CREATE INDEX IF NOT EXISTS idx_juris_reference ON jurisprudence(reference);

-- 3. Legislation table (shared - public legal data from BOE)
CREATE TABLE IF NOT EXISTS legislation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'boe'
    CHECK (source IN ('boe', 'eurlex', 'ccaa', 'manual')),
  title text NOT NULL,
  reference text UNIQUE,
  body text,
  publication_date date,
  effective_date date,
  status text DEFAULT 'vigente'
    CHECK (status IN ('vigente', 'derogada', 'modificada', 'pendiente')),
  category text,
  url text,
  embedding vector(1024),
  indexed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legis_fts
  ON legislation
  USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(body, '')));

CREATE INDEX IF NOT EXISTS idx_legis_embedding
  ON legislation
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_legis_source ON legislation(source);
CREATE INDEX IF NOT EXISTS idx_legis_status ON legislation(status);
CREATE INDEX IF NOT EXISTS idx_legis_date ON legislation(publication_date DESC);

-- 4. Procedural knowledge (PER tenant - curated by each firm)
CREATE TABLE IF NOT EXISTS procedural_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  embedding vector(1024),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proc_knowledge_tenant ON procedural_knowledge(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proc_knowledge_fts
  ON procedural_knowledge
  USING gin(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, '')));

-- 5. Search history (per tenant, for analytics)
CREATE TABLE IF NOT EXISTS search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query text NOT NULL,
  filters jsonb DEFAULT '{}',
  results_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_history_tenant ON search_history(tenant_id);

-- 6. Saved searches / bookmarks
CREATE TABLE IF NOT EXISTS saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('jurisprudence', 'legislation', 'knowledge')),
  item_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);

-- 7. Disable RLS on shared tables (public legal data)
ALTER TABLE jurisprudence DISABLE ROW LEVEL SECURITY;
ALTER TABLE legislation DISABLE ROW LEVEL SECURITY;
ALTER TABLE procedural_knowledge DISABLE ROW LEVEL SECURITY;
ALTER TABLE search_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items DISABLE ROW LEVEL SECURITY;

-- 8. Seed: sample jurisprudence for LSO/concursal
INSERT INTO jurisprudence (source, tribunal, sala, reference, case_date, ponente, matter, summary, full_text, url)
VALUES
  ('cendoj', 'Tribunal Supremo', 'Sala Primera', 'STS 381/2019', '2019-06-02', 'Pedro José Vela Torres',
   ARRAY['segunda oportunidad', 'BEPI', 'buena fe'],
   'Establece los criterios para valorar la buena fe del deudor a efectos de la concesión del beneficio de exoneración del pasivo insatisfecho (BEPI). El deudor debe haber actuado con buena fe procesal y material.',
   'FUNDAMENTOS DE DERECHO: PRIMERO.- La cuestión que se plantea es si procede conceder el beneficio de exoneración del pasivo insatisfecho...',
   'https://www.poderjudicial.es/search/AN/openDocument/STS381-2019'),

  ('cendoj', 'Tribunal Supremo', 'Sala Primera', 'STS 56/2020', '2020-02-02', 'Pedro José Vela Torres',
   ARRAY['segunda oportunidad', 'BEPI', 'crédito público', 'AEAT', 'TGSS'],
   'Sobre la extensión del BEPI al crédito público (AEAT y Seguridad Social). Establece que el crédito público puede ser exonerado en determinadas circunstancias bajo la LSO.',
   'FUNDAMENTOS DE DERECHO: PRIMERO.- Se discute si el beneficio de exoneración del pasivo insatisfecho se extiende a los créditos de derecho público...',
   'https://www.poderjudicial.es/search/AN/openDocument/STS56-2020'),

  ('cendoj', 'Tribunal Supremo', 'Sala Primera', 'STS 232/2022', '2022-03-22', 'Pedro José Vela Torres',
   ARRAY['segunda oportunidad', 'plan de pagos', 'concurso consecutivo'],
   'Sobre la aprobación del plan de pagos en el concurso consecutivo. Define los requisitos para que el juez apruebe un plan de pagos razonable que permita al deudor la exoneración.',
   'FUNDAMENTOS DE DERECHO: Se plantea recurso de casación contra la sentencia que denegó la aprobación del plan de pagos...',
   'https://www.poderjudicial.es/search/AN/openDocument/STS232-2022'),

  ('cendoj', 'Tribunal Supremo', 'Sala Primera', 'STS 400/2023', '2023-03-20', 'Ignacio Sancho Gargallo',
   ARRAY['concurso', 'masa activa', 'vivienda habitual'],
   'Sobre la exclusión de la vivienda habitual de la masa activa del concurso cuando el deudor persona física la necesita para su residencia. Criterios de proporcionalidad.',
   'FUNDAMENTOS DE DERECHO: PRIMERO.- La cuestión litigiosa se centra en si la vivienda habitual del concursado...',
   'https://www.poderjudicial.es/search/AN/openDocument/STS400-2023'),

  ('cendoj', 'Tribunal Supremo', 'Sala Primera', 'STS 589/2023', '2023-04-21', 'Pedro José Vela Torres',
   ARRAY['segunda oportunidad', 'BEPI', 'deudor hipotecario', 'vivienda'],
   'Extensión del BEPI a la deuda hipotecaria. El Tribunal Supremo clarifica que la exoneración puede alcanzar al crédito hipotecario en determinados supuestos del TRLC.',
   'FUNDAMENTOS DE DERECHO: Se plantea si la exoneración del pasivo insatisfecho puede extenderse a la deuda garantizada con hipoteca...',
   'https://www.poderjudicial.es/search/AN/openDocument/STS589-2023'),

  ('tjue', 'Tribunal de Justicia UE', 'Sala Tercera', 'STJUE C-869/19', '2022-03-10', NULL,
   ARRAY['segunda oportunidad', 'directiva insolvencia', 'plazos exoneración'],
   'Caso Liku/Sabiedrība. Sobre los plazos de exoneración de deudas en el marco de la Directiva (UE) 2019/1023. Establece que los plazos nacionales deben ser razonables y proporcionales.',
   'El Tribunal de Justicia resuelve que los Estados miembros deben garantizar plazos de exoneración razonables...',
   'https://curia.europa.eu/juris/document/document.jsf?docid=C-869-19')
ON CONFLICT (reference) DO NOTHING;

-- 9. Seed: sample legislation for LSO/concursal
INSERT INTO legislation (source, title, reference, publication_date, effective_date, status, category, url, body)
VALUES
  ('boe', 'Texto Refundido de la Ley Concursal (TRLC)', 'Real Decreto Legislativo 1/2020', '2020-05-07', '2020-09-01', 'vigente', 'concursal',
   'https://www.boe.es/buscar/act.php?id=BOE-A-2020-4859',
   'Libro primero: Del concurso de acreedores. Libro segundo: Del derecho preconcursal. Libro tercero: Del texto refundido. Incluye la regulación del BEPI (arts. 486-502) y el procedimiento especial para personas naturales.'),

  ('boe', 'Ley 16/2022 de reforma del TRLC', 'Ley 16/2022, de 5 de septiembre', '2022-09-06', '2022-09-26', 'vigente', 'concursal',
   'https://www.boe.es/buscar/act.php?id=BOE-A-2022-14580',
   'Transpone la Directiva (UE) 2019/1023. Reforma el TRLC para establecer el nuevo mecanismo de segunda oportunidad, planes de reestructuración y alerta temprana. Modifica sustancialmente el régimen del BEPI.'),

  ('boe', 'Ley Orgánica 1/2020 de protección de datos', 'Ley 3/2018 + RGPD', '2018-12-06', '2018-12-07', 'vigente', 'protección de datos',
   'https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673',
   'Ley Orgánica de Protección de Datos y garantía de los derechos digitales. Complementa el RGPD europeo. Aplicable al tratamiento de datos en procedimientos concursales y segunda oportunidad.'),

  ('boe', 'Real Decreto-ley 1/2015 de mecanismo de segunda oportunidad', 'Real Decreto-ley 1/2015', '2015-02-28', '2015-03-01', 'modificada', 'segunda oportunidad',
   'https://www.boe.es/buscar/act.php?id=BOE-A-2015-2109',
   'Mecanismo de segunda oportunidad, reducción de la carga financiera y otras medidas de orden social. Introdujo por primera vez el BEPI en el ordenamiento español. Modificada por Ley 16/2022.')
ON CONFLICT (reference) DO NOTHING;

-- Done!
SELECT 'Migration 002 completed: LexConsulta tables + seed data created' AS status;
