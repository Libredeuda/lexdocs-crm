// Adjuntos para Carlota: qué formatos se aceptan y cómo se preparan para Claude.
// Fotos y PDF viajan tal cual (base64): Claude los lee directamente.
// Word, Excel, CSV y TXT se convierten a texto en el navegador (Claude no lee
// .docx ni .xlsx); las librerías solo se descargan cuando hacen falta.
// Nada se guarda: el archivo va en la petición a carlota-chat y desaparece.

export const MAX_ADJUNTOS = 3;
export const MAX_BYTES_ADJUNTOS = 6 * 1024 * 1024;
// ~70 páginas llenas. Más que esto no se lee "a medias": se avisa al usuario.
export const MAX_CARACTERES_TEXTO = 200_000;

export const ACEPTADOS = ".pdf,.docx,.xlsx,.xls,.ods,.csv,.txt,.jpg,.jpeg,.png,.webp,.gif";

const MIME_IMAGEN = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

const extension = (nombre) => (String(nombre).split(".").pop() || "").toLowerCase();

// "imagen" | "pdf" | "word" | "hoja" | "texto" | "doc-antiguo" | null (no admitido)
export function clasificar(nombre, tipo = "") {
  const e = extension(nombre);
  if (MIME_IMAGEN[e] || Object.values(MIME_IMAGEN).includes(tipo)) return "imagen";
  if (e === "pdf" || tipo === "application/pdf") return "pdf";
  if (e === "docx") return "word";
  if (["xlsx", "xls", "ods"].includes(e)) return "hoja";
  if (["csv", "txt"].includes(e)) return "texto";
  if (e === "doc") return "doc-antiguo";
  return null;
}

// Cada hoja del libro como CSV, con su nombre delante
export function hojasATexto(XLSX, datos) {
  const libro = XLSX.read(datos, { type: "array" });
  return libro.SheetNames
    .map((nombre) => `## Hoja: ${nombre}\n${XLSX.utils.sheet_to_csv(libro.Sheets[nombre])}`)
    .join("\n\n");
}

export async function wordATexto(arrayBuffer) {
  const mammoth = await import("mammoth");
  // El build de navegador de mammoth lee arrayBuffer; el de Node (tests), buffer
  const buffer = globalThis.Buffer ? globalThis.Buffer.from(arrayBuffer) : undefined;
  const { value } = await (mammoth.default || mammoth).extractRawText({ arrayBuffer, buffer });
  return value;
}

function leerComoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Devuelve { ok: true, adjunto } o { ok: false, error } con un texto para el usuario.
// Adjunto binario: { nombre, tipo, tamano, datos(base64) }
// Adjunto de texto: { nombre, tipo: "text/plain", tamano, texto, origen: "word" | "hoja" | "texto" }
export async function prepararAdjunto(file) {
  const clase = clasificar(file.name, file.type);
  const base = { nombre: file.name, tamano: file.size };
  try {
    if (clase === "imagen") {
      return { ok: true, adjunto: { ...base, tipo: MIME_IMAGEN[extension(file.name)] || file.type, datos: await leerComoBase64(file) } };
    }
    if (clase === "pdf") {
      return { ok: true, adjunto: { ...base, tipo: "application/pdf", datos: await leerComoBase64(file) } };
    }
    if (clase === "doc-antiguo") {
      return { ok: false, error: `"${file.name}" es un Word antiguo (.doc): guárdalo como .docx o PDF y vuelve a adjuntarlo.` };
    }
    if (!clase) {
      return { ok: false, error: `"${file.name}": formato no admitido. Usa PDF, Word, Excel, CSV, TXT o fotos (JPG, PNG, WebP, GIF).` };
    }

    let texto;
    if (clase === "word") texto = await wordATexto(await file.arrayBuffer());
    else if (clase === "hoja") texto = hojasATexto(await import("xlsx"), new Uint8Array(await file.arrayBuffer()));
    else texto = await file.text();

    if (!texto.trim()) return { ok: false, error: `"${file.name}" no tiene texto que se pueda leer.` };
    if (texto.length > MAX_CARACTERES_TEXTO) {
      return { ok: false, error: `"${file.name}" es demasiado largo para leerlo entero (${texto.length.toLocaleString("es-ES")} caracteres). Divídelo o expórtalo a PDF con la parte que necesites.` };
    }
    return { ok: true, adjunto: { ...base, tipo: "text/plain", texto, origen: clase } };
  } catch (e) {
    console.error("prepararAdjunto:", e);
    return { ok: false, error: `No he podido leer "${file.name}". Comprueba que no esté dañado o protegido con contraseña.` };
  }
}
