import { useState, useEffect, useRef } from "react";
import { Send, Scale, User, Briefcase } from "lucide-react";
import { C, font } from "../constants";
import { supabase } from "../lib/supabase";

export default function Messages({ user, firstName }) {
  const [messages, setMessages] = useState([]);
  const [recipients, setRecipients] = useState([]); // [{id, full_name, role, professional_title}]
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [caseInfo, setCaseInfo] = useState(null);
  const [contactId, setContactId] = useState(null);
  const endRef = useRef(null);

  // Cargar caso del cliente + abogado/procurador asignados
  useEffect(() => {
    async function loadCaseAndRecipients() {
      setLoading(true);
      try {
        // Buscar el contact asociado al cliente (por email)
        let { data: contact } = await supabase
          .from("contacts")
          .select("id, first_name, last_name, email")
          .eq("email", user.email || "")
          .limit(1)
          .single();

        if (!contact && user.org_id) {
          // Fallback: coger el primer contacto tipo "client" de la org
          const { data } = await supabase
            .from("contacts")
            .select("id, first_name, last_name, email")
            .eq("org_id", user.org_id)
            .eq("status", "client")
            .limit(1)
            .single();
          contact = data;
        }
        if (contact) setContactId(contact.id);

        // Caso asociado
        let caseRow = null;
        if (contact?.id) {
          const { data } = await supabase
            .from("cases")
            .select("id, case_number, case_type, assigned_lawyer_id, assigned_procurador_id, lawyer:users!cases_assigned_lawyer_id_fkey(id, full_name, role, professional_title), procurador:users!cases_assigned_procurador_id_fkey(id, full_name, role, professional_title)")
            .eq("contact_id", contact.id)
            .limit(1)
            .single();
          caseRow = data;
        }
        setCaseInfo(caseRow);

        const recs = [];
        if (caseRow?.lawyer) recs.push(caseRow.lawyer);
        if (caseRow?.procurador) recs.push(caseRow.procurador);
        setRecipients(recs);
        if (recs.length > 0 && !selectedRecipientId) {
          setSelectedRecipientId(recs[0].id);
        }

        // Cargar mensajes de este contact
        if (contact?.id) {
          const { data: msgs } = await supabase
            .from("messages")
            .select("*, from_user:users!messages_from_user_id_fkey(full_name), to_user:users!messages_to_user_id_fkey(full_name)")
            .eq("contact_id", contact.id)
            .order("created_at", { ascending: true });
          setMessages(msgs || []);
        }
      } catch (e) {
        console.error("Error cargando mensajes:", e);
      } finally {
        setLoading(false);
      }
    }
    loadCaseAndRecipients();
  }, [user?.email, user?.org_id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !selectedRecipientId || !contactId || sending) return;
    setSending(true);
    const tempMsg = {
      id: `tmp-${Date.now()}`,
      content: text,
      from_contact_id: contactId,
      to_user_id: selectedRecipientId,
      created_at: new Date().toISOString(),
      _pending: true,
    };
    setMessages(p => [...p, tempMsg]);
    setInput("");

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          org_id: user.org_id || caseInfo?.org_id,
          case_id: caseInfo?.id || null,
          contact_id: contactId,
          from_contact_id: contactId,
          to_user_id: selectedRecipientId,
          content: text,
        })
        .select()
        .single();
      if (error) throw error;

      // Reemplazar el temporal por el real
      setMessages(p => p.map(m => m.id === tempMsg.id ? data : m));

      // Notificar al destinatario por email/WhatsApp
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          type: "message",
          recipientUserIds: [selectedRecipientId],
          caseId: caseInfo?.id,
          messageContent: text,
        }),
      }).catch(() => {});

      setToast("Mensaje enviado. Tu abogado recibirá una notificación.");
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      console.error("Error enviando mensaje:", e);
      setMessages(p => p.filter(m => m.id !== tempMsg.id));
      setToast("Error al enviar. Inténtalo de nuevo.");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSending(false);
    }
  }

  const selectedRec = recipients.find(r => r.id === selectedRecipientId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: "0 8px 30px rgba(0,0,0,.2)", maxWidth: "90%", textAlign: "center" }}>{toast}</div>}

      {/* Header con destinatario */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Scale size={18} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Mensaje a tu equipo legal</h3>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
            Tu mensaje llega al instante por email. Sin números de teléfono: todo queda registrado aquí.
          </p>
        </div>
        {recipients.length > 1 && (
          <select
            value={selectedRecipientId}
            onChange={e => setSelectedRecipientId(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12, fontFamily: font, background: C.card, color: C.text, cursor: "pointer" }}
          >
            {recipients.map(r => (
              <option key={r.id} value={r.id}>{r.professional_title || r.role}: {r.full_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Lista de mensajes */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px", background: C.bg }}>
        {loading && <p style={{ textAlign: "center", color: C.textMuted, fontSize: 12 }}>Cargando...</p>}

        {!loading && recipients.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: C.textMuted }}>
            <Briefcase size={32} style={{ opacity: 0.4, marginBottom: 10 }} />
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Aún no tienes un abogado asignado</p>
            <p style={{ fontSize: 11.5, marginTop: 5 }}>En cuanto se te asigne, podrás comunicarte desde aquí.</p>
          </div>
        )}

        {!loading && recipients.length > 0 && messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: C.textMuted }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Inicia la conversación con tu {selectedRec?.professional_title || "abogado"}</p>
            <p style={{ fontSize: 11.5, marginTop: 6 }}>Puedes preguntarle cualquier duda sobre tu expediente.</p>
          </div>
        )}

        {messages.map((m, i) => {
          const isFromClient = !!m.from_contact_id;
          return (
            <div key={m.id || i} style={{ display: "flex", justifyContent: isFromClient ? "flex-end" : "flex-start", marginBottom: 10 }}>
              <div style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: isFromClient ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: isFromClient ? `linear-gradient(135deg, ${C.primary}, ${C.violet})` : C.card,
                color: isFromClient ? "#fff" : C.text,
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                boxShadow: "0 1px 2px rgba(0,0,0,.04)",
                opacity: m._pending ? 0.6 : 1,
              }}>
                {!isFromClient && m.from_user?.full_name && (
                  <p style={{ fontSize: 10, fontWeight: 600, color: C.primary, marginBottom: 4 }}>
                    {m.from_user.full_name}
                  </p>
                )}
                {m.content}
                <p style={{ fontSize: 9.5, marginTop: 4, opacity: 0.7, textAlign: "right" }}>
                  {new Date(m.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  {m._pending && " · enviando..."}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      {recipients.length > 0 && (
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ display: "flex", gap: 7, alignItems: "flex-end", background: C.white, borderRadius: 10, padding: "6px 10px", border: `1.5px solid ${C.border}` }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Escribe a ${selectedRec?.full_name || "tu abogado"}...`}
              rows={1}
              style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: 13, fontFamily: font, background: "transparent", padding: "4px 0", maxHeight: 120, lineHeight: 1.5, color: C.text }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: input.trim() ? `linear-gradient(135deg, ${C.primary}, ${C.violet})` : C.bg,
                color: input.trim() ? "#fff" : C.textMuted,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", cursor: input.trim() ? "pointer" : "default",
              }}
            >
              <Send size={14} />
            </button>
          </div>
          <p style={{ fontSize: 10, color: C.textMuted, marginTop: 6, textAlign: "center" }}>
            🔒 Comunicación segura · Tu abogado recibe un email al momento.
          </p>
        </div>
      )}
    </div>
  );
}
