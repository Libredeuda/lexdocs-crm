// Edge Function: webhook-meta-leads
// Recibe leads de Meta Ads (Facebook/Instagram Lead Ads) y los crea como contactos.
//
// Meta envía 2 tipos de requests:
// 1. GET con ?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY (verificación inicial)
// 2. POST con datos del lead (cuando alguien rellena el formulario)
//
// URL: https://agzcaqgxlyrtbxtyxkwp.supabase.co/functions/v1/webhook-meta-leads?tenant_slug=libredeuda

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "libreapp_meta_2026"; // Token configurable
const META_PAGE_ACCESS_TOKEN = Deno.env.get("META_PAGE_ACCESS_TOKEN"); // Para descargar lead full

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    const body = await req.json();

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
              `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${META_PAGE_ACCESS_TOKEN}`
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
          notes_text: `Lead recibido de Meta Ads.\nForm ID: ${formId}\nLead ID: ${leadgenId}\nTodos los campos: ${JSON.stringify(fields, null, 2)}`,
          custom_fields: { meta_lead_id: leadgenId, meta_form_id: formId, raw_fields: fields },
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
