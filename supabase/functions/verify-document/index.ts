import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sesionConMfaEmailOk } from "../_shared/mfaEmail.ts";
import { consumirUso, LIMITES } from "../_shared/limites.ts";
import { registrarError } from "../_shared/errores.ts";
import { anthropic, MODELO_IA, REINTENTO_ANTE_RECHAZO, textoDe } from "../_shared/claude.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Límite de la imagen en base64 (~7 MB ≈ 5 MB de imagen, el máximo que acepta Claude)
const MAX_IMAGE_BASE64 = 7_000_000;
// Formatos de imagen que acepta Claude; el resto (p. ej. HEIC) pasa a revisión manual
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

// Salida estructurada: la API garantiza este JSON (sin limpiar markdown a mano)
const ESQUEMA_VEREDICTO = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["valid", "incomplete", "wrong_document", "expired", "unreadable"] },
    confidence: { type: "integer" },
    documentType: { type: "string" },
    issuer: { anyOf: [{ type: "string" }, { type: "null" }] },
    issueDate: { anyOf: [{ type: "string" }, { type: "null" }] },
    message: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["verdict", "confidence", "documentType", "issuer", "issueDate", "message", "warnings"],
  additionalProperties: false,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildPrompt(docName: string, issuer: string, validity: string, criteria: string, clientName: string): string {
  return `Eres un verificador documental experto en derecho concursal español, trabajando para LibreApp (plataforma legal SaaS para despachos especializados en Ley de Segunda Oportunidad y Concurso de Acreedores).

DOCUMENTO ESPERADO: ${docName}
${issuer ? `EMISOR ESPERADO: ${issuer}` : ""}
${validity ? `VALIDEZ REQUERIDA: ${validity}` : ""}
${criteria ? `CRITERIOS DE VERIFICACIÓN: ${criteria}` : ""}

Analiza la imagen adjunta y determina si corresponde al documento esperado y cumple los requisitos.

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto adicional, sin bloques de código), con esta estructura exacta:

{
  "verdict": "valid" | "incomplete" | "wrong_document" | "expired" | "unreadable",
  "confidence": número entero entre 0 y 100,
  "documentType": "tipo de documento detectado",
  "issuer": "emisor detectado o null si no visible",
  "issueDate": "YYYY-MM-DD si se ve la fecha, null si no",
  "message": "mensaje claro al cliente ${clientName}, en español de España, tono cercano y profesional. Máximo 2 frases.",
  "warnings": ["lista de problemas detectados, si los hay"]
}

Reglas para el verdict:
- "valid": el documento coincide con lo esperado, está completo y vigente
- "incomplete": es el documento correcto pero le faltan páginas, datos o secciones
- "wrong_document": no es el documento solicitado
- "expired": es correcto pero está caducado (fecha superior a la validez requerida)
- "unreadable": la imagen está borrosa, mal iluminada o ilegible

IMPORTANTE: Si verdict es "valid", el message debe ser positivo y motivador. Si no es válido, explica AL CLIENTE de forma clara y breve QUÉ pasa y QUÉ tiene que hacer para arreglarlo.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let userId: string | null = null;
  let orgId: string | null = null;
  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    // Solo usuarios con sesión real (la anon key sola no basta): evita que
    // cualquiera con la clave pública gaste saldo de Anthropic.
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = jwt ? await supabaseAdmin.auth.getUser(jwt) : { data: { user: null } };
    if (!user || !(await sesionConMfaEmailOk(jwt))) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    userId = user.id;

    // Despacho del llamador (staff en users; cliente en contacts por email)
    const { data: staff } = await supabaseAdmin.from("users").select("org_id").eq("id", user.id).maybeSingle();
    if (staff) orgId = staff.org_id;
    else {
      const { data: contacto } = await supabaseAdmin.from("contacts").select("org_id").eq("email", user.email || "").maybeSingle();
      orgId = contacto?.org_id || null;
    }

    const body = await req.json();
    const { imageBase64, mimeType, docName, issuer, validity, criteria, clientName } = body;

    if (!imageBase64 || !mimeType) {
      throw new Error("Missing imageBase64 or mimeType");
    }
    if (typeof imageBase64 !== "string" || imageBase64.length > MAX_IMAGE_BASE64) {
      return new Response(JSON.stringify({ success: false, error: "Image too large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Solo imágenes en formatos que Claude acepta; lo demás lo revisa el letrado
    if (!TIPOS_IMAGEN.includes(mimeType)) {
      return new Response(
        JSON.stringify({
          success: true,
          verdict: "needs_review",
          confidence: 60,
          documentType: "Archivo no-imagen",
          message: `${clientName || "Cliente"}, he recibido tu archivo. Como no es una imagen, lo revisará tu letrado manualmente.`,
          warnings: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uso = await consumirUso(supabaseAdmin, "verify-document", user.id, orgId, LIMITES["verify-document"]);
    if (!uso.ok) {
      return new Response(JSON.stringify({ success: false, code: "limite", error: uso.mensaje, retry_after: uso.reintentarEn }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(uso.reintentarEn) },
      });
    }

    const prompt = buildPrompt(
      docName || "Documento legal",
      issuer || "",
      validity || "",
      criteria || "",
      clientName || "Cliente"
    );

    const response = await anthropic.beta.messages.create({
      model: MODELO_IA,
      max_tokens: 8000,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: ESQUEMA_VEREDICTO },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType as typeof TIPOS_IMAGEN[number], data: imageBase64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
      ...REINTENTO_ANTE_RECHAZO,
    });

    let parsed;
    if (response.stop_reason === "refusal") {
      parsed = {
        verdict: "needs_review", confidence: 0, documentType: "No determinado",
        message: `${clientName || "Cliente"}, he recibido tu documento. Tu letrado lo revisará.`, warnings: [],
      };
    } else {
      try {
        parsed = JSON.parse(textoDe(response));
      } catch {
        parsed = {
          verdict: "needs_review", confidence: 50, documentType: "No determinado",
          message: "He recibido tu documento. Tu letrado lo revisará.",
          warnings: ["No pude procesar la respuesta automáticamente"],
        };
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    await registrarError(supabaseAdmin, "verify-document", error, { userId, orgId });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
