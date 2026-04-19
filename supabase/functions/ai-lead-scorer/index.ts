// Edge Function: ai-lead-scorer
// POST { contact_id } -> scores the lead 0-100 via Claude, updates contacts.ai_* fields.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { contact_id } = await req.json();
    if (!contact_id) throw new Error("contact_id is required");

    const { data: contact, error } = await supabase.from("contacts").select("*").eq("id", contact_id).single();
    if (error || !contact) throw new Error("contact not found");

    // Activities
    const { data: activities } = await supabase.from("activities")
      .select("activity_type, description, created_at")
      .eq("contact_id", contact_id)
      .order("created_at", { ascending: false })
      .limit(5);
    const { count: activitiesCount } = await supabase.from("activities")
      .select("*", { count: "exact", head: true })
      .eq("contact_id", contact_id);

    // Cases
    const { count: casesCount } = await supabase.from("cases")
      .select("*", { count: "exact", head: true })
      .eq("contact_id", contact_id);

    const summary = {
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      status: contact.status,
      source: contact.source,
      notes: contact.notes,
      created_at: contact.created_at,
      debt_amount: contact.debt_amount,
      province: contact.province,
      city: contact.city,
      activities_count: activitiesCount || 0,
      last_activities: activities || [],
      cases_count: casesCount || 0,
    };

    const prompt = `Analiza este lead para un despacho de abogados especializado en Segunda Oportunidad. Score 0-100 (higher = más probable que contrate). Tier: hot (>75), warm (40-75), cold (<40). Responde SOLO en JSON válido:
{ "score": number, "tier": "hot"|"warm"|"cold", "reasoning": "2 frases max", "next_action": "recomendación concreta" }

LEAD:
${JSON.stringify(summary, null, 2)}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Claude API error");
    const text = data.content?.map((b: any) => b.text || "").join("") || "{}";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Claude did not return JSON");
    const parsed = JSON.parse(m[0]);

    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const tier = parsed.tier || (score > 75 ? "hot" : score >= 40 ? "warm" : "cold");

    await supabase.from("contacts").update({
      ai_score: score,
      ai_tier: tier,
      ai_score_reasoning: parsed.reasoning || "",
      ai_next_action: parsed.next_action || "",
      ai_score_updated_at: new Date().toISOString(),
    }).eq("id", contact_id);

    return new Response(JSON.stringify({
      success: true,
      score, tier,
      reasoning: parsed.reasoning || "",
      next_action: parsed.next_action || "",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("ai-lead-scorer error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
