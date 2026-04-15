import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Check } from "lucide-react";
import { C } from "../../constants";

const font = "'Poppins', sans-serif";

const MOCK_STAGES = [
  { id: '1', name: 'Nuevo lead', position: 1, color: '#3b82f6' },
  { id: '2', name: 'Contactado', position: 2, color: '#f59e0b' },
  { id: '3', name: 'Cualificado', position: 3, color: '#8b5cf6' },
  { id: '4', name: 'Cliente', position: 4, color: '#22c55e' },
  { id: '5', name: 'Perdido', position: 5, color: '#ef4444' },
];

export default function PipelineSettings() {
  const [pipelineName, setPipelineName] = useState("Pipeline principal");
  const [stages, setStages] = useState(MOCK_STAGES);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const updateStage = (id, field, value) => {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const moveStage = (index, direction) => {
    const newStages = [...stages];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
    setStages(newStages.map((s, i) => ({ ...s, position: i + 1 })));
  };

  const deleteStage = (id) => {
    setStages((prev) =>
      prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, position: i + 1 }))
    );
  };

  const addStage = () => {
    const newId = String(Date.now());
    setStages((prev) => [
      ...prev,
      { id: newId, name: "", position: prev.length + 1, color: "#6b7280" },
    ]);
  };

  const card = {
    background: C.white, borderRadius: 14,
    border: `1px solid ${C.border}`, padding: "24px 28px", marginBottom: 20,
  };

  const input = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font,
    color: C.text, outline: "none", background: C.white,
  };

  const label = {
    fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6, display: "block",
  };

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

      {/* Pipeline name */}
      <div style={card}>
        <label style={label}>Nombre del pipeline</label>
        <input
          style={{ ...input, maxWidth: 400 }}
          value={pipelineName}
          onChange={(e) => setPipelineName(e.target.value)}
        />
      </div>

      {/* Stages */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Etapas</h3>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 18 }}>
          Configura las etapas de tu pipeline de ventas
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stages.map((stage, i) => (
            <div key={stage.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              border: `1px solid ${C.border}`, background: "#fafafa",
              transition: ".15s",
            }}>
              {/* Drag handle icon */}
              <GripVertical size={16} color={C.textLight} style={{ cursor: "grab", flexShrink: 0 }} />

              {/* Position number */}
              <span style={{
                width: 24, height: 24, borderRadius: 6,
                background: `${stage.color}18`, color: stage.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {stage.position}
              </span>

              {/* Color picker */}
              <input
                type="color"
                value={stage.color}
                onChange={(e) => updateStage(stage.id, "color", e.target.value)}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: `2px solid ${C.border}`,
                  padding: 1, cursor: "pointer", background: C.white, flexShrink: 0,
                }}
              />

              {/* Name */}
              <input
                style={{ ...input, flex: 1 }}
                value={stage.name}
                onChange={(e) => updateStage(stage.id, "name", e.target.value)}
                placeholder="Nombre de la etapa"
              />

              {/* Up/Down */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  onClick={() => moveStage(i, -1)}
                  disabled={i === 0}
                  style={{
                    padding: 3, borderRadius: 4,
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
                    padding: 3, borderRadius: 4,
                    background: i === stages.length - 1 ? "#eee" : `${C.primary}10`,
                    color: i === stages.length - 1 ? "#ccc" : C.primary,
                  }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>

              {/* Delete */}
              <button
                onClick={() => deleteStage(stage.id)}
                disabled={stages.length <= 2}
                style={{
                  padding: 6, borderRadius: 6,
                  background: stages.length <= 2 ? "#eee" : C.redSoft,
                  color: stages.length <= 2 ? "#ccc" : C.red,
                  flexShrink: 0,
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* Add stage */}
        <button
          onClick={addStage}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 16px", borderRadius: 10, marginTop: 12,
            background: `${C.primary}08`, color: C.primary,
            fontSize: 12, fontWeight: 600, width: "100%",
            justifyContent: "center",
            border: `1px dashed ${C.primary}30`,
          }}
        >
          <Plus size={15} /> Anadir etapa
        </button>
      </div>

      {/* Preview */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 14 }}>Vista previa</h3>
        <div style={{
          display: "flex", gap: 8, overflowX: "auto",
          padding: "4px 0",
        }}>
          {stages.map((stage) => (
            <div key={stage.id} style={{
              flex: "0 0 auto", minWidth: 110,
              borderRadius: 10, overflow: "hidden",
              border: `1px solid ${C.border}`,
              background: C.white,
            }}>
              <div style={{
                height: 4, background: stage.color,
              }} />
              <div style={{ padding: "10px 12px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>
                  {stage.name || "Sin nombre"}
                </p>
                <p style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>0 contactos</p>
              </div>
              {/* Mini placeholder cards */}
              <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
                {[1, 2].map((n) => (
                  <div key={n} style={{
                    height: 18, borderRadius: 4,
                    background: `${stage.color}10`,
                    border: `1px solid ${stage.color}15`,
                  }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => showToast("Pipeline guardado")}
          style={{
            padding: "11px 32px", borderRadius: 10,
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 13, fontWeight: 600,
            boxShadow: `0 4px 16px ${C.primary}30`,
          }}
        >
          Guardar pipeline
        </button>
      </div>
    </div>
  );
}
