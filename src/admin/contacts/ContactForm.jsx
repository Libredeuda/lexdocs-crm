import { useState } from "react";
import { X } from "lucide-react";
import { C, font } from "../../constants";

const sourceOptions = [
  { value: "website", label: "Web" },
  { value: "referral", label: "Referido" },
  { value: "ads", label: "Anuncios" },
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "api", label: "API" },
];

const statusOptions = [
  { value: "lead", label: "Lead" },
  { value: "contacted", label: "Contactado" },
  { value: "qualified", label: "Cualificado" },
  { value: "client", label: "Cliente" },
  { value: "lost", label: "Perdido" },
  { value: "archived", label: "Archivado" },
];

const teamMembers = [
  { value: "", label: "Sin asignar" },
  { value: "Carlos Martinez", label: "Carlos Martinez" },
  { value: "Ana Beltran", label: "Ana Beltran" },
  { value: "Laura Garcia", label: "Laura Garcia" },
];

export default function ContactForm({ contact, onSave, onClose }) {
  const isEdit = !!contact;
  const [form, setForm] = useState({
    first_name: contact?.first_name || "",
    last_name: contact?.last_name || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    company: contact?.company || "",
    source: contact?.source || "manual",
    status: contact?.status || "lead",
    assigned_to: contact?.assigned_to || "",
    notes_text: "",
  });
  const [hoveredBtn, setHoveredBtn] = useState(null);

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.email.trim()) return;
    onSave(form);
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1.5px solid ${C.border}`, fontSize: 13,
    fontFamily: font, background: C.card, color: C.text,
    outline: "none", boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: C.textMuted,
    textTransform: "uppercase", letterSpacing: ".04em",
    marginBottom: 5, display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: C.card, borderRadius: 18, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        border: `1px solid ${C.border}`,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
            {isEdit ? "Editar contacto" : "Nuevo contacto"}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: "none",
              background: C.bg, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} color={C.textMuted} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px" }}>
          {/* Name row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
            <div style={{ minWidth: 200, flex: "1 1 45%" }}>
              <label style={labelStyle}>Nombre *</label>
              <input
                value={form.first_name}
                onChange={e => handleChange("first_name", e.target.value)}
                placeholder="Nombre"
                required
                style={inputStyle}
              />
            </div>
            <div style={{ minWidth: 200, flex: "1 1 45%" }}>
              <label style={labelStyle}>Apellidos</label>
              <input
                value={form.last_name}
                onChange={e => handleChange("last_name", e.target.value)}
                placeholder="Apellidos"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Email + phone row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
            <div style={{ minWidth: 200, flex: "1 1 45%" }}>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => handleChange("email", e.target.value)}
                placeholder="email@ejemplo.com"
                required
                style={inputStyle}
              />
            </div>
            <div style={{ minWidth: 200, flex: "1 1 45%" }}>
              <label style={labelStyle}>Telefono</label>
              <input
                value={form.phone}
                onChange={e => handleChange("phone", e.target.value)}
                placeholder="+34 600 000 000"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Company */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Empresa</label>
            <input
              value={form.company}
              onChange={e => handleChange("company", e.target.value)}
              placeholder="Nombre de la empresa (opcional)"
              style={inputStyle}
            />
          </div>

          {/* Source */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Fuente</label>
            <select
              value={form.source}
              onChange={e => handleChange("source", e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {sourceOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Status (only on edit) */}
          {isEdit && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Estado</label>
              <select
                value={form.status}
                onChange={e => handleChange("status", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {statusOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Assigned to */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Asignado a</label>
            <select
              value={form.assigned_to}
              onChange={e => handleChange("assigned_to", e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {teamMembers.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notas</label>
            <textarea
              value={form.notes_text}
              onChange={e => handleChange("notes_text", e.target.value)}
              placeholder="Notas iniciales sobre el contacto..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              onMouseEnter={() => setHoveredBtn("cancel")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                fontFamily: font, cursor: "pointer",
                background: hoveredBtn === "cancel" ? C.bg : C.card,
                color: C.text, border: `1px solid ${C.border}`,
                transition: "all .15s",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              onMouseEnter={() => setHoveredBtn("save")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                fontFamily: font, cursor: "pointer", border: "none",
                background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                color: "#fff",
                boxShadow: hoveredBtn === "save" ? "0 4px 14px rgba(91,107,240,0.35)" : "0 2px 8px rgba(91,107,240,0.2)",
                transition: "all .15s",
              }}
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
