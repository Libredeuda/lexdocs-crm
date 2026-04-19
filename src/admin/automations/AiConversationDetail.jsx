import { useState, useEffect, useRef } from "react";
import { X, Bot, User, Hand, Pause } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";

const SENTIMENT_COLORS = {
  positive: C.green,
  negative: C.red,
  neutral: C.textMuted,
  objection: C.orange,
};

export default function AiConversationDetail({ conversation, onClose, onUpdated }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { loadMessages(); }, [conversation?.id]);

  async function loadMessages() {
    setLoading(true);
    const { data } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("sent_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function handleHandoff() {
    setActing(true);
    await supabase.from("ai_conversations").update({
      status: "handoff", handoff_reason: "manual", handoff_to: null,
    }).eq("id", conversation.id);
    setActing(false);
    onUpdated();
  }

  async function handlePause() {
    setActing(true);
    await supabase.from("ai_conversations").update({ status: "paused" }).eq("id", conversation.id);
    setActing(false);
    onUpdated();
  }

  const contactName = conversation.contact
    ? `${conversation.contact.first_name} ${conversation.contact.last_name || ""}`
    : "Sin contacto";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000,
      display: "flex", justifyContent: "flex-end",
    }}>
      <div style={{
        background: C.white, width: "100%", maxWidth: 560, height: "100%",
        display: "flex", flexDirection: "column", fontFamily: font,
        boxShadow: "-12px 0 40px rgba(0,0,0,.15)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>{contactName}</h2>
            <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
              Agente: {conversation.agent?.name || "-"} · {conversation.channel} · {messages.length} mensajes
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: C.bg }}>
          {loading ? (
            <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 20 }}>Cargando...</p>
          ) : messages.length === 0 ? (
            <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 20 }}>Sin mensajes</p>
          ) : (
            messages.map(m => {
              const isAgent = m.role === "assistant" || m.role === "agent" || m.role === "ai";
              return (
                <div key={m.id} style={{
                  display: "flex", marginBottom: 12,
                  justifyContent: isAgent ? "flex-start" : "flex-end",
                }}>
                  <div style={{
                    maxWidth: "78%", display: "flex", flexDirection: "column",
                    alignItems: isAgent ? "flex-start" : "flex-end",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      {isAgent ? <Bot size={11} color={C.primary} /> : <User size={11} color={C.textMuted} />}
                      <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>
                        {isAgent ? "Agente IA" : "Lead"}
                      </span>
                    </div>
                    <div style={{
                      padding: "10px 14px", borderRadius: 12,
                      background: isAgent ? `linear-gradient(135deg, ${C.primary}, ${C.violet})` : C.white,
                      color: isAgent ? "#fff" : C.text,
                      fontSize: 13, lineHeight: 1.5,
                      border: isAgent ? "none" : `1px solid ${C.border}`,
                      whiteSpace: "pre-wrap",
                    }}>
                      {m.content}
                    </div>
                    {!isAgent && (m.sentiment || m.intent) && (
                      <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                        {m.sentiment && (
                          <span style={{
                            padding: "2px 8px", borderRadius: 5, fontSize: 9.5, fontWeight: 600,
                            background: `${SENTIMENT_COLORS[m.sentiment] || C.textMuted}18`,
                            color: SENTIMENT_COLORS[m.sentiment] || C.textMuted,
                          }}>{m.sentiment}</span>
                        )}
                        {m.intent && (
                          <span style={{
                            padding: "2px 8px", borderRadius: 5, fontSize: 9.5, fontWeight: 600,
                            background: `${C.violet}18`, color: C.violet,
                          }}>{m.intent}</span>
                        )}
                      </div>
                    )}
                    <span style={{ fontSize: 9.5, color: C.textMuted, marginTop: 4 }}>
                      {new Date(m.sent_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Actions */}
        <div style={{
          padding: "14px 20px", borderTop: `1px solid ${C.border}`,
          display: "flex", gap: 8,
        }}>
          <button onClick={handleHandoff} disabled={acting || conversation.status === "handoff"} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 14px", borderRadius: 10, border: "none",
            background: conversation.status === "handoff" ? C.bg : `linear-gradient(135deg, ${C.orange}, ${C.red})`,
            color: conversation.status === "handoff" ? C.textMuted : "#fff",
            fontSize: 12.5, fontWeight: 600, cursor: acting || conversation.status === "handoff" ? "default" : "pointer", fontFamily: font,
            opacity: acting ? 0.7 : 1,
          }}>
            <Hand size={13} /> Tomar el control
          </button>
          <button onClick={handlePause} disabled={acting || conversation.status === "paused"} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.white, color: C.text, fontSize: 12.5, fontWeight: 500,
            cursor: acting || conversation.status === "paused" ? "default" : "pointer", fontFamily: font,
          }}>
            <Pause size={13} /> Pausar agente
          </button>
        </div>
      </div>
    </div>
  );
}
