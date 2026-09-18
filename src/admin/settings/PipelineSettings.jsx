import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Check, AlertCircle, Lock } from "lucide-react";
import { C } from "../../constants";
import { loadPipelineStages, savePipelineStages } from "../../lib/pipelineStages";

const font = "'Poppins', sans-serif";

let localIdCounter = 0;
const newLocalId = () => `new-${++localIdCounter}`;

export default function PipelineSettings() {
  const [stages, setStages] = useState([]);
  const [original, setOriginal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await loadPipelineStages();
      const withLocalId = data.map(s => ({ ...s, _localId: s.id }));
      setStages(withLocalId);
      setOriginal(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const updateStage = (localId, field, value) => {
    setStages((prev) => prev.map((s) => (s._localId === localId ? { ...s, [field]: value } : s)));
  };

  const moveStage = (index, direction) => {
    const newStages = [...stages];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
    setStages(newStages);
  };

  const deleteStage = (localId) => {
    setStages((prev) => prev.filter((s) => s._localId !== localId));
  };

  const addStage = () => {
    setStages((prev) => [
      ...prev,
      { _localId: newLocalId(), id: null, key: null, label: "", color: "#6b7280", is_won: false, is_lost: false },
    ]);
  };

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const saved = await savePipelineStages(stages, original);
      showToast("Pipeline guardado");
      await load();
      return saved;
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const card = {
    background: C.white, borderRadius: 14,
    border: `1px solid ${C.border}`, padding: "24px 28px", marginBottom: 20,
  };

  const input = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font,
    color: C.text, outline: "none", background: C.white,
  };

  if (loading) return <p style={{ fontSize: 13, color: C.textMuted }}>Cargando...</p>;

  return (
    <div style={{ maxWidth: 720, animation: "fadeIn .35s ease" }}>
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, background: C.sidebar,
          color: "#fff", padding: "12px 22px", borderRadius: 10, fontSize: 13,
          fontWeight: 500, zIndex: 9999, display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,.18)", animation: "fadeIn .25s ease",
        }}>
          <Check size={15} /> {toast}
        </div>
      )}

      {/* Stages */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Etapas del pipeline</h3>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 18 }}>
          Estas son las columnas del Kanban de Contactos. Añade, renombra, recolorea, reordena o elimina las que quieras.
          Las etapas con <Lock size={10} style={{ verticalAlign: -1 }} /> tienen un significado especial en el CRM (venta cerrada / lead perdido) y no se pueden eliminar, pero sí renombrar y recolorear.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stages.map((stage, i) => {
            const locked = stage.is_won || stage.is_lost;
            return (
              <div key={stage._localId} style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "10px 14px", borderRadius: 10,
                border: `1px solid ${C.border}`, background: "#fafafa",
                transition: ".15s",
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: `${stage.color}18`, color: stage.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  {i + 1}
                </span>

                <input
                  type="color"
                  value={stage.color}
                  onChange={(e) => updateStage(stage._localId, "color", e.target.value)}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: `2px solid ${C.border}`,
                    padding: 1, cursor: "pointer", background: C.white, flexShrink: 0,
                  }}
                />

                <input
                  style={{ ...input, flex: 1, minWidth: 140 }}
                  value={stage.label}
                  onChange={(e) => updateStage(stage._localId, "label", e.target.value)}
                  placeholder="Nombre de la etapa"
                />

                {locked && <Lock size={13} color={C.textMuted} title={stage.is_won ? "Marca venta cerrada" : "Marca lead perdido"} />}

                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button
                    onClick={() => moveStage(i, -1)}
                    disabled={i === 0}
                    style={{
                      padding: 3, borderRadius: 4, border: "none", cursor: i === 0 ? "default" : "pointer",
                      background: i === 0 ? "#eee" : `${C.primary}10`,
                      color: i === 0 ? "#ccc" : C.primary,
                    }}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={() => moveStage(i, 1)}
                    disabled={i === stages.length - 1}
                    style={{
                      padding: 3, borderRadius: 4, border: "none", cursor: i === stages.length - 1 ? "default" : "pointer",
                      background: i === stages.length - 1 ? "#eee" : `${C.primary}10`,
                      color: i === stages.length - 1 ? "#ccc" : C.primary,
                    }}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                <button
                  onClick={() => deleteStage(stage._localId)}
                  disabled={locked || stages.length <= 1}
                  title={locked ? "Esta etapa no se puede eliminar" : "Eliminar etapa"}
                  style={{
                    padding: 6, borderRadius: 6, border: "none",
                    cursor: locked || stages.length <= 1 ? "default" : "pointer",
                    background: locked || stages.length <= 1 ? "#eee" : C.redSoft,
                    color: locked || stages.length <= 1 ? "#ccc" : C.red,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={addStage}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 16px", borderRadius: 10, marginTop: 12,
            background: `${C.primary}08`, color: C.primary,
            fontSize: 12, fontWeight: 600, width: "100%",
            justifyContent: "center", cursor: "pointer",
            border: `1px dashed ${C.primary}30`,
          }}
        >
          <Plus size={15} /> Añadir etapa
        </button>
      </div>

      {/* Preview */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 14 }}>Vista previa</h3>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0" }}>
          {stages.map((stage) => (
            <div key={stage._localId} style={{
              flex: "0 0 auto", minWidth: 110,
              borderRadius: 10, overflow: "hidden",
              border: `1px solid ${C.border}`,
              background: C.white,
            }}>
              <div style={{ height: 4, background: stage.color }} />
              <div style={{ padding: "10px 12px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>
                  {stage.label || "Sin nombre"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.red, fontSize: 12, marginBottom: 12 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "11px 32px", borderRadius: 10, border: "none",
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer",
            boxShadow: `0 4px 16px ${C.primary}30`,
          }}
        >
          {saving ? "Guardando..." : "Guardar pipeline"}
        </button>
      </div>
    </div>
  );
}
