// Edge Function: gcal-check-availability
// Comprueba si un usuario tiene un slot libre en Google Calendar.
// Body: { userId: string, date: 'YYYY-MM-DD', time: 'HH:MM', durationMinutes: number }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

const TIMEZONE = "Europe/Madrid";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- Helpers ----------

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return { ok: res.ok, data, status: res.status };
}

async function ensureValidToken(connection: any) {
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const now = Date.now();
  if (expiresAt - now > 60_000) return connection.access_token;
  if (!connection.refresh_token) return connection.access_token;

  const refreshed = await refreshAccessToken(connection.refresh_token);
  if (!refreshed.ok || !refreshed.data.access_token) {
    await supabase.from("google_calendar_connections").delete().eq("user_id", connection.user_id);
    throw new Error("refresh_token revocado");
  }
  const newAccess = refreshed.data.access_token;
  const newExpires = new Date(Date.now() + (refreshed.data.expires_in || 3600) * 1000).toISOString();
  await supabase
    .from("google_calendar_connections")
    .update({ access_token: newAccess, expires_at: newExpires, updated_at: new Date().toISOString() })
    .eq("user_id", connection.user_id);
  return newAccess;
}

// Devuelve el offset (en minutos) de Europe/Madrid respecto a UTC para una fecha dada.
// Necesario para construir un timestamp UTC absoluto a partir de un local Madrid.
function madridOffsetMinutes(date: Date): number {
  // Truco: formatea la misma fecha en TZ Madrid y calcula el delta vs UTC.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce((acc: any, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Convierte (YYYY-MM-DD, HH:MM) interpretados en Europe/Madrid a un Date UTC absoluto.
function madridLocalToUtc(dateStr: string, timeStr: string): Date {
  const time = timeStr && timeStr.length >= 5 ? (timeStr.length === 5 ? timeStr + ":00" : timeStr) : "09:00:00";
  // Construimos primero como si fuera UTC, luego restamos el offset Madrid.
  const naive = new Date(`${dateStr}T${time}Z`);
  const offset = madridOffsetMinutes(naive); // minutos que Madrid va por delante de UTC
  return new Date(naive.getTime() - offset * 60_000);
}

// ---------- Handler ----------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId, date, time, durationMinutes } = await req.json();
    if (!userId || !date || !time) {
      throw new Error("userId, date y time son requeridos");
    }
    const dur = Number(durationMinutes) || 60;

    // 1) Cargar conexión GCal
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!connection) {
      return new Response(
        JSON.stringify({ available: true, reason: "no_connection" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (connection.block_busy_slots === false) {
      return new Response(
        JSON.stringify({ available: true, reason: "block_busy_slots_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Token válido
    const accessToken = await ensureValidToken(connection);

    // 3) Calcular ventana en UTC a partir de hora local Madrid
    const startUtc = madridLocalToUtc(date, time);
    const endUtc = new Date(startUtc.getTime() + dur * 60_000);
    const timeMin = startUtc.toISOString();
    const timeMax = endUtc.toISOString();

    const calendarId = connection.calendar_id || "primary";

    // 4) FreeBusy
    const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: TIMEZONE,
        items: [{ id: calendarId }],
      }),
    });

    if (fbRes.status === 401) {
      await supabase.from("google_calendar_connections").delete().eq("user_id", userId);
      return new Response(
        JSON.stringify({ available: true, reason: "token_revoked" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fbData = await fbRes.json();
    if (!fbRes.ok) {
      return new Response(
        JSON.stringify({ available: true, reason: "google_error", error: fbData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const calData = fbData?.calendars?.[calendarId];
    const busy: Array<{ start: string; end: string }> = calData?.busy || [];

    if (busy.length === 0) {
      return new Response(
        JSON.stringify({ available: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Conflictos: cualquier intervalo busy que solape la ventana solicitada.
    const conflicts = busy
      .filter((b) => {
        const bs = new Date(b.start).getTime();
        const be = new Date(b.end).getTime();
        return bs < endUtc.getTime() && be > startUtc.getTime();
      })
      .map((b) => ({ start: b.start, end: b.end, summary: "Ocupado" }));

    if (conflicts.length === 0) {
      return new Response(
        JSON.stringify({ available: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ available: false, conflicts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ available: true, error: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
