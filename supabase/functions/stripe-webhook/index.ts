// Edge Function: stripe-webhook
// Recibe webhooks de Stripe para sincronizar el estado de la suscripción del
// tenant con la base de datos. Eventos cubiertos:
//   - checkout.session.completed           (alta inicial)
//   - customer.subscription.created
//   - customer.subscription.updated        (cambios de plan, cantidad, estado)
//   - customer.subscription.deleted        (cancelación)
//   - invoice.paid                         (renovación exitosa)
//   - invoice.payment_failed               (fallo de cobro → past_due)
//
// Seguridad: verifica la firma HMAC que envía Stripe en la cabecera
// Stripe-Signature usando STRIPE_WEBHOOK_SECRET.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Verifica la cabecera Stripe-Signature (formato: t=TS,v1=SIG,v0=...).
// Algoritmo: HMAC-SHA256(secret, `${timestamp}.${payload}`). Hex lowercase.
async function verifyStripeSignature(payload: string, sigHeader: string | null): Promise<boolean> {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn("⚠️ STRIPE_WEBHOOK_SECRET no configurado: firma NO verificada (solo dev). Configúralo en producción.");
    return true;
  }
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const signedPayload = `${ts}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computed = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (computed.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  if (diff !== 0) return false;
  // Proteger contra replays: rechazar eventos con más de 5 min.
  const age = Math.abs(Date.now() / 1000 - parseInt(ts, 10));
  if (age > 300) {
    console.error(`Stripe webhook timestamp demasiado antiguo: ${age}s`);
    return false;
  }
  return true;
}

// Aplica los datos de la subscription al tenant correspondiente.
async function syncSubscriptionToTenant(sub: any, tenantIdFallback?: string | null) {
  const tenantId = sub.metadata?.tenant_id || tenantIdFallback;
  if (!tenantId) {
    console.warn("Subscription sin tenant_id en metadata; no se puede sincronizar", sub.id);
    return;
  }

  const planId: string = sub.metadata?.plan_id || "individual";
  const cycle: string = sub.metadata?.cycle
    || (sub.items?.data?.[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly");
  const licenses: number = parseInt(sub.metadata?.licenses || "", 10)
    || sub.items?.data?.[0]?.quantity
    || 1;

  const updates: Record<string, any> = {
    plan: planId,
    billing_cycle: cycle,
    license_count: licenses,
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    // Si Stripe indica cancel_at_period_end=true, consideramos auto_renew off
    auto_renew: !(sub.cancel_at_period_end === true),
    renewal_notified_at: null, // reset al renovar o cambiar plan
  };

  const { error } = await supabase.from("tenants").update(updates).eq("id", tenantId);
  if (error) console.error("Error actualizando tenant", tenantId, error);
  else console.log(`Tenant ${tenantId} sincronizado: plan=${planId} cycle=${cycle} licenses=${licenses} status=${sub.status}`);
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("stripe-signature");
    const valid = await verifyStripeSignature(rawBody, sigHeader);
    if (!valid) {
      console.error("Stripe signature inválida");
      return new Response("Forbidden", { status: 403 });
    }

    const event = JSON.parse(rawBody);
    const type: string = event.type;
    const obj = event.data?.object || {};

    // Idempotencia: registramos el event.id para evitar procesar dos veces.
    // (Si no quieres crear tabla, Stripe ya dedup al llegar; esto es extra.)
    // Por simplicidad omitimos la tabla de eventos aquí.

    switch (type) {
      case "checkout.session.completed": {
        // Al completarse el checkout, Stripe ya creó la subscription. Nos
        // traemos la subscription completa para tener todos los datos.
        if (obj.mode === "subscription" && obj.subscription) {
          const sub = await fetchSubscription(obj.subscription);
          if (sub) await syncSubscriptionToTenant(sub, obj.metadata?.tenant_id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscriptionToTenant(obj);
        break;
      }
      case "invoice.paid": {
        // Pago de renovación exitoso → asegura estado active + reset flag
        const subId = obj.subscription;
        if (subId) {
          const sub = await fetchSubscription(subId);
          if (sub) await syncSubscriptionToTenant(sub);
        }
        break;
      }
      case "invoice.payment_failed": {
        // Fallo de cobro: marcar past_due. Stripe reintenta automáticamente
        // durante unos días antes de cancelar.
        const subId = obj.subscription;
        if (subId) {
          await supabase.from("tenants")
            .update({ subscription_status: "past_due" })
            .eq("stripe_subscription_id", subId);
        }
        break;
      }
      default:
        // Ignorar el resto de eventos
        console.log("Evento Stripe ignorado:", type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("stripe-webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});

// Descargar subscription completa desde la API de Stripe (por si el objeto
// del evento está reducido).
async function fetchSubscription(id: string): Promise<any | null> {
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET_KEY) return null;
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${id}`, {
    headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) { console.error("fetchSubscription failed:", res.status); return null; }
  return res.json();
}
