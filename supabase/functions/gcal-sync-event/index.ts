// Edge Function: gcal-sync-event
// Sincroniza un evento de Supabase con Google Calendar (create / update / delete).
// Body: { eventId: string, action: 'create' | 'update' | 'delete' }

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
  // refrescar si expira en <60s o ya expiró
  if (expiresAt - now > 60_000) return connection.access_token;
  if (!connection.refresh_token) return connection.access_token; // no podemos refrescar

  const refreshed = await refreshAccessToken(connection.refresh_token);
  if (!refreshed.ok || !refreshed.data.access_token) {
    // refresh_token revocado: borrar conexión
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

async function callGoogleApi(method: string, url: string, accessToken: string, body?: any, userId?: string) {
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // 401 => token revocado: borrar conexión
  if (res.status === 401 && userId) {
    await supabase.from("google_calendar_connections").delete().eq("user_id", userId);
    throw new Error("token Google revocado (401)");
  }

  // delete suele devolver 204 sin body
  if (res.status === 204) return { ok: true, status: 204, data: null };

  let data: any = null;
  try { data = await res.json(); } catch (_) { /* sin body */ }
  return { ok: res.ok, status: res.status, data };
}

// Combina event_date (YYYY-MM-DD) + event_time (HH:MM[:SS]) en un dateTime ISO local sin Z.
// Google Calendar acepta dateTime sin offset cuando se envía timeZone aparte.
function buildLocalDateTime(dateStr: string, timeStr: string): string {
  const time = timeStr && timeStr.length >= 5 ? (timeStr.length === 5 ? timeStr + ":00" : timeStr) : "09:00:00";
  return `${dateStr}T${time}`;
}

function addMinutesToLocalDateTime(localDateTime: string, minutes: number): string {
  // Tratamos el local como si fuera UTC para sumar minutos (evita TZ del runtime),
  // y devolvemos sin Z. Con timeZone aparte Google interpreta correctamente.
  const d = new Date(localDateTime + "Z");
  d.setUTCMinutes(d.getUTCMinutes() + (minutes || 0));
  return d.toISOString().replace(/\.\d{3}Z$/, "").replace(/Z$/, "");
}

function buildEventBody(ev: any) {
  const startLocal = buildLocalDateTime(ev.event_date, ev.event_time || "09:00:00");
  const endLocal = addMinutesToLocalDateTime(startLocal, ev.duration_minutes || 60);

  const body: any = {
    summary: ev.title || "(sin título)",
    description: ev.description || "",
    start: { dateTime: startLocal, timeZone: TIMEZONE },
    end: { dateTime: endLocal, timeZone: TIMEZONE },
  };

  if (ev.location) body.location = ev.location;

  // Recordatorios
  const minutesBefore = typeof ev.minutes_before === "number" ? ev.minutes_before : null;
  if (minutesBefore !== null) {
    body.reminders = {
      useDefault: false,
      overrides: [{ method: "popup", minutes: minutesBefore }],
    };
  } else {
    body.reminders = { useDefault: true };
  }

  // Marcar tipo en extended properties (útil para debug)
  body.extendedProperties = {
    private: {
      libreapp_event_id: String(ev.id),
      libreapp_event_type: ev.event_type || "meeting",
    },
  };

  return body;
}

// ---------- Handler ----------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { eventId, action } = await req.json();
    if (!eventId || !["create", "update", "delete"].includes(action)) {
      throw new Error("eventId y action ('create'|'update'|'delete') requeridos");
    }

    // 1) Cargar el evento
    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();
    if (evErr || !ev) throw new Error(`Evento no encontrado: ${evErr?.message || eventId}`);

    if (!ev.assigned_to) {
      return new Response(
        JSON.stringify({ success: false, reason: "no_assignee" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Cargar conexión GCal del assigned_to
    const { data: connection } = await supabase
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", ev.assigned_to)
      .maybeSingle();

    if (!connection) {
      return new Response(
        JSON.stringify({ success: false, reason: "no_connection" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Asegurar token válido
    const accessToken = await ensureValidToken(connection);
    const calendarId = encodeURIComponent(connection.calendar_id || "primary");
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

    // 4) Acción
    if (action === "create") {
      const body = buildEventBody(ev);
      const res = await callGoogleApi("POST", baseUrl, accessToken, body, ev.assigned_to);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, reason: "google_error", status: res.status, error: res.data }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const googleEventId = res.data?.id;
      if (googleEventId) {
        await supabase.from("events").update({ google_event_id: googleEventId }).eq("id", ev.id);
      }
      return new Response(
        JSON.stringify({ success: true, action, google_event_id: googleEventId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      if (!ev.google_event_id) {
        // No existe en GCal: creamos
        const body = buildEventBody(ev);
        const res = await callGoogleApi("POST", baseUrl, accessToken, body, ev.assigned_to);
        if (!res.ok) {
          return new Response(
            JSON.stringify({ success: false, reason: "google_error", status: res.status, error: res.data }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const googleEventId = res.data?.id;
        if (googleEventId) {
          await supabase.from("events").update({ google_event_id: googleEventId }).eq("id", ev.id);
        }
        return new Response(
          JSON.stringify({ success: true, action: "create_fallback", google_event_id: googleEventId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const body = buildEventBody(ev);
      const url = `${baseUrl}/${encodeURIComponent(ev.google_event_id)}`;
      const res = await callGoogleApi("PATCH", url, accessToken, body, ev.assigned_to);
      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, reason: "google_error", status: res.status, error: res.data }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, action }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!ev.google_event_id) {
        return new Response(
          JSON.stringify({ success: true, action, reason: "no_google_event_id" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const url = `${baseUrl}/${encodeURIComponent(ev.google_event_id)}`;
      const res = await callGoogleApi("DELETE", url, accessToken, undefined, ev.assigned_to);
      // 410 Gone también es un OK lógico (ya no existe)
      if (!res.ok && res.status !== 410 && res.status !== 404) {
        return new Response(
          JSON.stringify({ success: false, reason: "google_error", status: res.status, error: res.data }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await supabase.from("events").update({ google_event_id: null }).eq("id", ev.id);
      return new Response(
        JSON.stringify({ success: true, action }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("acción no soportada");
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
