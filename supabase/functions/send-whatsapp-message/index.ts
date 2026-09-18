// Edge Function: send-whatsapp-message
// POST { contact_id, message } -> envía un mensaje de texto libre por WhatsApp
// Business Cloud API (Meta) al teléfono del contacto, usando el mismo número
// conectado en Integraciones → WhatsApp Business. Solo funciona dentro de la
// ventana de 24h desde el último mensaje del contacto (política de Meta); si
// no, Meta devuelve error y se lo mostramos tal cual al usuario.
// Deja registro en "messages" (para que aparezca en el histórico del contacto)
// y en "notifications_log" (auditoría de envíos).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sesionConMfaEmailOk } from "../_shared/mfaEmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizePhone(phone: string): string {
  return (phone || "").replace(/[^\d]/g, "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) {
      return json({ success: false, error: "WhatsApp Business no está conectado. Configúralo en Integraciones → WhatsApp Business." }, 400);
    }

    const { contact_id, message } = await req.json();
    if (!contact_id || !message?.trim()) throw new Error("contact_id y message son obligatorios");

    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
    if (!user || !(await sesionConMfaEmailOk(jwt))) return json({ success: false, error: "Unauthorized" }, 401);

    const { data: staff } = await supabase.from("users").select("org_id").eq("id", user.id).maybeSingle();
    if (!staff?.org_id) return json({ success: false, error: "Forbidden" }, 403);
    const orgId = staff.org_id;

    const { data: contact, error: contactErr } = await supabase.from("contacts")
      .select("id, phone, org_id").eq("id", contact_id).eq("org_id", orgId).single();
    if (contactErr || !contact) throw new Error("Contacto no encontrado");
    if (!contact.phone) throw new Error("Este contacto no tiene teléfono guardado");

    const to = normalizePhone(contact.phone);
    const waRes = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message.trim() } }),
    });
    const waData = await waRes.json();

    await supabase.from("notifications_log").insert({
      org_id: orgId,
      channel: "whatsapp",
      event_type: "manual_message",
      recipient_phone: contact.phone,
      body: message.trim(),
      status: waRes.ok ? "sent" : "failed",
      error: waRes.ok ? null : (waData.error?.message || JSON.stringify(waData)),
      metadata: { contact_id },
    });

    if (!waRes.ok) {
      return json({ success: false, error: waData.error?.message || "Meta rechazó el envío (probablemente fuera de la ventana de 24h; el contacto debe escribir primero)." }, 502);
    }

    await supabase.from("messages").insert({
      org_id: orgId,
      contact_id,
      from_user_id: user.id,
      to_contact_id: contact_id,
      content: message.trim(),
    });

    await supabase.from("activities").insert({
      org_id: orgId,
      entity_type: "contact",
      entity_id: contact_id,
      action: "updated",
      description: `WhatsApp enviado: "${message.trim().slice(0, 100)}"`,
    });

    return json({ success: true });
  } catch (e: any) {
    console.error("send-whatsapp-message error:", e);
    return json({ success: false, error: e.message }, 500);
  }
});
