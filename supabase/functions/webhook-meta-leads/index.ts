// Edge Function: webhook-meta-leads
// Recibe leads de Meta Ads (Facebook/Instagram Lead Ads) y los crea como contactos.
//
// Meta envía 2 tipos de requests:
// 1. GET con ?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY (verificación inicial)
// 2. POST con datos del lead (cuando alguien rellena el formulario)
//
// URL: https://<project-ref>.supabase.co/functions/v1/webhook-meta-leads?tenant_slug=libredeuda

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "libreapp_meta_2026"; // Token configurable
const META_PAGE_ACCESS_TOKEN = Deno.env.get("META_PAGE_ACCESS_TOKEN"); // Para descargar lead full
// App Secret de la app "LexDocs Leads" (distinta de la app "LexDocs" de WhatsApp,
// Meta no permite combinar el caso de uso "API de marketing" con "WhatsApp" en una sola app).
const META_LEADS_APP_SECRET = Deno.env.get("META_LEADS_APP_SECRET");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Verifica la firma HMAC-SHA256 que Meta envía en cabecera X-Hub-Signature-256.
// Si falta META_LEADS_APP_SECRET: se rechaza salvo ALLOW_INSECURE_WEBHOOKS=true (solo dev).
async function verifyMetaSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!META_LEADS_APP_SECRET) {
    if (Deno.env.get("ALLOW_INSECURE_WEBHOOKS") === "true") {
      console.warn("⚠️ META_LEADS_APP_SECRET no configurado: firma NO verificada (ALLOW_INSECURE_WEBHOOKS=true, solo dev).");
      return true;
    }
    console.error("META_LEADS_APP_SECRET no configurado: webhook rechazado.");
    return false;
  }
  if (!signatureHeader) {
    console.error("Firma ausente en X-Hub-Signature-256");
    return false;
  }
  const expected = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(META_LEADS_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (computed.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

serve(async (req: Request) => {
  const url = new URL(req.url);

  // ════════════════════════════════════════════════════════════════
  // VERIFICACIÓN INICIAL (Meta hace GET al guardar el webhook)
  // ════════════════════════════════════════════════════════════════
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      console.log("Meta webhook verified ✓");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ════════════════════════════════════════════════════════════════
  // RECIBIR LEAD (Meta hace POST cuando hay un lead nuevo)
  // ════════════════════════════════════════════════════════════════
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const tenantSlug = url.searchParams.get("tenant_slug") || "libredeuda";

    // Leer cuerpo en bruto (necesario para HMAC) y verificar firma ANTES de parsear
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const signatureValid = await verifyMetaSignature(rawBody, signatureHeader);
    if (!signatureValid) {
      console.error("HMAC inválida — posible intento de forja de webhook", { tenantSlug });
      return new Response("Forbidden", { status: 403 });
    }

    const body = JSON.parse(rawBody);

    // Resolver tenant + org
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", tenantSlug)
      .single();

    if (!tenant) return jsonResponse({ error: "tenant not found" }, 404);

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("tenant_id", tenant.id)
      .single();

    if (!org) return jsonResponse({ error: "org not found" }, 404);

    // Meta envía un objeto tipo:
    // { object: 'page', entry: [{ id, time, changes: [{ value: { leadgen_id, page_id, form_id, ... } }] }] }
    const entries = body.entry || [];
    const createdContacts: any[] = [];

    for (const entry of entries) {
      for (const change of (entry.changes || [])) {
        if (change.field !== "leadgen") continue;

        const leadgenId = change.value?.leadgen_id;
        const formId = change.value?.form_id;

        if (!leadgenId) continue;

        // Descargar el lead completo desde Meta
        let leadData: any = {};
        if (META_PAGE_ACCESS_TOKEN) {
          try {
            const res = await fetch(
              // Campaña y anuncio de origen: alimentan el bloque Marketing del resumen de dirección
              `https://graph.facebook.com/v21.0/${leadgenId}?fields=field_data,ad_id,ad_name,campaign_id,campaign_name,form_id&access_token=${META_PAGE_ACCESS_TOKEN}`
            );
            leadData = await res.json();
          } catch (e) {
            console.error("Error fetching lead:", e);
          }
        }

        // Parsear field_data: [{name: "full_name", values: ["Juan Perez"]}, ...]
        const fields: Record<string, string> = {};
        for (const f of (leadData.field_data || [])) {
          fields[f.name] = (f.values || [])[0] || "";
        }

        // Preguntas del formulario (label legible + opciones con su texto visible),
        // para mostrar en la ficha del lead lo mismo que vio al rellenar el formulario
        // en vez de los códigos internos ("10k_50k", "si_ya"...).
        let fieldAnswers: { key: string; label: string; value: string }[] = [];
        if (META_PAGE_ACCESS_TOKEN && formId) {
          try {
            const formRes = await fetch(
              `https://graph.facebook.com/v21.0/${formId}?fields=questions&access_token=${META_PAGE_ACCESS_TOKEN}`
            );
            const formData = await formRes.json();
            const questions: any[] = formData.questions || [];
            fieldAnswers = Object.entries(fields).map(([key, rawValue]) => {
              const q = questions.find((qq) => qq.key === key);
              const option = q?.options?.find((o: any) => o.key === rawValue);
              return { key, label: q?.label || key, value: option?.value || rawValue };
            });
          } catch (e) {
            console.error("Error fetching form questions:", e);
          }
        }

        // Mapear campos comunes de Meta a nuestro schema
        const fullName = fields.full_name || fields.name || "";
        const [firstName, ...rest] = fullName.split(" ");
        const lastName = rest.join(" ");

        const contact = {
          org_id: org.id,
          first_name: firstName || fields.first_name || "Lead",
          last_name: lastName || fields.last_name || "",
          email: fields.email || "",
          phone: fields.phone_number || fields.phone || "",
          company: fields.company_name || null,
          source: "ads",
          status: "lead",
          notes_text: `Lead recibido de Meta Ads.\nForm ID: ${formId}\nLead ID: ${leadgenId}`,
          custom_fields: { meta_lead_id: leadgenId, meta_form_id: formId, raw_fields: fields, field_answers: fieldAnswers },
          meta_campaign_id: leadData.campaign_id || null,
          meta_campaign_name: leadData.campaign_name || null,
          meta_ad_id: leadData.ad_id || null,
          meta_ad_name: leadData.ad_name || null,
        };

        const { data: created, error } = await supabase
          .from("contacts")
          .insert(contact)
          .select()
          .single();

        if (!error && created) {
          createdContacts.push(created);

          // Log activity
          await supabase.from("activities").insert({
            org_id: org.id,
            entity_type: "contact",
            entity_id: created.id,
            action: "created",
            description: `Lead recibido de Meta Ads (Form ${formId})`,
            metadata: { source: "meta_ads", lead_id: leadgenId, form_id: formId },
          });
        } else {
          console.error("Error creating contact:", error);
        }
      }
    }

    return jsonResponse({ success: true, created: createdContacts.length });
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
