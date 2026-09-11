-- =============================================================================
-- Datos iniciales de un despacho YA EXISTENTE (script manual, no es migración)
-- =============================================================================
-- Carga en el despacho indicado por su slug:
--   - Embudo de ventas "Embudo principal" con 5 etapas.
--   - 66 tipos de documento (30 LSO + 36 concurso) con emisor, validez, dónde
--     obtenerlo y criterio de verificación. Copiados de seed.sql.
-- NO crea usuarios, contactos, expedientes ni pagos de demostración (seed.sql sí,
-- con contraseñas conocidas: no ejecutar seed.sql en producción).
-- Re-ejecutable: cada bloque solo inserta si el despacho aún no tiene esos datos.
--
-- Uso: cambia el slug si hace falta y ejecútalo en el SQL Editor de Supabase.
-- =============================================================================

DO $$
DECLARE
  v_slug text := 'libredeuda';
  v_org  uuid;
  v_pipe uuid;
BEGIN
  SELECT id INTO v_org FROM organizations WHERE slug = v_slug;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No existe la organización con slug %', v_slug;
  END IF;

  -- ── Embudo de ventas ──
  IF NOT EXISTS (SELECT 1 FROM pipelines WHERE org_id = v_org) THEN
    INSERT INTO pipelines (org_id, name, is_default)
    VALUES (v_org, 'Embudo principal', true)
    RETURNING id INTO v_pipe;

    INSERT INTO pipeline_stages (pipeline_id, name, position, color) VALUES
      (v_pipe, 'Nuevo lead',  1, '#3b82f6'),
      (v_pipe, 'Contactado',  2, '#f59e0b'),
      (v_pipe, 'Cualificado', 3, '#8b5cf6'),
      (v_pipe, 'Cliente',     4, '#22c55e'),
      (v_pipe, 'Perdido',     5, '#ef4444');
  END IF;

  -- ── Tipos de documento LSO y concurso ──
  IF NOT EXISTS (SELECT 1 FROM document_types WHERE org_id = v_org) THEN
    INSERT INTO document_types (id, org_id, case_type, name, category, cat_num, required, kb_issuer, kb_validity, kb_where_to_get, kb_criteria, sort_order)
    VALUES
      -- ── Datos Personales (cat 1) ──
      (gen_random_uuid(), v_org, 'lso',
       'DNI / NIE en vigor (deudor y conyuge)', 'Datos Personales', 1, true,
       'Direccion General de la Policia', 'En vigor', 'Comisaria con cita previa en sede.policia.gob.es',
       'Confirma que es un DNI o NIE espanol oficial. Debe mostrar numero, nombre, fecha nacimiento, fecha validez (no caducado) y foto. Verifica anverso y reverso.', 1),

      (gen_random_uuid(), v_org, 'lso',
       'Libro de familia', 'Datos Personales', 1, true,
       'Registro Civil', 'Actualizado', 'Registro Civil del lugar de matrimonio',
       'Confirma que es un Libro de Familia oficial con sello del Registro Civil, datos del matrimonio y filiacion de hijos.', 2),

      (gen_random_uuid(), v_org, 'lso',
       'Certificado empadronamiento actual', 'Datos Personales', 1, true,
       'Ayuntamiento', '3 meses', 'Sede electronica del Ayuntamiento con Cl@ve o certificado digital',
       'Confirma que es un certificado (NO volante) con cabecera del Ayuntamiento, nombre, DNI, direccion, fecha expedicion no superior a 3 meses, y sello.', 3),

      (gen_random_uuid(), v_org, 'lso',
       'Certificado antecedentes penales', 'Datos Personales', 1, true,
       'Ministerio de Justicia', '3 meses', 'sede.mjusticia.gob.es',
       'Confirma certificado del Ministerio de Justicia con CSV de verificacion, fecha no superior a 3 meses. NO confundir con certificado de delitos sexuales.', 4),

      -- ── Situacion Laboral (cat 2) ──
      (gen_random_uuid(), v_org, 'lso',
       'Ultimas 3 nominas', 'Situacion Laboral', 2, true,
       'Empresa empleadora', '3 meses', 'RRHH o portal del empleado',
       'Confirma que son 3 nominas consecutivas y recientes con CIF empresa, datos trabajador, salario bruto/neto y deducciones.', 5),

      (gen_random_uuid(), v_org, 'lso',
       'Declaraciones IRPF/RENTA (4 anos)', 'Situacion Laboral', 2, true,
       'AEAT', 'Ultimos 4 ejercicios', 'sede.agenciatributaria.gob.es con Cl@ve',
       'Confirma declaraciones IRPF Modelo 100 oficiales, con CSV, de los ultimos 4 ejercicios consecutivos.', 6),

      (gen_random_uuid(), v_org, 'lso',
       'Declaracion patrimonio', 'Situacion Laboral', 2, false,
       NULL, NULL, NULL, NULL, 7),

      (gen_random_uuid(), v_org, 'lso',
       'Certificado prestaciones desempleo/pensiones', 'Situacion Laboral', 2, false,
       NULL, NULL, NULL, NULL, 8),

      -- ── Situacion Bancaria (cat 3) ──
      (gen_random_uuid(), v_org, 'lso',
       'Extractos bancarios 12 meses', 'Situacion Bancaria', 3, true,
       'Entidad bancaria', '12 meses consecutivos', 'Banca electronica de cada entidad',
       'Confirma extractos de TODAS las cuentas, 12 meses consecutivos, con movimientos detallados (no solo saldos).', 9),

      (gen_random_uuid(), v_org, 'lso',
       'Contratos prestamos, hipotecas, creditos', 'Situacion Bancaria', 3, true,
       NULL, NULL, NULL, NULL, 10),

      (gen_random_uuid(), v_org, 'lso',
       'Certificados deuda entidades financieras', 'Situacion Bancaria', 3, true,
       NULL, NULL, NULL, NULL, 11),

      (gen_random_uuid(), v_org, 'lso',
       'Tarjetas credito y saldos pendientes', 'Situacion Bancaria', 3, true,
       NULL, NULL, NULL, NULL, 12),

      -- ── Deudas y Acreedores (cat 4) ──
      (gen_random_uuid(), v_org, 'lso',
       'Listado acreedores completo (Excel)', 'Deudas y Acreedores', 4, true,
       NULL, NULL, NULL, NULL, 13),

      (gen_random_uuid(), v_org, 'lso',
       'Certificado deuda AEAT', 'Deudas y Acreedores', 4, true,
       'AEAT', '3 meses', 'sede.agenciatributaria.gob.es',
       'Confirma certificado AEAT de situacion de deudas con CSV, fecha no superior a 3 meses, y detalle de deudas pendientes.', 14),

      (gen_random_uuid(), v_org, 'lso',
       'Certificado deuda TGSS', 'Deudas y Acreedores', 4, true,
       'TGSS', '3 meses', 'sede.seg-social.gob.es',
       'Confirma certificado TGSS de deudas (NO confundir con vida laboral), con sello digital y fecha reciente.', 15),

      (gen_random_uuid(), v_org, 'lso',
       'Deuda otras AAPP', 'Deudas y Acreedores', 4, false,
       NULL, NULL, NULL, NULL, 16),

      (gen_random_uuid(), v_org, 'lso',
       'Reclamaciones judiciales en curso', 'Deudas y Acreedores', 4, true,
       NULL, NULL, NULL, NULL, 17),

      -- ── Inventario Bienes (cat 5) ──
      (gen_random_uuid(), v_org, 'lso',
       'Escrituras de propiedad', 'Inventario Bienes', 5, true,
       NULL, NULL, NULL, NULL, 18),

      (gen_random_uuid(), v_org, 'lso',
       'Recibos IBI (2 anos)', 'Inventario Bienes', 5, true,
       NULL, NULL, NULL, NULL, 19),

      (gen_random_uuid(), v_org, 'lso',
       'Contratos alquiler', 'Inventario Bienes', 5, true,
       NULL, NULL, NULL, NULL, 20),

      (gen_random_uuid(), v_org, 'lso',
       'Permisos circulacion y fichas tecnicas', 'Inventario Bienes', 5, true,
       NULL, NULL, NULL, NULL, 21),

      (gen_random_uuid(), v_org, 'lso',
       'Tasaciones inmuebles/vehiculos', 'Inventario Bienes', 5, false,
       NULL, NULL, NULL, NULL, 22),

      (gen_random_uuid(), v_org, 'lso',
       'Seguros contratados', 'Inventario Bienes', 5, true,
       NULL, NULL, NULL, NULL, 23),

      (gen_random_uuid(), v_org, 'lso',
       'Acciones o participaciones sociales', 'Inventario Bienes', 5, false,
       NULL, NULL, NULL, NULL, 24),

      (gen_random_uuid(), v_org, 'lso',
       'Propiedad intelectual, patentes', 'Inventario Bienes', 5, false,
       NULL, NULL, NULL, NULL, 25),

      -- ── Gastos e Ingresos (cat 6) ──
      (gen_random_uuid(), v_org, 'lso',
       'Gastos mensuales', 'Gastos e Ingresos', 6, true,
       NULL, NULL, NULL, NULL, 26),

      (gen_random_uuid(), v_org, 'lso',
       'Ingresos mensuales', 'Gastos e Ingresos', 6, true,
       NULL, NULL, NULL, NULL, 27),

      -- ── Contratos Vigentes (cat 7) ──
      (gen_random_uuid(), v_org, 'lso',
       'Contratos de trabajo', 'Contratos Vigentes', 7, true,
       NULL, NULL, NULL, NULL, 28),

      (gen_random_uuid(), v_org, 'lso',
       'Contratos mercantiles', 'Contratos Vigentes', 7, false,
       NULL, NULL, NULL, NULL, 29),

      (gen_random_uuid(), v_org, 'lso',
       'Leasing, renting, compromisos financieros', 'Contratos Vigentes', 7, true,
       NULL, NULL, NULL, NULL, 30)
    ;

    -- ════════════════════════════════════════════════════════════════════════════
    -- 6b. DOCUMENT TYPES - CONCURSO (36 types)
    -- ════════════════════════════════════════════════════════════════════════════

    INSERT INTO document_types (id, org_id, case_type, name, category, cat_num, required, kb_issuer, kb_validity, kb_where_to_get, kb_criteria, sort_order)
    VALUES
      -- ── Identificacion y Constitucion (cat 1) ──
      (gen_random_uuid(), v_org, 'concurso',
       'Escritura de constitucion', 'Identificacion y Constitucion', 1, true,
       NULL, NULL, NULL, NULL, 1),

      (gen_random_uuid(), v_org, 'concurso',
       'Estatutos sociales vigentes', 'Identificacion y Constitucion', 1, true,
       NULL, NULL, NULL, NULL, 2),

      (gen_random_uuid(), v_org, 'concurso',
       'DNI del administrador', 'Identificacion y Constitucion', 1, true,
       NULL, NULL, NULL, NULL, 3),

      (gen_random_uuid(), v_org, 'concurso',
       'Certificacion Registro Mercantil', 'Identificacion y Constitucion', 1, true,
       'Registro Mercantil', '3 meses', 'www.registradores.org',
       'Confirma certificacion oficial (no nota simple) del Registro Mercantil con datos vigentes y administradores actuales.', 4),

      (gen_random_uuid(), v_org, 'concurso',
       'Poderes de representacion', 'Identificacion y Constitucion', 1, false,
       NULL, NULL, NULL, NULL, 5),

      -- ── Doc. Contable y Fiscal (cat 2) ──
      (gen_random_uuid(), v_org, 'concurso',
       'Cuentas anuales 3 ejercicios', 'Doc. Contable y Fiscal', 2, true,
       NULL, NULL, NULL, NULL, 6),

      (gen_random_uuid(), v_org, 'concurso',
       'Impuesto Sociedades 3 ejercicios', 'Doc. Contable y Fiscal', 2, true,
       NULL, NULL, NULL, NULL, 7),

      (gen_random_uuid(), v_org, 'concurso',
       'Declaraciones IVA 12 meses', 'Doc. Contable y Fiscal', 2, true,
       NULL, NULL, NULL, NULL, 8),

      (gen_random_uuid(), v_org, 'concurso',
       'Retenciones 12 meses', 'Doc. Contable y Fiscal', 2, true,
       NULL, NULL, NULL, NULL, 9),

      (gen_random_uuid(), v_org, 'concurso',
       'Certificado AEAT', 'Doc. Contable y Fiscal', 2, true,
       'AEAT', '3 meses', 'sede.agenciatributaria.gob.es',
       'Igual que ls14 pero con CIF de empresa.', 10),

      (gen_random_uuid(), v_org, 'concurso',
       'Certificado TGSS', 'Doc. Contable y Fiscal', 2, true,
       NULL, NULL, NULL, NULL, 11),

      -- ── Memoria Economica y Juridica (cat 3) ──
      (gen_random_uuid(), v_org, 'concurso',
       'Memoria explicativa insolvencia', 'Memoria Economica y Juridica', 3, true,
       NULL, NULL, NULL, NULL, 12),

      (gen_random_uuid(), v_org, 'concurso',
       'Destino creditos tras insolvencia', 'Memoria Economica y Juridica', 3, true,
       NULL, NULL, NULL, NULL, 13),

      (gen_random_uuid(), v_org, 'concurso',
       'Insolvencia actual o inminente', 'Memoria Economica y Juridica', 3, true,
       NULL, NULL, NULL, NULL, 14),

      -- ── Inventario Bienes - Masa Activa (cat 4) ──
      (gen_random_uuid(), v_org, 'concurso',
       'Bienes inmuebles con cargas', 'Inventario Bienes (Masa Activa)', 4, true,
       NULL, NULL, NULL, NULL, 15),

      (gen_random_uuid(), v_org, 'concurso',
       'Tasacion inmuebles gravados', 'Inventario Bienes (Masa Activa)', 4, true,
       NULL, NULL, NULL, NULL, 16),

      (gen_random_uuid(), v_org, 'concurso',
       'Vehiculos y maquinaria', 'Inventario Bienes (Masa Activa)', 4, true,
       NULL, NULL, NULL, NULL, 17),

      (gen_random_uuid(), v_org, 'concurso',
       'Extractos bancarios 12 meses', 'Inventario Bienes (Masa Activa)', 4, true,
       'Entidades bancarias', '12 meses', 'Banca electronica de empresa',
       'Extractos de TODAS las cuentas de la sociedad, 12 meses consecutivos.', 18),

      (gen_random_uuid(), v_org, 'concurso',
       'Existencias y stocks', 'Inventario Bienes (Masa Activa)', 4, true,
       NULL, NULL, NULL, NULL, 19),

      (gen_random_uuid(), v_org, 'concurso',
       'Clientes pendientes cobro', 'Inventario Bienes (Masa Activa)', 4, true,
       NULL, NULL, NULL, NULL, 20),

      (gen_random_uuid(), v_org, 'concurso',
       'Contratos arrendamiento', 'Inventario Bienes (Masa Activa)', 4, true,
       NULL, NULL, NULL, NULL, 21),

      (gen_random_uuid(), v_org, 'concurso',
       'Participaciones otras sociedades', 'Inventario Bienes (Masa Activa)', 4, false,
       NULL, NULL, NULL, NULL, 22),

      -- ── Lista Acreedores - Masa Pasiva (cat 5) ──
      (gen_random_uuid(), v_org, 'concurso',
       'Lista acreedores (Word/Excel)', 'Lista Acreedores (Masa Pasiva)', 5, true,
       NULL, NULL, NULL, NULL, 23),

      (gen_random_uuid(), v_org, 'concurso',
       'Informe CIRBE (3 meses)', 'Lista Acreedores (Masa Pasiva)', 5, true,
       'Banco de Espana', '3 meses', 'sede.bde.es con certificado digital',
       'Confirma Informe CIRBE oficial del Banco de Espana, con detalle de operaciones de riesgo y fecha no superior a 3 meses.', 24),

      (gen_random_uuid(), v_org, 'concurso',
       'Contratos prestamo y polizas', 'Lista Acreedores (Masa Pasiva)', 5, true,
       NULL, NULL, NULL, NULL, 25),

      (gen_random_uuid(), v_org, 'concurso',
       'Certificados saldo deuda', 'Lista Acreedores (Masa Pasiva)', 5, true,
       NULL, NULL, NULL, NULL, 26),

      (gen_random_uuid(), v_org, 'concurso',
       'Reclamaciones y embargos', 'Lista Acreedores (Masa Pasiva)', 5, true,
       NULL, NULL, NULL, NULL, 27),

      -- ── Doc. Laboral (cat 6) ──
      (gen_random_uuid(), v_org, 'concurso',
       'Trabajadores y salarios', 'Doc. Laboral', 6, true,
       NULL, NULL, NULL, NULL, 28),

      (gen_random_uuid(), v_org, 'concurso',
       'Nominas trabajadores', 'Doc. Laboral', 6, true,
       NULL, NULL, NULL, NULL, 29),

      (gen_random_uuid(), v_org, 'concurso',
       'Contratos de trabajo', 'Doc. Laboral', 6, true,
       NULL, NULL, NULL, NULL, 30),

      (gen_random_uuid(), v_org, 'concurso',
       'Certificado SS', 'Doc. Laboral', 6, true,
       NULL, NULL, NULL, NULL, 31),

      (gen_random_uuid(), v_org, 'concurso',
       'Salarios pendientes', 'Doc. Laboral', 6, false,
       NULL, NULL, NULL, NULL, 32),

      -- ── Contratos y Rel. Juridicas (cat 7) ──
      (gen_random_uuid(), v_org, 'concurso',
       'Contratos mercantiles', 'Contratos y Rel. Juridicas', 7, true,
       NULL, NULL, NULL, NULL, 33),

      (gen_random_uuid(), v_org, 'concurso',
       'Contratos proveedores', 'Contratos y Rel. Juridicas', 7, true,
       NULL, NULL, NULL, NULL, 34),

      (gen_random_uuid(), v_org, 'concurso',
       'Contratos AAPP', 'Contratos y Rel. Juridicas', 7, false,
       NULL, NULL, NULL, NULL, 35),

      -- ── Transmisiones Patrimoniales (cat 8) ──
      (gen_random_uuid(), v_org, 'concurso',
       'Transmisiones a vinculados', 'Transmisiones Patrimoniales', 8, true,
       NULL, NULL, NULL, NULL, 36)
    ;
  END IF;

  RAISE NOTICE 'OK: datos iniciales cargados en %', v_slug;
END $$;

SELECT o.slug,
  (SELECT count(*) FROM pipelines p WHERE p.org_id = o.id) AS embudos,
  (SELECT count(*) FROM pipeline_stages s JOIN pipelines p ON p.id = s.pipeline_id WHERE p.org_id = o.id) AS etapas,
  (SELECT count(*) FROM document_types d WHERE d.org_id = o.id AND d.case_type = 'lso') AS docs_lso,
  (SELECT count(*) FROM document_types d WHERE d.org_id = o.id AND d.case_type = 'concurso') AS docs_concurso
FROM organizations o WHERE o.slug = 'libredeuda';
