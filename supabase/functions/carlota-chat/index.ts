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
const MAX_TEXTO_CHARS = 400_000;       // los borradores largos del despacho viajan en el historial
const MAX_ADJUNTOS = 3;                // por mensaje
const MAX_ADJUNTOS_CONVERSACION = 10;  // nivel despacho: los documentos siguen disponibles en la conversación
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
// Fotos y PDF llegan en base64 (datos); Word, Excel, CSV y TXT llegan ya
// convertidos a texto en el navegador (tipo "text/plain", texto).
type Adjunto = { nombre?: string; tipo: string; datos?: string; texto?: string };
const MAX_CARACTERES_ADJUNTO_TEXTO = 200_000;
type MensajeEntrada = { role: "user" | "assistant"; content: string; adjuntos?: Adjunto[] };

const adjuntoValido = (a: Adjunto) =>
  a?.tipo === "text/plain"
    ? typeof a.texto === "string" && a.texto.trim().length > 0 && a.texto.length <= MAX_CARACTERES_ADJUNTO_TEXTO
    : ((TIPOS_IMAGEN as readonly string[]).includes(a?.tipo) || a?.tipo === "application/pdf")
      && typeof a?.datos === "string" && a.datos.length > 0;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Legislación y jurisprudencia verificadas: las únicas referencias que Carlota
// puede citar sin marcarlas como "a verificar" (en los dos niveles)
const FUENTES_VERIFICADAS = `LEGISLACI\u00d3N ESPA\u00d1OLA DE REFERENCIA (base verificada):
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
- Si citas alguna fuera de esta lista y no est\u00e1s 100% segura de que exista con esa referencia exacta, NO LA CITES. Di "existe jurisprudencia consolidada, tu abogado te dar\u00e1 referencias actualizadas".`;

// Roles del despacho: reciben Carlota nivel despacho (lo decide la BD, nunca el navegador)
const ROLES_DESPACHO = ["admin", "owner", "lawyer", "staff", "procurador", "sales"];

const ROL_LEGIBLE: Record<string, string> = {
  admin: "administrador del despacho", owner: "titular del despacho", lawyer: "letrado",
  staff: "miembro del equipo", procurador: "procurador", sales: "equipo comercial",
};

// Nivel despacho: ayuda profesional para leer e interpretar documentos y redactar
// borradores. Mantiene los guardarraíles de CLAUDE.md regla 4: cita fuentes, no
// inventa jurisprudencia y todo escrito es un borrador para el letrado.
function buildPromptDespacho(firstName: string, userRole: string): string {
  return `Eres Carlota, la asistente jurídica de IA del despacho en LibreApp, especializada en Ley de Segunda Oportunidad y concurso de acreedores (TRLC). Trabajas para profesionales del despacho, no para clientes: ahora hablas con ${firstName}, ${ROL_LEGIBLE[userRole] || "profesional del despacho"}.

QUÉ HACES
- Lees e interpretas documentos (contratos, escrituras, nóminas, IRPF, certificados de AEAT y TGSS, CIRBE, extractos bancarios, resoluciones judiciales) y extraes lo relevante para el expediente. Los PDF y las fotos los ves tal cual; los Word y Excel te llegan convertidos a texto, y cada hoja de cálculo como CSV tras "## Hoja: nombre" (úsalo para sumar deudas, ingresos o movimientos).
- Analizas la situación del deudor: masa activa y pasiva, créditos exonerables y no exonerables, requisitos de buena fe y del BEPI, riesgos y alternativas, con tu valoración profesional razonada.
- Redactas borradores: solicitudes de concurso de persona física, solicitudes de exoneración, propuestas de plan de pagos, demandas, escritos de trámite, requerimientos, burofaxes, informes al cliente y resúmenes de expediente.

CÓMO REDACTAS ESCRITOS
- Estructura forense española: encabezamiento dirigido al juzgado competente, identificación de partes y representación (procurador y letrado), HECHOS numerados, FUNDAMENTOS DE DERECHO (jurisdiccionales, procesales y de fondo), SUPLICO y OTROSÍ cuando proceda.
- Los datos que no tengas los dejas como [●] con una indicación breve, por ejemplo [● fecha de la escritura]. Nunca inventas hechos, cifras, nombres ni fechas.
- Empiezas cada escrito con la línea: "BORRADOR generado con IA: revisar y validar por el letrado antes de presentarlo."
- La extensión es la que el escrito necesita: completo en lo sustancial, sin secciones de relleno ni resúmenes repetidos.

FUENTES Y CERTEZA (sin excepciones)
- Cada fundamento lleva su fuente exacta: artículo y norma, o sentencia con tribunal, sala, número y fecha.
- NUNCA inventas sentencias, números de recurso, ponentes, fechas ni artículos. Citas jurisprudencia de la lista verificada o que conozcas con total seguridad; si no, escribes [● jurisprudencia a verificar en CENDOJ o LexConsulta].
- Si un punto es discutido o depende del criterio del juzgado, lo dices y explicas las posturas.
- Ámbito: derecho español vigente (estatal y autonómico), jurisprudencia publicada en CENDOJ y del TJUE vinculante. Avisas cuando una norma ha sido reformada (por ejemplo, por la Ley 16/2022).

${FUENTES_VERIFICADAS}

TRATO
- Técnica y directa, en español de España. En conversación, respuestas centradas y breves; en escritos y análisis que te pidan, completos.
- Haces lo que te piden con el alcance que se pretende: resuelves tú las dudas menores y preguntas solo si la respuesta cambiaría el trabajo de forma importante. Si falta un dato, sigues con [●] en lugar de detenerte.
- Los datos personales de los documentos los usas para el trabajo pedido; no los repites sin necesidad.
- Tu trabajo es de apoyo: la decisión, la firma y la responsabilidad son del letrado.`;
}

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

ARCHIVOS ADJUNTOS (fotos, PDF, Word, Excel o CSV que te env\u00eda el usuario; los Word y Excel te llegan convertidos a texto y cada hoja de c\u00e1lculo como CSV tras "## Hoja: nombre"):
- Puedes decir qu\u00e9 tipo de documento parece, si corresponde a la documentaci\u00f3n que se suele pedir en LSO o concurso, si se lee bien y si parece incompleto (p. ej. faltan p\u00e1ginas o una cara del DNI).
- No lo interpretas jur\u00eddicamente ni sacas conclusiones para su caso (ver PROHIBICIONES): para eso, deriva al abogado.
- No repites datos personales del documento (n\u00fameros de DNI, cuentas, importes) salvo que el usuario lo pida expresamente.
- Nunca hablas sobre otras jurisdicciones ni derecho comparado salvo TJUE vinculante.
- Nunca tomas decisiones por el cliente (ej. "firma esto", "rechaza la oferta"). Derivas al abogado.

${FUENTES_VERIFICADAS}

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
    const nivel = staffRow && ROLES_DESPACHO.includes(realRole) ? "despacho" : "usuario";

    // Nivel usuario: 10 mensajes y adjuntos solo en el último. Nivel despacho: 20
    // mensajes y los documentos siguen disponibles durante la conversación.
    const historial: MensajeEntrada[] = messages.slice(nivel === "despacho" ? -20 : -10)
      .map((m: MensajeEntrada) => ({ role: m.role, content: String(m.content ?? ""), adjuntos: Array.isArray(m.adjuntos) ? m.adjuntos : [] }));
    const ultimo = historial[historial.length - 1];
    if (Array.isArray(adjuntos) && adjuntos.length) ultimo.adjuntos = adjuntos; // formato anterior del frontend
    if (nivel === "usuario") historial.forEach((m, i) => { if (i < historial.length - 1) m.adjuntos = []; });

    const textoTotal = historial.reduce((n, m) => n + m.content.length, 0);
    const todosAdjuntos = historial.flatMap((m) => m.adjuntos || []);
    const adjuntosValidos = historial.every((m) => (m.adjuntos || []).length <= MAX_ADJUNTOS)
      && todosAdjuntos.length <= MAX_ADJUNTOS_CONVERSACION
      && todosAdjuntos.every(adjuntoValido);
    if (textoTotal > MAX_TEXTO_CHARS || !adjuntosValidos) {
      return new Response(JSON.stringify({ success: false, code: "demasiado_grande", error: "El mensaje es demasiado largo o algún archivo no es una foto o un PDF válido. Prueba a empezar una conversación nueva." }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adjuntosNuevos = (ultimo.adjuntos || []).length; // solo cuentan para el límite los que llegan ahora

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
    for (let i = 0; usoAdjuntos.ok && i < adjuntosNuevos; i++) {
      usoAdjuntos = await consumirUso(supabaseAdmin, "carlota-adjuntos", user.id, orgId, LIMITES["carlota-adjuntos"]);
    }
    const bloqueo = !uso.ok ? uso : !usoAdjuntos.ok ? usoAdjuntos : null;
    if (bloqueo && !bloqueo.ok) {
      return new Response(JSON.stringify({ success: false, code: "limite", error: bloqueo.mensaje, retry_after: bloqueo.reintentarEn }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(bloqueo.reintentarEn) },
      });
    }

    // Cada adjunto va delante del texto de su mensaje. La caché de Anthropic se
    // marca tras el último documento: releerlo en las respuestas siguientes cuesta ~0,1×.
    const idxUltimoConAdjuntos = historial.map((m) => (m.adjuntos || []).length > 0).lastIndexOf(true);
    const conversacion = historial.map((m, i) => {
      if (!(m.adjuntos || []).length) return { role: m.role, content: m.content };
      // deno-lint-ignore no-explicit-any
      const bloques: any[] = (m.adjuntos || []).map((a) => a.tipo === "text/plain"
        ? { type: "document", source: { type: "text", media_type: "text/plain", data: a.texto }, title: (a.nombre || "documento").slice(0, 200) }
        : a.tipo === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.datos }, title: (a.nombre || "documento.pdf").slice(0, 200) }
          : { type: "image", source: { type: "base64", media_type: a.tipo as typeof TIPOS_IMAGEN[number], data: a.datos } });
      if (i === idxUltimoConAdjuntos) bloques[bloques.length - 1].cache_control = { type: "ephemeral" };
      return { role: m.role, content: [...bloques, { type: "text", text: m.content || "Te envío este archivo." }] };
    });

    const systemPrompt = nivel === "despacho"
      ? buildPromptDespacho(realFirstName, realRole)
      : buildSystemPrompt(realFirstName, realRole, currentModule || "general", currentContext || {});

    // Opus 5 piensa por defecto: max_tokens cubre razonamiento + respuesta
    const response = await anthropic.beta.messages.create({
      model: MODELO_IA,
      max_tokens: 16000,
      // Despacho: más esfuerzo (interpretar y redactar); usuario: respuestas rápidas
      output_config: { effort: nivel === "despacho" ? "high" : "medium" },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: conversacion,
      ...REINTENTO_ANTE_RECHAZO,
    });

    const reply = response.stop_reason === "refusal"
      ? "No puedo ayudarte con esa consulta. Si es sobre tu expediente, escríbele a tu abogado desde la pestaña 'Mi abogado'."
      : textoDe(response) || "Disculpa, no he podido procesar tu pregunta.";

    return new Response(
      JSON.stringify({ success: true, reply, nivel }),
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
