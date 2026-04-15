import { useState } from "react";
import {
  ArrowLeft, Mail, Phone, Building2, Edit3, PhoneCall, Send,
  UserCheck, Tag, Plus, Clock, FileText, MessageSquare, ChevronDown
} from "lucide-react";
import { C, font } from "../../constants";
import ContactForm from "./ContactForm";

const statusConfig = {
  lead: { label: 'Lead', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  contacted: { label: 'Contactado', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  qualified: { label: 'Cualificado', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  client: { label: 'Cliente', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  lost: { label: 'Perdido', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  archived: { label: 'Archivado', color: '#7A7A8A', bg: 'rgba(122,122,138,0.08)' },
};

const sourceLabels = {
  website: 'Web', referral: 'Referido', ads: 'Anuncios',
  manual: 'Manual', whatsapp: 'WhatsApp', api: 'API',
};

const MOCK_ACTIVITIES = [
  { id: 1, action: 'created', description: 'Contacto creado', performed_by: 'Sistema', created_at: '2026-04-10T10:00:00' },
  { id: 2, action: 'status_changed', description: 'Estado cambiado a Contactado', performed_by: 'Carlos Martinez', created_at: '2026-04-11T14:30:00' },
  { id: 3, action: 'note_added', description: 'Nota anadida: "Interesado en LSO"', performed_by: 'Carlos Martinez', created_at: '2026-04-12T09:15:00' },
];

const MOCK_TAGS = ["LSO", "Urgente"];

const TEAM = ["Carlos Martinez", "Ana Beltran", "Laura Garcia"];

export default function ContactDetail({ contact, setPage, setSelectedContact }) {
  const [data, setData] = useState({ ...contact });
  const [status, setStatus] = useState(contact.status);
  const [assignedTo, setAssignedTo] = useState(contact.assigned_to || "");
  const [tags, setTags] = useState(MOCK_TAGS);
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [notes, setNotes] = useState([
    { id: 1, text: "Interesado en procedimiento LSO. Tiene deudas con 3 entidades.", author: "Carlos Martinez", date: "2026-04-12" },
  ]);
  const [newNote, setNewNote] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [activities] = useState(MOCK_ACTIVITIES);
  const [hoveredBtn, setHoveredBtn] = useState(null);

  const st = statusConfig[status] || statusConfig.lead;

  function getInitials() {
    return (data.first_name[0] + (data.last_name[0] || "")).toUpperCase();
  }

  function handleBack() {
    setSelectedContact(null);
    setPage("contacts");
  }

  function handleAddNote() {
    if (!newNote.trim()) return;
    setNotes(prev => [{ id: Date.now(), text: newNote, author: "Admin", date: new Date().toISOString().slice(0, 10) }, ...prev]);
    setNewNote("");
  }

  function handleAddTag() {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    setTags(prev => [...prev, newTag.trim()]);
    setNewTag("");
    setShowTagInput(false);
  }

  function handleRemoveTag(t) {
    setTags(prev => prev.filter(x => x !== t));
  }

  function handleEditSave(updated) {
    setData(prev => ({ ...prev, ...updated }));
    setShowEditForm(false);
  }

  function formatDateTime(d) {
    const dt = new Date(d);
    return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) + " " +
      dt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  const actionIconColor = (key) => hoveredBtn === key ? C.primary : C.textMuted;

  // Card wrapper
  const Card = ({ title, icon: Icon, children, style: s }) => (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "20px 22px", ...s }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          {Icon && <Icon size={16} color={C.primary} />}
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>{title}</h3>
        </div>
      )}
      {children}
    </div>
  );

  return (
    <div>
      {showEditForm && (
        <ContactForm
          contact={data}
          onSave={handleEditSave}
          onClose={() => setShowEditForm(false)}
        />
      )}

      {/* Back */}
      <button
        onClick={handleBack}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
          color: C.primary, fontFamily: font, marginBottom: 18, padding: 0,
        }}
      >
        <ArrowLeft size={15} /> Volver a contactos
      </button>

      {/* Header */}
      <div style={{
        background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
        padding: "24px 28px", marginBottom: 18,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, color: "#fff", flexShrink: 0,
          }}>
            {getInitials()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
                {data.first_name} {data.last_name}
              </h2>
              <span style={{
                padding: "3px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: st.bg, color: st.color,
              }}>
                {st.label}
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.textMuted }}>
                <Mail size={13} /> {data.email}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.textMuted }}>
                <Phone size={13} /> {data.phone}
              </span>
              {data.company && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.textMuted }}>
                  <Building2 size={13} /> {data.company}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "edit", icon: Edit3, label: "Editar", onClick: () => setShowEditForm(true) },
            { key: "call", icon: PhoneCall, label: "Llamar", onClick: () => {} },
            { key: "email", icon: Send, label: "Email", onClick: () => {} },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={btn.onClick}
              onMouseEnter={() => setHoveredBtn(btn.key)}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8,
                border: `1px solid ${C.border}`, background: hoveredBtn === btn.key ? C.bg : C.card,
                cursor: "pointer", fontSize: 12, fontWeight: 500,
                color: C.text, fontFamily: font, transition: "all .15s",
              }}
            >
              <btn.icon size={14} color={actionIconColor(btn.key)} /> {btn.label}
            </button>
          ))}
          {status !== "client" && (
            <button
              onClick={() => setStatus("client")}
              onMouseEnter={() => setHoveredBtn("convert")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                color: "#fff", fontFamily: font,
                boxShadow: hoveredBtn === "convert" ? "0 4px 14px rgba(91,107,240,0.3)" : "none",
                transition: "all .15s",
              }}
            >
              <UserCheck size={14} /> Convertir a cliente
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 18, alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Info card */}
          <Card title="Informacion" icon={FileText}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Nombre", value: data.first_name },
                { label: "Apellidos", value: data.last_name },
                { label: "Email", value: data.email },
                { label: "Telefono", value: data.phone },
                { label: "Empresa", value: data.company || "-" },
                { label: "Fuente", value: sourceLabels[data.source] || data.source },
              ].map((f, i) => (
                <div key={i}>
                  <p style={{ fontSize: 10.5, color: C.textMuted, marginBottom: 3, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}>{f.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>{f.value}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 12, fontSize: 11, color: C.textMuted }}>
              <span>Creado: {new Date(data.created_at).toLocaleDateString("es-ES")}</span>
              <span>Actualizado: {new Date(data.updated_at).toLocaleDateString("es-ES")}</span>
            </div>
          </Card>

          {/* Notes card */}
          <Card title="Notas" icon={MessageSquare}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Anadir una nota..."
                rows={2}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10,
                  border: `1.5px solid ${C.border}`, fontSize: 13,
                  fontFamily: font, resize: "vertical", outline: "none",
                  background: C.bg,
                }}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                style={{
                  padding: "10px 18px", borderRadius: 10, border: "none",
                  background: newNote.trim() ? C.primary : C.border,
                  color: "#fff", fontSize: 12, fontWeight: 600,
                  cursor: newNote.trim() ? "pointer" : "default",
                  fontFamily: font, alignSelf: "flex-end",
                }}
              >
                Anadir
              </button>
            </div>
            {notes.map(n => (
              <div key={n.id} style={{
                padding: "12px 14px", background: C.bg, borderRadius: 10, marginBottom: 8,
              }}>
                <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>{n.text}</p>
                <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 6, margin: 0, marginTop: 6 }}>
                  {n.author} - {n.date}
                </p>
              </div>
            ))}
            {notes.length === 0 && (
              <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 16 }}>Sin notas</p>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Status card */}
          <Card title="Estado" icon={Tag}>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10.5, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}>Estado actual</p>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: `1.5px solid ${C.border}`, fontSize: 13,
                  fontFamily: font, background: C.card, color: C.text,
                  cursor: "pointer", outline: "none",
                }}
              >
                {Object.entries(statusConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <p style={{ fontSize: 10.5, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}>Asignado a</p>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: `1.5px solid ${C.border}`, fontSize: 13,
                  fontFamily: font, background: C.card, color: C.text,
                  cursor: "pointer", outline: "none",
                }}
              >
                <option value="">Sin asignar</option>
                {TEAM.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </Card>

          {/* Cases card */}
          <Card title="Casos vinculados" icon={FileText}>
            {status === "client" ? (
              <div style={{ padding: "10px 14px", background: C.bg, borderRadius: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.text, margin: 0 }}>EXP-2026-001</p>
                <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2, margin: 0, marginTop: 2 }}>LSO - En curso</p>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 16 }}>Sin casos vinculados</p>
            )}
          </Card>

          {/* Tags card */}
          <Card title="Etiquetas" icon={Tag}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tags.map(t => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                    background: "rgba(91,107,240,0.08)", color: C.primary,
                  }}
                >
                  {t}
                  <span
                    onClick={() => handleRemoveTag(t)}
                    style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, marginLeft: 2, color: C.textMuted }}
                  >
                    x
                  </span>
                </span>
              ))}
              {showTagInput ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddTag()}
                    placeholder="Etiqueta..."
                    autoFocus
                    style={{
                      padding: "4px 10px", borderRadius: 8, border: `1px solid ${C.border}`,
                      fontSize: 11, fontFamily: font, width: 100, outline: "none",
                    }}
                  />
                  <button
                    onClick={handleAddTag}
                    style={{
                      padding: "4px 10px", borderRadius: 8, border: "none",
                      background: C.primary, color: "#fff", fontSize: 11,
                      cursor: "pointer", fontFamily: font,
                    }}
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                    background: C.bg, color: C.textMuted, border: `1px dashed ${C.border}`,
                    cursor: "pointer", fontFamily: font,
                  }}
                >
                  <Plus size={11} /> Anadir
                </button>
              )}
            </div>
          </Card>

          {/* Timeline card */}
          <Card title="Actividad reciente" icon={Clock}>
            <div style={{ position: "relative" }}>
              {activities.map((a, i) => (
                <div key={a.id} style={{ display: "flex", gap: 12, marginBottom: i < activities.length - 1 ? 16 : 0, position: "relative" }}>
                  {/* Timeline line */}
                  {i < activities.length - 1 && (
                    <div style={{
                      position: "absolute", left: 7, top: 18, width: 2,
                      height: "calc(100% + 4px)", background: C.border,
                    }} />
                  )}
                  {/* Dot */}
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: a.action === "created" ? "rgba(34,197,94,0.15)" :
                      a.action === "status_changed" ? "rgba(245,158,11,0.15)" : "rgba(91,107,240,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: a.action === "created" ? C.green :
                        a.action === "status_changed" ? C.orange : C.primary,
                    }} />
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12.5, color: C.text, margin: 0, fontWeight: 500 }}>{a.description}</p>
                    <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3, margin: 0, marginTop: 3 }}>
                      {a.performed_by} - {formatDateTime(a.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
