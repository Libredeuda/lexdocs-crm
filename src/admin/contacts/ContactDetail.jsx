import { useState, useEffect } from "react";
import {
  ArrowLeft, Mail, Phone, Building2, Edit3, PhoneCall, Send,
  UserCheck, Tag, Plus, Clock, FileText, MessageSquare, ChevronDown,
  CheckSquare, Calendar, Briefcase, Paperclip, Upload, Download, Trash2, AlertCircle, Scale,
  Sparkles, RefreshCw, TrendingUp
} from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import ContactForm from "./ContactForm";
import TaskFormModal from "../agenda/TaskFormModal";

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

const EVENT_ICON = { task: CheckSquare, call: Phone, meeting: Briefcase, deadline: AlertCircle, hearing: Scale };
const EVENT_COLOR = { task: '#5B6BF0', call: '#3b82f6', meeting: '#7C5BF0', deadline: '#f59e0b', hearing: '#ef4444' };
const EVENT_LABEL = { task: 'Tarea', call: 'Llamada', meeting: 'Reunión', deadline: 'Plazo', hearing: 'Vista' };

export default function ContactDetail({ contact, setPage, setSelectedContact, user }) {
  const [data, setData] = useState({ ...contact });
  const [status, setStatus] = useState(contact.status);
  const [assignedTo, setAssignedTo] = useState(contact.assigned_to || "");
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [cases, setCases] = useState([]);
  const [team, setTeam] = useState([]);
  const [activities, setActivities] = useState([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [files, setFiles] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [aiScoring, setAiScoring] = useState(false);

  const st = statusConfig[status] || statusConfig.lead;

  async function handleRescore() {
    setAiScoring(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-lead-scorer`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ contact_id: contact.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Reload contact data (scoped por org)
      const { data: updated } = await supabase
        .from('contacts').select('*')
        .eq('id', contact.id)
        .eq('org_id', contact.org_id)
        .single();
      if (updated) setData(prev => ({ ...prev, ...updated }));
      showToast('Score recalculado');
    } catch (err) {
      console.error(err);
      showToast('Error: ' + (err.message || err));
    } finally {
      setAiScoring(false);
    }
  }

  const tierConfig = {
    hot:  { label: "HOT",  color: C.red,    bg: `${C.red}18` },
    warm: { label: "WARM", color: C.orange, bg: `${C.orange}18` },
    cold: { label: "COLD", color: C.blue,   bg: `${C.blue}18` },
  };

  useEffect(() => {
    if (!contact?.id) return;
    loadData();
  }, [contact?.id]);

  async function loadData() {
    setLoading(true);

    // Fetch activities for this contact
    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .eq('entity_type', 'contact')
      .eq('entity_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setActivities(acts || []);

    // Fetch tags for this contact
    const { data: contactTags } = await supabase
      .from('contact_tags')
      .select('tag_id, tags(id, name, color)')
      .eq('contact_id', contact.id);
    setTags((contactTags || []).map(ct => ct.tags));

    // Fetch all available tags (scoped por org)
    const { data: at } = await supabase.from('tags').select('*').eq('org_id', contact.org_id);
    setAllTags(at || []);

    // Fetch notes for this contact
    const { data: n } = await supabase
      .from('notes')
      .select('*, author:users!notes_author_id_fkey(full_name)')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false });
    setNotes(n || []);

    // Fetch cases linked to this contact
    const { data: c } = await supabase
      .from('cases')
      .select('*, lawyer:users!cases_assigned_lawyer_id_fkey(full_name)')
      .eq('contact_id', contact.id);
    setCases(c || []);

    // Fetch team members for assignment dropdown
    const { data: t } = await supabase.from('users').select('id, full_name, role');
    setTeam(t || []);

    // Fetch events (tareas/reuniones) linked to this contact
    const { data: ev } = await supabase
      .from('events')
      .select('*, assignee:users!events_assigned_to_fkey(full_name)')
      .eq('contact_id', contact.id)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true });
    setEvents(ev || []);

    // Fetch files linked to this contact
    const { data: f } = await supabase
      .from('documents')
      .select('*, uploader:users!documents_uploaded_by_fkey(full_name)')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false });
    setFiles(f || []);

    setLoading(false);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleToggleEventCompleted(ev) {
    await supabase.from('events')
      .update({ is_completed: !ev.is_completed, completed_at: !ev.is_completed ? new Date().toISOString() : null })
      .eq('id', ev.id);
    loadData();
  }

  async function handleDeleteEvent(ev) {
    if (!window.confirm(`¿Eliminar "${ev.title}"?`)) return;
    await supabase.from('events').delete().eq('id', ev.id);
    loadData();
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop();
      const path = `contacts/${contact.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('documents').insert({
        org_id: contact.org_id,
        contact_id: contact.id,
        name: file.name,
        file_path: path,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type,
        status: 'uploaded',
        uploaded_by: userData?.user?.id || null,
      });
      if (insErr) throw insErr;
      await supabase.from('activities').insert({
        org_id: contact.org_id,
        entity_type: 'contact',
        entity_id: contact.id,
        action: 'uploaded',
        description: `Archivo subido: "${file.name}"`,
      });
      showToast('Archivo subido');
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Error al subir: ' + (err.message || err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDownloadFile(f) {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(f.storage_path || f.file_path, 300);
    if (error || !data?.signedUrl) { showToast('Error generando enlace'); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function handleDeleteFile(f) {
    if (!window.confirm(`¿Eliminar "${f.name}"?`)) return;
    if (f.storage_path || f.file_path) {
      await supabase.storage.from('documents').remove([f.storage_path || f.file_path]);
    }
    await supabase.from('documents').delete().eq('id', f.id);
    loadData();
  }

  function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getInitials() {
    return (data.first_name[0] + (data.last_name?.[0] || "")).toUpperCase();
  }

  function handleBack() {
    setSelectedContact(null);
    setPage("contacts");
  }

  async function handleStatusChange(newStatus) {
    const oldStatus = status;
    setStatus(newStatus);
    await supabase.from('contacts').update({ status: newStatus }).eq('id', contact.id);
    await supabase.from('activities').insert({
      org_id: contact.org_id,
      entity_type: 'contact',
      entity_id: contact.id,
      action: 'status_changed',
      description: `Estado cambiado de ${statusConfig[oldStatus]?.label || oldStatus} a ${statusConfig[newStatus]?.label || newStatus}`,
    });
    loadData();
  }

  async function handleAssignedToChange(userId) {
    setAssignedTo(userId);
    await supabase.from('contacts').update({ assigned_to: userId || null }).eq('id', contact.id);
    const memberName = team.find(t => t.id === userId)?.full_name || 'Sin asignar';
    await supabase.from('activities').insert({
      org_id: contact.org_id,
      entity_type: 'contact',
      entity_id: contact.id,
      action: 'assigned',
      description: `Asignado a ${memberName}`,
    });
    loadData();
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id;
    await supabase.from('notes').insert({
      contact_id: contact.id,
      org_id: contact.org_id,
      author_id: currentUserId,
      content: newNote.trim(),
    });
    await supabase.from('activities').insert({
      org_id: contact.org_id,
      entity_type: 'contact',
      entity_id: contact.id,
      action: 'note_added',
      description: `Nota anadida: "${newNote.trim().substring(0, 50)}${newNote.trim().length > 50 ? '...' : ''}"`,
    });
    setNewNote("");
    loadData();
  }

  async function handleAddTag() {
    if (!newTag.trim()) return;
    // Check if it's an existing tag from allTags
    const existingTag = allTags.find(t => t.name.toLowerCase() === newTag.trim().toLowerCase());
    let tagId;
    if (existingTag) {
      tagId = existingTag.id;
    } else {
      // Create new tag
      const { data: createdTag } = await supabase.from('tags').insert({
        name: newTag.trim(),
        color: C.primary,
      }).select().single();
      if (!createdTag) return;
      tagId = createdTag.id;
    }
    // Check if already linked
    const alreadyLinked = tags.some(t => t.id === tagId);
    if (alreadyLinked) {
      setNewTag("");
      setShowTagInput(false);
      return;
    }
    await supabase.from('contact_tags').insert({
      contact_id: contact.id,
      tag_id: tagId,
    });
    setNewTag("");
    setShowTagInput(false);
    loadData();
  }

  async function handleRemoveTag(tagId) {
    await supabase.from('contact_tags').delete().eq('contact_id', contact.id).eq('tag_id', tagId);
    loadData();
  }

  async function handleEditSave(updated) {
    await supabase.from('contacts').update({
      first_name: updated.first_name,
      last_name: updated.last_name,
      email: updated.email,
      phone: updated.phone,
      company: updated.company,
      source: updated.source,
      status: updated.status,
      assigned_to: updated.assigned_to || null,
    }).eq('id', contact.id);
    setData(prev => ({ ...prev, ...updated }));
    if (updated.status) setStatus(updated.status);
    if (updated.assigned_to !== undefined) setAssignedTo(updated.assigned_to);
    setShowEditForm(false);
    loadData();
  }

  async function convertToClient() {
    // Update contact status
    await supabase.from('contacts').update({ status: 'client' }).eq('id', contact.id);
    // Create a case
    await supabase.from('cases').insert({
      org_id: contact.org_id,
      contact_id: contact.id,
      case_type: 'other',
      phase: 'intake',
      status: 'active',
      progress: 0,
    }).select().single();
    // Log activity
    await supabase.from('activities').insert({
      org_id: contact.org_id,
      entity_type: 'contact',
      entity_id: contact.id,
      action: 'status_changed',
      description: 'Convertido a cliente. Caso creado.',
    });
    // Reload
    setStatus('client');
    loadData();
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
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12,
          fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 8px 30px rgba(0,0,0,.2)",
        }}>{toast}</div>
      )}

      {showTaskModal && (
        <TaskFormModal
          initialData={editingEvent}
          defaultContactId={contact.id}
          user={user || { org_id: contact.org_id }}
          onClose={() => { setShowTaskModal(false); setEditingEvent(null); }}
          onSaved={() => { setShowTaskModal(false); setEditingEvent(null); loadData(); }}
        />
      )}

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
              onClick={convertToClient}
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 300, flex: "1 1 60%" }}>
          {/* Info card */}
          <Card title="Informacion" icon={FileText}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
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
                <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>{n.content}</p>
                <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 6, margin: 0, marginTop: 6 }}>
                  {n.author?.full_name || 'Sistema'} - {new Date(n.created_at).toLocaleDateString("es-ES")}
                </p>
              </div>
            ))}
            {notes.length === 0 && !loading && (
              <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 16 }}>Sin notas</p>
            )}
          </Card>

          {/* Tareas y reuniones */}
          <Card title="Tareas y reuniones" icon={Calendar}>
            <button
              onClick={() => { setEditingEvent(null); setShowTaskModal(true); }}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px dashed ${C.border}`,
                background: C.bg, color: C.primary, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                marginBottom: 12,
              }}
            >
              <Plus size={14} /> Nueva tarea / reunión
            </button>
            {events.length === 0 && !loading && (
              <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 16 }}>Sin tareas ni reuniones</p>
            )}
            {events.map(ev => {
              const Icon = EVENT_ICON[ev.event_type] || CheckSquare;
              const color = EVENT_COLOR[ev.event_type] || C.primary;
              return (
                <div key={ev.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 12px",
                  background: C.bg, borderRadius: 10, marginBottom: 8,
                  opacity: ev.is_completed ? 0.55 : 1,
                  borderLeft: `3px solid ${color}`,
                }}>
                  <input
                    type="checkbox"
                    checked={!!ev.is_completed}
                    onChange={() => handleToggleEventCompleted(ev)}
                    style={{ marginTop: 3, cursor: "pointer", width: 15, height: 15, accentColor: color }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Icon size={12} color={color} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: ".04em" }}>
                        {EVENT_LABEL[ev.event_type] || ev.event_type}
                      </span>
                      {ev.priority && ev.priority !== 'normal' && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                          background: ev.priority === 'urgent' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                          color: ev.priority === 'urgent' ? '#ef4444' : '#f59e0b',
                          textTransform: "uppercase",
                        }}>{ev.priority}</span>
                      )}
                    </div>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: C.text, margin: "3px 0 2px",
                      textDecoration: ev.is_completed ? "line-through" : "none",
                    }}>{ev.title}</p>
                    <p style={{ fontSize: 11, color: C.textMuted, margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <Clock size={10} />
                        {new Date(ev.event_date + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                        {ev.event_time && ` · ${ev.event_time.slice(0, 5)}`}
                      </span>
                      {ev.assignee?.full_name && <span>· {ev.assignee.full_name}</span>}
                      {ev.recurrence && <span>· {ev.recurrence === 'daily' ? 'Diaria' : ev.recurrence === 'weekly' ? 'Semanal' : 'Mensual'}</span>}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => { setEditingEvent(ev); setShowTaskModal(true); }} title="Editar" style={{
                      padding: 5, borderRadius: 6, border: "none", background: "transparent",
                      cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center",
                    }}><Edit3 size={13} /></button>
                    <button onClick={() => handleDeleteEvent(ev)} title="Eliminar" style={{
                      padding: 5, borderRadius: 6, border: "none", background: "transparent",
                      cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center",
                    }}><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Archivos adjuntos */}
          <Card title="Archivos" icon={Paperclip}>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px dashed ${C.border}`,
              background: C.bg, color: uploading ? C.textMuted : C.primary,
              fontSize: 12.5, fontWeight: 600, cursor: uploading ? "wait" : "pointer",
              fontFamily: font, marginBottom: 12,
            }}>
              <Upload size={14} /> {uploading ? "Subiendo..." : "Adjuntar archivo"}
              <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: "none" }} />
            </label>
            {files.length === 0 && !loading && (
              <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 16 }}>Sin archivos</p>
            )}
            {files.map(f => (
              <div key={f.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                background: C.bg, borderRadius: 10, marginBottom: 6,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: `${C.primary}14`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <FileText size={15} color={C.primary} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: C.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                  <p style={{ fontSize: 10.5, color: C.textMuted, margin: "2px 0 0" }}>
                    {formatBytes(f.file_size)}{f.uploader?.full_name ? ` · ${f.uploader.full_name}` : ''} · {new Date(f.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <button onClick={() => handleDownloadFile(f)} title="Descargar" style={{
                  padding: 6, borderRadius: 7, border: "none", background: "transparent",
                  cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center",
                }}><Download size={14} /></button>
                <button onClick={() => handleDeleteFile(f)} title="Eliminar" style={{
                  padding: 6, borderRadius: 7, border: "none", background: "transparent",
                  cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center",
                }}><Trash2 size={14} /></button>
              </div>
            ))}
          </Card>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 280, flex: "1 1 35%" }}>
          {/* Status card */}
          <Card title="Estado" icon={Tag}>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10.5, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}>Estado actual</p>
              <select
                value={status}
                onChange={e => handleStatusChange(e.target.value)}
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
                onChange={e => handleAssignedToChange(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: `1.5px solid ${C.border}`, fontSize: 13,
                  fontFamily: font, background: C.card, color: C.text,
                  cursor: "pointer", outline: "none",
                }}
              >
                <option value="">Sin asignar</option>
                {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
          </Card>

          {/* AI Intelligence card */}
          <Card title="Inteligencia IA" icon={Sparkles}>
            {data.ai_score != null ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 14,
                    background: tierConfig[data.ai_tier]?.bg || `${C.primary}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <span style={{
                      fontSize: 22, fontWeight: 700,
                      color: tierConfig[data.ai_tier]?.color || C.primary,
                    }}>{data.ai_score}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {data.ai_tier && (
                      <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: 6,
                        fontSize: 11, fontWeight: 700,
                        background: tierConfig[data.ai_tier]?.bg || C.bg,
                        color: tierConfig[data.ai_tier]?.color || C.textMuted,
                        letterSpacing: ".04em",
                      }}>{tierConfig[data.ai_tier]?.label || data.ai_tier.toUpperCase()}</span>
                    )}
                    <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 6 }}>
                      {data.ai_score_updated_at
                        ? `Actualizado: ${new Date(data.ai_score_updated_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
                        : ""}
                    </p>
                  </div>
                </div>

                {data.ai_score_reasoning && (
                  <div style={{ padding: "10px 12px", background: C.bg, borderRadius: 10, marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>Razonamiento</p>
                    <p style={{ fontSize: 11.5, color: C.text, margin: 0, lineHeight: 1.5 }}>{data.ai_score_reasoning}</p>
                  </div>
                )}

                {data.ai_next_action && (
                  <div style={{
                    padding: "10px 12px",
                    background: `linear-gradient(135deg, ${C.primary}10, ${C.violet}08)`,
                    borderRadius: 10, borderLeft: `3px solid ${C.primary}`, marginBottom: 12,
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <TrendingUp size={10} /> Siguiente acción
                    </p>
                    <p style={{ fontSize: 12, color: C.text, margin: 0, lineHeight: 1.5, fontWeight: 500 }}>{data.ai_next_action}</p>
                  </div>
                )}

                <button
                  onClick={handleRescore}
                  disabled={aiScoring}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
                    background: C.white, color: C.primary, fontSize: 12, fontWeight: 600,
                    cursor: aiScoring ? "wait" : "pointer", fontFamily: font,
                    opacity: aiScoring ? 0.7 : 1,
                  }}
                >
                  <RefreshCw size={12} style={{ animation: aiScoring ? "spin 1s linear infinite" : "none" }} />
                  {aiScoring ? "Analizando..." : "Recalcular score"}
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <Sparkles size={28} color={C.primary} style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 12.5, color: C.text, fontWeight: 500, marginBottom: 4 }}>
                  Sin análisis previo
                </p>
                <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
                  Analiza este lead con IA para obtener score y recomendaciones
                </p>
                <button
                  onClick={handleRescore}
                  disabled={aiScoring}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "9px 18px", borderRadius: 10, border: "none",
                    background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                    color: "#fff", fontSize: 12, fontWeight: 600,
                    cursor: aiScoring ? "wait" : "pointer", fontFamily: font,
                    opacity: aiScoring ? 0.7 : 1,
                  }}
                >
                  <Sparkles size={13} />
                  {aiScoring ? "Analizando..." : "Analizar con IA"}
                </button>
              </div>
            )}
          </Card>

          {/* Cases card */}
          <Card title="Casos vinculados" icon={FileText}>
            {cases.length > 0 ? (
              cases.map(c => (
                <div key={c.id} style={{ padding: "10px 14px", background: C.bg, borderRadius: 10, marginBottom: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.text, margin: 0 }}>
                    {c.case_type || 'Caso'} - {c.phase || ''}
                  </p>
                  <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2, margin: 0, marginTop: 2 }}>
                    {c.status || ''}{c.lawyer?.full_name ? ` - ${c.lawyer.full_name}` : ''}
                  </p>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 16 }}>Sin casos vinculados</p>
            )}
          </Card>

          {/* Tags card */}
          <Card title="Etiquetas" icon={Tag}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {tags.map(t => (
                <span
                  key={t.id}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                    background: t.color ? `${t.color}14` : "rgba(91,107,240,0.08)",
                    color: t.color || C.primary,
                  }}
                >
                  {t.name}
                  <span
                    onClick={() => handleRemoveTag(t.id)}
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
                    list="available-tags"
                    style={{
                      padding: "4px 10px", borderRadius: 8, border: `1px solid ${C.border}`,
                      fontSize: 11, fontFamily: font, width: 100, outline: "none",
                    }}
                  />
                  <datalist id="available-tags">
                    {allTags.filter(at => !tags.some(t => t.id === at.id)).map(at => (
                      <option key={at.id} value={at.name} />
                    ))}
                  </datalist>
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
                      {a.performed_by || 'Sistema'} - {formatDateTime(a.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              {activities.length === 0 && !loading && (
                <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 16 }}>Sin actividad registrada</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
