import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Paperclip, FileText, FileSpreadsheet, Image as ImageIcon, Copy, Check, RotateCcw, Mic, MicOff } from "lucide-react";
import { ACEPTADOS, MAX_ADJUNTOS, MAX_BYTES_ADJUNTOS, prepararAdjunto } from "../lib/adjuntos";
import { C, font } from "../constants";
import { supabase } from "../lib/supabase";

// ════ DEMO RESPONSES ════
const DEMO_RESPONSES = {
  default: "Puedo ayudarte con:\n\n* Dudas sobre tu expediente\n* Documentacion necesaria\n* Plazos legales\n* Busqueda de jurisprudencia\n\nQue necesitas?",
  documents: "Para la Ley de Segunda Oportunidad necesitas reunir documentacion en estas categorias:\n\n1. **Datos personales**: DNI, empadronamiento, antecedentes\n2. **Situacion laboral**: Nominas, IRPF\n3. **Situacion bancaria**: Extractos 12 meses\n4. **Deudas**: Certificados AEAT, TGSS\n5. **Bienes**: Escrituras, vehiculos\n\nSobre que categoria necesitas mas informacion?",
  deadlines: "Los plazos mas importantes en un procedimiento LSO son:\n\n* **Solicitud AEP**: ante notario, sin plazo fijo pero recomendado < 3 meses desde la primera consulta\n* **Concurso consecutivo**: 2 meses desde el fracaso del AEP\n* **BEPI**: se solicita en el concurso consecutivo\n\nSegun el art. 178 bis LC (ahora art. 486 y ss. TRLC).",
  jurisprudence: "Para busqueda de jurisprudencia sobre LSO, las sentencias mas relevantes son:\n\n* **STS 381/2019** (Sala 1a) -- Sobre la buena fe del deudor\n* **STS 56/2020** -- Extension BEPI a credito publico\n* **STJUE C-869/19** -- Plazos de exoneracion (caso Liku/Sabiedriba)\n\nCuando el modulo LexConsulta este activo, podre buscar en la base de datos completa de CENDOJ.",
};

// Aviso al pie de cada respuesta, según el nivel
const DISCLAIMER = {
  usuario: "\n\nInformacion orientativa. No constituye asesoramiento legal vinculante.",
  despacho: "\n\nApoyo generado con IA: revísalo y valídalo antes de usarlo.",
};

const GREETINGS = [
  (name) => `Hola ${name}! Soy Carlota, tu asistente legal de LibreApp. `,
  (name) => `Buenos dias ${name}! `,
  (name) => `Hola ${name}, encantada de ayudarte. `,
  (name) => `${name}, aqui estoy para lo que necesites. `,
];

function getGreeting(name) {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)](name);
}

function matchDemoResponse(text, firstName) {
  const lower = text.toLowerCase();
  let response;
  if (/document|subir|falta|archivo|papel/.test(lower)) {
    response = DEMO_RESPONSES.documents;
  } else if (/plazo|fecha|cuanto|tiempo|cuando/.test(lower)) {
    response = DEMO_RESPONSES.deadlines;
  } else if (/sentencia|jurisprudencia|tribunal|juzgado/.test(lower)) {
    response = DEMO_RESPONSES.jurisprudence;
  } else {
    response = DEMO_RESPONSES.default;
  }
  const useGreeting = Math.random() > 0.4;
  return (useGreeting ? getGreeting(firstName) : "") + response + DISCLAIMER.usuario;
}

// Nivel despacho para los roles del despacho; el servidor lo vuelve a decidir
// por el rol en BD (esto solo adapta la pantalla).
const ROLES_DESPACHO = ["admin", "owner", "lawyer", "staff", "procurador", "sales"];

// Adjuntos (ver src/lib/adjuntos.js): no se guardan en ningún sitio.
// Nivel usuario: viajan solo con su mensaje. Nivel despacho: siguen disponibles
// durante la conversación (hasta 6 MB en total) para trabajar sobre ellos.
const IconoAdjunto = ({ a, size = 12, color }) =>
  a.tipo?.startsWith("image/") ? <ImageIcon size={size} color={color} />
    : a.origen === "hoja" ? <FileSpreadsheet size={size} color={color} />
      : <FileText size={size} color={color} />;

// Dictado por voz: reconocimiento del propio navegador (Chrome, Edge, Safari).
// No pasa por LibreApp ni por Anthropic; en Firefox no existe y el botón no aparece.
const Reconocimiento = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

const MODULE_SUBTITLES = {
  lexdocs: "Asistente Documental",
  lexcrm: "Asistente CRM",
  lexconsulta: "Asistente Legal",
  general: "Asistente Legal IA",
};

const CHIPS = {
  usuario: ["Que documentos me faltan?", "Cual es mi proximo plazo?", "Como consigo el CIRBE?"],
  despacho: [
    "Resume este documento y señala lo relevante",
    "Redacta una solicitud de concurso de persona física",
    "Prepara una propuesta de plan de pagos",
    "¿Qué deudas no son exonerables en el BEPI?",
  ],
};

const BIENVENIDA = {
  usuario: (n) => `Hola ${n}! Soy Carlota, tu asistente legal de LibreApp.\n\nPuedo ayudarte con:\n\n* Dudas sobre tu expediente\n* Documentacion necesaria\n* Plazos legales\n* Busqueda de jurisprudencia\n\nEn que puedo ayudarte?`,
  despacho: (n) => `Hola ${n}, soy Carlota, la asistente jurídica del despacho.\n\nPuedo ayudarte a:\n\n* Leer e interpretar documentos: PDF, Word, Excel, CSV o fotos (con el clip)\n* Analizar la situación de un deudor y sus riesgos\n* Redactar borradores: solicitudes, demandas, planes de pagos, escritos e informes\n* Encontrar el fundamento legal de un punto\n\n¿Con qué empezamos?`,
};

// modo "flotante": burbuja abajo a la derecha. modo "pagina": ocupa el contenido
// (sección "Asistente IA Legal" del panel del despacho).
export default function Carlota({ user, currentModule = "general", currentContext = {}, modo = "flotante" }) {
  const enPagina = modo === "pagina";
  const [isOpen, setIsOpen] = useState(enPagina);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasPulse, setHasPulse] = useState(true);
  const [adjuntos, setAdjuntos] = useState([]); // { nombre, tipo, tamano, datos(base64) }
  const [avisoAdjunto, setAvisoAdjunto] = useState("");
  const [copiado, setCopiado] = useState(null);
  const [dictando, setDictando] = useState(false);
  const reconocimientoRef = useRef(null);
  const textoAntesDeDictarRef = useRef("");
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  const firstName = (user?.full_name || user?.name || "").split(" ")[0] || "usuario";
  const role = user?.role || "client";
  const nivel = ROLES_DESPACHO.includes(role) ? "despacho" : "usuario";
  const subtitle = nivel === "despacho" ? "Asistente jurídica del despacho" : (MODULE_SUBTITLES[currentModule] || MODULE_SUBTITLES.general);
  const chips = CHIPS[nivel];

  // Mensaje de bienvenida al abrir
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: "assistant", content: BIENVENIDA[nivel](firstName) + DISCLAIMER[nivel], timestamp: Date.now(), bienvenida: true }]);
    }
  }, [isOpen]);

  // Scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Remove pulse after first open
  useEffect(() => {
    if (isOpen) setHasPulse(false);
  }, [isOpen]);

  // Evento global para abrir la burbuja (con mensaje inicial opcional). La página no lo escucha.
  useEffect(() => {
    if (enPagina) return;
    function handler(e) {
      setIsOpen(true);
      const initial = e?.detail?.message;
      if (initial) {
        // Wait a tick for the panel to mount, then send the message
        setTimeout(() => sendMessage(initial), 300);
      }
    }
    window.addEventListener("open-carlota", handler);
    return () => window.removeEventListener("open-carlota", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bytes de adjuntos que siguen en la conversación (solo nivel despacho los reenvía)
  const bytesEnConversacion = nivel === "despacho"
    ? messages.reduce((n, m) => n + (m.adjuntos || []).reduce((k, a) => k + (a.tamano || 0), 0), 0)
    : 0;

  async function elegirArchivos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setAvisoAdjunto("");
    const nuevos = [];
    let total = bytesEnConversacion + adjuntos.reduce((n, a) => n + a.tamano, 0);
    for (const f of files) {
      if (adjuntos.length + nuevos.length >= MAX_ADJUNTOS) { setAvisoAdjunto(`Máximo ${MAX_ADJUNTOS} archivos por mensaje.`); break; }
      if (total + f.size > MAX_BYTES_ADJUNTOS) {
        setAvisoAdjunto(nivel === "despacho" && bytesEnConversacion
          ? "Esta conversación ya tiene 6 MB de archivos: empieza una nueva para añadir más."
          : "Los archivos no pueden pasar de 6 MB en total.");
        break;
      }
      const r = await prepararAdjunto(f);
      if (!r.ok) { setAvisoAdjunto(r.error); continue; }
      total += f.size;
      nuevos.push(r.adjunto);
    }
    if (nuevos.length) setAdjuntos(prev => [...prev, ...nuevos]);
  }

  function nuevaConversacion() {
    setAdjuntos([]);
    setAvisoAdjunto("");
    setInput("");
    setMessages([{ role: "assistant", content: BIENVENIDA[nivel](firstName) + DISCLAIMER[nivel], timestamp: Date.now(), bienvenida: true }]);
  }

  function alternarDictado() {
    if (dictando) { reconocimientoRef.current?.stop(); return; }
    const rec = new Reconocimiento();
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = true;
    textoAntesDeDictarRef.current = input ? input.replace(/\s*$/, " ") : "";
    rec.onresult = (e) => {
      let dicho = "";
      for (let i = 0; i < e.results.length; i++) dicho += e.results[i][0].transcript;
      setInput(textoAntesDeDictarRef.current + dicho.trimStart());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setAvisoAdjunto("Permite el micrófono en el navegador para dictar.");
    };
    rec.onend = () => { setDictando(false); textareaRef.current?.focus(); };
    reconocimientoRef.current = rec;
    rec.start();
    setDictando(true);
  }

  // Si se cierra el panel mientras se dicta, se para el micrófono
  useEffect(() => () => reconocimientoRef.current?.stop(), []);

  async function copiar(texto, i) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(i);
      setTimeout(() => setCopiado(null), 1800);
    } catch { /* sin permiso de portapapeles */ }
  }

  async function sendMessage(text) {
    const enviados = adjuntos;
    const msg = (text || input).trim() || (enviados.length ? "Te envío este archivo." : "");
    if (!msg || isTyping) return;
    if (dictando) reconocimientoRef.current?.stop();
    setInput("");
    setAdjuntos([]);
    setAvisoAdjunto("");

    // En nivel despacho se conservan los datos para reenviarlos en la conversación
    const userMsg = {
      role: "user",
      content: msg,
      adjuntos: enviados.map(a => nivel === "despacho" ? a : { nombre: a.nombre, tipo: a.tipo, origen: a.origen }),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (supabaseUrl) {
      // ═══ MODO REAL: Claude vía Edge Function carlota-chat ═══
      // La API key de Anthropic vive SOLO en el servidor (Edge Function). Nunca
      // se llama a api.anthropic.com desde el navegador para no exponer la clave.
      try {
        const aApi = (m) => nivel === "despacho"
          ? { role: m.role, content: m.content, adjuntos: (m.adjuntos || []).filter(a => a.datos || a.texto).map(a => ({ nombre: a.nombre, tipo: a.tipo, datos: a.datos, texto: a.texto })) }
          : { role: m.role, content: m.adjuntos?.length ? `${m.content}\n[Adjuntó: ${m.adjuntos.map(a => a.nombre).join(", ")}]` : m.content };
        const apiMessages = messages
          .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.bienvenida)
          .slice(nivel === "despacho" ? -19 : -10)
          .map(aApi)
          .concat([{ role: 'user', content: msg, adjuntos: enviados.map(a => ({ nombre: a.nombre, tipo: a.tipo, datos: a.datos, texto: a.texto })) }]);

        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        let reply;

        if (accessToken) {
          const res = await fetch(`${supabaseUrl}/functions/v1/carlota-chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              messages: apiMessages,
              currentModule,
              currentContext,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (data.success) reply = data.reply;
          else if (data.code === 'limite' || data.code === 'demasiado_grande') {
            // Límite de uso o mensaje enorme: el servidor ya da el texto para el usuario
            setMessages(prev => [...prev, { role: 'assistant', content: data.error, timestamp: Date.now() }]);
            setIsTyping(false);
            return;
          }
          else throw new Error(data.error || 'Edge function error');
        }

        if (reply) {
          setMessages(prev => [...prev, { role: 'assistant', content: reply + DISCLAIMER[nivel], timestamp: Date.now() }]);
        } else {
          // Sin sesión o sin respuesta del servidor → modo demo
          const demo = matchDemoResponse(msg, firstName);
          setMessages(prev => [...prev, { role: 'assistant', content: demo, timestamp: Date.now() }]);
        }
      } catch (e) {
        // Con sesión real no se muestran respuestas de demostración: parecerían
        // consejo legal de Carlota sin serlo.
        console.error('Carlota (edge function) error:', e);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Ahora mismo no puedo responderte. Inténtalo de nuevo en unos minutos; si es urgente, escribe a tu despacho.', timestamp: Date.now() }]);
      }
    } else {
      // ═══ MODO DEMO ═══
      const delay = 800 + Math.random() * 1200;
      await new Promise((r) => setTimeout(r, delay));
      const reply = matchDemoResponse(msg, firstName);
      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }]);
    }

    setIsTyping(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleChip(chip) {
    sendMessage(chip);
  }

  // ════ RENDER ════

  // Simple markdown-like rendering: **bold**, * bullets
  function renderContent(text) {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Bullet points
      const bulletMatch = line.match(/^\*\s+(.*)/);
      if (bulletMatch) {
        return (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2, paddingLeft: 4 }}>
            <span style={{ color: C.primary, flexShrink: 0 }}>&#x2022;</span>
            <span>{renderInline(bulletMatch[1])}</span>
          </div>
        );
      }
      // Numbered items
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2, paddingLeft: 4 }}>
            <span style={{ color: C.primary, fontWeight: 600, flexShrink: 0 }}>{numMatch[1]}.</span>
            <span>{renderInline(numMatch[2])}</span>
          </div>
        );
      }
      // Empty line
      if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
      // Normal line
      return <div key={i} style={{ marginBottom: 2 }}>{renderInline(line)}</div>;
    });
  }

  function renderInline(text) {
    // Handle **bold**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  }

  const hayQueEnviar = input.trim() || adjuntos.length;

  const panelStyle = enPagina
    ? {
      height: "calc(100vh - 150px)", minHeight: 460, borderRadius: 14, background: C.white,
      border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: font,
    }
    : {
      position: "fixed", bottom: 24, right: 24, width: 400, height: 520, maxHeight: "calc(100vh - 48px)",
      borderRadius: 18, background: C.white, boxShadow: "0 12px 48px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.05)",
      display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 1001,
      animation: "carlotaSlideUp .3s ease both", fontFamily: font,
    };

  return (
    <>
      {/* ════ STYLES ════ */}
      <style>{`
        @keyframes carlotaPulse{0%,100%{box-shadow:0 0 0 0 rgba(91,107,240,.4)}70%{box-shadow:0 0 0 12px rgba(91,107,240,0)}}
        @keyframes carlotaSlideUp{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes carlotaFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes carlotaBounce{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        @keyframes carlotaDot{0%,80%,100%{opacity:.3}40%{opacity:1}}
      `}</style>

      {/* ════ FLOATING BUTTON + CTA ════ */}
      {!enPagina && !isOpen && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setIsOpen(true)}
            className="carlota-cta"
            style={{
              padding: "9px 14px", borderRadius: 20, background: C.white, color: C.primary,
              border: `1px solid ${C.primary}30`, boxShadow: "0 4px 16px rgba(0,0,0,.10)",
              fontSize: 12.5, fontWeight: 600, fontFamily: font, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Pregúntale a la IA
          </button>
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Abrir Carlota, asistente IA"
            style={{
              position: "relative",
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 24px rgba(91,107,240,.35)",
              animation: hasPulse ? "carlotaPulse 2s ease infinite, carlotaBounce 2s ease infinite" : "none",
              transition: "transform .2s",
              fontFamily: font,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <Sparkles size={24} color="#fff" />
            {/* Badge IA */}
            <span style={{
              position: "absolute",
              top: -2,
              right: -2,
              background: C.teal,
              color: "#fff",
              fontSize: 8,
              fontWeight: 700,
              padding: "2px 5px",
              borderRadius: 6,
              letterSpacing: ".05em",
              lineHeight: 1,
              fontFamily: font,
            }}>IA</span>
          </button>
        </div>
      )}

      {/* ════ CHAT PANEL ════ */}
      {isOpen && (
        <div style={panelStyle} className={enPagina ? undefined : "carlota-panel"}>

          {/* ──── HEADER ──── */}
          <div style={{
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 11,
            flexShrink: 0,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(255,255,255,.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <Sparkles size={19} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>Carlota</h3>
              <p style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)", margin: 0, marginTop: 1 }}>{subtitle}</p>
            </div>
            {messages.length > 1 && (
              <button
                onClick={nuevaConversacion}
                disabled={isTyping}
                title="Empezar una conversación nueva"
                aria-label="Empezar una conversación nueva"
                style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, height: 32, padding: "0 10px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#fff", fontSize: 11.5, fontWeight: 600, fontFamily: font }}
              >
                <RotateCcw size={14} /> {enPagina && "Nueva conversación"}
              </button>
            )}
            {!enPagina && (
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar Carlota"
                style={{
                  background: "rgba(255,255,255,.15)",
                  border: "none",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* ──── MESSAGES ──── */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: enPagina ? "20px 24px 10px" : "14px 14px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: C.bg,
          }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  gap: 8,
                  animation: "carlotaFadeIn .25s ease both",
                }}
              >
                {m.role === "assistant" && (
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}>
                    <Sparkles size={13} color="#fff" />
                  </div>
                )}
                <div style={{ maxWidth: enPagina ? "85%" : "78%", display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: m.role === "user"
                      ? "14px 14px 4px 14px"
                      : "14px 14px 14px 4px",
                    background: m.role === "user"
                      ? `linear-gradient(135deg, ${C.primary}, ${C.violet})`
                      : C.white,
                    color: m.role === "user" ? "#fff" : C.text,
                    fontSize: enPagina ? 13.5 : 12.5,
                    lineHeight: 1.6,
                    boxShadow: m.role === "user"
                      ? "none"
                      : "0 1px 4px rgba(0,0,0,.06)",
                    overflowWrap: "anywhere",
                  }}>
                    {m.role === "user" ? m.content : renderContent(m.content)}
                    {m.adjuntos?.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                        {m.adjuntos.map((a, j) => (
                          <span key={j} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, opacity: .9 }}>
                            <IconoAdjunto a={a} /> {a.nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Copiar respuesta (nivel despacho: para llevar el borrador a un documento) */}
                  {nivel === "despacho" && m.role === "assistant" && !m.bienvenida && (
                    <button
                      onClick={() => copiar(m.content, i)}
                      style={{ marginTop: 4, background: "none", border: "none", padding: "2px 4px", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.textMuted, cursor: "pointer", fontFamily: font }}
                    >
                      {copiado === i ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div style={{ display: "flex", gap: 8, animation: "carlotaFadeIn .2s ease both" }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Sparkles size={13} color="#fff" />
                </div>
                <div style={{
                  padding: "10px 16px",
                  borderRadius: "14px 14px 14px 4px",
                  background: C.white,
                  boxShadow: "0 1px 4px rgba(0,0,0,.06)",
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                }}>
                  {[0, 1, 2].map((j) => (
                    <div key={j} style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: C.textMuted,
                      animation: `carlotaDot 1.4s ease ${j * 0.2}s infinite`,
                    }} />
                  ))}
                  {nivel === "despacho" && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>Los escritos largos pueden tardar un minuto</span>}
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* ──── QUICK CHIPS ──── */}
          {messages.length <= 1 && !isTyping && (
            <div style={{
              padding: "6px 14px 2px",
              display: "flex",
              flexWrap: "wrap",
              gap: 5,
              background: C.bg,
            }}>
              {chips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => handleChip(chip)}
                  style={{
                    padding: "5px 11px",
                    borderRadius: 14,
                    fontSize: 11,
                    background: C.white,
                    border: `1px solid ${C.primary}25`,
                    color: C.primary,
                    cursor: "pointer",
                    fontWeight: 500,
                    fontFamily: font,
                    transition: ".15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${C.primary}10`;
                    e.currentTarget.style.borderColor = `${C.primary}50`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = C.white;
                    e.currentTarget.style.borderColor = `${C.primary}25`;
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* ──── INPUT ──── */}
          <div style={{
            padding: "10px 14px",
            borderTop: `1px solid ${C.border}`,
            background: C.white,
            flexShrink: 0,
          }}>
            {(adjuntos.length > 0 || avisoAdjunto) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7 }}>
                {adjuntos.map((a, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 8, background: C.bg, border: `1px solid ${C.border}`, fontSize: 11, color: C.text, maxWidth: "100%" }}>
                    <IconoAdjunto a={a} color={C.primary} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{a.nombre}</span>
                    <button onClick={() => setAdjuntos(prev => prev.filter((_, j) => j !== i))} aria-label={`Quitar ${a.nombre}`} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: C.textMuted, display: "flex" }}><X size={12} /></button>
                  </span>
                ))}
                {avisoAdjunto && <span style={{ fontSize: 11, color: C.red }}>{avisoAdjunto}</span>}
              </div>
            )}
            <input ref={fileRef} id={enPagina ? "carlota-adjuntos-pagina" : "carlota-adjuntos"} type="file" accept={ACEPTADOS} multiple onChange={elegirArchivos} style={{ display: "none" }} />
            <div style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              background: C.bg,
              borderRadius: 12,
              padding: "6px 10px",
              border: `1.5px solid ${C.border}`,
              transition: ".2s",
            }}>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={isTyping || adjuntos.length >= MAX_ADJUNTOS}
                aria-label="Adjuntar archivo"
                title="Adjuntar PDF, Word, Excel, CSV o fotos"
                style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: "transparent", color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
              >
                <Paperclip size={16} />
              </button>
              {Reconocimiento && (
                <button
                  onClick={alternarDictado}
                  disabled={isTyping}
                  aria-label={dictando ? "Parar el dictado" : "Dictar por voz"}
                  aria-pressed={dictando}
                  title={dictando ? "Parar el dictado" : "Dictar por voz"}
                  style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: dictando ? `${C.red}15` : "transparent", color: dictando ? C.red : C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", animation: dictando ? "carlotaDot 1.4s ease infinite" : "none" }}
                >
                  {dictando ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <textarea
                ref={textareaRef}
                id={enPagina ? "carlota-texto-pagina" : "carlota-texto"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={dictando ? "Te escucho… pulsa el micrófono para terminar" : nivel === "despacho" ? "Pide un análisis, un resumen o un borrador..." : "Pregunta a Carlota..."}
                rows={enPagina ? 3 : 1}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontSize: enPagina ? 13.5 : 12.5,
                  fontFamily: font,
                  background: "transparent",
                  padding: "4px 0",
                  maxHeight: enPagina ? 180 : 72,
                  lineHeight: 1.5,
                  color: C.text,
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!hayQueEnviar || isTyping}
                aria-label="Enviar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  flexShrink: 0,
                  background: hayQueEnviar
                    ? `linear-gradient(135deg, ${C.primary}, ${C.violet})`
                    : C.border,
                  color: hayQueEnviar ? "#fff" : C.textMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: hayQueEnviar ? "pointer" : "default",
                  transition: ".2s",
                }}
              >
                <Send size={14} />
              </button>
            </div>

            {/* Disclaimer */}
            <p style={{
              fontSize: 9.5,
              color: C.textMuted,
              textAlign: "center",
              marginTop: 7,
              lineHeight: 1.4,
            }}>
              {nivel === "despacho"
                ? "Apoyo generado con IA para profesionales. Revisa y valida todo antes de usarlo."
                : "Informacion orientativa. No constituye asesoramiento legal vinculante."}
            </p>
          </div>
        </div>
      )}

      {/* ════ MOBILE OVERRIDES ════ */}
      <style>{`
        @media(max-width:768px){
          .carlota-panel{
            bottom:0!important;
            right:0!important;
            left:0!important;
            width:100%!important;
            height:calc(100vh - 60px)!important;
            max-height:100vh!important;
            border-radius:18px 18px 0 0!important;
          }
        }
        @media(max-width:420px){ .carlota-cta{ display:none } }
      `}</style>
    </>
  );
}
