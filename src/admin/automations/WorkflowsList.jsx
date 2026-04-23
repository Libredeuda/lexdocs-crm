import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Zap, Play, Pause, Activity, CheckCircle, TrendingUp } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import WorkflowBuilder from "./WorkflowBuilder";

const TRIGGER_LABELS = {
  contact_created: "Contacto creado",
  status_changed: "Cambio de estado",
  tag_added: "Etiqueta añadida",
  stage_entered: "Entrada a fase",
  manual: "Manual",
  inactivity: "Inactividad",
};

const TRIGGER_COLORS = {
  contact_created: C.green,
  status_changed: C.orange,
  tag_added: C.violet,
  stage_entered: C.blue,
  manual: C.textMuted,
  inactivity: C.red,
};

export default function WorkflowsList({ user }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [stepCounts, setStepCounts] = useState({});

  useEffect(() => { load(); }, [user?.org_id]);

  async function load() {
    setLoading(true);
    if (!user?.org_id) { setWorkflows([]); setLoading(false); return; }
    const { data } = await supabase.from("automation_workflows")
      .select("*")
      .eq("org_id", user.org_id)
      .order("created_at", { ascending: false });
    setWorkflows(data || []);

    if (data?.length) {
      const { data: steps } = await supabase
        .from("automation_steps")
        .select("workflow_id")
        .in("workflow_id", data.map(w => w.id));
      const counts = {};
      (steps || []).forEach(s => { counts[s.workflow_id] = (counts[s.workflow_id] || 0) + 1; });
      setStepCounts(counts);
    }
    setLoading(false);
  }

  async function toggleActive(w) {
    if (!user?.org_id) return;
    await supabase.from("automation_workflows")
      .update({ is_active: !w.is_active })
      .eq("id", w.id)
      .eq("org_id", user.org_id);
    load();
  }

  async function handleDelete(w) {
    if (!window.confirm(`¿Eliminar workflow "${w.name}"?`)) return;
    if (!user?.org_id) return;
    // Los steps se borran en cascada vía FK, pero filtramos por workflow propio.
    await supabase.from("automation_workflows")
      .delete()
      .eq("id", w.id)
      .eq("org_id", user.org_id);
    load();
  }

  function handleEdit(w) {
    setEditingWorkflow(w);
    setBuilderOpen(true);
  }

  function handleNew() {
    setEditingWorkflow(null);
    setBuilderOpen(true);
  }

  return (
    <div>
      {builderOpen && (
        <WorkflowBuilder
          user={user}
          workflow={editingWorkflow}
          onClose={() => { setBuilderOpen(false); setEditingWorkflow(null); }}
          onSaved={() => { setBuilderOpen(false); setEditingWorkflow(null); load(); }}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Workflows de automatización</h2>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{workflows.length} workflows · {workflows.filter(w => w.is_active).length} activos</p>
        </div>
        <button onClick={handleNew} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none",
          background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff",
          fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font,
        }}>
          <Plus size={14} /> Nuevo workflow
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 30 }}>Cargando...</p>
      ) : workflows.length === 0 ? (
        <div style={{ background: C.white, borderRadius: 14, border: `1px dashed ${C.border}`, padding: "48px 24px", textAlign: "center" }}>
          <Zap size={32} color={C.textMuted} style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Aún no hay workflows</p>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Crea tu primer workflow para automatizar tus leads</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
          {workflows.map(w => {
            const triggerColor = TRIGGER_COLORS[w.trigger_type] || C.textMuted;
            const conversionRate = w.stats_runs > 0 ? Math.round((w.stats_converted / w.stats_runs) * 100) : 0;
            return (
              <div key={w.id} style={{
                background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
                padding: 18, transition: "all .2s",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>{w.name}</h3>
                    {w.description && (
                      <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>{w.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleActive(w)}
                    title={w.is_active ? "Pausar" : "Activar"}
                    style={{
                      padding: 6, borderRadius: 8, border: "none",
                      background: w.is_active ? `${C.green}18` : C.bg,
                      color: w.is_active ? C.green : C.textMuted,
                      cursor: "pointer", display: "flex", alignItems: "center",
                    }}
                  >
                    {w.is_active ? <Play size={13} /> : <Pause size={13} />}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 600,
                    background: `${triggerColor}18`, color: triggerColor,
                  }}>
                    {TRIGGER_LABELS[w.trigger_type] || w.trigger_type}
                  </span>
                  <span style={{
                    padding: "3px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 500,
                    background: C.bg, color: C.textMuted,
                  }}>
                    {stepCounts[w.id] || 0} pasos
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14 }}>
                  <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 8, textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: C.textMuted }}>
                      <Activity size={10} />
                      <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Runs</span>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: C.text, marginTop: 3 }}>{w.stats_runs || 0}</p>
                  </div>
                  <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 8, textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: C.textMuted }}>
                      <CheckCircle size={10} />
                      <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>OK</span>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: C.green, marginTop: 3 }}>{w.stats_completed || 0}</p>
                  </div>
                  <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 8, textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: C.textMuted }}>
                      <TrendingUp size={10} />
                      <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Conv</span>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: C.primary, marginTop: 3 }}>{conversionRate}%</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                  <button onClick={() => handleEdit(w)} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.white, color: C.text, fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: font,
                  }}>
                    <Edit3 size={12} /> Editar
                  </button>
                  <button onClick={() => handleDelete(w)} style={{
                    padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
                    background: C.white, color: C.red, cursor: "pointer", display: "flex", alignItems: "center",
                  }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
