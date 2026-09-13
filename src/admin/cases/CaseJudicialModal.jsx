import { useState, useEffect } from "react";
import { X, Scale, Loader } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";

// Situación judicial del expediente: fase, presentación, notificaciones del
// juzgado y resultado. Alimenta el bloque "Expedientes" del resumen de dirección.
// La fecha de presentación y la de resolución se rellenan solas en la BD
// (migration-022) si se dejan vacías al pasar a "presentado" o poner resultado.

const FASES = [
  { id: "intake", nombre: "Alta" },
  { id: "document_collection", nombre: "Recogida de documentación" },
  { id: "lawyer_review", nombre: "Revisión del letrado" },
  { id: "drafting", nombre: "Redacción" },
  { id: "filed", nombre: "Presentado en el juzgado" },
  { id: "hearing", nombre: "En tramitación judicial" },
  { id: "closed", nombre: "Cerrado" },
];

const RESULTADOS = [
  { id: "", nombre: "Sin resolver" },
  { id: "won", nombre: "Ganado (exoneración total)" },
  { id: "partial", nombre: "Parcial" },
  { id: "dismissed", nombre: "Desestimado" },
  { id: "withdrawn", nombre: "Desistido" },
];

const hoy = () => new Date().toISOString().slice(0, 10);

export default function CaseJudicialModal({ caseId, caseNumber, clientName, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("cases").select("phase, filed_at, last_court_notice_at, outcome, resolved_at").eq("id", caseId).single()
      .then(({ data, error: e }) => {
        if (e) setError("No se pudo cargar el expediente. Si acabamos de actualizar la app, puede faltar aplicar la migración 022.");
        else setForm({ ...data, outcome: data.outcome || "" });
      });
  }, [caseId]);

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  async function guardar() {
    setGuardando(true);
    setError("");
    const cambios = {
      phase: form.phase,
      filed_at: form.filed_at || null,
      last_court_notice_at: form.last_court_notice_at || null,
      outcome: form.outcome || null,
      resolved_at: form.outcome ? (form.resolved_at || null) : null,
      phase_changed_at: new Date().toISOString(),
    };
    const { error: e } = await supabase.from("cases").update(cambios).eq("id", caseId);
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    onSaved?.();
  }

  const etiqueta = { fontSize: 11.5, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 5 };
  const campo = { width: "100%", padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: font, background: C.bg, color: C.text };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="judicial-titulo" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: C.card, borderRadius: 16, padding: 22, fontFamily: font, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Scale size={18} color={C.primary} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <h3 id="judicial-titulo" style={{ fontSize: 15.5, fontWeight: 700 }}>Situación judicial</h3>
            <p style={{ fontSize: 12, color: C.textMuted }}>{caseNumber ? `Exp. ${caseNumber} · ` : ""}{clientName}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><X size={18} /></button>
        </div>

        {!form && !error && <p style={{ fontSize: 13, color: C.textMuted }}><Loader size={14} /> Cargando…</p>}

        {form && (
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label htmlFor="jud-fase" style={etiqueta}>Fase</label>
              <select id="jud-fase" value={form.phase} onChange={(e) => cambiar("phase", e.target.value)} style={campo}>
                {FASES.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="jud-presentado" style={etiqueta}>Fecha de presentación en el juzgado</label>
              <input id="jud-presentado" type="date" value={form.filed_at || ""} onChange={(e) => cambiar("filed_at", e.target.value)} style={campo} />
              <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Si la dejas vacía, se pone hoy al pasar a "Presentado en el juzgado".</p>
            </div>
            <div>
              <label htmlFor="jud-notificacion" style={etiqueta}>Última notificación del juzgado</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input id="jud-notificacion" type="date" value={form.last_court_notice_at || ""} onChange={(e) => cambiar("last_court_notice_at", e.target.value)} style={{ ...campo, flex: 1 }} />
                <button onClick={() => cambiar("last_court_notice_at", hoy())} style={{ padding: "0 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font, color: C.text }}>Hoy</button>
              </div>
              <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Si pasan más de 3 meses sin notificaciones, el expediente aparece como alerta en el resumen.</p>
            </div>
            <div>
              <label htmlFor="jud-resultado" style={etiqueta}>Resultado</label>
              <select id="jud-resultado" value={form.outcome} onChange={(e) => cambiar("outcome", e.target.value)} style={campo}>
                {RESULTADOS.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            {form.outcome && (
              <div>
                <label htmlFor="jud-resolucion" style={etiqueta}>Fecha de resolución</label>
                <input id="jud-resolucion" type="date" value={form.resolved_at || ""} onChange={(e) => cambiar("resolved_at", e.target.value)} style={campo} />
              </div>
            )}
          </div>
        )}

        {error && <p style={{ marginTop: 12, fontSize: 12.5, color: C.red }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, color: C.text }}>Cancelar</button>
          <button onClick={guardar} disabled={!form || guardando} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: C.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, opacity: !form || guardando ? .6 : 1 }}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
