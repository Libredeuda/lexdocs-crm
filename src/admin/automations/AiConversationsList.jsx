import { useState, useEffect } from "react";
import { MessageCircle, Mail, MessageSquare, Clock } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import AiConversationDetail from "./AiConversationDetail";

const STATUS_CONFIG = {
  active: { label: "Activa", color: C.green, bg: `${C.green}18` },
  handoff: { label: "Handoff", color: C.orange, bg: `${C.orange}18` },
  closed: { label: "Cerrada", color: C.textMuted, bg: C.bg },
  paused: { label: "Pausada", color: C.blue, bg: `${C.blue}18` },
};

export default function AiConversationsList({ user }) {
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => { load(); }, [user?.org_id]);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("ai_conversations")
      .select("*, contact:contacts(id, first_name, last_name, email), agent:ai_agents(id, name)")
      .order("last_message_at", { ascending: false, nullsLast: true });
    if (user?.org_id) q = q.eq("org_id", user.org_id);
    const { data } = await q;
    setConvs(data || []);
    setLoading(false);
  }

  const filtered = filterStatus === "all" ? convs : convs.filter(c => c.status === filterStatus);

  function formatDate(d) {
    if (!d) return "-";
    const dt = new Date(d);
    const now = new Date();
    const diff = (now - dt) / 1000;
    if (diff < 60) return "ahora";
    if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
    return dt.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  return (
    <div>
      {selected && (
        <AiConversationDetail
          conversation={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); load(); }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Conversaciones IA</h2>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{convs.length} conversaciones totales</p>
        </div>

        <div style={{ display: "flex", gap: 4, background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: 3 }}>
          {[
            { id: "all", label: "Todas" },
            { id: "active", label: "Activas" },
            { id: "handoff", label: "Handoff" },
            { id: "closed", label: "Cerradas" },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterStatus(f.id)} style={{
              padding: "6px 14px", borderRadius: 7, border: "none",
              background: filterStatus === f.id ? `${C.primary}14` : "transparent",
              color: filterStatus === f.id ? C.primary : C.textMuted,
              fontSize: 12, fontWeight: filterStatus === f.id ? 600 : 400, cursor: "pointer", fontFamily: font,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {loading ? (
          <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 30 }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <MessageCircle size={32} color={C.textMuted} style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13, color: C.textMuted }}>Sin conversaciones</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Lead", "Agente", "Canal", "Estado", "Mensajes", "Última actividad"].map(h => (
                  <th key={h} style={{
                    textAlign: "left", padding: "10px 16px", fontSize: 10.5,
                    color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.active;
                return (
                  <tr key={c.id} onClick={() => setSelected(c)} style={{
                    borderTop: `1px solid ${C.border}`, cursor: "pointer", transition: "background .15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = C.bg}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: C.text }}>
                      {c.contact ? `${c.contact.first_name} ${c.contact.last_name || ""}` : "Sin contacto"}
                      {c.contact?.email && <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{c.contact.email}</div>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12.5, color: C.text }}>{c.agent?.name || "-"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.textMuted }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {c.channel === "email" ? <Mail size={11} /> : <MessageSquare size={11} />}
                        {c.channel}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 600,
                        background: st.bg, color: st.color,
                      }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: C.text, fontWeight: 500 }}>{c.message_count || 0}</td>
                    <td style={{ padding: "12px 16px", fontSize: 11.5, color: C.textMuted }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} />
                        {formatDate(c.last_message_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
