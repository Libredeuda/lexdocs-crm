// Edge Function: task-reminders-cron
// Se llama cada 5 minutos (vía pg_cron o GitHub Actions).
// Busca eventos próximos cuyo recordatorio está dentro de su ventana y dispara
// notificaciones (in-app inbox + email + WhatsApp + Web Push).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EVENT_TYPE_LABELS: Record<string, string> = {
  task: "Tarea",
  call: "Llamada",
  meeting: "Reunión",
  hearing: "Vista/Acto",
  deadline: "Plazo",
};

const EVENT_TYPE_EMOJI: Record<string, string> = {
  task: "✅",
  call: "📞",
  meeting: "🤝",
  hearing: "⚖️",
  deadline: "⏰",
};

function fmtTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5); // HH:MM
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Calcular ahora y la ventana de búsqueda
    // Buscamos eventos cuya fecha+hora menos reminder_minutes_before esté entre ahora-10min y ahora+10min
    // (para tolerar drift del cron)
    const now = new Date();
    const windowStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    // Cargar eventos pendientes de notificación (no completados, sin notification_sent_at)
    const { data: events, error } = await supabase
      .from("events")
      .select(`
        id, org_id, case_id, title, description, event_type, event_date, event_time,
        assigned_to, reminder_minutes_before, notification_sent_at, is_completed,
        priority, recurrence, location,
        case:cases(case_number, contact:contacts(first_name, last_name)),
        assignee:users!events_assigned_to_fkey(full_name, email, phone, whatsapp)
      `)
      .is("notification_sent_at", null)
      .eq("is_completed", false);

    if (error) throw error;

    let processed = 0;
    let dispatched = 0;
    const results: any[] = [];

    for (const ev of events || []) {
      // Construir el datetime del evento (Europe/Madrid)
      const dateStr = ev.event_date;
      const timeStr = ev.event_time || "00:00:00";
      // Tratamos como hora local Madrid; calculamos su equivalente en UTC para comparación
      const eventLocal = new Date(`${dateStr}T${timeStr}`);
      // Restar reminder_minutes_before
      const reminderMin = ev.reminder_minutes_before || 30;
      const reminderTime = new Date(eventLocal.getTime() - reminderMin * 60 * 1000);

      processed++;

      // Si la hora del recordatorio está fuera de la ventana, saltar
      if (reminderTime < new Date(windowStart) || reminderTime > new Date(windowEnd)) {
        continue;
      }

      // Si no hay asignado, no podemos notificar
      if (!ev.assigned_to || !ev.assignee) {
        // Marcar para no reintentar
        await supabase.from("events").update({ notification_sent_at: now.toISOString() }).eq("id", ev.id);
        continue;
      }

      const typeLabel = EVENT_TYPE_LABELS[ev.event_type] || "Evento";
      const emoji = EVENT_TYPE_EMOJI[ev.event_type] || "📌";
      const assignee = ev.assignee;
      const firstName = (assignee.full_name || "").split(" ")[0] || "";
      const clientName = ev.case?.contact ? `${ev.case.contact.first_name || ""} ${ev.case.contact.last_name || ""}`.trim() : "";
      const caseNumber = ev.case?.case_number || "";
      const minsLabel = reminderMin === 60 ? "en 1 hora"
        : reminderMin === 1440 ? "mañana"
        : reminderMin >= 60 ? `en ${Math.round(reminderMin / 60)} horas`
        : `en ${reminderMin} minutos`;

      const title = `${emoji} ${typeLabel}: ${ev.title}`;
      const subtitle = ev.event_time
        ? `${fmtDate(dateStr)} a las ${fmtTime(ev.event_time)}`
        : fmtDate(dateStr);
      const bodyShort = `${subtitle}${clientName ? " · " + clientName : ""}${caseNumber ? " (Exp. " + caseNumber + ")" : ""}`;

      // 1. Crear notification_inbox
      try {
        await supabase.from("notifications_inbox").insert({
          org_id: ev.org_id,
          user_id: ev.assigned_to,
          title: `${emoji} ${typeLabel} ${minsLabel}: ${ev.title}`,
          body: bodyShort,
          link: ev.case_id ? `/?page=cases&case=${ev.case_id}` : "/?page=agenda",
          icon: "calendar",
          type: "task_reminder",
          metadata: { event_id: ev.id, event_type: ev.event_type, priority: ev.priority },
        });
      } catch (e) {
        console.error("Inbox insert error:", e);
      }

      // 2. Web Push
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/web-push-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId: ev.assigned_to,
            title: `${emoji} ${typeLabel} ${minsLabel}`,
            body: `${ev.title}\n${subtitle}`,
            link: ev.case_id ? `/?page=cases&case=${ev.case_id}` : "/?page=agenda",
            type: "task_reminder",
            priority: ev.priority,
            tag: `event-${ev.id}`,
          }),
        });
      } catch (e) {
        console.error("Web push call error:", e);
      }

      // 3. Email + WhatsApp (vía send-notification)
      // Sólo email para todos; WhatsApp solo si priority es high/urgent
      try {
        const emailHtml = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#F5F5F7; padding:30px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.05)">
    <div style="background:linear-gradient(135deg,#5B6BF0,#7C5BF0);padding:24px;text-align:center;color:#fff">
      <h1 style="margin:0;font-size:22px;font-weight:700">${emoji} ${typeLabel} ${minsLabel}</h1>
    </div>
    <div style="padding:30px 26px;color:#2D2D2D">
      <p style="font-size:15px;line-height:1.6;margin:0 0 14px">Hola ${firstName},</p>
      <p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 18px">Te recordamos que tienes ${minsLabel}:</p>
      <div style="background:#F5F5F7;border-radius:10px;padding:16px;margin-bottom:20px;border-left:3px solid #5B6BF0">
        <p style="margin:0;font-size:16px;font-weight:700;color:#2D2D2D">${ev.title}</p>
        <p style="margin:8px 0 0;font-size:13px;color:#7A7A8A">${subtitle}</p>
        ${ev.location ? `<p style="margin:6px 0 0;font-size:13px;color:#7A7A8A">📍 ${ev.location}</p>` : ""}
        ${ev.description ? `<p style="margin:10px 0 0;font-size:13px;color:#555;line-height:1.5">${ev.description}</p>` : ""}
      </div>
      ${clientName ? `<p style="font-size:13px;color:#555;margin-bottom:18px"><strong>Cliente:</strong> ${clientName}${caseNumber ? " · Expediente " + caseNumber : ""}</p>` : ""}
      <div style="text-align:center">
        <a href="https://lexdocs-crm.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#5B6BF0,#7C5BF0);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">Abrir LibreApp</a>
      </div>
    </div>
    <div style="padding:18px;text-align:center;background:#fafafb;border-top:1px solid #eee;font-size:11px;color:#999">LibreApp · Suite Legal</div>
  </div>
</body></html>`;

        // Email directo via Resend (no usamos send-notification para evitar duplicar template)
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "LibreApp <onboarding@resend.dev>";
        if (RESEND_API_KEY && assignee.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: assignee.email,
              subject: `${emoji} ${typeLabel} ${minsLabel}: ${ev.title}`,
              html: emailHtml,
            }),
          });
        }
      } catch (e) {
        console.error("Email reminder error:", e);
      }

      // 4. WhatsApp solo para high/urgent
      if ((ev.priority === "high" || ev.priority === "urgent") && (assignee.whatsapp || assignee.phone)) {
        try {
          const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
          const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");
          if (WA_TOKEN && WA_PHONE_ID) {
            const to = (assignee.whatsapp || assignee.phone || "").replace(/[^\d]/g, "");
            const waBody = `${emoji} LibreApp recordatorio: "${ev.title}" ${minsLabel} (${subtitle}). ${clientName ? "Cliente: " + clientName : ""}`;
            await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${WA_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: waBody },
              }),
            });
          }
        } catch (e) {
          console.error("WhatsApp reminder error:", e);
        }
      }

      // Marcar como notificado
      await supabase
        .from("events")
        .update({ notification_sent_at: now.toISOString() })
        .eq("id", ev.id);

      dispatched++;
      results.push({ event_id: ev.id, title: ev.title, dispatched_to: assignee.full_name });
    }

    return new Response(
      JSON.stringify({ success: true, processed, dispatched, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("task-reminders-cron error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
