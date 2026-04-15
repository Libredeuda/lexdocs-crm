-- ============================================================================
-- LexDocs CRM - Seed Data
-- ============================================================================
-- Run with: supabase db reset  (applies migrations + seed)
-- Idempotent: uses ON CONFLICT DO NOTHING throughout
-- ============================================================================

-- Fixed IDs for referencing
-- Org:    aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- Carlos: 11111111-1111-1111-1111-111111111111
-- Ana:    22222222-2222-2222-2222-222222222222
-- Laura:  33333333-3333-3333-3333-333333333333

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ORGANIZATION
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO organizations (id, name, slug, plan, created_at)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'LibreDeuda Abogados',
  'libredeuda',
  'pro',
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. AUTH USERS (Supabase auth.users) + PUBLIC USERS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carlos@libredeuda.com', crypt('admin1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Carlos Martinez"}', now(), now(), '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@libredeuda.com', crypt('admin1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Beltran"}', now(), now(), '', ''),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'laura@libredeuda.com', crypt('admin1234', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Laura Sanchez"}', now(), now(), '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'carlos@libredeuda.com', 'email', '{"sub":"11111111-1111-1111-1111-111111111111","email":"carlos@libredeuda.com"}', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'ana@libredeuda.com', 'email', '{"sub":"22222222-2222-2222-2222-222222222222","email":"ana@libredeuda.com"}', now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'laura@libredeuda.com', 'email', '{"sub":"33333333-3333-3333-3333-333333333333","email":"laura@libredeuda.com"}', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- Now create the public.users records
INSERT INTO users (id, org_id, email, full_name, role, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'carlos@libredeuda.com', 'Carlos Martinez', 'admin', now()),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ana@libredeuda.com', 'Ana Beltran', 'lawyer', now()),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'laura@libredeuda.com', 'Laura Sanchez', 'staff', now())
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PIPELINE & STAGES
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO pipelines (id, org_id, name, is_default, created_at)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Embudo principal',
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pipeline_stages (id, pipeline_id, name, position, color, created_at)
VALUES
  ('cccccccc-cc01-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Nuevo lead',  1, '#3b82f6', now()),
  ('cccccccc-cc02-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Contactado',  2, '#f59e0b', now()),
  ('cccccccc-cc03-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Cualificado', 3, '#8b5cf6', now()),
  ('cccccccc-cc04-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Cliente',     4, '#22c55e', now()),
  ('cccccccc-cc05-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Perdido',     5, '#ef4444', now())
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. CONTACTS (8)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO contacts (id, org_id, first_name, last_name, email, phone, company, source, status, assigned_to, pipeline_stage_id, notes_text, created_at)
VALUES
  -- Maria Garcia Lopez (client, website, assigned to Carlos)
  ('dddddddd-dd01-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Maria', 'Garcia Lopez', 'maria@demo.com', '+34 612 345 678', NULL,
   'website', 'client', '11111111-1111-1111-1111-111111111111',
   'cccccccc-cc04-cccc-cccc-cccccccccccc',
   'Caso LSO abierto. Documentacion en curso.', now() - interval '45 days'),

  -- Construcciones Levante S.L. (client, referral, assigned to Ana)
  ('dddddddd-dd02-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Construcciones Levante', 'S.L.', 'admin@construccioneslevante.es', '+34 965 123 456', 'Construcciones Levante S.L.',
   'referral', 'client', '22222222-2222-2222-2222-222222222222',
   'cccccccc-cc04-cccc-cccc-cccccccccccc',
   'Concurso de acreedores. Empresa constructora.', now() - interval '40 days'),

  -- Pedro Ruiz Sanchez (qualified, ads, assigned to Carlos)
  ('dddddddd-dd03-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Pedro', 'Ruiz Sanchez', 'pedro.ruiz@email.com', '+34 622 987 654', NULL,
   'ads', 'qualified', '11111111-1111-1111-1111-111111111111',
   'cccccccc-cc03-cccc-cccc-cccccccccccc',
   'Deuda bancaria. Interesado en LSO.', now() - interval '10 days'),

  -- Elena Moreno Diaz (contacted, whatsapp, assigned to Ana)
  ('dddddddd-dd04-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Elena', 'Moreno Diaz', 'elena.moreno@email.com', '+34 633 456 789', NULL,
   'whatsapp', 'contacted', '22222222-2222-2222-2222-222222222222',
   'cccccccc-cc02-cccc-cccc-cccccccccccc',
   'Consulta por WhatsApp sobre deudas con Hacienda.', now() - interval '5 days'),

  -- Transportes Mediterraneo S.L. (lead, website, unassigned)
  ('dddddddd-dd05-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Transportes Mediterraneo', 'S.L.', 'info@transmediterraneo.es', '+34 966 789 012', 'Transportes Mediterraneo S.L.',
   'website', 'lead', NULL,
   'cccccccc-cc01-cccc-cccc-cccccccccccc',
   'Formulario web. Empresa de transporte con deudas.', now() - interval '2 days'),

  -- Antonio Lopez Fernandez (lead, ads, unassigned)
  ('dddddddd-dd06-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Antonio', 'Lopez Fernandez', 'antonio.lopez@email.com', '+34 644 321 098', NULL,
   'ads', 'lead', NULL,
   'cccccccc-cc01-cccc-cccc-cccccccccccc',
   'Lead de campana Meta Ads.', now() - interval '1 day'),

  -- Sofia Navarro Gil (lost, referral, assigned to Carlos)
  ('dddddddd-dd07-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Sofia', 'Navarro Gil', 'sofia.navarro@email.com', '+34 655 654 321', NULL,
   'referral', 'lost', '11111111-1111-1111-1111-111111111111',
   'cccccccc-cc05-cccc-cccc-cccccccccccc',
   'No cumplia requisitos para LSO. Derivada a otro despacho.', now() - interval '30 days'),

  -- Inversiones Costa Blanca S.L. (archived, manual)
  ('dddddddd-dd08-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'Inversiones Costa Blanca', 'S.L.', 'contacto@invcostabl.es', '+34 967 111 222', 'Inversiones Costa Blanca S.L.',
   'manual', 'archived', NULL,
   NULL,
   'Contacto antiguo. Caso cerrado.', now() - interval '90 days')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. CASES (2)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO cases (id, org_id, contact_id, case_number, case_type, assigned_lawyer_id, phase, progress, status, created_at)
VALUES
  -- Case 1412a-2025 (LSO) for Maria Garcia, assigned to Carlos
  ('eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'dddddddd-dd01-dddd-dddd-dddddddddddd',
   '1412a-2025', 'lso',
   '11111111-1111-1111-1111-111111111111',
   'document_collection', 0, 'active', now() - interval '44 days'),

  -- Case 0892b-2025 (concurso) for Construcciones Levante, assigned to Ana
  ('eeeeeeee-ee02-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'dddddddd-dd02-dddd-dddd-dddddddddddd',
   '0892b-2025', 'concurso',
   '22222222-2222-2222-2222-222222222222',
   'document_collection', 0, 'active', now() - interval '39 days')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. DOCUMENT TYPES - LSO (30 types)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO document_types (id, org_id, case_type, name, category, cat_num, required, kb_issuer, kb_validity, kb_where_to_get, kb_criteria, sort_order)
VALUES
  -- ── Datos Personales (cat 1) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'DNI / NIE en vigor (deudor y conyuge)', 'Datos Personales', 1, true,
   'Direccion General de la Policia', 'En vigor', 'Comisaria con cita previa en sede.policia.gob.es',
   'Confirma que es un DNI o NIE espanol oficial. Debe mostrar numero, nombre, fecha nacimiento, fecha validez (no caducado) y foto. Verifica anverso y reverso.', 1),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Libro de familia', 'Datos Personales', 1, true,
   'Registro Civil', 'Actualizado', 'Registro Civil del lugar de matrimonio',
   'Confirma que es un Libro de Familia oficial con sello del Registro Civil, datos del matrimonio y filiacion de hijos.', 2),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Certificado empadronamiento actual', 'Datos Personales', 1, true,
   'Ayuntamiento', '3 meses', 'Sede electronica del Ayuntamiento con Cl@ve o certificado digital',
   'Confirma que es un certificado (NO volante) con cabecera del Ayuntamiento, nombre, DNI, direccion, fecha expedicion no superior a 3 meses, y sello.', 3),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Certificado antecedentes penales', 'Datos Personales', 1, true,
   'Ministerio de Justicia', '3 meses', 'sede.mjusticia.gob.es',
   'Confirma certificado del Ministerio de Justicia con CSV de verificacion, fecha no superior a 3 meses. NO confundir con certificado de delitos sexuales.', 4),

  -- ── Situacion Laboral (cat 2) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Ultimas 3 nominas', 'Situacion Laboral', 2, true,
   'Empresa empleadora', '3 meses', 'RRHH o portal del empleado',
   'Confirma que son 3 nominas consecutivas y recientes con CIF empresa, datos trabajador, salario bruto/neto y deducciones.', 5),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Declaraciones IRPF/RENTA (4 anos)', 'Situacion Laboral', 2, true,
   'AEAT', 'Ultimos 4 ejercicios', 'sede.agenciatributaria.gob.es con Cl@ve',
   'Confirma declaraciones IRPF Modelo 100 oficiales, con CSV, de los ultimos 4 ejercicios consecutivos.', 6),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Declaracion patrimonio', 'Situacion Laboral', 2, false,
   NULL, NULL, NULL, NULL, 7),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Certificado prestaciones desempleo/pensiones', 'Situacion Laboral', 2, false,
   NULL, NULL, NULL, NULL, 8),

  -- ── Situacion Bancaria (cat 3) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Extractos bancarios 12 meses', 'Situacion Bancaria', 3, true,
   'Entidad bancaria', '12 meses consecutivos', 'Banca electronica de cada entidad',
   'Confirma extractos de TODAS las cuentas, 12 meses consecutivos, con movimientos detallados (no solo saldos).', 9),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Contratos prestamos, hipotecas, creditos', 'Situacion Bancaria', 3, true,
   NULL, NULL, NULL, NULL, 10),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Certificados deuda entidades financieras', 'Situacion Bancaria', 3, true,
   NULL, NULL, NULL, NULL, 11),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Tarjetas credito y saldos pendientes', 'Situacion Bancaria', 3, true,
   NULL, NULL, NULL, NULL, 12),

  -- ── Deudas y Acreedores (cat 4) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Listado acreedores completo (Excel)', 'Deudas y Acreedores', 4, true,
   NULL, NULL, NULL, NULL, 13),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Certificado deuda AEAT', 'Deudas y Acreedores', 4, true,
   'AEAT', '3 meses', 'sede.agenciatributaria.gob.es',
   'Confirma certificado AEAT de situacion de deudas con CSV, fecha no superior a 3 meses, y detalle de deudas pendientes.', 14),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Certificado deuda TGSS', 'Deudas y Acreedores', 4, true,
   'TGSS', '3 meses', 'sede.seg-social.gob.es',
   'Confirma certificado TGSS de deudas (NO confundir con vida laboral), con sello digital y fecha reciente.', 15),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Deuda otras AAPP', 'Deudas y Acreedores', 4, false,
   NULL, NULL, NULL, NULL, 16),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Reclamaciones judiciales en curso', 'Deudas y Acreedores', 4, true,
   NULL, NULL, NULL, NULL, 17),

  -- ── Inventario Bienes (cat 5) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Escrituras de propiedad', 'Inventario Bienes', 5, true,
   NULL, NULL, NULL, NULL, 18),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Recibos IBI (2 anos)', 'Inventario Bienes', 5, true,
   NULL, NULL, NULL, NULL, 19),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Contratos alquiler', 'Inventario Bienes', 5, true,
   NULL, NULL, NULL, NULL, 20),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Permisos circulacion y fichas tecnicas', 'Inventario Bienes', 5, true,
   NULL, NULL, NULL, NULL, 21),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Tasaciones inmuebles/vehiculos', 'Inventario Bienes', 5, false,
   NULL, NULL, NULL, NULL, 22),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Seguros contratados', 'Inventario Bienes', 5, true,
   NULL, NULL, NULL, NULL, 23),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Acciones o participaciones sociales', 'Inventario Bienes', 5, false,
   NULL, NULL, NULL, NULL, 24),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Propiedad intelectual, patentes', 'Inventario Bienes', 5, false,
   NULL, NULL, NULL, NULL, 25),

  -- ── Gastos e Ingresos (cat 6) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Gastos mensuales', 'Gastos e Ingresos', 6, true,
   NULL, NULL, NULL, NULL, 26),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Ingresos mensuales', 'Gastos e Ingresos', 6, true,
   NULL, NULL, NULL, NULL, 27),

  -- ── Contratos Vigentes (cat 7) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Contratos de trabajo', 'Contratos Vigentes', 7, true,
   NULL, NULL, NULL, NULL, 28),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Contratos mercantiles', 'Contratos Vigentes', 7, false,
   NULL, NULL, NULL, NULL, 29),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lso',
   'Leasing, renting, compromisos financieros', 'Contratos Vigentes', 7, true,
   NULL, NULL, NULL, NULL, 30)
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 6b. DOCUMENT TYPES - CONCURSO (36 types)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO document_types (id, org_id, case_type, name, category, cat_num, required, kb_issuer, kb_validity, kb_where_to_get, kb_criteria, sort_order)
VALUES
  -- ── Identificacion y Constitucion (cat 1) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Escritura de constitucion', 'Identificacion y Constitucion', 1, true,
   NULL, NULL, NULL, NULL, 1),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Estatutos sociales vigentes', 'Identificacion y Constitucion', 1, true,
   NULL, NULL, NULL, NULL, 2),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'DNI del administrador', 'Identificacion y Constitucion', 1, true,
   NULL, NULL, NULL, NULL, 3),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Certificacion Registro Mercantil', 'Identificacion y Constitucion', 1, true,
   'Registro Mercantil', '3 meses', 'www.registradores.org',
   'Confirma certificacion oficial (no nota simple) del Registro Mercantil con datos vigentes y administradores actuales.', 4),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Poderes de representacion', 'Identificacion y Constitucion', 1, false,
   NULL, NULL, NULL, NULL, 5),

  -- ── Doc. Contable y Fiscal (cat 2) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Cuentas anuales 3 ejercicios', 'Doc. Contable y Fiscal', 2, true,
   NULL, NULL, NULL, NULL, 6),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Impuesto Sociedades 3 ejercicios', 'Doc. Contable y Fiscal', 2, true,
   NULL, NULL, NULL, NULL, 7),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Declaraciones IVA 12 meses', 'Doc. Contable y Fiscal', 2, true,
   NULL, NULL, NULL, NULL, 8),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Retenciones 12 meses', 'Doc. Contable y Fiscal', 2, true,
   NULL, NULL, NULL, NULL, 9),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Certificado AEAT', 'Doc. Contable y Fiscal', 2, true,
   'AEAT', '3 meses', 'sede.agenciatributaria.gob.es',
   'Igual que ls14 pero con CIF de empresa.', 10),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Certificado TGSS', 'Doc. Contable y Fiscal', 2, true,
   NULL, NULL, NULL, NULL, 11),

  -- ── Memoria Economica y Juridica (cat 3) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Memoria explicativa insolvencia', 'Memoria Economica y Juridica', 3, true,
   NULL, NULL, NULL, NULL, 12),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Destino creditos tras insolvencia', 'Memoria Economica y Juridica', 3, true,
   NULL, NULL, NULL, NULL, 13),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Insolvencia actual o inminente', 'Memoria Economica y Juridica', 3, true,
   NULL, NULL, NULL, NULL, 14),

  -- ── Inventario Bienes - Masa Activa (cat 4) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Bienes inmuebles con cargas', 'Inventario Bienes (Masa Activa)', 4, true,
   NULL, NULL, NULL, NULL, 15),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Tasacion inmuebles gravados', 'Inventario Bienes (Masa Activa)', 4, true,
   NULL, NULL, NULL, NULL, 16),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Vehiculos y maquinaria', 'Inventario Bienes (Masa Activa)', 4, true,
   NULL, NULL, NULL, NULL, 17),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Extractos bancarios 12 meses', 'Inventario Bienes (Masa Activa)', 4, true,
   'Entidades bancarias', '12 meses', 'Banca electronica de empresa',
   'Extractos de TODAS las cuentas de la sociedad, 12 meses consecutivos.', 18),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Existencias y stocks', 'Inventario Bienes (Masa Activa)', 4, true,
   NULL, NULL, NULL, NULL, 19),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Clientes pendientes cobro', 'Inventario Bienes (Masa Activa)', 4, true,
   NULL, NULL, NULL, NULL, 20),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Contratos arrendamiento', 'Inventario Bienes (Masa Activa)', 4, true,
   NULL, NULL, NULL, NULL, 21),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Participaciones otras sociedades', 'Inventario Bienes (Masa Activa)', 4, false,
   NULL, NULL, NULL, NULL, 22),

  -- ── Lista Acreedores - Masa Pasiva (cat 5) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Lista acreedores (Word/Excel)', 'Lista Acreedores (Masa Pasiva)', 5, true,
   NULL, NULL, NULL, NULL, 23),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Informe CIRBE (3 meses)', 'Lista Acreedores (Masa Pasiva)', 5, true,
   'Banco de Espana', '3 meses', 'sede.bde.es con certificado digital',
   'Confirma Informe CIRBE oficial del Banco de Espana, con detalle de operaciones de riesgo y fecha no superior a 3 meses.', 24),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Contratos prestamo y polizas', 'Lista Acreedores (Masa Pasiva)', 5, true,
   NULL, NULL, NULL, NULL, 25),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Certificados saldo deuda', 'Lista Acreedores (Masa Pasiva)', 5, true,
   NULL, NULL, NULL, NULL, 26),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Reclamaciones y embargos', 'Lista Acreedores (Masa Pasiva)', 5, true,
   NULL, NULL, NULL, NULL, 27),

  -- ── Doc. Laboral (cat 6) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Trabajadores y salarios', 'Doc. Laboral', 6, true,
   NULL, NULL, NULL, NULL, 28),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Nominas trabajadores', 'Doc. Laboral', 6, true,
   NULL, NULL, NULL, NULL, 29),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Contratos de trabajo', 'Doc. Laboral', 6, true,
   NULL, NULL, NULL, NULL, 30),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Certificado SS', 'Doc. Laboral', 6, true,
   NULL, NULL, NULL, NULL, 31),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Salarios pendientes', 'Doc. Laboral', 6, false,
   NULL, NULL, NULL, NULL, 32),

  -- ── Contratos y Rel. Juridicas (cat 7) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Contratos mercantiles', 'Contratos y Rel. Juridicas', 7, true,
   NULL, NULL, NULL, NULL, 33),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Contratos proveedores', 'Contratos y Rel. Juridicas', 7, true,
   NULL, NULL, NULL, NULL, 34),

  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Contratos AAPP', 'Contratos y Rel. Juridicas', 7, false,
   NULL, NULL, NULL, NULL, 35),

  -- ── Transmisiones Patrimoniales (cat 8) ──
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'concurso',
   'Transmisiones a vinculados', 'Transmisiones Patrimoniales', 8, true,
   NULL, NULL, NULL, NULL, 36)
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. TAGS
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO tags (id, org_id, name, color)
VALUES
  ('ffffffff-ff01-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Urgente',    '#ef4444'),
  ('ffffffff-ff02-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'VIP',        '#8b5cf6'),
  ('ffffffff-ff03-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Particular', '#3b82f6'),
  ('ffffffff-ff04-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Empresa',    '#f59e0b'),
  ('ffffffff-ff05-ffff-ffff-ffffffffffff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Referido',   '#22c55e')
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. ACTIVITIES (sample timeline entries)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO activities (id, org_id, entity_type, entity_id, action, description, performed_by, metadata, created_at)
VALUES
  -- Maria Garcia: contact created
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'contact', 'dddddddd-dd01-dddd-dddd-dddddddddddd',
   'created', 'Nuevo contacto creado',
   '11111111-1111-1111-1111-111111111111', NULL,
   now() - interval '45 days'),

  -- Maria Garcia: assigned to Carlos
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'contact', 'dddddddd-dd01-dddd-dddd-dddddddddddd',
   'assigned', 'Contacto asignado a Carlos Martinez',
   '11111111-1111-1111-1111-111111111111', NULL,
   now() - interval '45 days' + interval '1 hour'),

  -- Case 1412a-2025 created
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'case', 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee',
   'created', 'Caso 1412a-2025 creado',
   '11111111-1111-1111-1111-111111111111', NULL,
   now() - interval '44 days'),

  -- Pedro Ruiz: contact created
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'contact', 'dddddddd-dd03-dddd-dddd-dddddddddddd',
   'created', 'Nuevo contacto creado',
   '11111111-1111-1111-1111-111111111111', NULL,
   now() - interval '10 days'),

  -- Pedro Ruiz: status changed to qualified
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'contact', 'dddddddd-dd03-dddd-dddd-dddddddddddd',
   'status_changed', 'Estado cambiado a Cualificado',
   '11111111-1111-1111-1111-111111111111', NULL,
   now() - interval '8 days'),

  -- Construcciones Levante: case created
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'case', 'eeeeeeee-ee02-eeee-eeee-eeeeeeeeeeee',
   'created', 'Caso 0892b-2025 creado',
   '22222222-2222-2222-2222-222222222222', NULL,
   now() - interval '39 days')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. PAYMENTS (for Maria's LSO case)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO payments (id, case_id, org_id, amount, concept, due_date, status, payment_method, invoice_number, paid_at, stripe_payment_id, stripe_invoice_id, created_at)
VALUES
  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   147.00, 'Analisis de viabilidad', '2026-01-05', 'paid',
   'direct_debit', 'FA-2026-0145', '2026-01-05'::timestamp, NULL, NULL, '2026-01-05'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 1/12', '2026-01-15', 'paid',
   'direct_debit', 'FA-2026-0167', '2026-01-15'::timestamp, NULL, NULL, '2026-01-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 2/12', '2026-02-15', 'paid',
   'direct_debit', 'FA-2026-0289', '2026-02-15'::timestamp, NULL, NULL, '2026-02-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 3/12', '2026-03-15', 'paid',
   'direct_debit', 'FA-2026-0412', '2026-03-15'::timestamp, NULL, NULL, '2026-03-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 4/12', '2026-04-18', 'upcoming',
   'direct_debit', NULL, NULL, NULL, NULL, '2026-04-18'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 5/12', '2026-05-15', 'pending',
   'direct_debit', NULL, NULL, NULL, NULL, '2026-05-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 6/12', '2026-06-15', 'pending',
   'direct_debit', NULL, NULL, NULL, NULL, '2026-06-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 7/12', '2026-07-15', 'pending',
   'direct_debit', NULL, NULL, NULL, NULL, '2026-07-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 8/12', '2026-08-15', 'pending',
   'direct_debit', NULL, NULL, NULL, NULL, '2026-08-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 9/12', '2026-09-15', 'pending',
   'direct_debit', NULL, NULL, NULL, NULL, '2026-09-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 10/12', '2026-10-15', 'pending',
   'direct_debit', NULL, NULL, NULL, NULL, '2026-10-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.33, 'Mensualidad 11/12', '2026-11-15', 'pending',
   'direct_debit', NULL, NULL, NULL, NULL, '2026-11-15'::timestamp),

  (gen_random_uuid(), 'eeeeeeee-ee01-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   208.37, 'Mensualidad 12/12 (final)', '2026-12-15', 'pending',
   'direct_debit', NULL, NULL, NULL, NULL, '2026-12-15'::timestamp)
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Done! Seed data for LexDocs CRM loaded successfully.
-- ════════════════════════════════════════════════════════════════════════════
