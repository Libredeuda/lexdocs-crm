import { useState, useEffect } from "react";
import {
  ArrowLeft, ExternalLink, Sparkles, BookOpen, Tag, User, Calendar,
  Building2, ChevronDown, ChevronUp, Scale,
} from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";

const badge = (text, bg, color) => (
  <span key={text} style={{
    display: "inline-block", padding: "3px 10px", borderRadius: 20,
    fontSize: 11, fontWeight: 600, background: bg, color,
    marginRight: 6, marginBottom: 4,
  }}>{text}</span>
);

export default function ResultDetail({ item, type, onBack }) {
  const [related, setRelated] = useState([]);
  const [showFullText, setShowFullText] = useState(false);

  useEffect(() => {
    if (type !== "jurisprudence" || !item.matter) return;
    const tags = Array.isArray(item.matter) ? item.matter : [item.matter];
    if (!tags.length) return;

    supabase
      .from("jurisprudence")
      .select("id, reference, tribunal, summary, date")
      .contains("matter", [tags[0]])
      .neq("id", item.id)
      .limit(5)
      .then(({ data }) => setRelated(data || []));
  }, [item, type]);

  if (type === "jurisprudence") {
    return (
      <div style={{ fontFamily: font, animation: "fadeIn .3s ease" }}>
        {/* Back button */}
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
          borderRadius: 8, background: C.white, border: `1px solid ${C.border}`,
          color: C.textMuted, fontSize: 12, fontWeight: 500, marginBottom: 20,
          cursor: "pointer",
        }}>
          <ArrowLeft size={14} /> Volver a resultados
        </button>

        {/* Header card */}
        <div style={{
          background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
          overflow: "hidden",
        }}>
          {/* Top bar */}
          <div style={{
            background: `linear-gradient(135deg, ${C.sidebar}, ${C.sidebarLight})`,
            padding: "22px 28px", color: "#fff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Scale size={18} style={{ opacity: 0.7 }} />
              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1 }}>Jurisprudencia</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
              {item.reference || "Sin referencia"}
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, opacity: 0.85 }}>
              {item.tribunal && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Building2 size={13} /> {item.tribunal}</span>}
              {item.chamber && <span>{item.chamber}</span>}
              {item.date && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={13} /> {new Date(item.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>}
            </div>
            {item.judge && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                <User size={12} /> Ponente: {item.judge}
              </div>
            )}
          </div>

          {/* Matter tags */}
          {item.matter && (
            <div style={{ padding: "14px 28px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Tag size={13} color={C.textMuted} />
                <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase" }}>Materias</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap" }}>
                {(Array.isArray(item.matter) ? item.matter : [item.matter]).map(m =>
                  badge(m, `linear-gradient(135deg, ${C.primary}15, ${C.violet}15)`, C.primary)
                )}
              </div>
            </div>
          )}

          {/* Summary */}
          <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Resumen</h3>
            <p style={{
              fontSize: 14, lineHeight: 1.7, color: C.text,
              background: `${C.primary}06`, borderLeft: `3px solid ${C.primary}`,
              padding: "14px 18px", borderRadius: "0 8px 8px 0",
            }}>
              {item.summary || "Sin resumen disponible."}
            </p>
          </div>

          {/* Full text */}
          {item.full_text && (
            <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}` }}>
              <button onClick={() => setShowFullText(!showFullText)} style={{
                display: "flex", alignItems: "center", gap: 6, background: "none",
                color: C.primary, fontSize: 13, fontWeight: 600, cursor: "pointer",
                marginBottom: showFullText ? 14 : 0,
              }}>
                <BookOpen size={14} />
                {showFullText ? "Ocultar texto completo" : "Ver texto completo"}
                {showFullText ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showFullText && (
                <div style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 14, lineHeight: 1.85, color: "#333",
                  maxHeight: 600, overflowY: "auto",
                  padding: "18px 22px", background: "#FAFAF8",
                  borderRadius: 10, border: `1px solid ${C.border}`,
                  whiteSpace: "pre-wrap",
                }}>
                  {item.full_text}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ padding: "16px 28px", display: "flex", flexWrap: "wrap", gap: 10 }}>
            {item.cendoj_url && (
              <a href={item.cendoj_url} target="_blank" rel="noopener noreferrer" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8,
                background: C.sidebar, color: "#fff", fontSize: 12,
                fontWeight: 600, textDecoration: "none",
              }}>
                <ExternalLink size={13} /> Ver en CENDOJ
              </a>
            )}
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
              color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              <Sparkles size={13} /> Preguntar a Carlota sobre esta sentencia
            </button>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Sentencias relacionadas</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {related.map(r => (
                <div key={r.id} style={{
                  background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
                  padding: "12px 18px", fontSize: 13,
                }}>
                  <span style={{ fontWeight: 700, color: C.primary }}>{r.reference}</span>
                  {r.tribunal && <span style={{ color: C.textMuted, marginLeft: 8 }}>{r.tribunal}</span>}
                  {r.summary && <p style={{ color: C.text, marginTop: 4, fontSize: 12, lineHeight: 1.5 }}>{(r.summary || "").substring(0, 140)}...</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Legislation detail ──
  return (
    <div style={{ fontFamily: font, animation: "fadeIn .3s ease" }}>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
        borderRadius: 8, background: C.white, border: `1px solid ${C.border}`,
        color: C.textMuted, fontSize: 12, fontWeight: 500, marginBottom: 20,
        cursor: "pointer",
      }}>
        <ArrowLeft size={14} /> Volver a resultados
      </button>

      <div style={{
        background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
        overflow: "hidden",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.teal}18, ${C.teal}08)`,
          padding: "22px 28px", borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>&#128220;</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.teal, textTransform: "uppercase", letterSpacing: 1 }}>Legislacion</span>
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            {item.title || "Sin titulo"}
          </h2>
          {item.reference && <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>{item.reference}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: C.textMuted, marginTop: 8 }}>
            {item.publication_date && <span>Publicado: {new Date(item.publication_date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>}
            {item.status && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: item.status === "vigente" ? C.greenSoft : C.orangeSoft,
                color: item.status === "vigente" ? C.green : C.orange,
              }}>
                {item.status === "vigente" ? "Vigente" : item.status}
              </span>
            )}
          </div>
        </div>

        {item.category && (
          <div style={{ padding: "12px 28px", borderBottom: `1px solid ${C.border}` }}>
            {badge(item.category, `${C.teal}12`, C.teal)}
          </div>
        )}

        {item.body && (
          <div style={{ padding: "20px 28px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 14, lineHeight: 1.85, color: "#333",
              maxHeight: 600, overflowY: "auto",
              padding: "18px 22px", background: "#FAFAF8",
              borderRadius: 10, border: `1px solid ${C.border}`,
              whiteSpace: "pre-wrap",
            }}>
              {item.body}
            </div>
          </div>
        )}

        <div style={{ padding: "16px 28px", display: "flex", flexWrap: "wrap", gap: 10 }}>
          {item.boe_url && (
            <a href={item.boe_url} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: C.sidebar, color: "#fff", fontSize: 12,
              fontWeight: 600, textDecoration: "none",
            }}>
              <ExternalLink size={13} /> Ver en BOE
            </a>
          )}
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            <Sparkles size={13} /> Preguntar a Carlota
          </button>
        </div>
      </div>
    </div>
  );
}
