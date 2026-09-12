-- =============================================================================
-- Migration 021: catálogo de planes 2026-09 (Starter / Company / Team / Top 10 / A medida)
-- =============================================================================
--
-- 1. tenants.plan admitía solo trial/starter/pro/premium/enterprise: los planes
--    "individual" y "team" de migration-013 nunca se habrían podido guardar desde
--    el webhook de Stripe. Se admite el catálogo nuevo y se conservan los antiguos
--    para no romper despachos existentes (libredeuda está en "pro").
-- 2. tenants.subscription_status no admitía "incomplete_expired" ni "paused",
--    estados reales de Stripe: el webhook fallaba al recibirlos.
--
-- license_count lo fija el webhook según el plan (1, 3, 5 o 10 usuarios del
-- despacho); los clientes del portal no consumen licencia (migration-014).
-- =============================================================================

ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_plan_check CHECK (plan IN (
  'trial', 'starter', 'company', 'team', 'top10', 'custom',
  'pro', 'premium', 'enterprise', 'individual'   -- antiguos
));

ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_subscription_status_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_subscription_status_check CHECK (
  subscription_status IS NULL OR subscription_status IN (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
  )
);

SELECT 'Migration 021 OK: catálogo de planes Starter/Company/Team/Top 10/A medida' AS status;
