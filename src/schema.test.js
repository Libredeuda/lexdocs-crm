// @vitest-environment node
// Comprobaciones estáticas del esquema SQL (supabase/schema.sql + migraciones).
// Protegen la garantía que vendemos: ninguna tabla de negocio sin RLS y ninguna
// tabla nueva fuera del candado del MFA por email (migration-019).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', 'supabase');
const migraciones = readdirSync(DIR).filter(f => /^migration-\d{3}-.+\.sql$/.test(f)).sort();
const leer = f => readFileSync(join(DIR, f), 'utf8')
  .replace(/--.*$/gm, '')                 // sin comentarios de línea
  .replace(/\/\*[\s\S]*?\*\//g, '');     // ni de bloque
const fuentes = [['schema.sql', leer('schema.sql')], ...migraciones.map(f => [f, leer(f)])];

// Tablas del esquema public creadas en un texto SQL
function tablasCreadas(sql) {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"?\w+"?\.)?"?\w+"?)/gi;
  return [...sql.matchAll(re)]
    .map(m => m[1].replace(/"/g, '').toLowerCase())
    .filter(n => !n.includes('.') || n.startsWith('public.'))
    .map(n => n.replace(/^public\./, ''));
}
// Cambios de RLS en orden de aparición: [tabla, true (enable) | false (disable)]
function cambiosRls(sql) {
  const re = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?((?:"?\w+"?\.)?"?\w+"?)\s+(enable|disable)\s+row\s+level\s+security/gi;
  return [...sql.matchAll(re)].map(m => [m[1].replace(/"/g, '').toLowerCase().replace(/^public\./, ''), m[2].toLowerCase() === 'enable']);
}
const numero = f => Number(f.slice(10, 13));

describe('Esquema SQL', () => {
  it('las migraciones están numeradas sin huecos ni duplicados', () => {
    const nums = migraciones.map(numero);
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });

  it('toda tabla de public termina con RLS activado', () => {
    // Las migraciones 001–009 desactivaban RLS y la 010 lo reactivó: cuenta el último cambio.
    const estado = new Map();
    for (const [, sql] of fuentes) {
      for (const t of tablasCreadas(sql)) if (!estado.has(t)) estado.set(t, false);
      for (const [t, on] of cambiosRls(sql)) estado.set(t, on);
    }
    const sinRls = [...estado].filter(([, on]) => !on).map(([t]) => t);
    expect(sinRls, `Tablas sin RLS al final de las migraciones: ${sinRls.join(', ')}`).toEqual([]);
  });

  it('ninguna migración posterior a la 010 desactiva RLS', () => {
    const culpables = fuentes
      .filter(([f, sql]) => f.startsWith('migration-') && numero(f) > 10 && /disable\s+row\s+level\s+security/i.test(sql))
      .map(([f]) => f);
    expect(culpables).toEqual([]);
  });

  it('las tablas creadas después de la migración 019 llevan su política mfa_email_gate', () => {
    const faltan = [];
    for (const [f, sql] of fuentes.filter(([f]) => f.startsWith('migration-') && numero(f) > 19)) {
      for (const t of tablasCreadas(sql)) {
        const re = new RegExp(`create\\s+policy\\s+"mfa_email_gate"\\s+on\\s+(?:public\\.)?"?${t}"?\\b`, 'i');
        if (!re.test(sql)) faltan.push(`${t} (${f})`);
      }
    }
    expect(faltan, `Añade CREATE POLICY "mfa_email_gate" ... AS RESTRICTIVE (ver migration-019) a: ${faltan.join(', ')}`).toEqual([]);
  });

  it('_bootstrap.sql está regenerado con todas las tablas', () => {
    const bootstrap = readFileSync(join(DIR, '_bootstrap.sql'), 'utf8');
    const esperadas = new Set(fuentes.flatMap(([, sql]) => tablasCreadas(sql)));
    const enBootstrap = new Set(tablasCreadas(bootstrap));
    const faltan = [...esperadas].filter(t => !enBootstrap.has(t));
    expect(faltan, 'Ejecuta: python3 supabase/_generate_bootstrap.py').toEqual([]);
  });
});
