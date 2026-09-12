// Cliente de Claude compartido por las Edge Functions (SDK oficial de Anthropic).
// La clave vive solo aquí, en el servidor (secret ANTHROPIC_API_KEY).
//
// Claude Opus 5 lleva clasificadores de seguridad que pueden rechazar una petición
// (HTTP 200 con stop_reason "refusal"). Con fallbacks: "default" la API reintenta
// en otro modelo según el motivo del rechazo, dentro de la misma llamada.

import Anthropic from "npm:@anthropic-ai/sdk@0.125.0";

export const MODELO_IA = "claude-opus-5";

export const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

export const REINTENTO_ANTE_RECHAZO: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

// Une los bloques de texto de una respuesta (ignora thinking y marcadores de fallback)
// deno-lint-ignore no-explicit-any
export function textoDe(respuesta: { content: any[] }): string {
  return respuesta.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}
