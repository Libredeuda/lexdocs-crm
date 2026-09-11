import { supabase } from "./supabase";

// Verificación en dos pasos por email (migration-019 + Edge Function mfa-email).
// La seguridad real la impone la base de datos (política restrictiva
// "mfa_email_gate"); aquí solo se gestiona la experiencia en pantalla.

// { enabled, verified }. Si la migración aún no está aplicada, la RPC no existe:
// no se bloquea el acceso (la BD tampoco lo bloquearía).
export async function estadoMfaEmail() {
  const { data, error } = await supabase.rpc("mfa_email_status");
  if (error || !data) return { enabled: false, verified: true };
  return { enabled: !!data.enabled, verified: !!data.verified };
}

async function llamar(body) {
  const { data, error } = await supabase.functions.invoke("mfa-email", { body });
  if (error) {
    let detalle = {};
    try { detalle = await error.context.json(); } catch { /* sin cuerpo JSON */ }
    return { ok: false, error: detalle.error || "No se pudo contactar con el servidor.", yaEnviado: !!detalle.ya_enviado };
  }
  return { ok: true, ...data };
}

// purpose: "login" | "enroll" | "disable"
export const enviarCodigoEmail = (purpose) => llamar({ action: "send", purpose });
export const verificarCodigoEmail = (purpose, code) => llamar({ action: "verify", purpose, code });
