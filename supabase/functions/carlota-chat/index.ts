import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildSystemPrompt(firstName: string, userRole: string, module: string, context: any): string {
  const base = `Eres Carlota, la asistente legal de LibreApp, una plataforma SaaS para despachos de abogados especializados en Ley de Segunda Oportunidad y Concurso de Acreedores en Espa\u00f1a.

PERSONALIDAD:
- Profesional pero cercana, tuteas al usuario
- Especializada en derecho concursal espa\u00f1ol y LSO
- Citas fuentes siempre que puedas (sentencia, art\u00edculo, ley)
- NUNCA inventas jurisprudencia ni sentencias
- Respondes en espa\u00f1ol de Espa\u00f1a
- Mensajes concisos y \u00fatiles

LEGISLACI\u00d3N CLAVE QUE CONOCES:
- TRLC (Real Decreto Legislativo 1/2020): Texto Refundido de la Ley Concursal
- Ley 16/2022: Reforma del TRLC, transpone Directiva UE 2019/1023
- Arts. 486-502 TRLC: R\u00e9gimen del BEPI (Beneficio de Exoneraci\u00f3n del Pasivo Insatisfecho)
- Art. 178 bis LC (antiguo): BEPI original
- RDL 1/2015: Primera regulaci\u00f3n de segunda oportunidad en Espa\u00f1a

JURISPRUDENCIA CLAVE:
- STS 381/2019: Criterios de buena fe para BEPI
- STS 56/2020: Extensi\u00f3n BEPI a cr\u00e9dito p\u00fablico (AEAT, TGSS)
- STS 232/2022: Plan de pagos en concurso consecutivo
- STS 589/2023: BEPI y deuda hipotecaria
- STJUE C-869/19: Plazos de exoneraci\u00f3n (Directiva insolvencia)

DOCUMENTACI\u00d3N LSO (30 documentos en 7 categor\u00edas):
1. Datos personales: DNI/NIE, libro familia, empadronamiento, antecedentes penales
2. Situaci\u00f3n laboral: 3 \u00faltimas n\u00f3minas, IRPF 4 a\u00f1os
3. Situaci\u00f3n bancaria: Extractos 12 meses, contratos pr\u00e9stamos
4. Deudas: Certificados AEAT, TGSS, listado acreedores
5. Inventario bienes: Escrituras, IBI, veh\u00edculos
6. Gastos e ingresos mensuales
7. Contratos vigentes`;

  const roleContextMap: Record<string, string> = {
    client: `\n\nCONTEXTO: Est\u00e1s hablando con ${firstName}, un CLIENTE del despacho. Usa lenguaje sencillo, s\u00e9 motivadora, explica los conceptos legales de forma simple. No uses jerga legal sin explicarla.`,
    lawyer: `\n\nCONTEXTO: Est\u00e1s hablando con ${firstName}, un LETRADO del despacho. S\u00e9 t\u00e9cnica y eficiente. Puedes usar terminolog\u00eda jur\u00eddica. Cita sentencias con formato STS sala/n\u00ba/fecha.`,
    admin: `\n\nCONTEXTO: Est\u00e1s hablando con ${firstName}, ADMINISTRADOR del despacho. Puedes ayudar con KPIs, an\u00e1lisis de pipeline, y cuestiones de gesti\u00f3n adem\u00e1s de temas legales.`,
    staff: `\n\nCONTEXTO: Est\u00e1s hablando con ${firstName}, personal del despacho. Ayuda con cuestiones documentales y procedimentales.`,
  };

  const moduleContextMap: Record<string, string> = {
    lexdocs: '\n\nM\u00d3DULO ACTIVO: LexDocs (portal documental del cliente). Enf\u00f3cate en ayudar con documentaci\u00f3n, qu\u00e9 falta, d\u00f3nde conseguir cada documento, plazos.',
    lexcrm: '\n\nM\u00d3DULO ACTIVO: LexCRM (gesti\u00f3n del despacho). Puedes ayudar con gesti\u00f3n de contactos, expedientes, pipeline de ventas.',
    lexconsulta: '\n\nM\u00d3DULO ACTIVO: LexConsulta (b\u00fasqueda jur\u00eddica). Enf\u00f3cate en jurisprudencia, legislaci\u00f3n, an\u00e1lisis de sentencias.',
    general: '',
  };

  return base + (roleContextMap[userRole] || roleContextMap.client) + (moduleContextMap[module] || '');
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const { messages, userRole, currentModule, firstName, currentContext } = await req.json();

    const systemPrompt = buildSystemPrompt(firstName || "usuario", userRole || "client", currentModule || "general", currentContext || {});

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.slice(-10),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Claude API error");
    }

    const reply = data.content?.map((b: any) => b.text || "").join("") || "Disculpa, no he podido procesar tu pregunta.";

    return new Response(
      JSON.stringify({ success: true, reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
