// Edge Function: automation-runner
// Dual mode:
//   - GET / no body: cron mode - process running automation_runs where next_run_at <= now()
//   - POST { trigger_type, contact_id }: start matching workflows for contact
//
// Handles step action_types: wait, send_email, send_whatsapp, create_task,
// change_status, add_tag, assign_to, ai_score, ai_message, ai_analyze_reply,
// notify_team, end.

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
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function renderTemplate(str: string, contact: any): string {
  if (!str) return "";
  return str
    .replaceAll("{{first_name}}", contact.first_name || "")
    .replaceAll("{{last_name}}", contact.last_name || "")
    .replaceAll("{{company}}", contact.company || "")
    .replaceAll("{{email}}", contact.email || "")
    .replaceAll("{{phone}}", contact.phone || "");
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) { console.error("sendEmail: no RESEND_API_KEY"); return { error: "no_api_key" }; }
  if (!to) { console.error("sendEmail: no to"); return { error: "no_to" }; }
  if (!html || html.trim().length === 0) { console.error("sendEmail: empty body"); return { error: "empty_body" }; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  const body = await res.text();
  if (!res.ok) console.error("sendEmail failed:", res.status, body);
  else console.log("sendEmail ok:", to, subject);
  return { status: res.status, body };
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

async function getOrCreateTag(orgId: string, name: string): Promise<string | null> {
  const { data: existing } = await supabase.from("tags").select("id").eq("org_id", orgId).eq("name", name).maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase.from("tags").insert({ org_id: orgId, name }).select("id").single();
  return created?.id || null;
}

async function scoreContact(contactId: string): Promise<any> {
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", contactId).single();
  if (!contact) return null;
  const prompt = `Analiza este lead para un despacho de abogados especializado en Segunda Oportunidad. Score 0-100 (higher = más probable que contrate). Tier: hot (>75), warm (40-75), cold (<40). Responde SOLO en JSON: { "score": number, "tier": "hot"|"warm"|"cold", "reasoning": "2 frases max", "next_action": "recomendación concreta" }

Lead:
${JSON.stringify(contact, null, 2)}`;
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
  const text = data.content?.map((b: any) => b.text || "").join("") || "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  await supabase.from("contacts").update({
    ai_score: parsed.score,
    ai_tier: parsed.tier,
    ai_score_reasoning: parsed.reasoning,
    ai_next_action: parsed.next_action,
    ai_score_updated_at: new Date().toISOString(),
  }).eq("id", contactId);
  return parsed;
}

async function executeStep(run: any, step: any, workflow: any): Promise<{ advance: boolean; nextDelayMin?: number }> {
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", run.contact_id).single();
  const config = step.config || {};
  const actionType = step.action_type;

  switch (actionType) {
    case "wait": {
      return { advance: true, nextDelayMin: config.delay_minutes || step.delay_minutes || 0 };
    }
    case "send_email": {
      let subject = config.subject || "";
      let body = config.body || config.html || "";
      if (config.template_id) {
        const { data: tpl } = await supabase.from("message_templates").select("*").eq("id", config.template_id).maybeSingle();
        if (tpl) { subject = tpl.subject || subject; body = tpl.body || body; }
      }
      subject = renderTemplate(subject, contact);
      body = renderTemplate(body, contact);
      if (contact?.email) {
        await sendEmail(contact.email, subject, body);
        try {
          await supabase.from("notifications_log").insert({
            contact_id: contact.id, channel: "email", subject, body, status: "sent",
          });
        } catch (_) { /* table may not exist */ }
      }
      return { advance: true };
    }
    case "send_whatsapp": {
      let body = config.body || config.message || "";
      if (config.template_id) {
        const { data: tpl } = await supabase.from("message_templates").select("*").eq("id", config.template_id).maybeSingle();
        if (tpl) body = tpl.body || body;
      }
      body = renderTemplate(body, contact);
      if (contact?.phone || contact?.whatsapp) {
        await sendWhatsapp(contact.whatsapp || contact.phone, body);
        try {
          await supabase.from("notifications_log").insert({
            contact_id: contact.id, channel: "whatsapp", body, status: "sent",
          });
        } catch (_) { /* skip */ }
      }
      return { advance: true };
    }
    case "create_task": {
      await supabase.from("events").insert({
        org_id: run.org_id || workflow.org_id,
        event_type: "task",
        contact_id: run.contact_id,
        title: renderTemplate(config.title || "Tarea automatizada", contact),
        description: renderTemplate(config.description || "", contact),
        event_date: new Date().toISOString().slice(0, 10),
        assigned_to: config.assigned_to || contact?.assigned_to || null,
        priority: config.priority || "normal",
      });
      return { advance: true };
    }
    case "change_status": {
      await supabase.from("contacts").update({ status: config.new_status }).eq("id", run.contact_id);
      return { advance: true };
    }
    case "add_tag": {
      const orgId = workflow.org_id;
      const tagId = await getOrCreateTag(orgId, config.tag_name);
      if (tagId) {
        try {
          await supabase.from("contact_tags").insert({ contact_id: run.contact_id, tag_id: tagId });
        } catch (_) { /* unique violation ok */ }
      }
      return { advance: true };
    }
    case "assign_to": {
      await supabase.from("contacts").update({ assigned_to: config.user_id }).eq("id", run.contact_id);
      return { advance: true };
    }
    case "ai_score": {
      await scoreContact(run.contact_id);
      return { advance: true };
    }
    case "ai_message": {
      if (!workflow.ai_agent_id) return { advance: true };
      const { data: agent } = await supabase.from("ai_agents").select("*").eq("id", workflow.ai_agent_id).single();
      if (!agent) return { advance: true };
      // Generate first message
      const sys = (agent.system_prompt || "") + `\n\nCONTEXTO LEAD: ${JSON.stringify({
        first_name: contact?.first_name, last_name: contact?.last_name, company: contact?.company,
        notes: contact?.notes, ai_tier: contact?.ai_tier,
      })}`;
      const openingPrompt = config.opening_prompt ||
        `Redacta el primer mensaje de contacto con este lead. Sé cercano, concreto y útil. Preséntate, muestra que entiendes su situación con la información disponible, haz 1 pregunta cualificadora. NO uses plantillas genéricas. Responde SOLO con el cuerpo del mensaje (sin asunto, sin saludos tipo "Hola, soy [nombre]:" previos, sin meta-comentarios). Entre 60 y 120 palabras.`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 800,
          system: sys,
          messages: [{ role: "user", content: openingPrompt }],
        }),
      });
      const data = await res.json();
      console.log("Claude ai_message response:", JSON.stringify(data).slice(0, 500));
      let text = data.content?.map((b: any) => b.text || "").join("").trim() || "";
      if (!text || text.length < 10) {
        console.error("Empty Claude reply, using fallback");
        text = `Hola ${contact?.first_name || ""},\n\nSoy ${agent.name || "Carlota"} del despacho. Vi que te interesa resolver tu situación de deuda y quería ponerme en contacto contigo para entender mejor tu caso y ver cómo podemos ayudarte con la Ley de Segunda Oportunidad.\n\n¿Podrías contarme brevemente cuál es tu situación actual (importe aproximado de deuda y si estás trabajando)?\n\nUn saludo,\n${agent.name || "Carlota"}`;
      }
      const channel = config.channel || (agent.channels && agent.channels[0]) || "email";
      // Create conversation
      const { data: conv, error: convErr } = await supabase.from("ai_conversations").insert({
        org_id: workflow.org_id,
        agent_id: agent.id,
        contact_id: run.contact_id,
        channel,
        status: "active",
        message_count: 1,
        last_message_at: new Date().toISOString(),
      }).select("id").single();
      if (convErr) console.error("ai_conversations insert error:", convErr);
      if (conv) {
        const { error: msgErr } = await supabase.from("ai_messages").insert({
          conversation_id: conv.id, role: "agent", content: text, channel,
        });
        if (msgErr) console.error("ai_messages insert error:", msgErr);
      }
      // Send
      if (channel === "email" && contact?.email) {
        const subject = config.subject || `${agent.name || "Carlota"} · ${contact.first_name || "Hola"}`;
        const html = text.replace(/\n/g, "<br>");
        const emailRes = await sendEmail(contact.email, subject, html);
        console.log("Email result:", JSON.stringify(emailRes));
      } else if (channel === "whatsapp" && (contact?.phone || contact?.whatsapp)) {
        await sendWhatsapp(contact.whatsapp || contact.phone, text);
      } else {
        console.error("No channel match or missing contact info", { channel, email: contact?.email, phone: contact?.phone });
      }
      return { advance: true };
    }
    case "ai_analyze_reply": {
      // Find the latest conversation for this contact + workflow's agent
      const { data: conv } = await supabase.from("ai_conversations")
        .select("id")
        .eq("contact_id", run.contact_id)
        .eq("agent_id", workflow.ai_agent_id)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let branch: string | null = null;
      if (conv) {
        const { data: msgs } = await supabase.from("ai_messages")
          .select("role, content")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(5);
        const lastLeadMsg = (msgs || []).find((m: any) => m.role === "lead");
        if (lastLeadMsg) {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 150,
              messages: [{ role: "user", content: `Clasifica este mensaje. Responde SOLO JSON: {"sentiment":"positive|neutral|negative","intent":"interested|objection|question|no_response|unsubscribe"}\n\nMensaje: ${lastLeadMsg.content}` }],
            }),
          });
          const data = await res.json();
          const text = data.content?.map((b: any) => b.text || "").join("") || "{}";
          const m = text.match(/\{[\s\S]*\}/);
          const parsed = m ? JSON.parse(m[0]) : {};
          branch = parsed.intent || "no_response";
        } else {
          branch = "no_response";
        }
      } else {
        branch = "no_response";
      }
      // Branch to condition.if_reply_<branch> step if config provides mapping
      const mapping = config[`if_reply_${branch}`];
      if (mapping?.go_to_step != null) {
        await supabase.from("automation_runs").update({
          current_step: mapping.go_to_step,
          next_run_at: new Date().toISOString(),
        }).eq("id", run.id);
        return { advance: false };
      }
      return { advance: true };
    }
    case "notify_team": {
      const orgId = workflow.org_id;
      const { data: users } = await supabase.from("users")
        .select("id")
        .eq("org_id", orgId)
        .in("role", ["owner", "admin", "lawyer"]);
      for (const u of users || []) {
        await supabase.from("notifications_inbox").insert({
          org_id: orgId,
          user_id: u.id,
          title: renderTemplate(config.title || "Notificación del workflow", contact),
          body: renderTemplate(config.body || "", contact),
          type: "automation",
          icon: "zap",
          link: `/?page=crm&contact=${run.contact_id}`,
          metadata: { workflow_id: workflow.id, run_id: run.id, contact_id: run.contact_id },
        });
      }
      return { advance: true };
    }
    case "end": {
      await supabase.from("automation_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
      return { advance: false };
    }
    default:
      return { advance: true };
  }
}

async function processRun(run: any) {
  const { data: workflow } = await supabase.from("automation_workflows").select("*").eq("id", run.workflow_id).single();
  if (!workflow) throw new Error("workflow not found");
  const { data: step } = await supabase.from("automation_steps")
    .select("*")
    .eq("workflow_id", run.workflow_id)
    .eq("step_order", run.current_step)
    .maybeSingle();
  if (!step) {
    // No more steps -> complete
    await supabase.from("automation_runs").update({
      status: "completed", completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    return;
  }

  const result = await executeStep(run, step, workflow);

  if (!result.advance) return; // branched or ended already

  // Determine next step
  const nextOrder = run.current_step + 1;
  const { data: nextStep } = await supabase.from("automation_steps")
    .select("*")
    .eq("workflow_id", run.workflow_id)
    .eq("step_order", nextOrder)
    .maybeSingle();
  if (!nextStep) {
    await supabase.from("automation_runs").update({
      status: "completed", completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    return;
  }
  const delayMin = result.nextDelayMin ?? (nextStep.delay_minutes || 0);
  const nextRunAt = new Date(Date.now() + delayMin * 60 * 1000).toISOString();
  await supabase.from("automation_runs").update({
    current_step: nextOrder,
    next_run_at: nextRunAt,
    last_action_at: new Date().toISOString(),
  }).eq("id", run.id);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Try to read body for POST trigger mode
    let body: any = null;
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = null; }
    }

    // TRIGGER MODE
    if (body && body.trigger_type && body.contact_id) {
      const { data: contact } = await supabase.from("contacts").select("*").eq("id", body.contact_id).single();
      if (!contact) throw new Error("contact not found");
      const { data: workflows } = await supabase.from("automation_workflows")
        .select("*")
        .eq("is_active", true)
        .eq("trigger_type", body.trigger_type);
      let started = 0;
      for (const wf of workflows || []) {
        // Optional: filter by trigger_config match (best-effort)
        const tc = wf.trigger_config || {};
        let matches = true;
        for (const [k, v] of Object.entries(tc)) {
          if (v !== undefined && v !== null && v !== "" && contact[k] !== v) { matches = false; break; }
        }
        if (!matches) continue;
        // Load first step
        const { data: firstStep } = await supabase.from("automation_steps")
          .select("*")
          .eq("workflow_id", wf.id)
          .order("step_order", { ascending: true })
          .limit(1)
          .maybeSingle();
        const delayMin = firstStep?.delay_minutes || 0;
        await supabase.from("automation_runs").insert({
          org_id: wf.org_id,
          workflow_id: wf.id,
          contact_id: body.contact_id,
          status: "running",
          current_step: firstStep?.step_order ?? 1,
          next_run_at: new Date(Date.now() + delayMin * 60 * 1000).toISOString(),
          started_at: new Date().toISOString(),
        });
        started++;
      }
      return new Response(JSON.stringify({ success: true, started }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRON MODE
    const { data: runs } = await supabase.from("automation_runs")
      .select("*")
      .eq("status", "running")
      .lte("next_run_at", new Date().toISOString())
      .limit(50);

    let processed = 0, succeeded = 0, failed = 0;
    for (const run of runs || []) {
      processed++;
      try {
        await processRun(run);
        succeeded++;
      } catch (e: any) {
        failed++;
        await supabase.from("automation_runs").update({
          status: "failed", last_error: e.message || String(e),
        }).eq("id", run.id);
      }
    }

    return new Response(JSON.stringify({ success: true, processed, succeeded, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("automation-runner error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
