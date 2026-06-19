-- =============================================================================
-- Migration 017: lookup público (pre-login) del tenant por slug
-- =============================================================================
--
-- El frontend necesita resolver el despacho (marca/branding) ANTES de iniciar
-- sesión, pero la tabla tenants tiene RLS (id = auth_tenant_id()), no legible de
-- forma anónima. En vez de abrir toda la tabla al rol anon (lo que expondría
-- stripe_customer_id, settings, etc.), exponemos una función SECURITY DEFINER que
-- devuelve SOLO los campos de marca de un tenant activo.

CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  plan text,
  modules_enabled text[],
  carlota_enabled boolean,
  carlota_settings jsonb,
  trial_ends_at timestamptz,
  is_active boolean,
  max_users integer,
  max_cases integer,
  max_carlota_messages_per_day integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, slug, name, logo_url, primary_color, secondary_color,
         plan, modules_enabled, carlota_enabled, carlota_settings,
         trial_ends_at, is_active, max_users, max_cases, max_carlota_messages_per_day
  FROM public.tenants
  WHERE slug = p_slug AND is_active = true
$$;

-- Solo ejecutable (no expone la tabla). Disponible para anónimos y autenticados.
REVOKE ALL ON FUNCTION public.get_tenant_by_slug(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug(text) TO anon, authenticated;

SELECT 'Migration 017 OK: get_tenant_by_slug (lookup pre-login seguro)' AS status;
