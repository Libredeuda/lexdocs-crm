-- =============================================================================
-- Migration 015: Enforcement de licencias también en UPDATE de role/org
-- =============================================================================
--
-- La migración 014 solo valida el límite de licencias en BEFORE INSERT. Eso deja
-- un hueco: promover un usuario existente (p.ej. role 'contact' → 'lawyer') vía
-- UPDATE no dispara la comprobación y permite superar el plan contratado sin
-- pagar. Esta migración añade un trigger BEFORE UPDATE que cierra ese hueco.
--
-- Lógica: solo se valida cuando el cambio AÑADE un asiento de licencia a un
-- tenant, es decir, cuando NEW.role es de pago y, o bien el rol anterior no
-- consumía licencia, o el usuario se mueve a otra organización/tenant.
-- El recuento excluye al propio usuario (u.id <> NEW.id) para no contarlo dos
-- veces.

CREATE OR REPLACE FUNCTION enforce_license_limit_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_license_count integer;
  v_current_count integer;
  v_licensed_roles text[] := ARRAY['admin','owner','lawyer','staff','sales','procurador'];
BEGIN
  -- El nuevo rol no consume licencia → nada que validar.
  IF NEW.role IS NULL OR NOT (NEW.role = ANY(v_licensed_roles)) THEN
    RETURN NEW;
  END IF;

  -- Ya consumía un asiento en la MISMA organización → no se añade asiento nuevo.
  IF OLD.role = ANY(v_licensed_roles) AND OLD.org_id IS NOT DISTINCT FROM NEW.org_id THEN
    RETURN NEW;
  END IF;

  SELECT o.tenant_id, t.license_count
    INTO v_tenant_id, v_license_count
  FROM organizations o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE o.id = NEW.org_id;

  IF v_license_count IS NULL THEN
    RETURN NEW; -- Tenant sin license_count (trial/onboarding) → dejar pasar.
  END IF;

  SELECT COUNT(*)::int
    INTO v_current_count
  FROM users u
  JOIN organizations o ON o.id = u.org_id
  WHERE o.tenant_id = v_tenant_id
    AND u.role = ANY(v_licensed_roles)
    AND u.id <> NEW.id;

  IF v_current_count >= v_license_count THEN
    RAISE EXCEPTION 'Límite de licencias alcanzado (%/%). Amplía tu plan en Configuración → Facturación.',
      v_current_count, v_license_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_license_limit_update ON users;
CREATE TRIGGER trg_enforce_license_limit_update
  BEFORE UPDATE OF role, org_id ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_license_limit_on_update();

SELECT 'Migration 015 OK: license enforcement en UPDATE' AS status;
