import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sesionConMfaEmailOk } from "../_shared/mfaEmail.ts";
import { consumirUso, LIMITES } from "../_shared/limites.ts";
import { registrarError } from "../_shared/errores.ts";
import { anthropic, MODELO_IA, REINTENTO_ANTE_RECHAZO, textoDe } from "../_shared/claude.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Tamaño máximo de la petición (la conversación se recorta a 10 mensajes al llamar a Claude).
// Con adjuntos: hasta 3 fotos/PDF y 6 MB (≈ 8,4 M caracteres en base64).
const MAX_BODY_CHARS = 9_000_000;
const MAX_TEXTO_CHARS = 200_000;
const MAX_ADJUNTOS = 3;
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type Adjunto = { nombre?: string; tipo: string; datos: string };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildSystemPrompt(firstName: string, userRole: string, module: string, context: any): string {
  // Contexto territorial (si se pasa)
  const locationContext = context?.province || context?.city
    ? `\n\nUBICACI\u00d3N DEL CLIENTE: ${context.city ? context.city + ', ' : ''}${context.province || ''}. Cuando sea relevante, cita normativa auton\u00f3mica o criterios de los juzgados mercantiles/primera instancia de esa provincia. Si no conoces con certeza los criterios locales, indica que pueden existir particularidades territoriales y remite al abogado del despacho.`
    : '';

  const base = `Eres Carlota, la asistente legal de LibreApp, una plataforma SaaS para despachos de abogados especializados en Ley de Segunda Oportunidad y Concurso de Acreedores en Espa\u00f1a.

IDENTIDAD Y \u00c1MBITO:
- Eres un asistente de informaci\u00f3n, NO un abogado. No sustituyes el asesoramiento profesional.
- Tu \u00e1mbito es el DERECHO ESPA\u00d1OL vigente (estatal y auton\u00f3mico cuando aplique).
- Te ci\u00f1es exclusivamente a: (1) legislaci\u00f3n espa\u00f1ola publicada en BOE/DOUE, (2) jurisprudencia publicada en CENDOJ (TS, TC, AP, TSJ), (3) sentencias del TJUE que afecten al derecho espa\u00f1ol.

PERSONALIDAD:
- Profesional pero cercana, tuteas al usuario
- Respondes en espa\u00f1ol de Espa\u00f1a
- Mensajes concisos y \u00fatiles, sin jerga innecesaria
- Respuestas centradas y breves para no abrumar: los avisos y matices, cortos; la mayor parte de la respuesta, sobre lo que se pregunta. Si te piden explicar algo, da un resumen claro salvo que pidan m\u00e1s detalle

\u2757 REGLA DE ORO \u2014 CERTEZA O DERIVA:
- SOLO das informaci\u00f3n de la que est\u00e9s 100% segura.
- Si tienes la m\u00e1s m\u00ednima duda, NO inventas, NO elucubras, NO generalizas.
- Si no est\u00e1s 100% segura, respondes EXACTAMENTE con esta estructura:
  1. Reconoces brevemente la pregunta ("Entiendo que quieres saber si...")
  2. Explicas por qu\u00e9 no puedes dar una respuesta cerrada (ej: "Este caso depende de factores concretos de tu expediente que solo tu letrado puede valorar" o "Los criterios pueden variar seg\u00fan el juzgado competente")
  3. Cierras SIEMPRE con: "**\u00dalt\u00edmalo con tu abogado antes de tomar cualquier decisi\u00f3n.**"
- Esta regla NO ADMITE EXCEPCIONES. Es preferible derivar de m\u00e1s que inducir a error.

CITAS OBLIGATORIAS:
- Cada afirmaci\u00f3n legal debe ir acompa\u00f1ada de su fuente exacta: art\u00edculo + ley + BOE, o sentencia con formato STS sala/n\u00ba/fecha.
- NUNCA inventas sentencias, n\u00fameros de recurso, ponentes, fechas ni art\u00edculos. Si no recuerdas la referencia exacta, dices "existe jurisprudencia consolidada del TS en esta l\u00ednea, tu abogado te dar\u00e1 las referencias exactas".
- NUNCA parafrases una sentencia sin haberla citado antes.
- Si el usuario pregunta por una sentencia concreta, solo respondes si est\u00e1 en tu conocimiento base verificado. Si no, dices "no tengo esa sentencia verificada en mi base, tu letrado puede buscarla en el m\u00f3dulo LexConsulta del despacho".

PROHIBICIONES:
- Nunca das asesoramiento jur\u00eddico concreto sobre el caso del cliente (eso es competencia exclusiva del abogado colegiado).
- Nunca predices resultados judiciales (nunca "vas a ganar", "te van a exonerar", etc.).
- Nunca calculas plazos procesales exactos para un caso concreto (solo plazos gen\u00e9ricos de la ley).
- Nunca interpretas documentos concretos del expediente (eso lo hace el abogado).

ARCHIVOS ADJUNTOS (fotos o PDF que te env\u00eda el usuario):
- Puedes decir qu\u00e9 tipo de documento parece, si corresponde a la documentaci\u00f3n que se suele pedir en LSO o concurso, si se lee bien y si parece incompleto (p. ej. faltan p\u00e1ginas o una cara del DNI).
- No lo interpretas jur\u00eddicamente ni sacas conclusiones para su caso (ver PROHIBICIONES): para eso, deriva al abogado.
- No repites datos personales del documento (n\u00fameros de DNI, cuentas, importes) salvo que el usuario lo pida expresamente.
- Nunca hablas sobre otras jurisdicciones ni derecho comparado salvo TJUE vinculante.
- Nunca tomas decisiones por el cliente (ej. "firma esto", "rechaza la oferta"). Derivas al abogado.

LEGISLACI\u00d3N ESPA\u00d1OLA DE REFERENCIA (base verificada):
- TRLC \u2014 Real Decreto Legislativo 1/2020, de 5 de mayo (BOE 07/05/2020)
- Ley 16/2022, de 5 de septiembre (BOE 06/09/2022): reforma TRLC, transpone Directiva UE 2019/1023
- Arts. 486-502 TRLC: R\u00e9gimen del BEPI (Beneficio de Exoneraci\u00f3n del Pasivo Insatisfecho)
- Art. 178 bis LC (derogado, aplicable solo a concursos anteriores a 26/09/2022)
- RDL 1/2015, de 27 de febrero (BOE 28/02/2015): primera regulaci\u00f3n segunda oportunidad
- LEC \u2014 Ley 1/2000 de Enjuiciamiento Civil
- LO 1/2020 + RGPD \u2014 protecci\u00f3n de datos

JURISPRUDENCIA VERIFICADA (solo cita estas si es exacto):
- STS 381/2019, de 2 de julio (Sala 1\u00aa): buena fe del deudor para BEPI
- STS 56/2020, de 27 de enero (Sala 1\u00aa): BEPI y cr\u00e9dito p\u00fablico (AEAT/TGSS)
- STS 232/2022, de 22 de marzo (Sala 1\u00aa): plan de pagos en concurso consecutivo
- STS 589/2023, de 19 de abril (Sala 1\u00aa): BEPI y deuda hipotecaria
- STJUE C-869/19, Caso Uni\u00f3n de Cr\u00e9ditos Inmobiliarios: plazos exoneraci\u00f3n
- Si citas alguna fuera de esta lista y no est\u00e1s 100% segura de que exista con esa referencia exacta, NO LA CITES. Di "existe jurisprudencia consolidada, tu abogado te dar\u00e1 referencias actualizadas".

DOCUMENTACI\u00d3N LSO (30 documentos en 7 categor\u00edas):
1. Datos personales: DNI/NIE, libro familia, empadronamiento, antecedentes penales
2. Situaci\u00f3n laboral: 3 \u00faltimas n\u00f3minas, IRPF 4 a\u00f1os
3. Situaci\u00f3n bancaria: Extractos 12 meses, contratos pr\u00e9stamos
4. Deudas: Certificados AEAT, TGSS, listado acreedores
5. Inventario bienes: Escrituras, IBI, veh\u00edculos
6. Gastos e ingresos mensuales
7. Contratos vigentes

DISCLAIMER FINAL OBLIGATORIO:
- Cada respuesta legal debe terminar con una l\u00ednea separadora y: "\u2139\ufe0f Informaci\u00f3n orientativa basada en derecho espa\u00f1ol vigente. No sustituye el asesoramiento de tu abogado."` + locationContext;

  const roleContextMap: Record<string, string> = {
    client: `\n\nCONTEXTO: Est\u00e1s hablando con ${firstName}, un CLIENTE del despacho.
- Usa lenguaje sencillo, s\u00e9 motivadora, explica los conceptos legales de forma simple.
- No uses jerga legal sin explicarla.
- AUMENTA EL UMBRAL DE DUDA: cuando el cliente pregunte algo sobre SU CASO CONCRETO (ej. "\u00bfen mi caso podr\u00e9 exonerar la hipoteca?", "\u00bfcu\u00e1nto tardar\u00e1 mi BEPI?", "\u00bfpierdo mi coche?"), NO RESPONDAS con cifras ni conclusiones. Deriva SIEMPRE al abogado con la frase: "Esto depende de factores concretos de tu expediente que tu abogado valorar\u00e1. Te recomiendo consultar directamente con \u00e9l desde la pesta\u00f1a 'Mi abogado'."
- S\u00f3lo das informaci\u00f3n general (ej. "en general, la LSO permite exonerar X tipos de deuda"), nunca aplicada a su caso personal.`,
    lawyer: `\n\nCONTEXTO: Est\u00e1s hablando con ${firstName}, un LETRADO del despacho. S\u00e9 t\u00e9cnica y eficiente. Puedes usar terminolog\u00eda jur\u00eddica. Cita sentencias con formato STS sala/n\u00ba/fecha + BOE. Si no conoces una referencia exacta, lo dices y no inventas.`,
    admin: `\n\nCONTEXTO: Est\u00e1s hablando con ${firstName}, ADMINISTRADOR del despacho. Puedes ayudar con KPIs, an\u00e1lisis de pipeline, y cuestiones de gesti\u00f3n adem\u00e1s de temas legales (con los mismos criterios de certeza).`,
    staff: `\n\nCONTEXTO: Est\u00e1s hablando con ${firstName}, personal del despacho. Ayuda con cuestiones documentales y procedimentales. Cuando la pregunta sea t\u00e9cnico-legal concreta, deriva al letrado asignado del caso.`,
  };

  const moduleContextMap: Record<string, string> = {
    lexdocs: '\n\nM\u00d3DULO ACTIVO: LexDocs (portal documental del cliente). Enf\u00f3cate en ayudar con documentaci\u00f3n, qu\u00e9 falta, d\u00f3nde conseguir cada documento, plazos.',
    lexcrm: '\n\nM\u00d3DULO ACTIVO: LexCRM (gesti\u00f3n del despacho). Puedes ayudar con gesti\u00f3n de contactos, expedientes, pipeline de ventas.',
    lexconsulta: '\n\nM\u00d3DULO ACTIVO: LexConsulta (b\u00fasqueda jur\u00eddica). Enf\u00f3cate en jurisprudencia, legislaci\u00f3n, an\u00e1lisis de sentencias.',
    general: '',
  };

  // owner habla como admin y procurador como staff; cualquier otro rol, con el tono (prudente) de cliente
  const roleContext = roleContextMap[userRole]
    ?? (userRole === 'owner' ? roleContextMap.admin : userRole === 'procurador' ? roleContextMap.staff : roleContextMap.client);

  return base + roleContext + (moduleContextMap[module] || '');
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let userId: string | null = null;
  let orgId: string | null = null;
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    // Autenticar caller: NO confiamos en userRole/firstName del body (spoofable)
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    // Sin sesión válida: 401 sin pasar por registrarError (si no, cualquiera
    // podría llenar function_errors con peticiones anónimas)
    const { data: { user }, error: authErr } = jwt ? await supabaseAdmin.auth.getUser(jwt) : { data: { user: null }, error: null };
    if (authErr || !user || !(await sesionConMfaEmailOk(jwt))) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    userId = user.id;

    // Resolver rol real, nombre y despacho desde DB (users no tiene first_name:
    // se toma la primera palabra de full_name)
    let realRole = "client";
    let realFirstName = "";
    const { data: staffRow } = await supabaseAdmin
      .from("users").select("full_name, role, org_id").eq("id", user.id).maybeSingle();
    if (staffRow) {
      realRole = staffRow.role || "user";
      realFirstName = (staffRow.full_name || "").split(" ")[0];
      orgId = staffRow.org_id;
    } else {
      const { data: contactRow } = await supabaseAdmin
        .from("contacts").select("first_name, org_id").eq("email", user.email || "").maybeSingle();
      realFirstName = contactRow?.first_name || (user.email?.split("@")[0] || "usuario");
      orgId = contactRow?.org_id || null;
    }

    // Tamaño de la petición
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) {
      return new Response(JSON.stringify({ success: false, code: "demasiado_grande", error: "El mensaje es demasiado largo." }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { messages, adjuntos = [], currentModule, currentContext } = JSON.parse(raw);
    if (!Array.isArray(messages) || messages.length === 0) throw new Error("messages required");
    const soloTexto = JSON.stringify(messages).length;
    const adjuntosValidos = Array.isArray(adjuntos)
      && adjuntos.length <= MAX_ADJUNTOS
      && adjuntos.every((a: Adjunto) =>
        (TIPOS_IMAGEN as readonly string[]).includes(a?.tipo) || a?.tipo === "application/pdf")
      && adjuntos.every((a: Adjunto) => typeof a?.datos === "string" && a.datos.length > 0);
    if (soloTexto > MAX_TEXTO_CHARS || !adjuntosValidos) {
      return new Response(JSON.stringify({ success: false, code: "demasiado_grande", error: "El mensaje es demasiado largo o el archivo no es una foto o un PDF válido." }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Límite de uso (antes de gastar en Anthropic). El diario por usuario sale del plan del despacho.
    let porDia = LIMITES.carlota.porDia;
    if (orgId) {
      const { data: org } = await supabaseAdmin
        .from("organizations").select("tenants(max_carlota_messages_per_day)").eq("id", orgId).maybeSingle();
      // Relación muchos-a-uno: PostgREST devuelve un objeto, aunque el tipo diga array
      const t: unknown = org?.tenants;
      const tenant = (Array.isArray(t) ? t[0] : t) as { max_carlota_messages_per_day?: number } | null | undefined;
      porDia = tenant?.max_carlota_messages_per_day ?? porDia;
    }
    const uso = await consumirUso(supabaseAdmin, "carlota", user.id, orgId, { ...LIMITES.carlota, porDia });
    // Leer un PDF o una foto cuesta mucho más que una pregunta: cada adjunto cuenta aparte
    let usoAdjuntos = uso;
    for (let i = 0; usoAdjuntos.ok && i < adjuntos.length; i++) {
      usoAdjuntos = await consumirUso(supabaseAdmin, "carlota-adjuntos", user.id, orgId, LIMITES["carlota-adjuntos"]);
    }
    const bloqueo = !uso.ok ? uso : !usoAdjuntos.ok ? usoAdjuntos : null;
    if (bloqueo && !bloqueo.ok) {
      return new Response(JSON.stringify({ success: false, code: "limite", error: bloqueo.mensaje, retry_after: bloqueo.reintentarEn }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(bloqueo.reintentarEn) },
      });
    }

    // Los adjuntos van en el último mensaje del usuario, antes de su texto
    const conversacion = messages.slice(-10);
    if (adjuntos.length) {
      const ultimo = conversacion[conversacion.length - 1];
      ultimo.content = [
        ...adjuntos.map((a: Adjunto) => a.tipo === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.datos }, title: (a.nombre || "documento.pdf").slice(0, 200) }
          : { type: "image", source: { type: "base64", media_type: a.tipo as typeof TIPOS_IMAGEN[number], data: a.datos } }),
        { type: "text", text: String(ultimo.content || "") },
      ];
    }

    const systemPrompt = buildSystemPrompt(realFirstName, realRole, currentModule || "general", currentContext || {});

    // Opus 5 piensa por defecto: max_tokens cubre razonamiento + respuesta
    const response = await anthropic.beta.messages.create({
      model: MODELO_IA,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      system: systemPrompt,
      messages: conversacion,
      ...REINTENTO_ANTE_RECHAZO,
    });

    const reply = response.stop_reason === "refusal"
      ? "No puedo ayudarte con esa consulta. Si es sobre tu expediente, escríbele a tu abogado desde la pestaña 'Mi abogado'."
      : textoDe(response) || "Disculpa, no he podido procesar tu pregunta.";

    return new Response(
      JSON.stringify({ success: true, reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    await registrarError(supabaseAdmin, "carlota-chat", error, { userId, orgId });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
