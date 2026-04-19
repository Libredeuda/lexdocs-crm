import { useState, useEffect } from "react";
import {
  X, Check, Calendar, Clock, RefreshCw, Phone, Briefcase, Scale,
  AlertCircle, MapPin, Bell, User, FolderKanban
} from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";

const EVENT_TYPES = [
  { value: "task",     label: "Tarea",    icon: Check,        color: C.primary },
  { value: "call",     label: "Llamada",  icon: Phone,        color: C.blue    },
  { value: "meeting",  label: "Reunión",  icon: Briefcase,    color: C.violet  },
  { value: "deadline", label: "Plazo",    icon: AlertCircle,  color: C.orange  },
  { value: "hearing",  label: "Vista",    icon: Scale,        color: C.red     },
];

const PRIORITIES = [
  { value: "low",     label: "Baja",    color: C.textMuted },
  { value: "normal",  label: "Normal",  color: C.blue      },
  { value: "high",    label: "Alta",    color: C.orange    },
  { value: "urgent",  label: "Urgente", color: C.red       },
];

const REMINDERS = [
  { value: 0,    label: "Sin recordatorio" },
  { value: 5,    label: "5 min antes"      },
  { value: 15,   label: "15 min antes"     },
  { value: 30,   label: "30 min antes"     },
  { value: 60,   label: "1 hora antes"     },
  { value: 1440, label: "1 día antes"      },
];

const RECURRENCES = [
  { value: "",        label: "Ninguna" },
  { value: "daily",   label: "Diaria"  },
  { value: "weekly",  label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

export default function TaskFormModal({ initialData = null, defaultDate = null, defaultContactId = null, user, onClose, onSaved }) {
  const isEdit = !!initialData?.id;

  const [title, setTitle] = useState(initialData?.title || "");
  const [eventType, setEventType] = useState(initialData?.event_type || "task");
  const [description, setDescription] = useState(initialData?.description || "");
  const [eventDate, setEventDate] = useState(initialData?.event_date || defaultDate?.date || new Date().toISOString().split("T")[0]);
  const [eventTime, setEventTime] = useState(initialData?.event_time?.slice(0, 5) || defaultDate?.time || "09:00");
  const [durationMinutes, setDurationMinutes] = useState(initialData?.duration_minutes || 30);
  const [assignedTo, setAssignedTo] = useState(initialData?.assigned_to || "");
  const [priority, setPriority] = useState(initialData?.priority || "normal");
  const [reminderMinutes, setReminderMinutes] = useState(initialData?.reminder_minutes_before ?? 30);
  const [recurrence, setRecurrence] = useState(initialData?.recurrence || "");
  const [recurrenceUntil, setRecurrenceUntil] = useState(initialData?.recurrence_until || "");
  const [linkedCaseId, setLinkedCaseId] = useState(initialData?.case_id || "");
  const [location, setLocation] = useState(initialData?.location || "");

  const [team, setTeam] = useState([]);
  const [cases, setCases] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from("users")
        .select("id, full_name, role")
        .in("role", ["owner", "admin", "lawyer", "procurador", "staff"])
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      setTeam(t || []);

      let casesQ = supabase
        .from("cases")
        .select("id, case_number, client_name, status")
        .order("created_at", { ascending: false });
      if (user?.org_id) casesQ = casesQ.eq("org_id", user.org_id);
      const { data: c } = await casesQ;
      setCases((c || []).filter(x => x.status !== "closed" && x.status !== "archived"));
    }
    load();
  }, [user?.org_id]);

  const showDuration = ["meeting", "call", "hearing"].includes(eventType);

  async function handleSave() {
    if (!title.trim()) {
      setToast("Título obligatorio");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (!eventDate || !eventTime) {
      setToast("Fecha y hora obligatorias");
      setTimeout(() => setToast(null), 2500);
      return;
    }

    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const dataToSave = {
        org_id: user?.org_id,
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        event_date: eventDate,
        event_time: eventTime,
        duration_minutes: showDuration ? Number(durationMinutes) || 30 : 30,
        assigned_to: assignedTo || null,
        priority,
        location: location.trim() || null,
        reminder_minutes_before: Number(reminderMinutes) || 0,
        recurrence: recurrence || null,
        recurrence_until: recurrence ? (recurrenceUntil || null) : null,
        case_id: linkedCaseId || null,
        contact_id: defaultContactId || initialData?.contact_id || null,
        created_by: authUser?.id || null,
      };

      // Verificar disponibilidad GCal en reuniones
      if (eventType === "meeting" && assignedTo) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          const checkRes = await fetch(`${supabaseUrl}/functions/v1/gcal-check-availability`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
            body: JSON.stringify({
              userId: assignedTo,
              date: eventDate,
              time: eventTime,
              durationMinutes: Number(durationMinutes) || 30,
            }),
          });
          if (checkRes.ok) {
            const check = await checkRes.json();
            if (!check.available && check.conflicts?.length > 0) {
              const ok = window.confirm(
                `⚠️ El usuario asignado tiene un conflicto en Google Calendar:\n\n` +
                `${check.conflicts.map(c => `• ${c.summary || "Evento"} (${c.start})`).join("\n")}\n\n` +
                `¿Crear igualmente?`
              );
              if (!ok) {
                setSaving(false);
                return;
              }
            }
          }
        } catch (e) {
          console.warn("GCal availability check failed:", e);
        }
      }

      let savedEvent;
      if (isEdit) {
        const { data, error } = await supabase
          .from("events")
          .update(dataToSave)
          .eq("id", initialData.id)
          .select()
          .single();
        if (error) throw error;
        savedEvent = data;
      } else {
        const { data, error } = await supabase
          .from("events")
          .insert(dataToSave)
          .select()
          .single();
        if (error) throw error;
        savedEvent = data;
      }

      // Sincronizar con Google Calendar
      if (savedEvent && ["meeting", "call", "hearing"].includes(eventType)) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        fetch(`${supabaseUrl}/functions/v1/gcal-sync-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({ eventId: savedEvent.id, action: isEdit ? "update" : "create" }),
        }).catch(() => {});
      }

      setToast(isEdit ? "Tarea actualizada" : "Tarea creada");
      setTimeout(() => {
        setToast(null);
        if (onSaved) onSaved(savedEvent);
        onClose();
      }, 900);
    } catch (e) {
      console.error(e);
      setToast("Error: " + (e.message || "no se pudo guardar"));
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1.5px solid ${C.border}`, fontSize: 13,
    fontFamily: font, background: C.card, color: C.text,
    outline: "none",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: C.textMuted,
    textTransform: "uppercase", letterSpacing: ".04em",
    marginBottom: 6, display: "flex", alignItems: "center", gap: 6,
  };
  const fieldGroup = { marginBottom: 16 };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: font,
    }}>
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: C.sidebar, color: "#fff", padding: "12px 24px",
          borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 10001,
          boxShadow: "0 8px 30px rgba(0,0,0,.2)",
        }}>{toast}</div>
      )}

      <div style={{
        background: C.card, borderRadius: 18, width: "100%", maxWidth: 580,
        maxHeight: "92vh", overflow: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: `1px solid ${C.border}`,
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: `linear-gradient(135deg, ${C.primary}08, ${C.violet}05)`,
          position: "sticky", top: 0, zIndex: 5,
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              {isEdit ? "Editar tarea" : "Nueva tarea"}
            </h2>
            <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
              {isEdit ? "Modifica los datos de la tarea" : "Crea una tarea o evento en la agenda"}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: "none",
            background: C.bg, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} color={C.textMuted} />
          </button>
        </div>

        <div style={{ padding: "22px 24px" }}>

          {/* Título */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Título *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej. Llamar al cliente para revisión"
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Tipo */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Tipo</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EVENT_TYPES.map(t => {
                const Icon = t.icon;
                const active = eventType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setEventType(t.value)}
                    style={{
                      flex: "1 1 90px", padding: "8px 10px", borderRadius: 10,
                      border: `1.5px solid ${active ? t.color : C.border}`,
                      background: active ? `${t.color}12` : C.card,
                      color: active ? t.color : C.text,
                      fontSize: 12, fontWeight: active ? 600 : 500, fontFamily: font,
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 5,
                    }}
                  >
                    <Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descripción */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Descripción</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Notas, contexto, detalles..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: font }}
            />
          </div>

          {/* Fecha + Hora + Duración */}
          <div style={{ display: "grid", gridTemplateColumns: showDuration ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}><Calendar size={12} /> Fecha *</label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}><Clock size={12} /> Hora *</label>
              <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} style={inputStyle} />
            </div>
            {showDuration && (
              <div>
                <label style={labelStyle}>Duración (min)</label>
                <input type="number" min={5} step={5} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} style={inputStyle} />
              </div>
            )}
          </div>

          {/* Asignado a */}
          <div style={fieldGroup}>
            <label style={labelStyle}><User size={12} /> Asignado a</label>
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">— Sin asignar —</option>
              {team.map(m => (
                <option key={m.id} value={m.id}>
                  {m.full_name} {m.role ? `· ${m.role}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Prioridad */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Prioridad</label>
            <div style={{ display: "flex", gap: 6 }}>
              {PRIORITIES.map(p => {
                const active = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 10,
                      border: `1.5px solid ${active ? p.color : C.border}`,
                      background: active ? `${p.color}15` : C.card,
                      color: active ? p.color : C.text,
                      fontSize: 12, fontWeight: active ? 600 : 500, fontFamily: font,
                      cursor: "pointer",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recordatorio */}
          <div style={fieldGroup}>
            <label style={labelStyle}><Bell size={12} /> Recordatorio</label>
            <select value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value))} style={{ ...inputStyle, cursor: "pointer" }}>
              {REMINDERS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Recurrencia */}
          <div style={fieldGroup}>
            <label style={labelStyle}><RefreshCw size={12} /> Recurrencia</label>
            <div style={{ display: "flex", gap: 6 }}>
              {RECURRENCES.map(r => {
                const active = recurrence === r.value;
                return (
                  <button
                    key={r.value || "none"}
                    type="button"
                    onClick={() => setRecurrence(r.value)}
                    style={{
                      flex: 1, padding: "8px 10px", borderRadius: 10,
                      border: `1.5px solid ${active ? C.primary : C.border}`,
                      background: active ? `${C.primary}12` : C.card,
                      color: active ? C.primary : C.text,
                      fontSize: 12, fontWeight: active ? 600 : 500, fontFamily: font,
                      cursor: "pointer",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {recurrence && (
              <div style={{ marginTop: 10 }}>
                <label style={{ ...labelStyle, marginBottom: 4 }}>Hasta el día (opcional)</label>
                <input type="date" value={recurrenceUntil} onChange={e => setRecurrenceUntil(e.target.value)} style={inputStyle} />
              </div>
            )}
          </div>

          {/* Vincular caso */}
          <div style={fieldGroup}>
            <label style={labelStyle}><FolderKanban size={12} /> Vincular a expediente</label>
            <select value={linkedCaseId} onChange={e => setLinkedCaseId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">— Sin vincular —</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.case_number} {c.client_name ? `· ${c.client_name}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Ubicación */}
          <div style={fieldGroup}>
            <label style={labelStyle}><MapPin size={12} /> Ubicación</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Despacho, juzgado, videollamada..."
              style={inputStyle}
            />
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <button onClick={onClose} disabled={saving} style={{
              padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 500,
              fontFamily: font, cursor: saving ? "default" : "pointer",
              background: C.card, color: C.text, border: `1px solid ${C.border}`,
            }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              fontFamily: font, cursor: saving ? "default" : "pointer", border: "none",
              background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
              color: "#fff", opacity: saving ? 0.7 : 1,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <Check size={14} /> {saving ? "Guardando..." : (isEdit ? "Guardar cambios" : "Crear tarea")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
