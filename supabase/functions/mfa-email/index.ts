// Edge Function: mfa-email
// Verificación en dos pasos por email (migration-019).
//
// POST { action: "send",   purpose: "login" | "enroll" | "disable" }
// POST { action: "verify", purpose: "login" | "enroll" | "disable", code: "123456" }
//
// - Requiere el JWT del usuario (Authorization: Bearer ...).
// - El código se liga al session_id del JWT: verificarlo desbloquea SOLO esa sesión.
// - Se guarda el hash del código, nunca el código. Caduca en 10 min, 5 intentos.
// - Límite de envíos: 1 por minuto y 5 cada 15 minutos por usuario.
// - "enroll" activa el MFA por email; "disable" lo desactiva (exige además que la
//   sesión actual ya esté verificada).
//
// Secrets: RESEND_API_KEY, FROM_EMAIL (+ SUPABASE_URL / SERVICE_ROLE / ANON automáticos)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sesionConMfaEmailOk } from "../_shared/mfaEmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "LibreApp <onboarding@resend.dev>";

const CADUCIDAD_MIN = 10;
const MAX_INTENTOS = 5;
const ESPERA_REENVIO_SEG = 60;
const MAX_ENVIOS_15MIN = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// session_id del JWT (la firma ya la ha validado auth.getUser)
function sessionIdDelJwt(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).session_id || null;
  } catch {
    return null;
  }
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generarCodigo(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const ASUNTOS: Record<string, string> = {
  login: "Tu código de acceso a LibreApp",
  enroll: "Activa la verificación por email en LibreApp",
  disable: "Desactivar la verificación por email en LibreApp",
};

function htmlEmail(codigo: string, purpose: string): string {
  const frase = purpose === "login"
    ? "Usa este código para terminar de iniciar sesión:"
    : purpose === "enroll"
      ? "Usa este código para activar la verificación en dos pasos por email:"
      : "Usa este código para desactivar la verificación en dos pasos por email:";
  return `<div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#1E1E2E">
  <h2 style="margin:0 0 12px;font-size:18px">LibreApp</h2>
  <p style="font-size:14px;line-height:1.5">${frase}</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0;color:#5B6BF0">${codigo}</p>
  <p style="font-size:12px;color:#7A7A8A;line-height:1.5">Caduca en ${CADUCIDAD_MIN} minutos. Si no has sido tú, cambia tu contraseña: alguien la conoce.</p>
</div>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // ---- Identidad del llamador ----
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Sesión requerida" }, 401);
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user?.email) return json({ error: "Sesión no válida" }, 401);
  const sessionId = sessionIdDelJwt(jwt);
  if (!sessionId) return json({ error: "Sesión sin identificador" }, 401);

  let body: { action?: string; purpose?: string; code?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON no válido" }, 400); }
  const { action, purpose = "login" } = body;
  if (!["login", "enroll", "disable"].includes(purpose)) return json({ error: "Propósito no válido" }, 400);

  const { data: ajustes } = await admin
    .from("mfa_email_settings").select("enabled").eq("user_id", user.id).maybeSingle();
  const activado = !!ajustes?.enabled;

  // Coherencia del propósito con el estado actual
  if (purpose === "login" && !activado) return json({ error: "La verificación por email no está activada" }, 400);
  if (purpose === "enroll" && activado) return json({ error: "La verificación por email ya está activada" }, 400);
  if (purpose === "disable") {
    if (!activado) return json({ error: "La verificación por email no está activada" }, 400);
    if (!(await sesionConMfaEmailOk(jwt))) return json({ error: "Verifica primero tu sesión" }, 403);
  }

  // ------------------------------------------------------------------ SEND
  if (action === "send") {
    if (!RESEND_API_KEY) return json({ error: "El envío de emails no está configurado (RESEND_API_KEY)" }, 503);

    const { data: recientes } = await admin
      .from("mfa_email_challenges").select("created_at, session_id, purpose")
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString())
      .order("created_at", { ascending: false });
    if (recientes && recientes.length >= MAX_ENVIOS_15MIN) {
      return json({ error: "Demasiados códigos enviados. Espera 15 minutos." }, 429);
    }
    // Espera entre reenvíos dentro de la misma sesión (un login nuevo sí puede pedir código ya)
    const ultimo = recientes?.find(r => r.session_id === sessionId && r.purpose === purpose);
    if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < ESPERA_REENVIO_SEG * 1000) {
      return json({ error: "Ya te hemos enviado un código hace un momento. Revisa tu correo.", ya_enviado: true }, 429);
    }

    const id = crypto.randomUUID();
    const codigo = generarCodigo();
    const { error: insErr } = await admin.from("mfa_email_challenges").insert({
      id,
      user_id: user.id,
      session_id: sessionId,
      purpose,
      code_hash: await sha256(`${id}:${codigo}`),
      expires_at: new Date(Date.now() + CADUCIDAD_MIN * 60_000).toISOString(),
    });
    if (insErr) {
      console.error("mfa-email insert:", insErr.message);
      return json({ error: "No se pudo generar el código" }, 500);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: user.email, subject: ASUNTOS[purpose], html: htmlEmail(codigo, purpose) }),
    });
    if (!res.ok) {
      console.error("mfa-email resend:", res.status, await res.text());
      await admin.from("mfa_email_challenges").delete().eq("id", id);
      return json({ error: "No se pudo enviar el email. Inténtalo más tarde." }, 502);
    }
    return json({ ok: true, enviado_a: user.email });
  }

  // ---------------------------------------------------------------- VERIFY
  if (action === "verify") {
    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length !== 6) return json({ error: "Introduce el código de 6 dígitos" }, 400);

    const { data: reto } = await admin
      .from("mfa_email_challenges").select("id, code_hash, attempts, expires_at")
      .eq("user_id", user.id).eq("session_id", sessionId).eq("purpose", purpose)
      .is("verified_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (!reto || new Date(reto.expires_at).getTime() < Date.now()) {
      return json({ error: "El código ha caducado. Pide uno nuevo." }, 400);
    }
    if (reto.attempts >= MAX_INTENTOS) {
      return json({ error: "Demasiados intentos. Pide un código nuevo." }, 429);
    }
    if (!iguales(await sha256(`${reto.id}:${code}`), reto.code_hash)) {
      await admin.from("mfa_email_challenges").update({ attempts: reto.attempts + 1 }).eq("id", reto.id);
      return json({ error: "Código incorrecto." }, 400);
    }

    await admin.from("mfa_email_challenges").update({ verified_at: new Date().toISOString() }).eq("id", reto.id);

    if (purpose === "enroll" || purpose === "disable") {
      const { error: upErr } = await admin.from("mfa_email_settings").upsert({
        user_id: user.id, enabled: purpose === "enroll", updated_at: new Date().toISOString(),
      });
      if (upErr) {
        console.error("mfa-email settings:", upErr.message);
        return json({ error: "No se pudo guardar el cambio" }, 500);
      }
    }
    return json({ ok: true });
  }

  return json({ error: "Acción no válida" }, 400);
});
