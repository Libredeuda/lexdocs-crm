-- =============================================================================
-- Migration 012: Datos de facturación a nivel de contacto (cliente)
-- =============================================================================
-- Permite guardar método de pago preferido, IBAN para domiciliación y estado
-- del mandato SEPA. Así el portal cliente muestra y permite modificar su
-- configuración de facturación de forma persistente.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_payment_method text
  CHECK (preferred_payment_method IS NULL OR preferred_payment_method IN
    ('direct_debit', 'card', 'transfer'));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS billing_iban text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS billing_account_holder text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sepa_mandate_signed_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sepa_mandate_reference text;

-- Índice para búsquedas por IBAN (raro, pero útil para auditoría de cobros)
CREATE INDEX IF NOT EXISTS idx_contacts_iban ON contacts(billing_iban)
  WHERE billing_iban IS NOT NULL;

SELECT 'Migration 012 OK: billing fields on contacts' AS status;
