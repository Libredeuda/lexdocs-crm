// Edge Function: renewal-reminders-cron
// Se ejecuta diariamente (programada con pg_cron). Busca tenants cuya
// suscripción está cerca de renovar (30 días) o ya ha expirado, y envía
// un aviso por email a los admins del despacho + notificación in-app.
//
// Seguridad: requiere cabecera X-Cron-Secret = CRON_SECRET para evitar que
// alguien dispare spam de emails.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "LibreApp <noreply@libredeudaabogados.com>";
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const APP_URL = Deno.env.get("APP_URL") || "https://lexdocs-crm.vercel.app";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) console.error("Resend failed:", res.status, await res.text());
  return res.ok;
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / 86400000);
}

function buildReminderHtml(tenantName: string, adminName: string, days: number, isExpired: boolean, autoRenew: boolean, periodEnd: Date, planLabel: string): string {
  const endStr = periodEnd.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const title = isExpired
    ? "Tu suscripción LibreApp ha expirado"
    : `Tu suscripción LibreApp se renueva en ${days} día${days === 1 ? "" : "s"}`;
  const lead = isExpired
    ? `Hola ${adminName}, la suscripción de <strong>${tenantName}</strong> a LibreApp expiró el ${endStr}. Renueva cuanto antes para seguir usando la plataforma sin interrupciones.`
    : autoRenew
      ? `Hola ${adminName}, recordamos que la suscripción de <strong>${tenantName}</strong> (${planLabel}) se renovará automáticamente el ${endStr}.`
      : `Hola ${adminName}, la suscripción de <strong>${tenantName}</strong> (${planLabel}) termina el ${endStr} y no tienes la renovación automática activada. Renueva o activa la renovación automática para evitar la suspensión del servicio.`;
  const cta = isExpired ? "Renovar ahora" : autoRenew ? "Ver mi plan" : "Activar renovación";
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1E1E2E">
      <h1 style="font-size:20px;margin:0 0 14px">${title}</h1>
      <p style="font-size:14px;line-height:1.6;color:#444">${lead}</p>
      <p style="margin:24px 0"><a href="${APP_URL}/?page=settings&tab=billing"
        style="display:inline-block;padding:11px 20px;border-radius:8px;background:linear-gradient(135deg,#5B6BF0,#7C5BF0);color:#fff;font-weight:600;text-decoration:none;font-size:14px">
        ${cta}
      </a></p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
      <p style="font-size:11px;color:#888">Recibiste este email porque eres admin del despacho en LibreApp.</p>
    </div>`;
}

serve(async (req: Request) => {
  // Auth del cron: sólo quien tenga el secreto
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (CRON_SECRET && cronHeader !== CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!CRON_SECRET) {
    console.warn("⚠️ CRON_SECRET no configurado: función abierta a cualquiera. Configúralo en producción.");
  }

  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86400000);

    // Candidatos: tenants con suscripción activa y periodo terminando en los próximos 30 días
    // que NO han sido notificados ya, O que ya expiraron
    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("id, name, plan, billing_cycle, auto_renew, current_period_end, renewal_notified_at, subscription_status")
      .in("subscription_status", ["active", "trialing", "past_due"])
      .not("current_period_end", "is", null)
      .lte("current_period_end", in30Days.toISOString());

    if (error) throw error;

    let sent = 0;
    let skipped = 0;

    for (const t of tenants || []) {
      const periodEnd = new Date(t.current_period_end);
      const days = daysBetween(periodEnd, now);
      const isExpired = days < 0;

      // Solo notificar plan anual para el aviso de 30 días (mensual no lo
      // necesita, se renueva cada mes). Los expirados los avisamos en todo caso.
      if (!isExpired && t.billing_cycle !== "yearly") { skipped++; continue; }

      // Evitar re-notificar: si ya notificamos en los últimos 25 días, saltar.
      // (Así cubrimos también "aviso a 30 días" + "aviso a día de renovación"
      // sin spam constante.)
      if (t.renewal_notified_at) {
        const lastNotifiedDays = daysBetween(now, new Date(t.renewal_notified_at));
        if (lastNotifiedDays < 25 && !isExpired) { skipped++; continue; }
      }

      // Buscar admins del tenant
      const { data: admins } = await supabase
        .from("users")
        .select("email, full_name, first_name, organizations!inner(tenant_id)")
        .eq("organizations.tenant_id", t.id)
        .in("role", ["admin", "owner"]);

      if (!admins || admins.length === 0) { skipped++; continue; }

      const planLabel = t.plan === "individual" ? "Individual" : t.plan === "team" ? "Team" : t.plan;
      const subject = isExpired
        ? `⚠️ ${t.name} · Suscripción LibreApp expirada`
        : `${t.name} · Tu plan LibreApp se renueva en ${days} día${days === 1 ? "" : "s"}`;

      for (const admin of admins) {
        if (!admin.email) continue;
        const name = admin.first_name || admin.full_name?.split(" ")[0] || "";
        const html = buildReminderHtml(t.name, name, days, isExpired, t.auto_renew, periodEnd, planLabel);
        await sendEmail(admin.email, subject, html);
      }

      // Notificación in-app: una por cada admin (necesitamos user_id + org_id)
      const { data: adminUsers } = await supabase
        .from("users")
        .select("id, org_id, email")
        .in("role", ["admin", "owner"])
        .in("email", admins.map(a => a.email).filter(Boolean));

      for (const au of adminUsers || []) {
        await supabase.from("notifications_inbox").insert({
          org_id: au.org_id,
          user_id: au.id,
          title: subject,
          body: isExpired
            ? "Tu suscripción ha expirado. Renueva para recuperar el acceso."
            : t.auto_renew
              ? `Se renovará automáticamente el ${periodEnd.toLocaleDateString("es-ES")}`
              : `Renueva antes del ${periodEnd.toLocaleDateString("es-ES")} para no perder acceso`,
          link: "/?page=settings&tab=billing",
          icon: "credit-card",
          type: "billing_renewal",
          metadata: { days_to_renewal: days, is_expired: isExpired },
        });
      }

      // Marcar como notificado
      await supabase.from("tenants")
        .update({ renewal_notified_at: now.toISOString() })
        .eq("id", t.id);

      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, considered: tenants?.length || 0 }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("renewal-reminders-cron error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
