// Catálogo de planes de LibreApp para las Edge Functions (Stripe).
// Importes en céntimos SIN IVA. Anual = 10 mensualidades ("2 meses gratis").
// Debe coincidir con src/lib/planes.js (lo comprueba src/planes.test.js).

export const MESES_PAGADOS_AL_ANIO = 10;

export type IdPlan = "starter" | "company" | "team" | "top10";
export type Ciclo = "monthly" | "yearly";

export const PLANES: Record<IdPlan, { nombre: string; usuarios: number; mensualCentimos: number }> = {
  starter: { nombre: "LibreApp Starter", usuarios: 1, mensualCentimos: 8900 },
  company: { nombre: "LibreApp Company", usuarios: 3, mensualCentimos: 14900 },
  team: { nombre: "LibreApp Team", usuarios: 5, mensualCentimos: 22900 },
  top10: { nombre: "LibreApp Top 10", usuarios: 10, mensualCentimos: 34900 },
};

export const esPlanDeCompra = (id: string): id is IdPlan => Object.hasOwn(PLANES, id);

// Importe de un cobro: una mensualidad o 10 mensualidades en un único pago anual
export const importeCentimos = (id: IdPlan, ciclo: Ciclo): number =>
  ciclo === "yearly" ? PLANES[id].mensualCentimos * MESES_PAGADOS_AL_ANIO : PLANES[id].mensualCentimos;
