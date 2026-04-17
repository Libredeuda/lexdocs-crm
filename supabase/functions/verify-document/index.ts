import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

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

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const body = await req.json();
    const { imageBase64, mimeType, docName, issuer, validity, criteria, clientName } = body;

    if (!imageBase64 || !mimeType) {
      throw new Error("Missing imageBase64 or mimeType");
    }

    // Only support image types for vision
    if (!mimeType.startsWith("image/")) {
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

    const prompt = buildPrompt(
      docName || "Documento legal",
      issuer || "",
      validity || "",
      criteria || "",
      clientName || "Cliente"
    );

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
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Claude API error");
    }

    const rawText = data.content?.map((b: any) => b.text || "").join("") || "{}";

    // Parse JSON from response (Claude sometimes adds markdown blocks)
    let parsed;
    try {
      const cleanText = rawText.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (e) {
      // Fallback if parsing fails
      parsed = {
        verdict: "needs_review",
        confidence: 50,
        documentType: "No determinado",
        message: rawText.slice(0, 200) || "He recibido tu documento. Tu letrado lo revisará.",
        warnings: ["No pude procesar la respuesta automáticamente"],
      };
    }

    return new Response(
      JSON.stringify({ success: true, ...parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
