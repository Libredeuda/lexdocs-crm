import { useState, useEffect } from "react";
import {
  Globe, Users, Megaphone, PenLine, MessageCircle, Code,
  GripVertical, User
} from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from '../../lib/supabase';

const columns = [
  { key: 'lead', label: 'Nuevo lead', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  { key: 'contacted', label: 'Contactado', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  { key: 'qualified', label: 'Cualificado', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  { key: 'client', label: 'Cliente', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  { key: 'lost', label: 'Perdido', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
];

const sourceConfig = {
  website: { label: 'Web', icon: Globe },
  referral: { label: 'Referido', icon: Users },
  ads: { label: 'Anuncios', icon: Megaphone },
  manual: { label: 'Manual', icon: PenLine },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  api: { label: 'API', icon: Code },
};

export default function ContactPipeline({ setPage, setSelectedContact }) {
  const [contacts, setContacts] = useState([]);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('contacts')
        .select('*, assigned_user:users!contacts_assigned_to_fkey(full_name)')
        .not('status', 'eq', 'archived');
      setContacts(data || []);
    }
    load();
  }, []);

  function daysSince(dateStr) {
    const now = new Date();
    const then = new Date(dateStr);
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
  }

  function getInitials(c) {
    return ((c.first_name?.[0] || '') + (c.last_name?.[0] || '')).toUpperCase();
  }

  function handleDragStart(e, contactId) {
    e.dataTransfer.setData("text/plain", contactId);
    setDraggingId(contactId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }

  function handleDragOver(e, colKey) {
    e.preventDefault();
    setDragOverCol(colKey);
  }

  function handleDragLeave() {
    setDragOverCol(null);
  }

  async function handleDrop(e, colKey) {
    e.preventDefault();
    const contactId = e.dataTransfer.getData("text/plain");

    // Optimistic update
    setContacts(prev => prev.map(c =>
      c.id === contactId ? { ...c, status: colKey, updated_at: new Date().toISOString() } : c
    ));
    setDragOverCol(null);
    setDraggingId(null);

    // Persist to Supabase
    const { error } = await supabase
      .from('contacts')
      .update({ status: colKey })
      .eq('id', contactId);

    if (error) {
      console.error('Error updating contact status:', error);
      // Reload on error to revert
      const { data } = await supabase
        .from('contacts')
        .select('*, assigned_user:users!contacts_assigned_to_fkey(full_name)')
        .not('status', 'eq', 'archived');
      setContacts(data || []);
    }
  }

  function handleCardClick(contact) {
    setSelectedContact(contact);
    setPage("contact-detail");
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Pipeline</h2>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
          Arrastra los contactos entre columnas para actualizar su estado
        </p>
      </div>

      {/* Kanban board */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
        gap: 12, minHeight: 500,
      }}>
        {columns.map(col => {
          const colContacts = contacts.filter(c => c.status === col.key);
          const isOver = dragOverCol === col.key;

          return (
            <div
              key={col.key}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.key)}
              style={{
                background: isOver ? col.bg : C.bg,
                borderRadius: 14, padding: 12,
                border: isOver ? `2px dashed ${col.color}` : `1px solid ${C.border}`,
                transition: "all .2s",
                minHeight: 400,
              }}
            >
              {/* Column header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 12, padding: "0 4px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", background: col.color,
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{col.label}</span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: col.color,
                  background: col.bg, padding: "2px 8px", borderRadius: 6,
                }}>
                  {colContacts.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {colContacts.map(c => {
                  const src = sourceConfig[c.source];
                  const SrcIcon = src?.icon || Globe;
                  const days = daysSince(c.updated_at);
                  const isDragging = draggingId === c.id;
                  const displayName = `${c.first_name} ${c.last_name || ''}`.trim();
                  const assignedName = c.assigned_user?.full_name;

                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={e => handleDragStart(e, c.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleCardClick(c)}
                      onMouseEnter={() => setHoveredCard(c.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      style={{
                        background: C.card,
                        borderRadius: 12, padding: "14px 16px",
                        border: `1px solid ${C.border}`,
                        cursor: "grab", transition: "all .15s",
                        opacity: isDragging ? 0.5 : 1,
                        boxShadow: hoveredCard === c.id ? "0 4px 16px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
                        transform: hoveredCard === c.id ? "translateY(-1px)" : "none",
                      }}
                    >
                      {/* Name + initials */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: "50%",
                          background: col.bg, display: "flex", alignItems: "center",
                          justifyContent: "center", flexShrink: 0,
                          fontSize: 11, fontWeight: 700, color: col.color,
                        }}>
                          {getInitials(c)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{
                            fontSize: 12.5, fontWeight: 600, color: C.text, margin: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {displayName}
                          </p>
                        </div>
                      </div>

                      {/* Email */}
                      <p style={{
                        fontSize: 11, color: C.textMuted, margin: 0, marginBottom: 6,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {c.email}
                      </p>

                      {/* Phone */}
                      <p style={{ fontSize: 11, color: C.textMuted, margin: 0, marginBottom: 10 }}>
                        {c.phone}
                      </p>

                      {/* Footer: source + assigned + days */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        borderTop: `1px solid ${C.bg}`, paddingTop: 8,
                      }}>
                        {/* Source badge */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: 6,
                          background: C.bg, fontSize: 10, color: C.textMuted,
                        }}>
                          <SrcIcon size={10} /> {src?.label || c.source}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {/* Assigned avatar */}
                          {assignedName && (
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%",
                              background: "rgba(91,107,240,0.1)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 8, fontWeight: 700, color: C.primary,
                            }}
                              title={assignedName}
                            >
                              {assignedName.split(" ").map(w => w[0]).join("")}
                            </div>
                          )}

                          {/* Days since update */}
                          <span style={{
                            fontSize: 10, color: days > 7 ? C.orange : C.textMuted,
                            fontWeight: days > 7 ? 600 : 400,
                          }}>
                            {days === 0 ? "Hoy" : `${days}d`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {colContacts.length === 0 && (
                  <div style={{
                    padding: "30px 16px", textAlign: "center",
                    borderRadius: 10, border: `1px dashed ${C.border}`,
                  }}>
                    <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>
                      Arrastra aqui
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
