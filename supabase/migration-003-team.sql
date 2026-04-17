-- =============================================================================
-- Migration 003: Equipo legal - abogados, procuradores, datos colegiales
-- =============================================================================

-- 1. Añadir columnas profesionales a users
ALTER TABLE users ADD COLUMN IF NOT EXISTS colegio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS colegiado_num text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_title text;

-- 2. Permitir role 'procurador' (drop & recreate del check constraint)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'admin', 'lawyer', 'procurador', 'staff', 'client'));

-- 3. Hacer opcional la FK a auth.users (permite añadir miembros del equipo
--    aunque no tengan cuenta de login todavía). Mantenemos el ID como UUID.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 4. Añadir assigned_procurador_id a cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_procurador_id uuid REFERENCES users ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cases_assigned_procurador ON cases(assigned_procurador_id);

-- 5. Añadir email único pero permitiendo duplicados de UUID
-- (la tabla users ya tiene email no único; lo dejamos así)

-- 6. Insertar los 3 profesionales del equipo
-- Si ya existen por email, no los duplica
INSERT INTO users (id, org_id, email, full_name, role, professional_title, colegio, colegiado_num, is_active)
SELECT '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'jose.ayarza@libredeuda.com', 'José Alberto Ayarza Sancho', 'lawyer', 'Abogado',
       'Ilustre Colegio de Abogados de La Rioja', '1185', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'jose.ayarza@libredeuda.com');

INSERT INTO users (id, org_id, email, full_name, role, professional_title, colegio, colegiado_num, is_active)
SELECT '55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'silvia.rivera@libredeuda.com', 'Silvia Juliana Rivera Rodríguez', 'procurador', 'Procuradora',
       'Ilustre Colegio de Procuradores de La Rioja', '97', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'silvia.rivera@libredeuda.com');

INSERT INTO users (id, org_id, email, full_name, role, professional_title, colegio, colegiado_num, is_active)
SELECT '66666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'natalia.sanchez@libredeuda.com', 'Natalia Sánchez', 'lawyer', 'Letrada',
       'Ilustre Colegio de Abogados de Alicante', '8907', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'natalia.sanchez@libredeuda.com');

SELECT 'Migration 003 completed: equipo legal añadido' AS status;
