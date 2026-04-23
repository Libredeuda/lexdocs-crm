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

// Stripe price IDs will be created on first request if they don't exist
const PLAN_PRICES: Record<string, { name: string; amount: number; interval: string }> = {
  starter: { name: "LibreApp Starter", amount: 4900, interval: "month" },
  pro: { name: "LibreApp Pro", amount: 8900, interval: "month" },
  premium: { name: "LibreApp Premium", amount: 13900, interval: "month" },
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

async function getOrCreatePrice(planId: string): Promise<string> {
  const plan = PLAN_PRICES[planId];
  if (!plan) throw new Error(`Unknown plan: ${planId}`);

  // Search for existing product
  const products = await stripeRequest(`/products/search?query=metadata["plan_id"]:"${planId}"`, "GET");

  if (products.data?.length > 0) {
    // Get price for this product
    const prices = await stripeRequest(`/prices?product=${products.data[0].id}&active=true`, "GET");
    if (prices.data?.length > 0) return prices.data[0].id;
  }

  // Create product
  const product = await stripeRequest("/products", "POST", {
    name: plan.name,
    "metadata[plan_id]": planId,
  });

  // Create price
  const price = await stripeRequest("/prices", "POST", {
    product: product.id,
    unit_amount: plan.amount.toString(),
    currency: "eur",
    "recurring[interval]": plan.interval,
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

    const { planId, successUrl, cancelUrl } = await req.json();

    if (!planId || !PLAN_PRICES[planId]) {
      throw new Error("Invalid plan");
    }

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

    const priceId = await getOrCreatePrice(planId);

    // Create Checkout Session
    const session = await stripeRequest("/checkout/sessions", "POST", {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl || `${req.headers.get("origin") || "https://lexdocs-crm.vercel.app"}?checkout=success&plan=${planId}`,
      cancel_url: cancelUrl || `${req.headers.get("origin") || "https://lexdocs-crm.vercel.app"}?checkout=cancel`,
      customer_email: email,
      "metadata[tenant_id]": tenantId || "",
      "metadata[tenant_slug]": tenantSlug || "",
      "metadata[plan_id]": planId,
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
