// Catálogo de planes de LibreApp (decisión de José, 2026-09-12).
// Precios en euros SIN IVA; se muestran como "89 € (+ IVA)".
// Anual = 10 mensualidades ("2 meses gratis").
// Debe coincidir con supabase/functions/_shared/planes.ts (lo comprueba src/planes.test.js).

export const MESES_PAGADOS_AL_ANIO = 10;

export const PLANES = [
  { id: "starter", nombre: "Starter", usuarios: 1, mensual: 89 },
  { id: "company", nombre: "Company", usuarios: 3, mensual: 149 },
  { id: "team", nombre: "Team", usuarios: 5, mensual: 229 }, // nombre y precio provisionales, pendientes de confirmar
  { id: "top10", nombre: "Top 10", usuarios: 10, mensual: 349 },
];

// Más de 10 usuarios: sin compra directa, se habla por WhatsApp
export const PLAN_A_MEDIDA = { id: "custom", nombre: "A medida", desdeUsuarios: 11 };

// Lo que incluyen todos los planes (solo cambia el nº de usuarios del despacho)
export const INCLUIDO_EN_TODOS = [
  "Clientes ilimitados en el portal",
  "Portal del cliente con verificación de documentos por IA",
  "CRM, pipeline de ventas y agenda",
  "Carlota, asistente IA",
  "LexConsulta: legislación y jurisprudencia",
];

// Planes que pudo tener un despacho antes de este catálogo
const NOMBRES_ANTIGUOS = { trial: "Prueba", pro: "Pro", premium: "Premium", enterprise: "Enterprise", individual: "Individual" };

export const planPorId = (id) => PLANES.find((p) => p.id === id) || null;

export const nombreDePlan = (id) =>
  planPorId(id)?.nombre || (id === PLAN_A_MEDIDA.id ? PLAN_A_MEDIDA.nombre : NOMBRES_ANTIGUOS[id] || id);

export const precioAnual = (plan) => plan.mensual * MESES_PAGADOS_AL_ANIO;

export function formatoEuros(importe) {
  const decimales = Number.isInteger(importe) ? 0 : 2;
  return `${importe.toLocaleString("es-ES", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} €`;
}

// Enlace de WhatsApp para el plan a medida. El número llega por VITE_WHATSAPP_VENTAS
// (solo dígitos con prefijo, p. ej. 34600000000); sin él, devuelve null.
export function enlaceWhatsappVentas(nombreDespacho) {
  const numero = (import.meta.env.VITE_WHATSAPP_VENTAS || "").replace(/\D/g, "");
  if (!numero) return null;
  const texto = `Hola, quiero información sobre el plan a medida de LibreApp para ${nombreDespacho || "mi despacho"} (más de 10 usuarios).`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
