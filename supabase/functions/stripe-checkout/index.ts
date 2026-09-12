import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sesionConMfaEmailOk } from "../_shared/mfaEmail.ts";
import { type Ciclo, esPlanDeCompra, type IdPlan, importeCentimos, PLANES } from "../_shared/planes.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// deno-lint-ignore no-explicit-any
async function stripeRequest(endpoint: string, method: string, body?: any) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  return res.json();
}

// Devuelve el price ID de plan+ciclo (catálogo en _shared/planes.ts). Crea el
// producto y el precio en Stripe la primera vez; si el importe del catálogo
// cambia, crea un precio nuevo (Stripe no permite editar importes).
async function getOrCreatePrice(planId: IdPlan, cycle: Ciclo): Promise<string> {
  const plan = PLANES[planId];
  const key = `${planId}_${cycle}`;
  const unit = importeCentimos(planId, cycle); // anual = 10 mensualidades en un solo cobro

  const products = await stripeRequest(`/products/search?query=metadata["plan_cycle"]:"${key}"`, "GET");
  let productId: string;
  if (products.data?.length > 0) {
    productId = products.data[0].id;
  } else {
    const product = await stripeRequest("/products", "POST", {
      name: `${plan.nombre} (${cycle === "yearly" ? "anual" : "mensual"})`,
      "metadata[plan_id]": planId,
      "metadata[plan_cycle]": key,
    });
    productId = product.id;
  }

  const prices = await stripeRequest(`/prices?product=${productId}&active=true`, "GET");
  // deno-lint-ignore no-explicit-any
  const matching = (prices.data || []).find((p: any) =>
    p.unit_amount === unit && p.recurring?.interval === (cycle === "yearly" ? "year" : "month")
  );
  if (matching) return matching.id;

  const price = await stripeRequest("/prices", "POST", {
    product: productId,
    unit_amount: unit.toString(),
    currency: "eur",
    "recurring[interval]": cycle === "yearly" ? "year" : "month",
  });
  return price.id;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!STRIPE_SECRET_KEY) throw new Error("Stripe no está configurado (STRIPE_SECRET_KEY)");

    // 1. Autenticar al caller con el JWT que llega en Authorization
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) throw new Error("Authentication required");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
    if (authErr || !user) throw new Error("Invalid session");
    if (!(await sesionConMfaEmailOk(jwt))) throw new Error("Email verification required");

    const { planId, cycle = "monthly", successUrl, cancelUrl } = await req.json();

    if (planId === "custom") throw new Error("El plan a medida se contrata hablando con nosotros por WhatsApp");
    if (!esPlanDeCompra(planId)) throw new Error("Invalid plan");
    if (cycle !== "monthly" && cycle !== "yearly") throw new Error("Invalid cycle");
    const usuarios = PLANES[planId].usuarios;

    // 2. Resolver tenant del CALLER (NO del body — el cliente no decide tenant)
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("users")
      .select("email, role, org_id, organizations!inner(tenant_id, tenants!inner(id, slug))")
      .eq("id", user.id)
      .single();
    if (userErr || !userRow) throw new Error("User profile not found");

    // 3. Sólo admins pueden cambiar el plan del tenant
    if (userRow.role !== "admin" && userRow.role !== "owner") {
      throw new Error("Only admins can change subscription plan");
    }

    // deno-lint-ignore no-explicit-any
    const org: any = userRow.organizations;
    // deno-lint-ignore no-explicit-any
    const tenant: any = org?.tenants;
    const tenantId = tenant?.id;
    const tenantSlug = tenant?.slug;
    const email = userRow.email || user.email || "";

    const priceId = await getOrCreatePrice(planId, cycle);
    const origin = req.headers.get("origin") || "https://lexdocs-crm.vercel.app";

    // Checkout: un plan = una línea; los usuarios del plan viajan en metadata.
    // Precios sin IVA: cómo se añade el IVA (Stripe Tax o tipo fijo) se decide al
    // configurar Stripe. Se piden dirección y NIF para poder facturar.
    const session = await stripeRequest("/checkout/sessions", "POST", {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl || `${origin}?checkout=success&plan=${planId}`,
      cancel_url: cancelUrl || `${origin}?checkout=cancel`,
      customer_email: email,
      billing_address_collection: "required",
      "tax_id_collection[enabled]": "true",
      "metadata[tenant_id]": tenantId || "",
      "metadata[tenant_slug]": tenantSlug || "",
      "metadata[plan_id]": planId,
      "metadata[cycle]": cycle,
      "metadata[licenses]": String(usuarios),
      "subscription_data[metadata][tenant_id]": tenantId || "",
      "subscription_data[metadata][plan_id]": planId,
      "subscription_data[metadata][cycle]": cycle,
      "subscription_data[metadata][licenses]": String(usuarios),
      allow_promotion_codes: "true",
    });
    if (!session.url) throw new Error(session.error?.message || "Stripe no devolvió la sesión de pago");

    return new Response(
      JSON.stringify({ success: true, url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  // deno-lint-ignore no-explicit-any
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
