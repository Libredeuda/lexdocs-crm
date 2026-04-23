// Edge Function: ai-agent-respond
// POST { conversation_id, incoming_message? }
// - Logs incoming lead message if present
// - Asks Claude (with handoff_to_human tool) to reply or handoff
// - If handoff: creates task + notifies assigned user
// - Otherwise: sends reply via channel (email/whatsapp), logs agent message
// - Auto-handoff when message_count >= agent.max_messages

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "LibreApp <noreply@libredeudaabogados.com>";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
}

async function sendWhatsapp(to: string, body: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID || !to) return;
  const phone = to.replace(/[^\d]/g, "");
  await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body } }),
  });
}

async function performHandoff(conv: any, agent: any, contact: any, reason: string) {
  await supabase.from("ai_conversations").update({
    status: "handoff",
    handoff_reason: reason,
    handoff_at: new Date().toISOString(),
  }).eq("id", conv.id);

  const assignedTo = contact?.assigned_to || agent?.fallback_user_id || null;
  const title = `LEAD CALIENTE: ${contact?.first_name || "Lead"} listo para hablar — motivo: ${reason}`;

  if (assignedTo) {
    await supabase.from("events").insert({
      org_id: conv.org_id,
      event_type: "task",
      contact_id: conv.contact_id,
      title,
      description: `Conversación IA derivada a humano.\nConversación: ${conv.id}\nMotivo: ${reason}`,
      event_date: new Date().toISOString().slice(0, 10),
      assigned_to: assignedTo,
      priority: "high",
    });
    await supabase.from("notifications_inbox").insert({
      org_id: conv.org_id,
      user_id: assignedTo,
      title,
      body: `Conversación con ${contact?.first_name || ""} ${contact?.last_name || ""} requiere atención humana.`,
      type: "ai_handoff",
      icon: "user",
      link: `/?page=crm&contact=${conv.contact_id}`,
      metadata: { conversation_id: conv.id, agent_id: agent.id, reason },
    });
  }
}

const INTERNAL_FUNCTION_SECRET = Deno.env.get("INTERNAL_FUNCTION_SECRET");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { conversation_id, incoming_message } = await req.json();
    if (!conversation_id) throw new Error("conversation_id required");

    const { data: conv, error: convErr } = await supabase.from("ai_conversations")
      .select("*").eq("id", conversation_id).single();
    if (convErr || !conv) throw new Error("conversation not found");

    // Autorización: (a) llamada interna con INTERNAL_FUNCTION_SECRET, o
    // (b) usuario autenticado que pertenece a la org de la conversación.
    const internalSecret = req.headers.get("x-internal-secret") || "";
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    let authorized = false;
    if (INTERNAL_FUNCTION_SECRET && internalSecret === INTERNAL_FUNCTION_SECRET) {
      authorized = true;
    } else if (jwt) {
      const { data: { user } } = await supabase.auth.getUser(jwt);
      if (user) {
        const { data: staff } = await supabase.from("users")
          .select("org_id").eq("id", user.id).maybeSingle();
        if (staff?.org_id === conv.org_id) authorized = true;
      }
    }
    if (!authorized) {
      if (!INTERNAL_FUNCTION_SECRET) {
        console.warn("⚠️ INTERNAL_FUNCTION_SECRET no configurado: llamadas internas sin auth siguen aceptándose. Configúralo en producción.");
        authorized = true; // Backwards compat hasta configurar secret
      } else {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (conv.status === "handoff" || conv.status === "closed") {
      return new Response(JSON.stringify({ success: true, action: "skipped", reason: conv.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: agent }, { data: contact }] = await Promise.all([
      supabase.from("ai_agents").select("*").eq("id", conv.agent_id).single(),
      supabase.from("contacts").select("*").eq("id", conv.contact_id).single(),
    ]);
    if (!agent) throw new Error("agent not found");
    if (!contact) throw new Error("contact not found");

    // Log incoming lead message
    if (incoming_message) {
      await supabase.from("ai_messages").insert({
        conversation_id, role: "lead", content: incoming_message,
      });
    }

    // Load last 10 messages (chronological)
    const { data: history } = await supabase.from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(10);
    const msgs = (history || []).slice().reverse();

    const claudeMessages = msgs.map((m: any) => ({
      role: m.role === "lead" ? "user" : "assistant",
      content: m.content,
    }));
    if (claudeMessages.length === 0) {
      claudeMessages.push({ role: "user", content: incoming_message || "(sin mensaje previo)" });
    }

    const systemPrompt = `${agent.system_prompt || ""}

CONTEXTO DEL LEAD:
- Nombre: ${contact.first_name || ""} ${contact.last_name || ""}
- Email: ${contact.email || ""}
- Teléfono: ${contact.phone || ""}
- Empresa: ${contact.company || ""}
- Estado: ${contact.status || ""}
- Notas: ${contact.notes || ""}
- AI tier: ${contact.ai_tier || "n/a"}
- AI score: ${contact.ai_score ?? "n/a"}

CONDICIONES DE HANDOFF:
${agent.handoff_conditions || "Pasa a humano cuando el lead esté listo para comprar, tenga pregunta legal compleja o muestre objeción fuerte."}`;

    const maxMessages = agent.max_messages || 10;
    const currentCount = conv.message_count || 0;

    // Auto-handoff if exceeding max
    if (currentCount >= maxMessages) {
      await performHandoff(conv, agent, contact, `Alcanzado máximo de mensajes (${maxMessages})`);
      return new Response(JSON.stringify({ success: true, action: "handoff", reason: "max_messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 500,
        system: systemPrompt,
        tools: [{
          name: "handoff_to_human",
          description: "Pass conversation to human lawyer when lead is ready to buy, has complex legal question, or expresses strong objection",
          input_schema: {
            type: "object",
            properties: { reason: { type: "string" } },
            required: ["reason"],
          },
        }],
        messages: claudeMessages,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Claude API error");

    // Check for tool use
    const toolUse = (data.content || []).find((b: any) => b.type === "tool_use" && b.name === "handoff_to_human");
    if (toolUse) {
      const reason = toolUse.input?.reason || "Handoff solicitado por el agente";
      await performHandoff(conv, agent, contact, reason);
      return new Response(JSON.stringify({ success: true, action: "handoff", reason }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const replyText = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    if (!replyText) throw new Error("empty reply from Claude");

    // Log agent message
    await supabase.from("ai_messages").insert({
      conversation_id, role: "agent", content: replyText,
    });

    // Send via channel
    const channel = conv.channel || agent.default_channel || "email";
    if (channel === "email" && contact.email) {
      await sendEmail(contact.email, `Re: conversación con ${agent.name || "LibreApp"}`, replyText);
    } else if (channel === "whatsapp" && (contact.phone || contact.whatsapp)) {
      await sendWhatsapp(contact.whatsapp || contact.phone, replyText);
    }

    // Update conversation
    await supabase.from("ai_conversations").update({
      last_message_at: new Date().toISOString(),
      message_count: currentCount + 1,
    }).eq("id", conversation_id);

    return new Response(JSON.stringify({ success: true, action: "replied", message: replyText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ai-agent-respond error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
