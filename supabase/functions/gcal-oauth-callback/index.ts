// Edge Function: gcal-oauth-callback
// Recibe el `code` de Google tras el OAuth, lo intercambia por tokens,
// obtiene el email del usuario y guarda la conexión en google_calendar_connections.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function htmlResponse(title: string, message: string, success: boolean) {
  const color = success ? "#22C55E" : "#EF4444";
  const icon = success ? "✅" : "⚠️";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F5F5F7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
  <div style="max-width:460px;background:#fff;border-radius:14px;padding:40px 32px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)">
    <div style="font-size:54px;margin-bottom:14px">${icon}</div>
    <h1 style="margin:0 0 12px;font-size:22px;color:${color};font-weight:700">${title}</h1>
    <p style="margin:0 0 22px;font-size:15px;color:#555;line-height:1.6">${message}</p>
    <p style="margin:0;font-size:13px;color:#999">Esta ventana se cerrará automáticamente…</p>
  </div>
  <script>
    setTimeout(() => { try { window.close(); } catch (e) {} }, 2500);
    if (window.opener) {
      try { window.opener.postMessage({ type: 'gcal-oauth', success: ${success} }, '*'); } catch (e) {}
    }
  </script>
</body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // userId
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(htmlResponse("Conexión cancelada", `Google devolvió un error: ${error}`, false), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    if (!code || !state) {
      return new Response(htmlResponse("Faltan parámetros", "No se recibió el código de autorización o el identificador de usuario.", false), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // 1) Intercambiar code por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(htmlResponse("Error de autenticación", `No se pudieron obtener los tokens de Google: ${tokenData.error_description || tokenData.error || "desconocido"}`, false), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const accessToken: string = tokenData.access_token;
    const refreshToken: string | undefined = tokenData.refresh_token;
    const expiresIn: number = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 2) Obtener email del usuario
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const userInfo = await userInfoRes.json();

    if (!userInfoRes.ok || !userInfo.email) {
      return new Response(htmlResponse("Error obteniendo perfil", "No se pudo leer el email del usuario de Google.", false), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const googleEmail: string = userInfo.email;

    // 3) Cargar org_id del usuario
    const { data: userRow } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", state)
      .single();

    const orgId = userRow?.org_id || null;

    // 4) UPSERT en google_calendar_connections
    // Si ya existe una conexión y Google no envía un nuevo refresh_token, conservar el anterior.
    const { data: existing } = await supabase
      .from("google_calendar_connections")
      .select("refresh_token")
      .eq("user_id", state)
      .maybeSingle();

    const finalRefreshToken = refreshToken || existing?.refresh_token || null;

    const { error: upsertErr } = await supabase
      .from("google_calendar_connections")
      .upsert({
        user_id: state,
        org_id: orgId,
        google_email: googleEmail,
        access_token: accessToken,
        refresh_token: finalRefreshToken,
        expires_at: expiresAt,
        calendar_id: "primary",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) {
      return new Response(htmlResponse("Error guardando conexión", upsertErr.message, false), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(
      htmlResponse("Conectado correctamente", `Tu cuenta <strong>${googleEmail}</strong> está enlazada con LibreApp. Puedes cerrar esta ventana.`, true),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (e: any) {
    return new Response(htmlResponse("Error inesperado", e.message || "Error desconocido", false), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
