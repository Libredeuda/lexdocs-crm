// Límites de uso de las funciones de IA (migration-020: consume_usage).
// Se consulta ANTES de llamar a Anthropic. Si el contador falla (p. ej. la
// migración aún no está aplicada) se deja pasar y se registra en consola: el
// límite protege el coste, no debe tumbar el servicio.

export type Limites = { porMinuto: number | null; porDia: number | null; despachoPorDia: number | null };

// Valores por defecto; carlota usa además tenants.max_carlota_messages_per_day como límite diario por usuario.
export const LIMITES: Record<string, Limites> = {
  "carlota": { porMinuto: 10, porDia: 50, despachoPorDia: 1000 },
  "verify-document": { porMinuto: 10, porDia: 100, despachoPorDia: 1000 },
};

const MENSAJES: Record<string, Record<string, string>> = {
  "carlota": {
    user_minute: "Vas muy rápido: espera un minuto y vuelve a preguntarme.",
    user_day: "Has llegado al límite diario de consultas a Carlota. Mañana podrás seguir; si es urgente, escribe a tu despacho.",
    org_day: "El despacho ha llegado al límite diario de consultas a Carlota. Mañana volverá a estar disponible.",
  },
  "verify-document": {
    user_minute: "Has subido muchos documentos seguidos: espera un minuto y vuelve a intentarlo.",
    user_day: "Has llegado al límite diario de verificaciones automáticas. Tu letrado revisará los documentos que subas.",
    org_day: "El despacho ha llegado al límite diario de verificaciones automáticas. Tu letrado revisará los documentos.",
  },
};

export type ResultadoUso = { ok: true } | { ok: false; motivo: string; mensaje: string; reintentarEn: number };

// deno-lint-ignore no-explicit-any
export async function consumirUso(admin: any, feature: string, userId: string, orgId: string | null, limites: Limites): Promise<ResultadoUso> {
  const { data, error } = await admin.rpc("consume_usage", {
    p_feature: feature,
    p_user_id: userId,
    p_org_id: orgId,
    p_user_per_min: limites.porMinuto,
    p_user_per_day: limites.porDia,
    p_org_per_day: limites.despachoPorDia,
  });
  if (error) {
    console.error(`consume_usage (${feature}):`, error.message);
    return { ok: true };
  }
  if (data?.allowed) return { ok: true };
  const motivo = data?.reason || "user_minute";
  return {
    ok: false,
    motivo,
    mensaje: MENSAJES[feature]?.[motivo] || "Has alcanzado el límite de uso. Inténtalo más tarde.",
    reintentarEn: data?.retry_after || 60,
  };
}
