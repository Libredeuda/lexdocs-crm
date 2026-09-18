import { supabase } from "./supabase";
import { getCurrentOrgId } from "./currentOrg";

// Varios pipelines por despacho (equivalente a las "secuencias" de GHL).
// pipelines: { id, org_id, name, is_default }

export async function loadPipelines() {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("pipelines")
    .select("*")
    .eq("org_id", orgId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

const DEFAULT_STAGE_TEMPLATE = [
  { key: "lead", label: "Nuevo lead", color: "#3b82f6", is_won: false, is_lost: false },
  { key: "seguimiento", label: "Seguimiento", color: "#f59e0b", is_won: false, is_lost: false },
  { key: "pendiente_cierre", label: "Pendiente de cierre", color: "#eab308", is_won: false, is_lost: false },
  { key: "lost", label: "Descartado", color: "#ef4444", is_won: false, is_lost: true },
  { key: "client", label: "Venta", color: "#22c55e", is_won: true, is_lost: false },
];

// Crea un pipeline nuevo con una configuración de etapas de partida razonable
// (el usuario la puede editar después en Configuración → Pipeline).
export async function createPipeline(name) {
  const orgId = await getCurrentOrgId();
  const { data: pipeline, error } = await supabase
    .from("pipelines")
    .insert({ org_id: orgId, name: name.trim() || "Nuevo pipeline", is_default: false })
    .select()
    .single();
  if (error) throw error;

  const stages = DEFAULT_STAGE_TEMPLATE.map((s, i) => ({
    ...s, org_id: orgId, pipeline_id: pipeline.id, position: i,
  }));
  const { error: stagesErr } = await supabase.from("pipeline_stages").insert(stages);
  if (stagesErr) throw stagesErr;

  return pipeline;
}

export async function renamePipeline(pipelineId, name) {
  const { error } = await supabase.from("pipelines").update({ name: name.trim() }).eq("id", pipelineId);
  if (error) throw error;
}

// No se puede eliminar el pipeline por defecto, ni uno que todavía tenga contactos.
export async function deletePipeline(pipelineId) {
  const { count, error: countErr } = await supabase
    .from("contacts").select("id", { count: "exact", head: true }).eq("pipeline_id", pipelineId);
  if (countErr) throw countErr;
  if (count > 0) throw new Error(`Este pipeline todavía tiene ${count} contacto(s). Muévelos a otro pipeline antes de eliminarlo.`);
  const { error } = await supabase.from("pipelines").delete().eq("id", pipelineId);
  if (error) throw error;
}
