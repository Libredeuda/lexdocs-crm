import { useState, useEffect } from "react";
import { X, Plus, Trash2, ArrowUp, ArrowDown, Clock, Mail, MessageSquare, CheckSquare, RefreshCw, Tag, Sparkles, Bot, GitBranch, UserPlus, Bell, StopCircle } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";

const TRIGGER_TYPES = [
  { value: "contact_created", label: "Contacto creado" },
  { value: "status_changed", label: "Cambio de estado" },
  { value: "tag_added", label: "Etiqueta añadida" },
  { value: "stage_entered", label: "Entrada a fase" },
  { value: "manual", label: "Manual" },
  { value: "inactivity", label: "Inactividad" },
];

const ACTION_TYPES = [
  { value: "wait", label: "Esperar", icon: Clock, color: C.textMuted },
  { value: "send_email", label: "Enviar email", icon: Mail, color: C.blue },
  { value: "send_whatsapp", label: "Enviar WhatsApp", icon: MessageSquare, color: C.green },
  { value: "create_task", label: "Crear tarea", icon: CheckSquare, color: C.primary },
  { value: "change_status", label: "Cambiar estado", icon: RefreshCw, color: C.orange },
  { value: "add_tag", label: "Añadir etiqueta", icon: Tag, color: C.violet },
  { value: "ai_score", label: "IA: Scoring", icon: Sparkles, color: C.violet },
  { value: "ai_message", label: "IA: Enviar mensaje", icon: Bot, color: C.violet },
  { value: "ai_analyze_reply", label: "IA: Analizar respuesta", icon: GitBranch, color: C.violet },
  { value: "assign_to", label: "Asignar a", icon: UserPlus, color: C.blue },
  { value: "notify_team", label: "Notificar equipo", icon: Bell, color: C.orange },
  { value: "end", label: "Fin", icon: StopCircle, color: C.red },
];

const STATUS_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Cualificado" },
  { value: "client", label: "Cliente" },
  { value: "lost", label: "Perdido" },
];

const SOURCE_OPTIONS = [
  { value: "website", label: "Web" },
  { value: "referral", label: "Referido" },
  { value: "ads", label: "Anuncios" },
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "api", label: "API" },
];

const DELAY_PRESETS = [
  { label: "5 min", value: 5 },
  { label: "1 hora", value: 60 },
  { label: "1 día", value: 1440 },
  { label: "3 días", value: 4320 },
  { label: "1 semana", value: 10080 },
];

export default function WorkflowBuilder({ user, workflow, onClose, onSaved }) {
  const [name, setName] = useState(workflow?.name || "");
  const [description, setDescription] = useState(workflow?.description || "");
  const [triggerType, setTriggerType] = useState(workflow?.trigger_type || "contact_created");
  const [triggerConfig, setTriggerConfig] = useState(workflow?.trigger_config || {});
  const [aiAgentId, setAiAgentId] = useState(workflow?.ai_agent_id || "");
  const [isActive, setIsActive] = useState(workflow?.is_active ?? true);
  const [steps, setSteps] = useState([]);
  const [agents, setAgents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [team, setTeam] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase.from("ai_agents").select("id, name");
      setAgents(a || []);
      const { data: t } = await supabase.from("message_templates").select("id, name, channel");
      setTemplates(t || []);
      const { data: u } = await supabase.from("users").select("id, full_name");
      setTeam(u || []);

      if (workflow?.id) {
        const { data: s } = await supabase
          .from("automation_steps").select("*")
          .eq("workflow_id", workflow.id).order("step_order");
        setSteps((s || []).map(x => ({ ...x, _tempId: x.id })));
      }
    })();
  }, [workflow?.id]);

  function addStep() {
    setSteps(prev => [...prev, {
      _tempId: `new-${Date.now()}-${Math.random()}`,
      action_type: "wait",
      action_config: {},
      delay_minutes: 0,
      condition: null,
    }]);
  }

  function updateStep(idx, patch) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  function updateStepConfig(idx, patch) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, action_config: { ...(s.action_config || {}), ...patch } } : s));
  }

  function removeStep(idx) {
    setSteps(prev => prev.filter((_, i) => i !== idx));
  }

  function moveStep(idx, dir) {
    setSteps(prev => {
      const arr = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  }

  async function handleSave() {
    if (!name.trim()) { alert("Introduce un nombre"); return; }
    setSaving(true);
    try {
      const payload = {
        org_id: user?.org_id,
        name: name.trim(),
        description: description.trim() || null,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        ai_agent_id: aiAgentId || null,
        is_active: isActive,
      };

      let workflowId = workflow?.id;
      if (workflow?.id) {
        await supabase.from("automation_workflows").update(payload).eq("id", workflow.id);
        await supabase.from("automation_steps").delete().eq("workflow_id", workflow.id);
      } else {
        const { data, error } = await supabase.from("automation_workflows").insert(payload).select().single();
        if (error) throw error;
        workflowId = data.id;
      }

      if (steps.length > 0) {
        const stepsPayload = steps.map((s, i) => ({
          workflow_id: workflowId,
          step_order: i,
          action_type: s.action_type,
          action_config: s.action_config || {},
          delay_minutes: s.delay_minutes || 0,
          condition: s.condition || null,
        }));
        const { error: e2 } = await supabase.from("automation_steps").insert(stepsPayload);
        if (e2) throw e2;
      }

      onSaved();
    } catch (err) {
      console.error(err);
      alert("Error al guardar: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`,
    fontSize: 13, fontFamily: font, background: C.white, outline: "none", color: C.text,
  };

  const labelStyle = { fontSize: 10.5, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600, display: "block" };

  function renderStepConfig(step, idx) {
    const cfg = step.action_config || {};
    switch (step.action_type) {
      case "wait":
        return (
          <div>
            <label style={labelStyle}>Retraso (minutos)</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {DELAY_PRESETS.map(p => (
                <button key={p.value} type="button" onClick={() => updateStep(idx, { delay_minutes: p.value })} style={{
                  padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
                  background: step.delay_minutes === p.value ? C.primary : C.white,
                  color: step.delay_minutes === p.value ? "#fff" : C.text,
                  fontSize: 11, cursor: "pointer", fontFamily: font,
                }}>{p.label}</button>
              ))}
            </div>
            <input type="number" value={step.delay_minutes || 0} onChange={e => updateStep(idx, { delay_minutes: parseInt(e.target.value) || 0 })} style={inputStyle} />
          </div>
        );
      case "send_email":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={labelStyle}>Plantilla (opcional)</label>
              <select value={cfg.template_id || ""} onChange={e => updateStepConfig(idx, { template_id: e.target.value || null })} style={inputStyle}>
                <option value="">-- Sin plantilla --</option>
                {templates.filter(t => t.channel === "email").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Asunto</label>
              <input value={cfg.subject || ""} onChange={e => updateStepConfig(idx, { subject: e.target.value })} style={inputStyle} placeholder="Hola {{first_name}}..." />
            </div>
            <div>
              <label style={labelStyle}>Cuerpo</label>
              <textarea value={cfg.body || ""} onChange={e => updateStepConfig(idx, { body: e.target.value })} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: font }} placeholder="Variables: {{first_name}}, {{last_name}}, {{company}}" />
            </div>
          </div>
        );
      case "send_whatsapp":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={labelStyle}>Plantilla (opcional)</label>
              <select value={cfg.template_id || ""} onChange={e => updateStepConfig(idx, { template_id: e.target.value || null })} style={inputStyle}>
                <option value="">-- Sin plantilla --</option>
                {templates.filter(t => t.channel === "whatsapp").map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Mensaje</label>
              <textarea value={cfg.body || ""} onChange={e => updateStepConfig(idx, { body: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: font }} placeholder="Hola {{first_name}}! Tenemos novedades..." />
            </div>
          </div>
        );
      case "create_task":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={labelStyle}>Título</label>
              <input value={cfg.title || ""} onChange={e => updateStepConfig(idx, { title: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Descripción</label>
              <textarea value={cfg.description || ""} onChange={e => updateStepConfig(idx, { description: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: font }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Asignar a</label>
                <select value={cfg.assigned_to || ""} onChange={e => updateStepConfig(idx, { assigned_to: e.target.value || null })} style={inputStyle}>
                  <option value="">-- Automático --</option>
                  {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Vencimiento (días)</label>
                <input type="number" value={cfg.due_in_days || ""} onChange={e => updateStepConfig(idx, { due_in_days: parseInt(e.target.value) || null })} style={inputStyle} />
              </div>
            </div>
          </div>
        );
      case "change_status":
        return (
          <div>
            <label style={labelStyle}>Nuevo estado</label>
            <select value={cfg.new_status || ""} onChange={e => updateStepConfig(idx, { new_status: e.target.value })} style={inputStyle}>
              <option value="">-- Selecciona --</option>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        );
      case "add_tag":
        return (
          <div>
            <label style={labelStyle}>Etiqueta</label>
            <input value={cfg.tag || ""} onChange={e => updateStepConfig(idx, { tag: e.target.value })} style={inputStyle} placeholder="nurturing, hot-lead..." />
          </div>
        );
      case "ai_score":
        return <p style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>Ejecuta el lead scorer. No requiere configuración.</p>;
      case "ai_message":
        return (
          <div>
            <label style={labelStyle}>Prompt override (opcional)</label>
            <textarea value={cfg.prompt_override || ""} onChange={e => updateStepConfig(idx, { prompt_override: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: font }} placeholder="Si vacío, usará el prompt del agente" />
            <label style={{ ...labelStyle, marginTop: 8 }}>Canal</label>
            <select value={cfg.channel || "whatsapp"} onChange={e => updateStepConfig(idx, { channel: e.target.value })} style={inputStyle}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </div>
        );
      case "ai_analyze_reply":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={labelStyle}>Si respuesta positiva → ir al paso</label>
              <input type="number" value={cfg.on_positive || ""} onChange={e => updateStepConfig(idx, { on_positive: parseInt(e.target.value) || null })} style={inputStyle} placeholder="Número de paso" />
            </div>
            <div>
              <label style={labelStyle}>Si objeción → ir al paso</label>
              <input type="number" value={cfg.on_objection || ""} onChange={e => updateStepConfig(idx, { on_objection: parseInt(e.target.value) || null })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Si negativa → ir al paso</label>
              <input type="number" value={cfg.on_negative || ""} onChange={e => updateStepConfig(idx, { on_negative: parseInt(e.target.value) || null })} style={inputStyle} />
            </div>
          </div>
        );
      case "assign_to":
        return (
          <div>
            <label style={labelStyle}>Usuario</label>
            <select value={cfg.user_id || ""} onChange={e => updateStepConfig(idx, { user_id: e.target.value })} style={inputStyle}>
              <option value="">-- Selecciona --</option>
              {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
        );
      case "notify_team":
        return (
          <div>
            <label style={labelStyle}>Mensaje</label>
            <textarea value={cfg.message || ""} onChange={e => updateStepConfig(idx, { message: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: font }} />
          </div>
        );
      case "end":
        return <p style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>Fin del workflow.</p>;
      default:
        return null;
    }
  }

  function renderTriggerConfig() {
    switch (triggerType) {
      case "status_changed":
        return (
          <div>
            <label style={labelStyle}>Nuevo estado que dispara el workflow</label>
            <select value={triggerConfig.new_status || ""} onChange={e => setTriggerConfig({ ...triggerConfig, new_status: e.target.value })} style={inputStyle}>
              <option value="">Cualquier cambio</option>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        );
      case "contact_created":
        return (
          <div>
            <label style={labelStyle}>Fuente (opcional)</label>
            <select value={triggerConfig.source || ""} onChange={e => setTriggerConfig({ ...triggerConfig, source: e.target.value })} style={inputStyle}>
              <option value="">Cualquier fuente</option>
              {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        );
      case "tag_added":
        return (
          <div>
            <label style={labelStyle}>Etiqueta</label>
            <input value={triggerConfig.tag || ""} onChange={e => setTriggerConfig({ ...triggerConfig, tag: e.target.value })} style={inputStyle} />
          </div>
        );
      case "stage_entered":
        return (
          <div>
            <label style={labelStyle}>Fase</label>
            <input value={triggerConfig.stage || ""} onChange={e => setTriggerConfig({ ...triggerConfig, stage: e.target.value })} style={inputStyle} />
          </div>
        );
      case "inactivity":
        return (
          <div>
            <label style={labelStyle}>Días de inactividad</label>
            <input type="number" value={triggerConfig.days || ""} onChange={e => setTriggerConfig({ ...triggerConfig, days: parseInt(e.target.value) || null })} style={inputStyle} />
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto",
    }}>
      <div style={{
        background: C.white, borderRadius: 14, width: "100%", maxWidth: 820, marginTop: 20, marginBottom: 40,
        fontFamily: font, boxShadow: "0 20px 60px rgba(0,0,0,.25)",
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>
            {workflow ? "Editar workflow" : "Nuevo workflow"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ej: Nurturing nuevos leads" />
            </div>
            <div>
              <label style={labelStyle}>Agente IA (opcional)</label>
              <select value={aiAgentId} onChange={e => setAiAgentId(e.target.value)} style={inputStyle}>
                <option value="">-- Sin agente --</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: font }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Disparador</label>
              <select value={triggerType} onChange={e => { setTriggerType(e.target.value); setTriggerConfig({}); }} style={inputStyle}>
                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>{renderTriggerConfig()}</div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.text, cursor: "pointer", marginBottom: 18 }}>
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            Activo
          </label>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Pasos ({steps.length})</h3>

            {steps.map((step, idx) => {
              const type = ACTION_TYPES.find(a => a.value === step.action_type) || ACTION_TYPES[0];
              const Icon = type.icon;
              return (
                <div key={step._tempId} style={{
                  background: C.bg, borderRadius: 10, padding: 14, marginBottom: 10,
                  borderLeft: `3px solid ${type.color}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, background: `${type.color}20`,
                      display: "flex", alignItems: "center", justifyContent: "center", color: type.color,
                    }}>
                      <Icon size={14} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted }}>PASO {idx + 1}</span>
                    <select value={step.action_type} onChange={e => updateStep(idx, { action_type: e.target.value, action_config: {} })} style={{ ...inputStyle, flex: 1, padding: "6px 10px", fontSize: 12 }}>
                      {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                    <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} style={{ padding: 5, background: "transparent", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? C.border : C.textMuted }}>
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} style={{ padding: 5, background: "transparent", border: "none", cursor: idx === steps.length - 1 ? "default" : "pointer", color: idx === steps.length - 1 ? C.border : C.textMuted }}>
                      <ArrowDown size={14} />
                    </button>
                    <button onClick={() => removeStep(idx)} style={{ padding: 5, background: "transparent", border: "none", cursor: "pointer", color: C.red }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {renderStepConfig(step, idx)}
                </div>
              );
            })}

            <button onClick={addStep} style={{
              width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px dashed ${C.border}`,
              background: C.bg, color: C.primary, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Plus size={14} /> Añadir paso
            </button>
          </div>
        </div>

        <div style={{
          padding: "14px 22px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.white, color: C.text, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: font,
          }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "9px 22px", borderRadius: 10, border: "none",
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff",
            fontSize: 12.5, fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: font,
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Guardando..." : "Guardar workflow"}
          </button>
        </div>
      </div>
    </div>
  );
}
