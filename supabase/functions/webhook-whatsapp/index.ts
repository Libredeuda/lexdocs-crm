// Edge Function: webhook-whatsapp
// Recibe mensajes entrantes de WhatsApp Business Cloud API y los crea como contactos/leads.
//
// 1. Verificación inicial: GET con hub.mode/hub.verify_token/hub.challenge
// 2. Mensajes: POST con payload de Meta
//
// URL: https://agzcaqgxlyrtbxtyxkwp.supabase.co/functions/v1/webhook-whatsapp?tenant_slug=libredeuda

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "libreapp_meta_2026";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  const url = new URL(req.url);

  // Verificación inicial
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const tenantSlug = url.searchParams.get("tenant_slug") || "libredeuda";
    const body = await req.json();

    // Resolver tenant + org
    const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", tenantSlug).single();
    if (!tenant) return jsonResponse({ error: "tenant not found" }, 404);
    const { data: org } = await supabase.from("organizations").select("id").eq("tenant_id", tenant.id).single();
    if (!org) return jsonResponse({ error: "org not found" }, 404);

    // WhatsApp envía: { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { messages: [...], contacts: [...] } }] }] }
    const entries = body.entry || [];
    let processed = 0;

    for (const entry of entries) {
      for (const change of (entry.changes || [])) {
        if (change.field !== "messages") continue;
        const value = change.value || {};
        const contactsMeta = value.contacts || [];
        const messages = value.messages || [];

        for (const msg of messages) {
          // Solo mensajes de texto por ahora (ignoramos status updates, audio, etc.)
          if (msg.type !== "text" && msg.type !== "interactive") continue;

          const fromPhone = msg.from; // ej: "34684160853"
          const text = msg.text?.body || msg.interactive?.button_reply?.title || "[Mensaje no textual]";

          // Buscar nombre del remitente en value.contacts
          const senderInfo = contactsMeta.find((c: any) => c.wa_id === fromPhone);
          const senderName = senderInfo?.profile?.name || "Contacto WhatsApp";
          const [firstName, ...rest] = senderName.split(" ");

          // ¿El número ya existe como contact?
          const phoneFmt = fromPhone.startsWith("+") ? fromPhone : `+${fromPhone}`;
          const { data: existing } = await supabase
            .from("contacts")
            .select("id")
            .eq("org_id", org.id)
            .or(`phone.eq.${phoneFmt},phone.eq.${fromPhone}`)
            .limit(1);

          let contactId: string;
          if (existing && existing.length > 0) {
            contactId = existing[0].id;
            // Actualizar notas con el mensaje nuevo
            const { data: cur } = await supabase.from("contacts").select("notes_text").eq("id", contactId).single();
            await supabase
              .from("contacts")
              .update({ notes_text: `${cur?.notes_text || ""}\n[${new Date().toISOString()}] WhatsApp: ${text}`.slice(0, 5000) })
              .eq("id", contactId);
          } else {
            // Crear nuevo lead
            const { data: created, error } = await supabase
              .from("contacts")
              .insert({
                org_id: org.id,
                first_name: firstName || "Contacto",
                last_name: rest.join(" "),
                phone: phoneFmt,
                source: "whatsapp",
                status: "lead",
                notes_text: `Lead recibido por WhatsApp.\nMensaje inicial: "${text}"`,
                custom_fields: { wa_id: fromPhone, wa_profile_name: senderName },
              })
              .select()
              .single();
            if (error) {
              console.error("Error creating contact:", error);
              continue;
            }
            contactId = created.id;
            await supabase.from("activities").insert({
              org_id: org.id,
              entity_type: "contact",
              entity_id: contactId,
              action: "created",
              description: `Lead recibido por WhatsApp: "${text.slice(0, 100)}"`,
              metadata: { source: "whatsapp", phone: phoneFmt },
            });
          }

          // Registrar el mensaje en la tabla messages
          await supabase.from("messages").insert({
            org_id: org.id,
            contact_id: contactId,
            from_contact_id: contactId,
            to_user_id: null,
            content: text,
            is_read: false,
            created_at: msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
          });

          processed++;
        }
      }
    }

    return jsonResponse({ success: true, processed });
  } catch (e: any) {
    console.error("Webhook error:", e);
    return jsonResponse({ error: e.message }, 500);
  }
});

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
