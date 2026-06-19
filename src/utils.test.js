import { describe, it, expect } from 'vitest';
import {
  getS,
  getEv,
  getPayStatus,
  fmtMoney,
  daysUntil,
  motivMsg,
} from './utils';

describe('getS (estado de documento)', () => {
  it('mapea estados conocidos', () => {
    expect(getS('approved').l).toBe('Aprobado');
    expect(getS('not_applicable').l).toBe('No aplica');
  });
  it('cae a "pending" con estado desconocido o vacío', () => {
    expect(getS('lo-que-sea').l).toBe('Pendiente');
    expect(getS(undefined).l).toBe('Pendiente');
  });
});

describe('getEv (tipo de evento)', () => {
  it('mapea tipos conocidos', () => {
    expect(getEv('hearing').l).toBe('Vista/Acto');
  });
  it('cae a "call" por defecto', () => {
    expect(getEv('desconocido').l).toBe('Llamada');
  });
});

describe('getPayStatus (estado de pago)', () => {
  it('mapea estados conocidos', () => {
    expect(getPayStatus('paid').l).toBe('Pagado');
    expect(getPayStatus('failed').l).toBe('Fallido');
  });
  it('cae a "pending" por defecto', () => {
    expect(getPayStatus('???').l).toBe('Pendiente');
  });
});

describe('fmtMoney', () => {
  // Nota: el separador de miles depende de los datos ICU del entorno (el navegador
  // pone "1.234,50€"; Node puede dar "1234,50€"). Verificamos el contrato estable:
  // coma decimal con 2 dígitos y sufijo €.
  it('formatea con 2 decimales (coma) y símbolo €', () => {
    expect(fmtMoney(1234.5)).toMatch(/^1\.?234,50€$/);
    expect(fmtMoney(0)).toBe('0,00€');
  });
});

describe('daysUntil', () => {
  it('da ~0 para hoy y positivo para futuro', () => {
    expect(daysUntil(new Date())).toBeLessThanOrEqual(1);
    const en10 = new Date(Date.now() + 10 * 86400000);
    expect(daysUntil(en10)).toBeGreaterThanOrEqual(9);
    expect(daysUntil(en10)).toBeLessThanOrEqual(10);
  });
  it('da negativo para fechas pasadas', () => {
    const hace5 = new Date(Date.now() - 5 * 86400000);
    expect(daysUntil(hace5)).toBeLessThan(0);
  });
});

describe('motivMsg (mensaje motivacional por % de progreso)', () => {
  it('felicita al 100%', () => {
    expect(motivMsg('Ana', 100, 0)).toContain('COMPLETA');
  });
  it('incluye el nombre y los pendientes en tramos intermedios', () => {
    const m = motivMsg('Luis', 30, 4);
    expect(m).toContain('Luis');
    expect(m).toContain('30%');
  });
  it('mensaje de arranque cuando pct es 0', () => {
    expect(motivMsg('Eva', 0, 7)).toContain('7 documentos');
  });
});
