import { supabase } from "./supabase";
import { getCurrentOrgId } from "./currentOrg";

// Configuración de videollamada del despacho, guardada en organizations.settings.video
// (columna jsonb ya existente en el esquema, sin necesidad de migración nueva).
// { provider: "meet" | "zoom" | "teams" | "custom", url: string }

export const VIDEO_PROVIDERS = {
  meet: { label: "Google Meet", defaultUrl: "https://meet.google.com/new", color: "#00897B" },
  zoom: { label: "Zoom", defaultUrl: "", color: "#2D8CFF" },
  teams: { label: "Microsoft Teams", defaultUrl: "", color: "#6264A7" },
  custom: { label: "Otra herramienta", defaultUrl: "", color: "#5B6BF0" },
};

export function getVideoLink(settings) {
  const provider = settings?.provider || "meet";
  const url = settings?.url?.trim();
  if (url) return url;
  return VIDEO_PROVIDERS[provider]?.defaultUrl || VIDEO_PROVIDERS.meet.defaultUrl;
}

export async function loadVideoSettings() {
  const orgId = await getCurrentOrgId();
  const { data, error } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  if (error) throw error;
  return data?.settings?.video || { provider: "meet", url: "" };
}

export async function saveVideoSettings(video) {
  const orgId = await getCurrentOrgId();
  const { data: org, error: readErr } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  if (readErr) throw readErr;
  const settings = { ...(org?.settings || {}), video };
  const { error } = await supabase.from("organizations").update({ settings }).eq("id", orgId);
  if (error) throw error;
}
