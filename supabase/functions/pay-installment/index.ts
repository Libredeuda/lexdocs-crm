import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function stripeRequest(endpoint: string, method: string, body?: Record<string, string>) {
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { paymentId, successUrl, cancelUrl, email } = await req.json();

    if (!paymentId) throw new Error("paymentId is required");

    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .select("*, case:cases(contact:contacts(first_name, last_name, email))")
      .eq("id", paymentId)
      .single();

    if (payErr || !payment) throw new Error("Payment not found");
    if (payment.status === "paid") throw new Error("Already paid");

    const amountCents = Math.round(parseFloat(payment.amount) * 100);
    if (!amountCents || amountCents <= 0) throw new Error("Invalid payment amount");

    const origin = req.headers.get("origin") || "";
    const session = await stripeRequest("/checkout/sessions", "POST", {
      mode: "payment",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][product_data][name]": payment.concept || "Cuota LibreApp",
      "line_items[0][price_data][unit_amount]": amountCents.toString(),
      "line_items[0][quantity]": "1",
      success_url: successUrl || `${origin}?paid=${paymentId}`,
      cancel_url: cancelUrl || `${origin}`,
      customer_email: email || payment.case?.contact?.email || undefined,
      "metadata[payment_id]": paymentId,
      "payment_intent_data[metadata][payment_id]": paymentId,
    });

    if (session.url) {
      await supabase
        .from("payments")
        .update({ stripe_checkout_session_id: session.id })
        .eq("id", paymentId);

      return new Response(JSON.stringify({ success: true, url: session.url, sessionId: session.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(session.error?.message || "Failed to create Stripe session");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
