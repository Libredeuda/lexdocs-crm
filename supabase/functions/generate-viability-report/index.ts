// Edge Function: generate-viability-report
// POST { contact_id } -> lee el formulario de viabilidad del lead (migration-023),
// pide a Claude un informe de viabilidad jurídico-económica de la Ley de Segunda
// Oportunidad siguiendo el modelo real del despacho, lo guarda como archivo
// descargable en la ficha del contacto (tabla documents) y deja registro en
// lead_viability_reports.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sesionConMfaEmailOk } from "../_shared/mfaEmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TIPO_ACREEDOR_LABEL: Record<string, string> = {
  bancario: "Financiación bancaria",
  tarjeta: "Tarjeta de compra / crédito revolving",
  publico: "Deuda pública",
  otro: "Otro",
};

function formatEuros(n: number | null | undefined) {
  if (n === null || n === undefined) return "No indicado";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function buildPrompt(contact: any, form: any, letradoNombre: string, modeloInforme: string) {
  const acreedores = (form.acreedores || []) as { nombre: string; tipo: string; importe: number }[];
  const acreedoresTexto = acreedores.length
    ? acreedores.map(a => `- ${a.nombre || "(sin nombre)"} · ${TIPO_ACREEDOR_LABEL[a.tipo] || a.tipo || "otro"} · ${formatEuros(a.importe)}`).join("\n")
    : "No se ha detallado el desglose por acreedor; usar solo la deuda total estimada.";

  const requisitosBuenaFe = [
    ["Condena firme por delitos patrimoniales/socioeconómicos en los últimos 10 años", form.condena_penal_10anios],
    ["Concurso declarado culpable previo", form.concurso_culpable_previo],
    ["Sanción firme grave (tributaria/Seguridad Social) en los últimos 10 años", form.sancion_grave_10anios],
    ["Exoneración obtenida en los últimos 5 años", form.exoneracion_previa_5anios],
  ].map(([label, val]) => `- ${label}: ${val ? "SÍ concurre (riesgo para la buena fe, hay que valorarlo con cuidado)" : "No concurre"}`).join("\n");

  const datosLead = `
DATOS DEL CLIENTE (proporcionados por el despacho, tratar como ciertos salvo que se indique "pendiente de confirmar")
- Nombre: ${contact.first_name || ""} ${contact.last_name || ""}
- Localidad: ${form.localidad || "No indicada"}
- Perfil: ${form.perfil === "empresario" ? "Persona física empresaria" : "Persona física no empresaria"}
- Estado civil: ${form.estado_civil || "No indicado"}${form.regimen_matrimonial && form.regimen_matrimonial !== "no_aplica" ? ` (régimen: ${form.regimen_matrimonial})` : ""}

SITUACIÓN ECONÓMICA
- Ingresos mensuales: ${formatEuros(form.ingresos_mensuales)} (origen: ${form.origen_ingresos || "no indicado"})
- Gastos mensuales declarados: ${formatEuros(form.gastos_mensuales)}
- Capacidad de pago mensual (ingresos - gastos): ${form.ingresos_mensuales != null && form.gastos_mensuales != null ? formatEuros(form.ingresos_mensuales - form.gastos_mensuales) : "No calculable, faltan datos"}
- Deuda total estimada: ${formatEuros(form.deuda_total_estimada)}
- Origen del endeudamiento (año aproximado): ${form.origen_endeudamiento_anio || "No indicado"}

CARGAS FAMILIARES
- Hijos menores a cargo: ${form.tiene_hijos_menores ? `Sí (${form.num_hijos_menores ?? "número no indicado"})` : "No"}
- Otras personas dependientes a cargo: ${form.tiene_personas_dependientes ? `Sí. Detalle: ${form.detalle_dependientes || "sin detalle adicional"}` : "No"}

PATRIMONIO
- Vivienda en propiedad: ${form.tiene_vivienda ? `Sí (valor aprox. ${formatEuros(form.valor_vivienda)})` : "No"}
- Vehículos: ${form.tiene_vehiculos ? "Sí" : "No"}
- Otros bienes: ${form.otros_bienes || "Ninguno declarado"}

DEUDA PÚBLICA
- AEAT: ${formatEuros(form.deuda_aeat)}
- TGSS: ${formatEuros(form.deuda_tgss)}

SITUACIÓN PROCESAL
- Embargos activos: ${form.embargos_activos ? `Sí. Detalle: ${form.detalle_embargos || "sin detalle adicional"}` : "No"}

ACREEDORES
${acreedoresTexto}

REQUISITOS DE BUENA FE (art. 487 TRLC)
${requisitosBuenaFe}
- Acuerdo extrajudicial de pagos previo: ${form.acuerdo_extrajudicial_previo ? "Sí" : "No (no es requisito obligatorio tras la Ley 16/2022)"}

NOTAS DEL SETTER/CLOSER
${form.notas_setter || "Sin notas adicionales."}
`.trim();

  return `Eres un abogado experto en derecho concursal y en la Ley de Segunda Oportunidad española (Texto Refundido de la Ley Concursal, RDL 1/2020, en su redacción dada por la Ley 16/2022, de 5 de septiembre). Vas a redactar un INFORME DE VIABILIDAD JURÍDICO-ECONÓMICA para un lead del despacho LibreDeuda Abogados, siguiendo EXACTAMENTE la estructura, el tono técnico-profesional y el nivel de detalle del siguiente informe modelo real del despacho (cambia los datos, mantén el estilo, las citas legales y la estructura de apartados y tablas en Markdown):

--- INICIO DEL INFORME MODELO ---
${modeloInforme}
--- FIN DEL INFORME MODELO ---

Ahora redacta el informe para este nuevo cliente, con estos datos:

${datosLead}

Letrado/a responsable a firmar el informe: ${letradoNombre}
Fecha del informe: ${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}

INSTRUCCIONES IMPORTANTES:
1. Usa Markdown (títulos con #, tablas con |, negritas con **).
2. Reproduce las mismas 9 secciones del modelo (Situación económica actual, Análisis del endeudamiento, Situación patrimonial, Cumplimiento de los requisitos legales, Deuda exonerable, Estrategia jurídica recomendada, Servicio y condiciones económicas, Escenarios previsibles, Conclusión y documentación necesaria), con la tabla-resumen de cabecera igual que el modelo.
3. Haz el análisis legal real y específico para estos datos: calcula si los ingresos superan el SMI vigente (2026: 1.221 €/mes) para valorar inembargabilidad (art. 607 LEC), valora el límite de deuda pública exonerable (10.000 € por organismo), valora la antigüedad de la deuda como factor de buena fe, valora si hay patrimonio realizable (art. 37 bis TRLC, concurso sin masa), ten en cuenta las cargas familiares (hijos menores/dependientes) al valorar la capacidad de pago y el mínimo inembargable ampliado, y recomienda la vía procesal (concurso sin masa vs. con masa, plan de pagos vs. liquidación) que corresponda a ESTOS datos, no copies mecánicamente la recomendación del modelo si no aplica.
4. Si algún dato imprescindible falta o es solo aproximado, indícalo igual que el modelo con un recuadro "Dato pendiente de concretar" — nunca inventes cifras que no se han dado.
5. En el apartado "7. SERVICIO Y CONDICIONES ECONÓMICAS" NO inventes honorarios ni cuotas: escribe únicamente "*Honorarios y condiciones de pago: a determinar por el despacho según la complejidad del expediente.*" y mantén sí la lista de servicios incluidos (son estándar del despacho, puedes redactarlos igual que el modelo).
6. Sé honesto y prudente con los porcentajes de probabilidad de los escenarios: ajústalos al perfil real (más patrimonio/deuda pública/circunstancias del art. 487 concurridas = menor probabilidad de exoneración total), no copies siempre "85-95%".
7. Al principio del documento, antes del título, incluye esta línea exacta: "> ⚠️ Borrador generado por IA a partir de los datos facilitados. Debe ser revisado y validado por un letrado del despacho antes de entregarlo al cliente."
8. ANTES de esa línea del disclaimer, como las 3 primerísimas líneas del documento (una por línea, sin nada más en la línea, sin markdown alrededor), incluye estos 3 marcadores para que el sistema los procese automáticamente:
[[PROBABILIDAD_EXITO:NN]]  (NN = número entero 0-100, tu estimación honesta y prudente de probabilidad de obtener la exoneración total o sustancial del pasivo, coherente con el análisis que vas a desarrollar)
[[VIA_RECOMENDADA:texto corto]]  (la vía procesal recomendada en pocas palabras, ej. "Concurso sin masa + exoneración del pasivo insatisfecho")
[[RESUMEN_CORTO:una frase]]  (una frase en lenguaje cercano y sin tecnicismos, pensada para leérsela o mostrársela directamente al cliente, resumiendo su situación y perspectiva)
9. En la sección "1. SITUACIÓN ECONÓMICA ACTUAL" incluye una tabla en Markdown de INGRESOS Y GASTOS MENSUALES con filas de cada concepto de ingreso, cada concepto de gasto (usa el dato de gastos mensuales declarado; si no se ha indicado, pon una fila "Gastos mensuales" con "Dato pendiente de concretar"), y una fila final en negrita "Capacidad de pago mensual" (ingresos - gastos) que uses luego para razonar sobre la insolvencia (art. 2 TRLC: imposibilidad de cumplir regularmente las obligaciones exigibles).
10. En la sección "2. ANÁLISIS DEL ENDEUDAMIENTO" incluye la tabla COMPLETA de acreedores en Markdown (columnas: Acreedor, Tipo, Importe), con todos los acreedores facilitados arriba, más una fila final en negrita "TOTAL" sumando los importes; si no se han detallado acreedores, indícalo y usa solo la deuda total estimada.
11. En la sección "4. CUMPLIMIENTO DE LOS REQUISITOS LEGALES" incluye, además del análisis narrativo, una CHECKLIST en Markdown con casillas (usa "- [x] Requisito: cumple" o "- [ ] Requisito: NO cumple / requiere revisión") de cada uno de estos requisitos, marcada según los datos facilitados: persona física, deudor de buena fe (art. 487.1.1º-5º TRLC, uno por cada circunstancia de los datos de "REQUISITOS DE BUENA FE"), deuda dentro de los límites de exoneración de deuda pública, ausencia de patrimonio oculto declarado, documentación acreditativa disponible (indica "pendiente de aportar" si no consta).
12. Ten en cuenta las cargas familiares (hijos menores/personas dependientes) en el análisis de capacidad de pago y en la valoración de la vía procesal recomendada.
13. Responde ÚNICAMENTE con los 3 marcadores seguidos del informe en Markdown, sin explicaciones antes o después.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { contact_id } = await req.json();
    if (!contact_id) throw new Error("contact_id is required");

    // Authz: staff autenticado con MFA-email ok, y el contacto debe ser de su org
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } };
    if (!user || !(await sesionConMfaEmailOk(jwt))) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: staff } = await supabase.from("users").select("org_id, full_name").eq("id", user.id).maybeSingle();
    if (!staff?.org_id) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orgId = staff.org_id;

    const { data: contact, error: contactErr } = await supabase.from("contacts")
      .select("*, assigned_user:users!contacts_assigned_to_fkey(full_name)")
      .eq("id", contact_id).eq("org_id", orgId).single();
    if (contactErr || !contact) throw new Error("Contacto no encontrado");

    const { data: form, error: formErr } = await supabase.from("lead_viability_forms")
      .select("*").eq("contact_id", contact_id).eq("org_id", orgId).maybeSingle();
    if (formErr) throw formErr;
    if (!form) {
      return new Response(JSON.stringify({ success: false, error: "Rellena primero el formulario de viabilidad de este lead." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tpl } = await supabase.from("ai_prompt_templates")
      .select("content").eq("key", "informe_viabilidad_lso").maybeSingle();
    if (!tpl?.content) {
      return new Response(JSON.stringify({ success: false, error: "Falta configurar la plantilla del informe modelo (tabla ai_prompt_templates)." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const letradoNombre = contact.assigned_user?.full_name || staff.full_name || "Letrado/a del despacho";
    const prompt = buildPrompt(contact, form, letradoNombre, tpl.content);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const aiData = await res.json();
    if (!res.ok) throw new Error(aiData.error?.message || "Claude API error");
    const content = (aiData.content || []).map((b: any) => b.text || "").join("").trim();
    if (!content) throw new Error("Claude no devolvio contenido");

    // Guardar como archivo descargable en la ficha del contacto (misma tabla/bucket
    // que los archivos subidos a mano, para que aparezca directamente en "Archivos").
    const fileName = `Informe de viabilidad LSO - ${new Date().toISOString().slice(0, 10)}.md`;
    const storagePath = `${orgId}/contacts/${contact_id}/${Date.now()}-informe-viabilidad.md`;
    const { error: uploadErr } = await supabase.storage.from("documents")
      .upload(storagePath, new Blob([content], { type: "text/markdown; charset=utf-8" }), {
        upsert: false,
        contentType: "text/markdown; charset=utf-8",
      });
    if (uploadErr) throw uploadErr;

    const { data: doc, error: docErr } = await supabase.from("documents").insert({
      org_id: orgId,
      contact_id,
      name: fileName,
      file_path: storagePath,
      storage_path: storagePath,
      file_size: new TextEncoder().encode(content).length,
      mime_type: "text/markdown; charset=utf-8",
      status: "uploaded",
      uploaded_by: user.id,
    }).select().single();
    if (docErr) throw docErr;

    await supabase.from("lead_viability_reports").insert({
      org_id: orgId,
      contact_id,
      form_id: form.id,
      content,
      document_id: doc.id,
      generated_by: user.id,
    });

    await supabase.from("activities").insert({
      org_id: orgId,
      entity_type: "contact",
      entity_id: contact_id,
      action: "updated",
      description: "Informe de viabilidad LSO generado con IA",
    });

    return new Response(JSON.stringify({ success: true, content, document_id: doc.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-viability-report error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
