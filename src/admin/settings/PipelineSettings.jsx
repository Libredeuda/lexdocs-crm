import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Check, AlertCircle, Lock, Star, Pencil } from "lucide-react";
import { C } from "../../constants";
import { loadPipelineStages, savePipelineStages } from "../../lib/pipelineStages";
import { loadPipelines, createPipeline, renamePipeline, deletePipeline } from "../../lib/pipelines";

const font = "'Poppins', sans-serif";

let localIdCounter = 0;
const newLocalId = () => `new-${++localIdCounter}`;

export default function PipelineSettings() {
  const [pipelines, setPipelines] = useState([]);
  const [pipelineId, setPipelineId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [stages, setStages] = useState([]);
  const [original, setOriginal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => { loadPipelinesList(); }, []);
  useEffect(() => { if (pipelineId) load(pipelineId); }, [pipelineId]);

  async function loadPipelinesList() {
    const list = await loadPipelines();
    setPipelines(list);
    setPipelineId(list.find(p => p.is_default)?.id || list[0]?.id || null);
  }

  async function load(pid) {
    setLoading(true);
    setError("");
    try {
      const data = await loadPipelineStages(pid);
      const withLocalId = data.map(s => ({ ...s, _localId: s.id }));
      setStages(withLocalId);
      setOriginal(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePipeline() {
    if (!newPipelineName.trim()) return;
    const pipeline = await createPipeline(newPipelineName);
    setNewPipelineName("");
    setCreatingPipeline(false);
    setPipelines(prev => [...prev, pipeline]);
    setPipelineId(pipeline.id);
  }

  async function handleRenamePipeline(id) {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    await renamePipeline(id, renameValue);
    setPipelines(prev => prev.map(p => p.id === id ? { ...p, name: renameValue.trim() } : p));
    setRenamingId(null);
  }

  async function handleDeletePipeline(pipeline) {
    if (pipeline.is_default) return;
    if (!window.confirm(`¿Eliminar el pipeline "${pipeline.name}"? Solo se puede si no tiene contactos.`)) return;
    try {
      await deletePipeline(pipeline.id);
      setPipelines(prev => prev.filter(p => p.id !== pipeline.id));
      if (pipelineId === pipeline.id) setPipelineId(pipelines.find(p => p.is_default)?.id || null);
    } catch (e) {
      setError(e.message);
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
      const saved = await savePipelineStages(pipelineId, stages, original);
      showToast("Pipeline guardado");
      await load(pipelineId);
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

      {/* Pipelines */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Pipelines</h3>
        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
          Puedes tener varios pipelines (por ejemplo uno para leads y otro para clientes recurrentes). Elige cuál editar.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pipelines.map(p => (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9,
              background: p.id === pipelineId ? `${C.primary}0c` : "#fafafa",
              border: `1px solid ${p.id === pipelineId ? C.primary + "40" : C.border}`,
            }}>
              {renamingId === p.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRenamePipeline(p.id); if (e.key === "Escape") setRenamingId(null); }}
                  onBlur={() => handleRenamePipeline(p.id)}
                  style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font }}
                />
              ) : (
                <button
                  onClick={() => setPipelineId(p.id)}
                  style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontFamily: font, fontWeight: p.id === pipelineId ? 700 : 500, color: C.text, padding: 0 }}
                >
                  {p.name}
                </button>
              )}
              {p.is_default && <Star size={13} color={C.primary} title="Pipeline por defecto" fill={C.primary} />}
              <button onClick={() => { setRenamingId(p.id); setRenameValue(p.name); }} title="Renombrar" style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
                <Pencil size={13} />
              </button>
              {!p.is_default && (
                <button onClick={() => handleDeletePipeline(p)} title="Eliminar" style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {creatingPipeline ? (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <input
              autoFocus
              value={newPipelineName}
              onChange={e => setNewPipelineName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreatePipeline(); if (e.key === "Escape") setCreatingPipeline(false); }}
              placeholder="Nombre del pipeline"
              style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font, outline: "none" }}
            />
            <button onClick={handleCreatePipeline} style={{ background: C.primary, border: "none", borderRadius: 9, color: "#fff", padding: "0 14px", cursor: "pointer" }}>
              <Check size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreatingPipeline(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 10,
              padding: "9px 14px", borderRadius: 9, background: `${C.primary}08`, color: C.primary,
              fontSize: 12, fontWeight: 600, border: `1px dashed ${C.primary}30`, cursor: "pointer", fontFamily: font,
            }}
          >
            <Plus size={14} /> Nuevo pipeline
          </button>
        )}
      </div>

      {/* Stages */}
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Etapas de "{pipelines.find(p => p.id === pipelineId)?.name || ""}"
        </h3>
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
