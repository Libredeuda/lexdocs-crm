import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, FileText, Mail, MessageSquare, X } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";

const VARIABLES_HINT = "Variables: {{first_name}} {{last_name}} {{company}} {{case_type}} {{assignee_name}}";

function TemplateModal({ user, template, onClose, onSaved }) {
  const [name, setName] = useState(template?.name || "");
  const [channel, setChannel] = useState(template?.channel || "email");
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !body.trim()) { alert("Rellena nombre y cuerpo"); return; }
    setSaving(true);
    try {
      const payload = {
        org_id: user?.org_id,
        name: name.trim(), channel,
        subject: channel === "email" ? (subject.trim() || null) : null,
        body: body.trim(),
      };
      if (template?.id) {
        await supabase.from("message_templates").update(payload).eq("id", template.id);
      } else {
        await supabase.from("message_templates").insert(payload);
      }
      onSaved();
    } catch (err) {
      alert("Error: " + (err.message || err));
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
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ background: C.white, borderRadius: 14, width: "100%", maxWidth: 600, fontFamily: font }}>
        <div style={{
          padding: "16px 22px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>
            {template ? "Editar plantilla" : "Nueva plantilla"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 22 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Canal</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { id: "email", label: "Email", icon: Mail },
                { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
              ].map(ch => (
                <label key={ch.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 8,
                  border: `1.5px solid ${channel === ch.id ? C.primary : C.border}`,
                  background: channel === ch.id ? `${C.primary}10` : C.white,
                  color: channel === ch.id ? C.primary : C.text,
                  fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                }}>
                  <input type="radio" name="channel" checked={channel === ch.id} onChange={() => setChannel(ch.id)} />
                  <ch.icon size={13} /> {ch.label}
                </label>
              ))}
            </div>
          </div>

          {channel === "email" && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Asunto</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} placeholder="Hola {{first_name}}..." />
            </div>
          )}

          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>Cuerpo</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} style={{ ...inputStyle, resize: "vertical", fontFamily: font, lineHeight: 1.5 }} />
            <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>{VARIABLES_HINT}</p>
          </div>
        </div>

        <div style={{
          padding: "14px 22px", borderTop: `1px solid ${C.border}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.white, color: C.text, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: font,
          }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "9px 22px", borderRadius: 10, border: "none",
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff",
            fontSize: 12.5, fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: font, opacity: saving ? 0.7 : 1,
          }}>{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesList({ user }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, [user?.org_id]);

  async function load() {
    setLoading(true);
    const q = supabase.from("message_templates").select("*").order("created_at", { ascending: false });
    if (user?.org_id) q.eq("org_id", user.org_id);
    const { data } = await q;
    setTemplates(data || []);
    setLoading(false);
  }

  async function handleDelete(t) {
    if (!window.confirm(`¿Eliminar plantilla "${t.name}"?`)) return;
    await supabase.from("message_templates").delete().eq("id", t.id);
    load();
  }

  return (
    <div>
      {modalOpen && (
        <TemplateModal
          user={user}
          template={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); load(); }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Plantillas de mensaje</h2>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{templates.length} plantillas</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none",
          background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff",
          fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font,
        }}>
          <Plus size={14} /> Nueva plantilla
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 30 }}>Cargando...</p>
      ) : templates.length === 0 ? (
        <div style={{ background: C.white, borderRadius: 14, border: `1px dashed ${C.border}`, padding: "48px 24px", textAlign: "center" }}>
          <FileText size={32} color={C.textMuted} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Aún no hay plantillas</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {templates.map(t => {
            const Icon = t.channel === "email" ? Mail : MessageSquare;
            const color = t.channel === "email" ? C.blue : C.green;
            return (
              <div key={t.id} style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, background: `${color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 13.5, fontWeight: 600, color: C.text, margin: 0 }}>{t.name}</h3>
                    <span style={{
                      display: "inline-block", marginTop: 4, padding: "2px 8px", borderRadius: 5,
                      fontSize: 10, fontWeight: 600, background: `${color}18`, color,
                    }}>{t.channel}</span>
                  </div>
                </div>
                {t.subject && (
                  <p style={{ fontSize: 11.5, color: C.text, fontWeight: 500, marginBottom: 6 }}>{t.subject}</p>
                )}
                <p style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.5, margin: 0 }}>
                  {(t.body || "").substring(0, 80)}{(t.body || "").length > 80 ? "..." : ""}
                </p>
                <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                  <button onClick={() => { setEditing(t); setModalOpen(true); }} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.white, color: C.text, fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: font,
                  }}>
                    <Edit3 size={12} /> Editar
                  </button>
                  <button onClick={() => handleDelete(t)} style={{
                    padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
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
