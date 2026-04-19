import { useState } from "react";
import { X, Bot } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";

const DEFAULT_PROMPT = "Eres Carlota, agente de ventas de LibreApp Abogados. Tu objetivo es cualificar leads interesados en cancelar sus deudas mediante Ley de Segunda Oportunidad. Preguntas clave: importe adeudado, situación laboral, urgencia. NUNCA des asesoramiento legal concreto. Si el lead está cualificado (>5.000€ deuda, disposición a firmar) o pregunta algo legal específico → traspasar a letrado.";

export default function AiAgentEditor({ user, agent, onClose, onSaved }) {
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [role, setRole] = useState(agent?.role || "sales");
  const [tone, setTone] = useState(agent?.tone || "cercano");
  const [goal, setGoal] = useState(agent?.goal || "");
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || "");
  const [handoffConditions, setHandoffConditions] = useState(agent?.handoff_conditions || "");
  const [channels, setChannels] = useState(agent?.channels || ["whatsapp"]);
  const [maxMessages, setMaxMessages] = useState(agent?.max_messages || 10);
  const [isActive, setIsActive] = useState(agent?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  function toggleChannel(ch) {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  }

  async function handleSave() {
    if (!name.trim()) { alert("Introduce un nombre"); return; }
    setSaving(true);
    try {
      const payload = {
        org_id: user?.org_id,
        name: name.trim(),
        description: description.trim() || null,
        role, tone, goal: goal.trim() || null,
        system_prompt: systemPrompt.trim() || null,
        handoff_conditions: handoffConditions.trim() || null,
        channels, max_messages: maxMessages || 10,
        model: "claude-sonnet-4-5",
        is_active: isActive,
      };
      if (agent?.id) {
        await supabase.from("ai_agents").update(payload).eq("id", agent.id);
      } else {
        await supabase.from("ai_agents").insert(payload);
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

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000,
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto",
    }}>
      <div style={{
        background: C.white, borderRadius: 14, width: "100%", maxWidth: 720, marginTop: 20, marginBottom: 40,
        fontFamily: font, boxShadow: "0 20px 60px rgba(0,0,0,.25)",
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={16} color="#fff" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>
              {agent ? "Editar agente IA" : "Nuevo agente IA"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ej: Carlota" />
            </div>
            <div>
              <label style={labelStyle}>Rol</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
                <option value="sales">Ventas</option>
                <option value="qualifier">Cualificador</option>
                <option value="support">Soporte</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Descripción</label>
            <input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Tono</label>
              <select value={tone} onChange={e => setTone(e.target.value)} style={inputStyle}>
                <option value="profesional">Profesional</option>
                <option value="cercano">Cercano</option>
                <option value="directo">Directo</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Máx. mensajes antes de handoff</label>
              <input type="number" value={maxMessages} onChange={e => setMaxMessages(parseInt(e.target.value) || 10)} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Objetivo</label>
            <input value={goal} onChange={e => setGoal(e.target.value)} style={inputStyle} placeholder="Cualificar leads y agendar reunión con abogado" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={8}
              placeholder={DEFAULT_PROMPT}
              style={{ ...inputStyle, resize: "vertical", fontFamily: font, lineHeight: 1.5 }}
            />
            {!systemPrompt.trim() && (
              <button
                type="button"
                onClick={() => setSystemPrompt(DEFAULT_PROMPT)}
                style={{
                  marginTop: 6, padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.primary}40`,
                  background: `${C.primary}10`, color: C.primary, fontSize: 11, cursor: "pointer", fontFamily: font,
                }}
              >
                Usar plantilla sugerida
              </button>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Condiciones de handoff (cuándo traspasar a humano)</label>
            <textarea
              value={handoffConditions}
              onChange={e => setHandoffConditions(e.target.value)}
              rows={3}
              placeholder="- Lead pide hablar con abogado&#10;- Deuda >20.000€&#10;- Pregunta legal específica&#10;- Mensaje tras 10 intercambios sin avance"
              style={{ ...inputStyle, resize: "vertical", fontFamily: font, lineHeight: 1.5 }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Canales</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { id: "email", label: "Email" },
                { id: "whatsapp", label: "WhatsApp" },
              ].map(ch => (
                <label key={ch.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  border: `1.5px solid ${channels.includes(ch.id) ? C.primary : C.border}`,
                  background: channels.includes(ch.id) ? `${C.primary}10` : C.white,
                  color: channels.includes(ch.id) ? C.primary : C.text,
                  fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                }}>
                  <input type="checkbox" checked={channels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} />
                  {ch.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 4 }}>
            <div>
              <label style={labelStyle}>Modelo</label>
              <input value="claude-sonnet-4-5" readOnly style={{ ...inputStyle, background: C.bg, color: C.textMuted }} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.text, cursor: "pointer" }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                Agente activo
              </label>
            </div>
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
            {saving ? "Guardando..." : "Guardar agente"}
          </button>
        </div>
      </div>
    </div>
  );
}
