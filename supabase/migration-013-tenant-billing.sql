-- =============================================================================
-- Migration 013: Campos de facturación del tenant (licencias SaaS)
-- =============================================================================
-- Permite que el admin del despacho gestione su suscripción a LibreApp:
-- ciclo (mensual/anual), número de licencias contratadas (plan team),
-- renovación automática, fecha de fin del periodo actual y última notificación
-- de renovación enviada.

-- Nuevos planes que admitirá la columna tenants.plan:
--   trial             — periodo de prueba
--   individual        — 1 licencia (120€/mes o 99€/mes anual)
--   team              — hasta 5 licencias (79€/mes por licencia o 59€/mes anual)
--   enterprise        — sobre medida (se mantiene)
-- Planes legacy (starter/pro/premium) siguen siendo válidos para no romper
-- tenants existentes.

-- Ciclo de facturación
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle text
  CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'yearly'));

-- Nº de licencias contratadas (solo aplica a plan "team"; para "individual" es 1)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS license_count integer NOT NULL DEFAULT 1
  CHECK (license_count >= 1 AND license_count <= 100);

-- Renovación automática
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;

-- Fin del periodo actual (cuando termina la suscripción vigente)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- Última fecha en que se notificó la renovación próxima al admin
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS renewal_notified_at timestamptz;

-- Estado de la suscripción (viene del webhook de Stripe)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status text
  CHECK (subscription_status IS NULL OR subscription_status IN
    ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'));

-- Índice para cron job de recordatorios (buscar tenants con renovación cercana)
CREATE INDEX IF NOT EXISTS idx_tenants_renewal
  ON tenants (current_period_end)
  WHERE auto_renew = true AND subscription_status = 'active';

SELECT 'Migration 013 OK: tenant billing fields' AS status;
