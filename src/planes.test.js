// @vitest-environment node
// El catálogo de la app (src/lib/planes.js) y el del servidor
// (supabase/functions/_shared/planes.ts, el que usa Stripe) deben coincidir.
import { describe, it, expect } from 'vitest';
import { PLANES, MESES_PAGADOS_AL_ANIO, precioAnual, formatoEuros, nombreDePlan } from './lib/planes';
import * as servidor from '../supabase/functions/_shared/planes.ts';

describe('Catálogo de planes', () => {
  it('la app y el servidor tienen los mismos planes, usuarios y precios', () => {
    const app = PLANES.map((p) => [p.id, p.usuarios, p.mensual * 100]);
    const srv = Object.entries(servidor.PLANES).map(([id, p]) => [id, p.usuarios, p.mensualCentimos]);
    expect(srv).toEqual(app);
  });

  it('el anual son 10 mensualidades en los dos lados ("2 meses gratis")', () => {
    expect(MESES_PAGADOS_AL_ANIO).toBe(10);
    expect(servidor.MESES_PAGADOS_AL_ANIO).toBe(10);
    for (const p of PLANES) {
      expect(servidor.importeCentimos(p.id, 'yearly')).toBe(precioAnual(p) * 100);
      expect(servidor.importeCentimos(p.id, 'monthly')).toBe(p.mensual * 100);
    }
  });

  it('los planes crecen en usuarios y bajan en precio por usuario', () => {
    for (let i = 1; i < PLANES.length; i++) {
      expect(PLANES[i].usuarios).toBeGreaterThan(PLANES[i - 1].usuarios);
      expect(PLANES[i].mensual / PLANES[i].usuarios).toBeLessThan(PLANES[i - 1].mensual / PLANES[i - 1].usuarios);
    }
  });

  it('el plan a medida no se puede comprar directamente', () => {
    expect(servidor.esPlanDeCompra('custom')).toBe(false);
    expect(servidor.esPlanDeCompra('starter')).toBe(true);
  });

  it('formatea euros y nombra planes antiguos', () => {
    expect(formatoEuros(89)).toBe('89 €');
    expect(formatoEuros(74.17)).toBe('74,17 €');
    expect(nombreDePlan('top10')).toBe('Top 10');
    expect(nombreDePlan('pro')).toBe('Pro');
  });
});
