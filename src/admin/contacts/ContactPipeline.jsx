import { useState, useEffect } from "react";
import {
  Globe, Users, Megaphone, PenLine, MessageCircle, Code,
  ArrowUp, ArrowDown, PhoneCall, MessageSquare, Tag, FileText,
  CheckSquare, CalendarPlus, ChevronDown, Plus, Check, X,
} from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from '../../lib/supabase';
import { loadPipelineStages } from '../../lib/pipelineStages';
import { loadPipelines, createPipeline } from '../../lib/pipelines';

const sourceConfig = {
  website: { label: 'Web', icon: Globe },
  referral: { label: 'Referido', icon: Users },
  ads: { label: 'Anuncios', icon: Megaphone },
  manual: { label: 'Manual', icon: PenLine },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  api: { label: 'API', icon: Code },
};

// Iconos de acceso rápido en cada tarjeta (todos abren la ficha del contacto)
const cardActions = [
  { icon: PhoneCall, label: "Llamar" },
  { icon: MessageSquare, label: "Notas" },
  { icon: Tag, label: "Etiquetas" },
  { icon: FileText, label: "Documentos" },
  { icon: CheckSquare, label: "Tareas" },
  { icon: CalendarPlus, label: "Agendar" },
];

const sortOptions = [
  { key: 'first_name', label: 'Nombre' },
  { key: 'source', label: 'Fuente' },
  { key: 'created_at', label: 'Creado el' },
  { key: 'updated_at', label: 'Actualizado el' },
];

export default function ContactPipeline({ setPage, setSelectedContact }) {
  const [contacts, setContacts] = useState([]);
  const [columns, setColumns] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [pipelineId, setPipelineId] = useState(null);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  const [showPipelinePicker, setShowPipelinePicker] = useState(false);
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [dragOverCol, setDragOverCol] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  // Por defecto: el último contacto en entrar aparece el primero de la columna
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    async function loadInitial() {
      const list = await loadPipelines();
      setPipelines(list);
      setPipelineId(list.find(p => p.is_default)?.id || list[0]?.id || null);
      setPipelinesLoading(false);
    }
    loadInitial();
  }, []);

  useEffect(() => {
    if (!pipelineId) return;
    loadBoard(pipelineId);
  }, [pipelineId]);

  async function loadBoard(pid) {
    const [{ data }, stages] = await Promise.all([
      supabase
        .from('contacts')
        .select('*, assigned_user:users!contacts_assigned_to_fkey(full_name)')
        .eq('pipeline_id', pid)
        .not('status', 'eq', 'archived'),
      loadPipelineStages(pid),
    ]);
    setContacts(data || []);
    setColumns(stages.map(s => ({ key: s.key, label: s.label, color: s.color, bg: `${s.color}14` })));
  }

  async function handleCreatePipeline() {
    if (!newPipelineName.trim()) return;
    const pipeline = await createPipeline(newPipelineName);
    setNewPipelineName("");
    setCreatingPipeline(false);
    setShowPipelinePicker(false);
    setPipelines(prev => [...prev, pipeline]);
    setPipelineId(pipeline.id);
  }

  function sortContacts(list) {
    return [...list].sort((a, b) => {
      let av, bv;
      if (sortBy === 'first_name') {
        av = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
        bv = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
      } else {
        av = a[sortBy] || '';
        bv = b[sortBy] || '';
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
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
      loadBoard(pipelineId); // revertir con datos reales
    }
  }

  function handleCardClick(contact) {
    setSelectedContact(contact);
    setPage("contact-detail");
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 18, gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              onClick={() => setShowPipelinePicker(v => !v)}
              disabled={pipelinesLoading}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "none", border: "none", padding: 0, cursor: "pointer",
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
                {pipelines.find(p => p.id === pipelineId)?.name || "Pipeline"}
              </h2>
              <ChevronDown size={16} color={C.textMuted} />
            </button>

            {showPipelinePicker && (
              <>
                <div onClick={() => { setShowPipelinePicker(false); setCreatingPipeline(false); }} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                  boxShadow: "0 12px 32px rgba(0,0,0,.14)", minWidth: 240, padding: 6,
                }}>
                  {pipelines.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setPipelineId(p.id); setShowPipelinePicker(false); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                        width: "100%", padding: "9px 12px", borderRadius: 8, border: "none",
                        background: p.id === pipelineId ? C.bg : "transparent",
                        color: p.id === pipelineId ? C.primary : C.text,
                        fontSize: 13, fontWeight: p.id === pipelineId ? 600 : 500,
                        cursor: "pointer", fontFamily: font, textAlign: "left",
                      }}
                    >
                      {p.name}
                      {p.id === pipelineId && <Check size={14} />}
                    </button>
                  ))}
                  <div style={{ borderTop: `1px solid ${C.border}`, margin: "6px 0" }} />
                  {creatingPipeline ? (
                    <div style={{ display: "flex", gap: 6, padding: "4px 6px" }}>
                      <input
                        autoFocus
                        value={newPipelineName}
                        onChange={e => setNewPipelineName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleCreatePipeline(); if (e.key === "Escape") setCreatingPipeline(false); }}
                        placeholder="Nombre del pipeline"
                        style={{
                          flex: 1, padding: "7px 10px", borderRadius: 7, border: `1px solid ${C.border}`,
                          fontSize: 12.5, fontFamily: font, outline: "none",
                        }}
                      />
                      <button onClick={handleCreatePipeline} style={{ background: C.primary, border: "none", borderRadius: 7, color: "#fff", padding: "0 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <Check size={14} />
                      </button>
                      <button onClick={() => setCreatingPipeline(false)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreatingPipeline(true)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, width: "100%",
                        padding: "9px 12px", borderRadius: 8, border: "none", background: "transparent",
                        color: C.primary, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font,
                      }}
                    >
                      <Plus size={14} /> Nuevo pipeline
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            Arrastra los contactos entre columnas para actualizar su estado
          </p>
        </div>

        {/* Ordenar por */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>Ordenar por</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              fontSize: 12, padding: "7px 10px", borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.card, color: C.text,
              fontFamily: font, cursor: "pointer",
            }}
          >
            {sortOptions.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
            style={{
              width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.card, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: C.primary,
            }}
          >
            {sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div style={{
        display: "flex",
        gap: 12, minHeight: 500,
        overflowX: "auto", paddingBottom: 8,
      }}>
        {columns.map(col => {
          const colContacts = sortContacts(contacts.filter(c => c.status === col.key));
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
                minWidth: 200, flex: "1 0 200px",
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
                  const isDragging = draggingId === c.id;
                  const displayName = `${c.first_name} ${c.last_name || ''}`.trim();

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
                      {/* Nombre */}
                      <p style={{
                        fontSize: 14, fontWeight: 700, color: C.text, margin: 0, marginBottom: 10,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {displayName}
                      </p>

                      {/* Fuente */}
                      <div style={{ display: "flex", fontSize: 11.5, marginBottom: 4 }}>
                        <span style={{ color: C.textMuted, marginRight: 4 }}>Fuente:</span>
                        <span style={{ color: C.text }}>{src?.label || c.source}</span>
                      </div>

                      {/* Valor */}
                      <div style={{ display: "flex", fontSize: 11.5, marginBottom: 12 }}>
                        <span style={{ color: C.textMuted, marginRight: 4 }}>Valor:</span>
                        <span style={{ color: C.text }}>€0,00</span>
                      </div>

                      {/* Iconos de acceso rápido */}
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        borderTop: `1px solid ${C.bg}`, paddingTop: 8,
                      }}>
                        {cardActions.map(({ icon: ActionIcon, label }) => (
                          <button
                            key={label}
                            title={label}
                            onClick={e => { e.stopPropagation(); handleCardClick(c); }}
                            style={{
                              background: "none", border: "none", padding: 4,
                              cursor: "pointer", color: C.textMuted,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <ActionIcon size={15} />
                          </button>
                        ))}
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
