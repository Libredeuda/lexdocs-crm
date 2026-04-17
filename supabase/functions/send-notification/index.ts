// Edge Function: send-notification
// Envía email (Resend) y WhatsApp (Twilio) cuando se asigna un caso o llega un mensaje.
// Si las API keys no están configuradas, registra en notifications_log con status=pending.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// WhatsApp Business API (Meta Cloud API) — directo, sin Twilio
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID"); // Phone Number ID de Meta
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN"); // System User Access Token permanente
const WHATSAPP_TEMPLATE_ASSIGNMENT = Deno.env.get("WHATSAPP_TEMPLATE_ASSIGNMENT") || "case_assignment";
const WHATSAPP_TEMPLATE_MESSAGE = Deno.env.get("WHATSAPP_TEMPLATE_MESSAGE") || "new_message";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "LibreApp <noreply@libreapp.com>";
const APP_URL = Deno.env.get("APP_URL") || "https://lexdocs-crm.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendEmailResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { ok: false, reason: "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  const data = await res.json();
  return { ok: res.ok, data, status: res.status };
}

// Normaliza número de teléfono al formato E.164 sin '+' (WhatsApp Cloud API lo acepta así)
function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

// WhatsApp Cloud API — envío de mensaje con plantilla aprobada
// Si se envía fuera de la ventana de 24h, solo funcionan plantillas.
// Dentro de 24h también puedes enviar mensajes de texto libre.
async function sendWhatsappBusiness(toPhone: string, templateName: string, params: string[], freeTextBody?: string) {
  if (!WHATSAPP_PHONE_ID || !WHATSAPP_TOKEN) {
    return { ok: false, reason: "WhatsApp Business API not configured" };
  }
  const to = normalizePhone(toPhone);
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`;

  // Primero intenta plantilla (funciona siempre)
  let payload: any = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es" },
      components: params.length > 0 ? [{
        type: "body",
        parameters: params.map(p => ({ type: "text", text: p })),
      }] : [],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  // Si la plantilla falla y hay freeTextBody, intenta como texto libre (solo funcionará en ventana 24h)
  if (!res.ok && freeTextBody) {
    const fallbackRes = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: freeTextBody },
      }),
    });
    const fallbackData = await fallbackRes.json();
    return { ok: fallbackRes.ok, data: fallbackData, status: fallbackRes.status, mode: "text" };
  }

  return { ok: res.ok, data, status: res.status, mode: "template" };
}

function htmlAssignment(opts: { recipientName: string; clientName: string; caseNumber: string; caseType: string; assignerName?: string; }) {
  const caseTypeLabel = opts.caseType === "concurso" ? "Concurso de Acreedores" : "Ley de Segunda Oportunidad";
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5F5F7; padding:30px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.05)">
    <div style="background:linear-gradient(135deg,#5B6BF0,#7C5BF0);padding:24px;text-align:center;color:#fff">
      <h1 style="margin:0;font-size:22px;font-weight:700">⚖️ Nuevo caso asignado</h1>
    </div>
    <div style="padding:30px 26px;color:#2D2D2D">
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Hola ${opts.recipientName},</p>
      <p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 18px">Se te ha asignado un nuevo expediente en LibreApp${opts.assignerName ? ` por ${opts.assignerName}` : ""}.</p>
      <div style="background:#F5F5F7;border-radius:10px;padding:16px;margin-bottom:20px">
        <p style="margin:0 0 6px;font-size:11px;color:#7A7A8A;text-transform:uppercase;letter-spacing:.05em;font-weight:600">Cliente</p>
        <p style="margin:0 0 14px;font-size:15px;font-weight:600">${opts.clientName}</p>
        <p style="margin:0 0 6px;font-size:11px;color:#7A7A8A;text-transform:uppercase;letter-spacing:.05em;font-weight:600">Expediente</p>
        <p style="margin:0 0 14px;font-size:15px;font-weight:600">${opts.caseNumber}</p>
        <p style="margin:0 0 6px;font-size:11px;color:#7A7A8A;text-transform:uppercase;letter-spacing:.05em;font-weight:600">Procedimiento</p>
        <p style="margin:0;font-size:15px;font-weight:600">${caseTypeLabel}</p>
      </div>
      <div style="text-align:center">
        <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#5B6BF0,#7C5BF0);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">Acceder a LibreApp</a>
      </div>
    </div>
    <div style="padding:18px;text-align:center;background:#fafafb;border-top:1px solid #eee;font-size:11px;color:#999">LibreApp · Suite Legal</div>
  </div>
</body></html>`;
}

function htmlMessage(opts: { recipientName: string; senderName: string; caseNumber: string; messagePreview: string; }) {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5F5F7; padding:30px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.05)">
    <div style="background:linear-gradient(135deg,#5B6BF0,#7C5BF0);padding:24px;text-align:center;color:#fff">
      <h1 style="margin:0;font-size:22px;font-weight:700">💬 Nuevo mensaje de tu cliente</h1>
    </div>
    <div style="padding:30px 26px;color:#2D2D2D">
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Hola ${opts.recipientName},</p>
      <p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 18px"><strong>${opts.senderName}</strong> (Exp. ${opts.caseNumber}) te ha enviado un mensaje:</p>
      <div style="background:#F5F5F7;border-radius:10px;padding:16px;margin-bottom:20px;border-left:3px solid #5B6BF0">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#2D2D2D;white-space:pre-wrap">${opts.messagePreview}</p>
      </div>
      <div style="text-align:center">
        <a href="${APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#5B6BF0,#7C5BF0);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">Responder en LibreApp</a>
      </div>
    </div>
    <div style="padding:18px;text-align:center;background:#fafafb;border-top:1px solid #eee;font-size:11px;color:#999">LibreApp · Suite Legal</div>
  </div>
</body></html>`;
}

async function logNotification(opts: any) {
  await supabase.from("notifications_log").insert(opts);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, recipientUserIds, caseId, contactId, messageContent, assignerName } = body;

    if (!type || !["assignment", "message"].includes(type)) {
      throw new Error("type must be 'assignment' or 'message'");
    }
    if (!recipientUserIds || !Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
      throw new Error("recipientUserIds (array) required");
    }

    // Cargar destinatarios
    const { data: recipients } = await supabase
      .from("users")
      .select("id, full_name, email, phone, whatsapp, org_id")
      .in("id", recipientUserIds);

    // Cargar caso + contacto
    let caseInfo: any = null;
    let contactInfo: any = null;
    if (caseId) {
      const { data: c } = await supabase
        .from("cases")
        .select("*, contact:contacts(first_name, last_name, email, phone)")
        .eq("id", caseId)
        .single();
      caseInfo = c;
      contactInfo = c?.contact;
    } else if (contactId) {
      const { data: ct } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();
      contactInfo = ct;
    }

    const clientName = contactInfo
      ? `${contactInfo.first_name || ""} ${contactInfo.last_name || ""}`.trim()
      : "Cliente";

    const results: any[] = [];

    for (const r of recipients || []) {
      let subject = "";
      let html = "";
      let waBody = "";

      if (type === "assignment") {
        subject = `⚖️ Nuevo caso asignado · ${caseInfo?.case_number || ""}`;
        html = htmlAssignment({
          recipientName: r.full_name || "",
          clientName,
          caseNumber: caseInfo?.case_number || "—",
          caseType: caseInfo?.case_type || "lso",
          assignerName,
        });
        waBody = `⚖️ LibreApp: Te ha sido asignado el expediente ${caseInfo?.case_number || ""} de ${clientName}. Accede: ${APP_URL}`;
      } else if (type === "message") {
        subject = `💬 Nuevo mensaje de ${clientName} · Exp. ${caseInfo?.case_number || ""}`;
        html = htmlMessage({
          recipientName: r.full_name || "",
          senderName: clientName,
          caseNumber: caseInfo?.case_number || "—",
          messagePreview: (messageContent || "").slice(0, 500),
        });
        waBody = `💬 LibreApp: ${clientName} te ha enviado un mensaje (${caseInfo?.case_number || ""}). Accede para responder: ${APP_URL}`;
      }

      // Email
      if (r.email) {
        const emailRes = await sendEmailResend(r.email, subject, html);
        await logNotification({
          org_id: r.org_id,
          channel: "email",
          event_type: type,
          recipient_user_id: r.id,
          recipient_email: r.email,
          subject,
          body: html,
          status: emailRes.ok ? "sent" : (RESEND_API_KEY ? "failed" : "pending"),
          error: emailRes.ok ? null : (emailRes.reason || JSON.stringify(emailRes.data || {})),
        });
        results.push({ user: r.id, email: emailRes });
      }

      // WhatsApp Business (Meta Cloud API directo)
      const waNumber = r.whatsapp || r.phone;
      if (waNumber) {
        let templateName: string;
        let params: string[];
        if (type === "assignment") {
          templateName = WHATSAPP_TEMPLATE_ASSIGNMENT;
          params = [r.full_name || "", clientName, caseInfo?.case_number || ""];
        } else {
          templateName = WHATSAPP_TEMPLATE_MESSAGE;
          params = [r.full_name || "", clientName, (messageContent || "").slice(0, 100)];
        }
        const waRes = await sendWhatsappBusiness(waNumber, templateName, params, waBody);
        await logNotification({
          org_id: r.org_id,
          channel: "whatsapp",
          event_type: type,
          recipient_user_id: r.id,
          recipient_phone: waNumber,
          body: waBody,
          status: waRes.ok ? "sent" : (WHATSAPP_TOKEN ? "failed" : "pending"),
          error: waRes.ok ? null : (waRes.reason || JSON.stringify(waRes.data || {})),
          metadata: waRes.mode ? { mode: waRes.mode } : null,
        });
        results.push({ user: r.id, whatsapp: waRes });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results, providers: { email: !!RESEND_API_KEY, whatsapp: !!WHATSAPP_TOKEN } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
