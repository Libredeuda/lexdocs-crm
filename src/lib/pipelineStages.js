import { supabase } from "./supabase";
import { getCurrentOrgId } from "./currentOrg";

// Etapas configurables de un pipeline concreto (tabla pipeline_stages,
// migration-025/026). contacts.status guarda la "key" de la etapa dentro del
// pipeline al que pertenece el contacto (contacts.pipeline_id).
// 'lead' es siempre el estado por defecto de un contacto nuevo; 'client'
// (is_won) y 'lost' (is_lost) son las dos que usa el resto del sistema
// (botón "Convertir a cliente" / marcar como perdido) y conviene no borrar.

export async function loadPipelineStages(pipelineId) {
  let query = supabase.from("pipeline_stages").select("*").order("position", { ascending: true });
  if (pipelineId) {
    query = query.eq("pipeline_id", pipelineId);
  } else {
    const orgId = await getCurrentOrgId();
    query = query.eq("org_id", orgId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Carga las etapas de TODOS los pipelines del despacho, agrupadas por pipeline_id.
// Útil en pantallas que muestran contactos de varios pipelines a la vez (listado).
export async function loadAllPipelineStagesByPipeline() {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase
    .from("pipeline_stages").select("*").eq("org_id", orgId).order("position", { ascending: true });
  if (error) throw error;
  const byPipeline = {};
  for (const s of data || []) {
    (byPipeline[s.pipeline_id] ||= []).push(s);
  }
  return byPipeline;
}

// Convierte la lista de etapas en un mapa { key: {label, color} } listo para
// usar como "statusConfig" en las pantallas que muestran el estado de un contacto.
export function stagesToConfig(stages) {
  const cfg = {};
  for (const s of stages) {
    cfg[s.key] = { label: s.label, color: s.color, bg: `${s.color}14` };
  }
  return cfg;
}

function slugify(label, existingKeys) {
  let base = (label || "etapa")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "etapa";
  let key = base;
  let i = 2;
  while (existingKeys.includes(key)) { key = `${base}_${i}`; i++; }
  return key;
}

// Guarda la lista completa de etapas de un pipeline: upsert de las que tienen
// id (o crea las nuevas con key generada a partir del label) y elimina las
// que ya no están en la lista. `original` es la lista tal y como se cargó,
// para saber qué borrar.
export async function savePipelineStages(pipelineId, stages, original) {
  const orgId = await getCurrentOrgId();
  const existingKeys = stages.filter(s => s.key).map(s => s.key);

  const toDelete = original.filter(o => !stages.some(s => s.id === o.id));
  if (toDelete.length > 0) {
    const { error } = await supabase.from("pipeline_stages").delete().in("id", toDelete.map(s => s.id));
    if (error) throw error;
  }

  const rows = stages.map((s, i) => ({
    ...(s.id ? { id: s.id } : {}),
    org_id: orgId,
    pipeline_id: pipelineId,
    key: s.key || slugify(s.label, existingKeys),
    label: s.label?.trim() || "Sin nombre",
    color: s.color || "#6b7280",
    position: i,
    is_won: !!s.is_won,
    is_lost: !!s.is_lost,
  }));

  const { error } = await supabase.from("pipeline_stages").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  return rows;
}
