import { useState, useEffect, useCallback } from "react";
import {
  Search, BookOpen, Bookmark, BookmarkCheck, ExternalLink,
  Filter, Calendar, Building2, ChevronDown, ChevronUp, Sparkles,
  Scale, X, Loader2,
} from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import ResultDetail from "./ResultDetail";

// ═══════════════════════════════════════════
//  Skeleton loader
// ═══════════════════════════════════════════
function SkeletonCard() {
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: "20px 24px", marginBottom: 12, animation: "fadeIn .4s ease",
    }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 180, height: 14, background: C.border, borderRadius: 6 }} />
        <div style={{ width: 120, height: 14, background: C.border, borderRadius: 6 }} />
      </div>
      <div style={{ width: "90%", height: 12, background: `${C.border}80`, borderRadius: 5, marginBottom: 8 }} />
      <div style={{ width: "70%", height: 12, background: `${C.border}80`, borderRadius: 5, marginBottom: 8 }} />
      <div style={{ width: "50%", height: 12, background: `${C.border}60`, borderRadius: 5 }} />
    </div>
  );
}

// ═══════════════════════════════════════════
//  Toast notification
// ═══════════════════════════════════════════
function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 28, right: 28, zIndex: 9999,
      background: C.sidebar, color: "#fff", padding: "12px 22px",
      borderRadius: 10, fontSize: 13, fontWeight: 500,
      boxShadow: "0 8px 30px rgba(0,0,0,.18)", animation: "fadeIn .25s ease",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      {message}
      <button onClick={onClose} style={{ background: "none", color: "rgba(255,255,255,.5)", cursor: "pointer" }}><X size={14} /></button>
    </div>
  );
}

// ═══════════════════════════════════════════
//  Filter chip
// ═══════════════════════════════════════════
function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: active ? 600 : 400,
      background: active ? `linear-gradient(135deg, ${C.primary}15, ${C.violet}12)` : C.white,
      color: active ? C.primary : C.textMuted,
      border: `1px solid ${active ? C.primary + "30" : C.border}`,
      cursor: "pointer", transition: ".2s", whiteSpace: "nowrap",
    }}>
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════
//  Search suggestions (empty state)
// ═══════════════════════════════════════════
const SUGGESTIONS = [
  "exoneracion deuda hipotecaria",
  "BEPI credito publico",
  "plan de pagos concurso",
  "segunda oportunidad autonomo",
  "nulidad clausula suelo",
];

// ═══════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════
export default function SearchView() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all | jurisprudence | legislation
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const [savedItems, setSavedItems] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // Load saved items
  useEffect(() => {
    supabase
      .from("saved_items")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setSavedItems(data);
          setSavedIds(new Set(data.map(s => s.item_id)));
        }
      });
  }, []);

  // ── Search logic ──
  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    setDetailItem(null);

    const promises = [];

    if (typeFilter === "all" || typeFilter === "jurisprudence") {
      promises.push(
        supabase
          .from("jurisprudence")
          .select("*")
          .textSearch("summary", q, { type: "websearch", config: "spanish" })
          .limit(20)
          .then(({ data }) => (data || []).map(d => ({ ...d, _type: "jurisprudence" })))
      );
    }

    if (typeFilter === "all" || typeFilter === "legislation") {
      promises.push(
        supabase
          .from("legislation")
          .select("*")
          .textSearch("title", q, { type: "websearch", config: "spanish" })
          .limit(20)
          .then(({ data }) => (data || []).map(d => ({ ...d, _type: "legislation" })))
      );
    }

    try {
      const allResults = await Promise.all(promises);
      const combined = allResults.flat();
      setResults(combined);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [typeFilter]);

  const handleSubmit = (e) => {
    e.preventDefault();
    doSearch(query);
  };

  const handleSuggestion = (s) => {
    setQuery(s);
    doSearch(s);
  };

  // ── Save / unsave ──
  const toggleSave = async (item, type) => {
    const itemId = String(item.id);
    if (savedIds.has(itemId)) {
      await supabase.from("saved_items").delete().eq("item_id", itemId);
      setSavedIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
      setSavedItems(prev => prev.filter(s => s.item_id !== itemId));
      setToast("Eliminado de guardados");
    } else {
      const record = {
        item_id: itemId,
        item_type: type,
        title: type === "jurisprudence" ? (item.reference || "Sentencia") : (item.title || "Legislacion"),
        data: item,
      };
      const { data } = await supabase.from("saved_items").insert(record).select().single();
      if (data) {
        setSavedIds(prev => new Set(prev).add(itemId));
        setSavedItems(prev => [data, ...prev]);
      }
      setToast("Guardado correctamente");
    }
  };

  // ── Detail view ──
  if (detailItem) {
    return (
      <ResultDetail
        item={detailItem}
        type={detailType}
        onBack={() => { setDetailItem(null); setDetailType(null); }}
      />
    );
  }

  const resultCount = results.length;

  return (
    <div style={{ fontFamily: font, animation: "fadeIn .35s ease" }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .lc-skel{animation:pulse 1.5s ease-in-out infinite}
      `}</style>

      {/* ═══ Header area ═══ */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Scale size={22} color={C.primary} />
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em" }}>LexConsulta</h2>
        </div>
        <p style={{ fontSize: 12.5, color: C.textMuted }}>
          Busqueda de jurisprudencia y legislacion concursal
        </p>
      </div>

      {/* ═══ Search bar ═══ */}
      <form onSubmit={handleSubmit} style={{
        background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
        padding: "6px 8px", display: "flex", alignItems: "center", gap: 8,
        marginBottom: 14, boxShadow: "0 2px 12px rgba(0,0,0,.04)",
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Search size={18} color="#fff" />
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar jurisprudencia y legislacion..."
          style={{
            flex: 1, border: "none", outline: "none", fontSize: 14,
            fontFamily: font, color: C.text, background: "transparent",
            padding: "10px 4px",
          }}
        />
        {query && (
          <button type="button" onClick={() => { setQuery(""); setResults([]); setSearched(false); }} style={{
            background: "none", color: C.textMuted, cursor: "pointer", padding: 4,
          }}>
            <X size={16} />
          </button>
        )}
        <button type="submit" style={{
          padding: "9px 20px", borderRadius: 9,
          background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
          color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          Buscar
        </button>
      </form>

      {/* ═══ Filters ═══ */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18, alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 4 }}>
          <Filter size={13} color={C.textMuted} />
          <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>Tipo:</span>
        </div>
        <Chip label="Todos" active={typeFilter === "all"} onClick={() => setTypeFilter("all")} />
        <Chip label="Jurisprudencia" active={typeFilter === "jurisprudence"} onClick={() => setTypeFilter("jurisprudence")} />
        <Chip label="Legislacion" active={typeFilter === "legislation"} onClick={() => setTypeFilter("legislation")} />

        <div style={{ flex: 1 }} />

        {/* Saved toggle */}
        <button onClick={() => setShowSaved(!showSaved)} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
          borderRadius: 20, fontSize: 12, fontWeight: showSaved ? 600 : 400,
          background: showSaved ? `${C.primary}12` : C.white,
          color: showSaved ? C.primary : C.textMuted,
          border: `1px solid ${showSaved ? C.primary + "30" : C.border}`,
          cursor: "pointer",
        }}>
          <Bookmark size={13} /> Guardados ({savedItems.length})
        </button>
      </div>

      {/* ═══ Main content area ═══ */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Results column */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Powered badge */}
          {searched && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 12.5, color: C.textMuted, fontWeight: 500 }}>
                {loading ? "Buscando..." : `${resultCount} resultado${resultCount !== 1 ? "s" : ""} para "${query}"`}
              </span>
              <span style={{
                fontSize: 10, color: C.textMuted, padding: "3px 10px",
                background: `${C.border}60`, borderRadius: 20, fontWeight: 500,
              }}>
                Powered by CENDOJ + BOE
              </span>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="lc-skel">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Empty state */}
          {!loading && !searched && !showSaved && (
            <div style={{
              background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
              padding: "48px 32px", textAlign: "center",
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px",
                background: `linear-gradient(135deg, ${C.primary}12, ${C.violet}10)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Scale size={28} color={C.primary} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: C.text }}>
                Busca sentencias del Tribunal Supremo, BOE y legislacion concursal
              </h3>
              <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, maxWidth: 420, margin: "0 auto 20px" }}>
                Accede a jurisprudencia y normativa relevante para tus expedientes de segunda oportunidad y concurso de acreedores.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => handleSuggestion(s)} style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 12,
                    background: `${C.primary}08`, color: C.primary,
                    border: `1px solid ${C.primary}18`, cursor: "pointer",
                    fontWeight: 500,
                  }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {!loading && searched && resultCount === 0 && (
            <div style={{
              background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
              padding: "40px 32px", textAlign: "center",
            }}>
              <p style={{ fontSize: 14, color: C.textMuted }}>
                No se encontraron resultados para "<strong>{query}</strong>".
              </p>
              <p style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                Prueba con otros terminos o revisa los filtros.
              </p>
            </div>
          )}

          {/* Result cards */}
          {!loading && !showSaved && results.map(item => (
            <ResultCard
              key={`${item._type}-${item.id}`}
              item={item}
              type={item._type}
              isSaved={savedIds.has(String(item.id))}
              expanded={expandedId === item.id}
              onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onSave={() => toggleSave(item, item._type)}
              onDetail={() => { setDetailItem(item); setDetailType(item._type); }}
              onCarlota={() => setToast("Proximamente: consulta con Carlota")}
            />
          ))}

          {/* Saved items list */}
          {showSaved && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                Elementos guardados ({savedItems.length})
              </h3>
              {savedItems.length === 0 && (
                <div style={{
                  background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
                  padding: "32px 24px", textAlign: "center",
                }}>
                  <Bookmark size={24} color={C.textMuted} style={{ marginBottom: 8 }} />
                  <p style={{ fontSize: 13, color: C.textMuted }}>
                    Aun no has guardado ninguna sentencia o ley.
                  </p>
                </div>
              )}
              {savedItems.map(s => (
                <div key={s.id} style={{
                  background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
                  padding: "14px 20px", marginBottom: 8,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                      color: s.item_type === "jurisprudence" ? C.primary : C.teal,
                    }}>
                      {s.item_type === "jurisprudence" ? "Jurisprudencia" : "Legislacion"}
                    </span>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginTop: 2 }}>{s.title}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => {
                      if (s.data) { setDetailItem(s.data); setDetailType(s.item_type); setShowSaved(false); }
                    }} style={{
                      padding: "5px 12px", borderRadius: 6, fontSize: 11,
                      background: `${C.primary}10`, color: C.primary, fontWeight: 600, cursor: "pointer",
                    }}>
                      Ver
                    </button>
                    <button onClick={() => toggleSave(s.data || { id: s.item_id }, s.item_type)} style={{
                      padding: "5px 10px", borderRadius: 6, fontSize: 11,
                      background: C.redSoft, color: C.red, fontWeight: 600, cursor: "pointer",
                    }}>
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════
//  Result Card component
// ═══════════════════════════════════════════
function ResultCard({ item, type, isSaved, expanded, onToggleExpand, onSave, onDetail, onCarlota }) {
  if (type === "jurisprudence") {
    return (
      <div style={{
        background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
        padding: "18px 22px", marginBottom: 12,
        transition: ".2s", cursor: "default",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.primary}15, ${C.violet}12)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Building2 size={15} color={C.primary} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                {item.reference || "Sentencia"}
              </span>
              {item.tribunal && (
                <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                  {item.tribunal}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 11.5, color: C.textMuted, marginTop: 2, flexWrap: "wrap" }}>
              {item.chamber && <span>{item.chamber}</span>}
              {item.date && <span>{new Date(item.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>}
              {item.judge && <span style={{ fontStyle: "italic" }}>Ponente: {item.judge}</span>}
            </div>
          </div>
        </div>

        {/* Summary */}
        <p style={{
          fontSize: 13, lineHeight: 1.6, color: C.text, marginBottom: 10,
          display: "-webkit-box", WebkitLineClamp: expanded ? 999 : 3,
          WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {item.summary || "Sin resumen disponible."}
        </p>

        {/* Expanded full text */}
        {expanded && item.full_text && (
          <div style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 13, lineHeight: 1.8, color: "#444",
            maxHeight: 400, overflowY: "auto",
            padding: "14px 18px", background: "#FAFAF8",
            borderRadius: 8, border: `1px solid ${C.border}`,
            marginBottom: 10, whiteSpace: "pre-wrap",
          }}>
            {item.full_text}
          </div>
        )}

        {/* Matter tags */}
        {item.matter && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
            {(Array.isArray(item.matter) ? item.matter : [item.matter]).map(m => (
              <span key={m} style={{
                display: "inline-block", padding: "2px 9px", borderRadius: 14,
                fontSize: 10.5, fontWeight: 600,
                background: `linear-gradient(135deg, ${C.primary}12, ${C.violet}10)`,
                color: C.primary,
              }}>{m}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onToggleExpand} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
            borderRadius: 7, fontSize: 11.5, fontWeight: 500,
            background: `${C.primary}08`, color: C.primary, cursor: "pointer",
          }}>
            <BookOpen size={13} />
            {expanded ? "Ocultar" : "Ver completa"}
          </button>
          <button onClick={onSave} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
            borderRadius: 7, fontSize: 11.5, fontWeight: 500,
            background: isSaved ? `${C.green}10` : `${C.border}40`,
            color: isSaved ? C.green : C.textMuted, cursor: "pointer",
          }}>
            {isSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
            {isSaved ? "Guardado" : "Guardar"}
          </button>
          <button onClick={onCarlota} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
            borderRadius: 7, fontSize: 11.5, fontWeight: 500,
            background: `linear-gradient(135deg, ${C.violet}10, ${C.primary}08)`,
            color: C.violet, cursor: "pointer",
          }}>
            <Sparkles size={13} /> Carlota
          </button>
        </div>
      </div>
    );
  }

  // ── Legislation card ──
  return (
    <div style={{
      background: C.white, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: "18px 22px", marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${C.teal}12`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
        }}>
          &#128220;
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            {item.title || "Legislacion"}
          </span>
          {item.reference && (
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{item.reference}</p>
          )}
          <div style={{ display: "flex", gap: 10, fontSize: 11.5, color: C.textMuted, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
            {item.publication_date && <span>Publicado: {new Date(item.publication_date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>}
            {item.status && (
              <span style={{
                padding: "1px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700,
                background: item.status === "vigente" ? C.greenSoft : C.orangeSoft,
                color: item.status === "vigente" ? C.green : C.orange,
              }}>
                {item.status === "vigente" ? "Vigente" : item.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body preview */}
      {item.body && (
        <p style={{
          fontSize: 13, lineHeight: 1.6, color: C.text, marginBottom: 10,
          display: "-webkit-box", WebkitLineClamp: expanded ? 999 : 3,
          WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {item.body}
        </p>
      )}

      {/* Expanded body */}
      {expanded && item.body && (
        <div style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 13, lineHeight: 1.8, color: "#444",
          maxHeight: 400, overflowY: "auto",
          padding: "14px 18px", background: "#FAFAF8",
          borderRadius: 8, border: `1px solid ${C.border}`,
          marginBottom: 10, whiteSpace: "pre-wrap",
        }}>
          {item.body}
        </div>
      )}

      {/* Category tag */}
      {item.category && (
        <div style={{ marginBottom: 12 }}>
          <span style={{
            display: "inline-block", padding: "2px 9px", borderRadius: 14,
            fontSize: 10.5, fontWeight: 600,
            background: `${C.teal}12`, color: C.teal,
          }}>{item.category}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onDetail} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
          borderRadius: 7, fontSize: 11.5, fontWeight: 500,
          background: `${C.teal}10`, color: C.teal, cursor: "pointer",
        }}>
          <ExternalLink size={13} /> Ver en BOE
        </button>
        <button onClick={onSave} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
          borderRadius: 7, fontSize: 11.5, fontWeight: 500,
          background: isSaved ? `${C.green}10` : `${C.border}40`,
          color: isSaved ? C.green : C.textMuted, cursor: "pointer",
        }}>
          {isSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
          {isSaved ? "Guardado" : "Guardar"}
        </button>
        <button onClick={onCarlota} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
          borderRadius: 7, fontSize: 11.5, fontWeight: 500,
          background: `linear-gradient(135deg, ${C.violet}10, ${C.primary}08)`,
          color: C.violet, cursor: "pointer",
        }}>
          <Sparkles size={13} /> Preguntar
        </button>
      </div>
    </div>
  );
}
