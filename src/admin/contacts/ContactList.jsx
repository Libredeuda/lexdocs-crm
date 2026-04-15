import { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, ChevronRight, ChevronLeft, Globe, Users, Megaphone,
  PenLine, MessageCircle, Code, Filter, TrendingUp, UserPlus, BarChart3
} from "lucide-react";
import { C, font } from "../../constants";
import { useContacts } from '../../lib/hooks/useContacts';
import ContactForm from "./ContactForm";

const statusConfig = {
  lead: { label: 'Lead', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  contacted: { label: 'Contactado', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  qualified: { label: 'Cualificado', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  client: { label: 'Cliente', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  lost: { label: 'Perdido', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  archived: { label: 'Archivado', color: '#7A7A8A', bg: 'rgba(122,122,138,0.08)' },
};

const sourceConfig = {
  website: { label: 'Web', icon: Globe },
  referral: { label: 'Referido', icon: Users },
  ads: { label: 'Anuncios', icon: Megaphone },
  manual: { label: 'Manual', icon: PenLine },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
  api: { label: 'API', icon: Code },
};

const PAGE_SIZE = 5;

export default function ContactList({ setPage, setSelectedContact }) {
  const { contacts, total, loading, error, fetchContacts, createContact } = useContacts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);

  useEffect(() => {
    fetchContacts({
      status: statusFilter === 'all' ? undefined : statusFilter,
      source: sourceFilter === 'all' ? undefined : sourceFilter,
      search: search || undefined,
      page: currentPage,
      limit: PAGE_SIZE,
    });
  }, [statusFilter, sourceFilter, search, currentPage]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Stats
  const totalContacts = total;
  const leadsThisMonth = contacts.filter(c => c.status === 'lead' && c.created_at >= '2026-04-01').length;
  const clients = contacts.filter(c => c.status === 'client').length;
  const conversionRate = totalContacts > 0 ? Math.round((clients / totalContacts) * 100) : 0;

  async function handleSave(newContact) {
    try {
      await createContact(newContact);
      setShowForm(false);
      // Refresh the list
      fetchContacts({
        status: statusFilter === 'all' ? undefined : statusFilter,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        search: search || undefined,
        page: currentPage,
        limit: PAGE_SIZE,
      });
    } catch (e) {
      console.error('Error creating contact:', e);
    }
  }

  function handleRowClick(contact) {
    setSelectedContact(contact);
    setPage("contact-detail");
  }

  function getInitials(c) {
    return ((c.first_name?.[0] || '') + (c.last_name?.[0] || '')).toUpperCase();
  }

  function formatDate(d) {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }

  const statusFilters = [
    { k: "all", l: "Todos" },
    { k: "lead", l: "Lead" },
    { k: "contacted", l: "Contactado" },
    { k: "qualified", l: "Cualificado" },
    { k: "client", l: "Cliente" },
    { k: "lost", l: "Perdido" },
  ];

  return (
    <div>
      {showForm && (
        <ContactForm
          contact={null}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Contactos</h2>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Gestiona tu base de contactos y pipeline comercial</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: font,
            boxShadow: "0 4px 14px rgba(91,107,240,0.25)",
          }}
        >
          <Plus size={15} /> Nuevo contacto
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 18 }}>
        {[
          { label: "Total contactos", value: totalContacts, icon: Users, color: C.primary, bg: "rgba(91,107,240,0.08)" },
          { label: "Leads este mes", value: leadsThisMonth, icon: UserPlus, color: C.blue, bg: "rgba(59,130,246,0.08)" },
          { label: "Tasa conversion", value: `${conversionRate}%`, icon: BarChart3, color: C.green, bg: "rgba(34,197,94,0.08)" },
        ].map((s, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 14, padding: "16px 20px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <s.icon size={18} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color: C.text }}>{s.value}</p>
              <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <Search size={15} color={C.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por nombre, email o telefono..."
            style={{
              width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10,
              border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: font,
              background: C.card, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Source filter */}
        <div style={{ position: "relative" }}>
          <select
            value={sourceFilter}
            onChange={e => { setSourceFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: "10px 32px 10px 14px", borderRadius: 10, fontSize: 12,
              fontFamily: font, fontWeight: 500, border: `1.5px solid ${C.border}`,
              background: C.card, color: C.text, cursor: "pointer",
              appearance: "none", outline: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237A7A8A' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
            }}
          >
            <option value="all">Todas las fuentes</option>
            {Object.entries(sourceConfig).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: "flex", gap: 5, marginBottom: 16, flexWrap: "wrap" }}>
        {statusFilters.map(f => (
          <button
            key={f.k}
            onClick={() => { setStatusFilter(f.k); setCurrentPage(1); }}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: font, transition: "all .15s",
              background: statusFilter === f.k ? `linear-gradient(135deg, ${C.primary}, ${C.violet})` : C.card,
              color: statusFilter === f.k ? "#fff" : C.text,
              border: `1px solid ${statusFilter === f.k ? "transparent" : C.border}`,
            }}
          >
            {f.l}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
        {total} contacto{total !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", overflowX: "auto" }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2.2fr 1.2fr 1fr 1fr 1fr 1fr 60px",
          gap: 8, padding: "12px 18px", minWidth: 700,
          borderBottom: `1px solid ${C.border}`, background: C.bg,
        }}>
          {["Nombre", "Telefono", "Estado", "Fuente", "Asignado a", "Ultima act.", ""].map(h => (
            <span key={h} style={{ fontSize: 10.5, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</span>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ padding: "40px 18px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>Cargando contactos...</p>
          </div>
        )}

        {/* Rows */}
        {!loading && contacts.length === 0 && (
          <div style={{ padding: "40px 18px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>No se encontraron contactos</p>
          </div>
        )}
        {!loading && contacts.map((c, i) => {
          const st = statusConfig[c.status] || statusConfig.lead;
          const src = sourceConfig[c.source];
          const SrcIcon = src?.icon || Globe;
          const displayName = `${c.first_name} ${c.last_name || ''}`.trim();
          const assignedName = c.assigned_user?.full_name || 'Sin asignar';
          return (
            <div
              key={c.id}
              onClick={() => handleRowClick(c)}
              onMouseEnter={() => setHoveredRow(c.id)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1.2fr 1fr 1fr 1fr 1fr 60px",
                gap: 8, padding: "13px 18px", minWidth: 700,
                borderBottom: i < contacts.length - 1 ? `1px solid ${C.bg}` : "none",
                cursor: "pointer", transition: "background .15s",
                background: hoveredRow === c.id ? C.bg : "transparent",
                alignItems: "center",
              }}
            >
              {/* Name + avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: st.bg, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: 12, fontWeight: 700, color: st.color,
                }}>
                  {getInitials(c)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                    {displayName}
                  </p>
                  <p style={{ fontSize: 10.5, color: C.textMuted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</p>
                </div>
              </div>

              {/* Phone */}
              <span style={{ fontSize: 12, color: C.text }}>{c.phone}</span>

              {/* Status badge */}
              <div>
                <span style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: 6,
                  fontSize: 11, fontWeight: 600, background: st.bg, color: st.color,
                }}>
                  {st.label}
                </span>
              </div>

              {/* Source */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <SrcIcon size={13} color={C.textMuted} />
                <span style={{ fontSize: 12, color: C.textMuted }}>{src?.label || c.source}</span>
              </div>

              {/* Assigned */}
              <span style={{ fontSize: 12, color: c.assigned_user?.full_name ? C.text : C.textMuted }}>
                {assignedName}
              </span>

              {/* Last activity */}
              <span style={{ fontSize: 11.5, color: C.textMuted }}>{formatDate(c.updated_at)}</span>

              {/* Action */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <ChevronRight size={16} color={C.textMuted} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.card, cursor: currentPage === 1 ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: currentPage === 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={14} color={C.textMuted} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              style={{
                width: 32, height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600,
                fontFamily: font, cursor: "pointer", border: "none",
                background: currentPage === p ? C.primary : C.card,
                color: currentPage === p ? "#fff" : C.text,
                boxShadow: currentPage === p ? "0 2px 8px rgba(91,107,240,0.3)" : "none",
              }}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.card, cursor: currentPage === totalPages ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: currentPage === totalPages ? 0.4 : 1,
            }}
          >
            <ChevronRight size={14} color={C.textMuted} />
          </button>
        </div>
      )}
    </div>
  );
}
