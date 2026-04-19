import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Bot, Mail, MessageSquare } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import AiAgentEditor from "./AiAgentEditor";

const ROLE_LABELS = {
  sales: "Ventas",
  qualifier: "Cualificador",
  support: "Soporte",
};
const ROLE_COLORS = {
  sales: C.primary,
  qualifier: C.violet,
  support: C.blue,
};

export default function AiAgentsList({ user }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);

  useEffect(() => { load(); }, [user?.org_id]);

  async function load() {
    setLoading(true);
    const q = supabase.from("ai_agents").select("*").order("created_at", { ascending: false });
    if (user?.org_id) q.eq("org_id", user.org_id);
    const { data } = await q;
    setAgents(data || []);
    setLoading(false);
  }

  async function toggleActive(a) {
    await supabase.from("ai_agents").update({ is_active: !a.is_active }).eq("id", a.id);
    load();
  }

  async function handleDelete(a) {
    if (!window.confirm(`¿Eliminar agente "${a.name}"?`)) return;
    await supabase.from("ai_agents").delete().eq("id", a.id);
    load();
  }

  return (
    <div>
      {editorOpen && (
        <AiAgentEditor
          user={user}
          agent={editingAgent}
          onClose={() => { setEditorOpen(false); setEditingAgent(null); }}
          onSaved={() => { setEditorOpen(false); setEditingAgent(null); load(); }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Agentes IA</h2>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{agents.length} agentes · {agents.filter(a => a.is_active).length} activos</p>
        </div>
        <button onClick={() => { setEditingAgent(null); setEditorOpen(true); }} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none",
          background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff",
          fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font,
        }}>
          <Plus size={14} /> Nuevo agente IA
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 30 }}>Cargando...</p>
      ) : agents.length === 0 ? (
        <div style={{ background: C.white, borderRadius: 14, border: `1px dashed ${C.border}`, padding: "48px 24px", textAlign: "center" }}>
          <Bot size={32} color={C.textMuted} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Aún no hay agentes IA</p>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Crea tu primer agente para automatizar conversaciones</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {agents.map(a => {
            const roleColor = ROLE_COLORS[a.role] || C.textMuted;
            return (
              <div key={a.id} style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10,
                    background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Bot size={20} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>{a.name}</h3>
                    {a.description && <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3, lineHeight: 1.4 }}>{a.description}</p>}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!a.is_active} onChange={() => toggleActive(a)} style={{ cursor: "pointer" }} />
                  </label>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  {a.role && (
                    <span style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 600,
                      background: `${roleColor}18`, color: roleColor,
                    }}>
                      {ROLE_LABELS[a.role] || a.role}
                    </span>
                  )}
                  {(a.channels || []).map(ch => (
                    <span key={ch} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 500,
                      background: C.bg, color: C.textMuted,
                    }}>
                      {ch === "email" ? <Mail size={10} /> : <MessageSquare size={10} />}
                      {ch}
                    </span>
                  ))}
                </div>

                {a.goal && (
                  <div style={{ marginTop: 12, padding: "8px 10px", background: C.bg, borderRadius: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3 }}>Objetivo</p>
                    <p style={{ fontSize: 11.5, color: C.text, margin: 0, lineHeight: 1.4 }}>{a.goal}</p>
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                  <button onClick={() => { setEditingAgent(a); setEditorOpen(true); }} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.white, color: C.text, fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: font,
                  }}>
                    <Edit3 size={12} /> Editar
                  </button>
                  <button onClick={() => handleDelete(a)} style={{
                    padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.white, color: C.red, cursor: "pointer", display: "flex", alignItems: "center",
                  }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
