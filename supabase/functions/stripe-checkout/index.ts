import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Catálogo de planes LibreApp. Precios por licencia/mes en céntimos.
// interval=month se usa en los dos casos; para el plan anual cobramos el precio
// anual en un solo pago (interval=year, amount = precio_anual_mes * 12).
const PLANS: Record<string, { name: string; monthly: number; yearly: number; maxLicenses: number }> = {
  individual: { name: "LibreApp Individual", monthly: 12000, yearly: 9900, maxLicenses: 1 },
  team: { name: "LibreApp Team", monthly: 7900, yearly: 5900, maxLicenses: 5 },
};

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

// Devuelve un price ID para la combinación planId+cycle. Lo crea en Stripe si
// no existe. Busca por metadata compuesta plan_cycle="individual_monthly" etc.
async function getOrCreatePrice(planId: string, cycle: "monthly" | "yearly"): Promise<string> {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Unknown plan: ${planId}`);
  const key = `${planId}_${cycle}`;
  const unit = cycle === "yearly" ? plan.yearly * 12 : plan.monthly; // anual = 12 meses en un solo cobro

  // Buscar producto existente por metadata
  const products = await stripeRequest(`/products/search?query=metadata["plan_cycle"]:"${key}"`, "GET");
  let productId: string;
  if (products.data?.length > 0) {
    productId = products.data[0].id;
  } else {
    const product = await stripeRequest("/products", "POST", {
      name: `${plan.name} (${cycle === "yearly" ? "anual" : "mensual"})`,
      "metadata[plan_id]": planId,
      "metadata[plan_cycle]": key,
    });
    productId = product.id;
  }

  // Buscar precio existente activo del producto
  const prices = await stripeRequest(`/prices?product=${productId}&active=true`, "GET");
  const matching = (prices.data || []).find((p: any) =>
    p.unit_amount === unit && p.recurring?.interval === (cycle === "yearly" ? "year" : "month")
  );
  if (matching) return matching.id;

  // Crearlo si no existe
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
    // 1. Autenticar al caller con el JWT que llega en Authorization
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) throw new Error("Authentication required");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
    if (authErr || !user) throw new Error("Invalid session");

    const { planId, cycle = "monthly", licenses = 1, successUrl, cancelUrl } = await req.json();

    const plan = PLANS[planId];
    if (!plan) throw new Error("Invalid plan");
    if (cycle !== "monthly" && cycle !== "yearly") throw new Error("Invalid cycle");

    // Validar nº de licencias
    let qty = Number(licenses) || 1;
    if (planId === "individual") qty = 1;
    else qty = Math.max(2, Math.min(plan.maxLicenses, qty));

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

    const org: any = userRow.organizations;
    const tenant: any = org?.tenants;
    const tenantId = tenant?.id;
    const tenantSlug = tenant?.slug;
    const email = userRow.email || user.email || "";

    const priceId = await getOrCreatePrice(planId, cycle);

    // Crear Checkout Session. Cantidad = licencias (team puede ser 2-5).
    const session = await stripeRequest("/checkout/sessions", "POST", {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": String(qty),
      success_url: successUrl || `${req.headers.get("origin") || "https://lexdocs-crm.vercel.app"}?checkout=success&plan=${planId}`,
      cancel_url: cancelUrl || `${req.headers.get("origin") || "https://lexdocs-crm.vercel.app"}?checkout=cancel`,
      customer_email: email,
      "metadata[tenant_id]": tenantId || "",
      "metadata[tenant_slug]": tenantSlug || "",
      "metadata[plan_id]": planId,
      "metadata[cycle]": cycle,
      "metadata[licenses]": String(qty),
      "subscription_data[metadata][tenant_id]": tenantId || "",
      "subscription_data[metadata][plan_id]": planId,
      "subscription_data[metadata][cycle]": cycle,
      "subscription_data[metadata][licenses]": String(qty),
      allow_promotion_codes: "true",
    });

    return new Response(
      JSON.stringify({ success: true, url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
