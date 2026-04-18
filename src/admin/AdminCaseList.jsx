import { useState } from "react";
import { Search, Filter, AlertCircle, Clock, FileText, Building2, User, ChevronRight, Eye, UserCheck } from "lucide-react";
import { C, font } from "../constants";
import { fmtMoney, daysUntil, fmtD } from "../utils";
import AssignCaseModal from "./AssignCaseModal";
import CaseDocuments from "./cases/CaseDocuments";

export default function AdminCaseList({ cases, onRefresh }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all, lso, concurso
  const [toast, setToast] = useState(null);
  const [assigningCase, setAssigningCase] = useState(null);
  const [reviewingCase, setReviewingCase] = useState(null);

  const filtered = cases.filter(c => {
    const matchesSearch = !search || c.client.name.toLowerCase().includes(search.toLowerCase()) || c.client.caseId.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || c.client.caseType === typeFilter;
    return matchesSearch && matchesType;
  });

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: "0 8px 30px rgba(0,0,0,.2)", maxWidth: "90%", textAlign: "center" }}>{toast}</div>}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={15} color={C.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o expediente..."
            style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: font, background: C.card }}
          />
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {[{ k: "all", l: "Todos" }, { k: "lso", l: "LSO" }, { k: "concurso", l: "Concurso" }].map(f => (
            <button key={f.k} onClick={() => setTypeFilter(f.k)} style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: font,
              background: typeFilter === f.k ? `linear-gradient(135deg,${C.primary},${C.violet})` : C.card,
              color: typeFilter === f.k ? "#fff" : C.text,
              border: `1px solid ${typeFilter === f.k ? "transparent" : C.border}`
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>{filtered.length} expediente{filtered.length !== 1 ? "s" : ""}</p>

      {/* Table */}
      <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px 1fr 80px", gap: 8, padding: "12px 18px", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
          {["Cliente", "Expediente", "Tipo", "Progreso", "Estado", ""].map(h => (
            <span key={h} style={{ fontSize: 10.5, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".05em" }}>{h}</span>
          ))}
        </div>

        {/* Rows */}
        {filtered.map((c, i) => {
          const isCompany = c.client.caseType === "concurso";
          const hasAlerts = c.docsInReview > 0 || (c.nextPayment && daysUntil(c.nextPayment.date) <= 3);
          return (
            <button
              key={i}
              onClick={() => setReviewingCase(c)}
              style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 120px 1fr 80px", gap: 8,
                padding: "14px 18px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : "none",
                width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: font,
                textAlign: "left", transition: "background .15s",
                alignItems: "center"
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {/* Client */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: `rgba(91,107,240,.08)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isCompany ? <Building2 size={15} color={C.primary} /> : <User size={15} color={C.primary} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.client.name}</p>
                  <p style={{ fontSize: 10.5, color: C.textMuted }}>Abogado: {c.client.lawyer}</p>
                  <p style={{ fontSize: 10.5, color: C.textMuted }}>Procurador: {c.client.procurador || 'Sin asignar'}</p>
                </div>
              </div>

              {/* Expediente */}
              <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{c.client.caseId}</span>

              {/* Tipo */}
              <span style={{
                display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: isCompany ? `rgba(124,91,240,.08)` : `rgba(91,107,240,.08)`,
                color: isCompany ? C.violet : C.primary,
                width: "fit-content"
              }}>
                {isCompany ? "Concurso" : "LSO"}
              </span>

              {/* Progress */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${c.progress}%`, borderRadius: 3, background: c.progress >= 100 ? C.green : `linear-gradient(90deg,${C.primary},${C.violet})` }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.progress >= 100 ? C.green : C.primary }}>{c.progress}%</span>
                </div>
              </div>

              {/* Status / Alerts */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 5, background: C.bg, fontSize: 10.5, fontWeight: 500, color: C.text }}>
                  <FileText size={10} />{c.pendingDocs} pend.
                </span>
                {c.docsInReview > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 5, background: C.orangeSoft, fontSize: 10.5, fontWeight: 500, color: C.orange }}>
                    <Eye size={10} />{c.docsInReview} rev.
                  </span>
                )}
                {c.nextPayment && daysUntil(c.nextPayment.date) <= 7 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 5, background: daysUntil(c.nextPayment.date) <= 3 ? C.redSoft : C.orangeSoft, fontSize: 10.5, fontWeight: 500, color: daysUntil(c.nextPayment.date) <= 3 ? C.red : C.orange }}>
                    <Clock size={10} />{daysUntil(c.nextPayment.date)}d pago
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setReviewingCase(c); }}
                  title="Revisar documentos"
                  style={{ padding: "6px 10px", borderRadius: 7, background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff", fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                >
                  <FileText size={11} /> Docs
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setAssigningCase(c); }}
                  title="Asignar equipo"
                  style={{ padding: "6px 10px", borderRadius: 7, background: C.card, color: C.text, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", border: `1px solid ${C.border}` }}
                >
                  <UserCheck size={11} /> Equipo
                </span>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <Search size={28} color={C.textMuted} style={{ marginBottom: 8, opacity: 0.4 }} />
            <p style={{ fontSize: 13, color: C.textMuted }}>No se encontraron expedientes</p>
          </div>
        )}
      </div>

      {assigningCase && (
        <AssignCaseModal
          caseData={assigningCase}
          onClose={() => setAssigningCase(null)}
          onSaved={() => { setAssigningCase(null); if (onRefresh) onRefresh(); }}
        />
      )}

      {reviewingCase && (
        <CaseDocuments
          caseId={reviewingCase.id}
          caseNumber={reviewingCase.case_number || reviewingCase.client?.caseId}
          clientName={reviewingCase.client?.name || "Cliente"}
          onClose={() => { setReviewingCase(null); if (onRefresh) onRefresh(); }}
        />
      )}
    </div>
  );
}
