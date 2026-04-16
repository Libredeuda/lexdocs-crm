import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, MessageCircle, Bot } from "lucide-react";
import { C, font } from "../constants";

// ════ DEMO RESPONSES ════
const DEMO_RESPONSES = {
  default: "Puedo ayudarte con:\n\n* Dudas sobre tu expediente\n* Documentacion necesaria\n* Plazos legales\n* Busqueda de jurisprudencia\n\nQue necesitas?",
  documents: "Para la Ley de Segunda Oportunidad necesitas reunir documentacion en estas categorias:\n\n1. **Datos personales**: DNI, empadronamiento, antecedentes\n2. **Situacion laboral**: Nominas, IRPF\n3. **Situacion bancaria**: Extractos 12 meses\n4. **Deudas**: Certificados AEAT, TGSS\n5. **Bienes**: Escrituras, vehiculos\n\nSobre que categoria necesitas mas informacion?",
  deadlines: "Los plazos mas importantes en un procedimiento LSO son:\n\n* **Solicitud AEP**: ante notario, sin plazo fijo pero recomendado < 3 meses desde la primera consulta\n* **Concurso consecutivo**: 2 meses desde el fracaso del AEP\n* **BEPI**: se solicita en el concurso consecutivo\n\nSegun el art. 178 bis LC (ahora art. 486 y ss. TRLC).",
  jurisprudence: "Para busqueda de jurisprudencia sobre LSO, las sentencias mas relevantes son:\n\n* **STS 381/2019** (Sala 1a) -- Sobre la buena fe del deudor\n* **STS 56/2020** -- Extension BEPI a credito publico\n* **STJUE C-869/19** -- Plazos de exoneracion (caso Liku/Sabiedriba)\n\nCuando el modulo LexConsulta este activo, podre buscar en la base de datos completa de CENDOJ.",
};

const DISCLAIMER = "\n\nInformacion orientativa. No constituye asesoramiento legal vinculante.";

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
  return (useGreeting ? getGreeting(firstName) : "") + response + DISCLAIMER;
}

const MODULE_SUBTITLES = {
  lexdocs: "Asistente Documental",
  lexcrm: "Asistente CRM",
  lexconsulta: "Asistente Legal",
  general: "Asistente Legal IA",
};

const QUICK_CHIPS_CLIENT = [
  "Que documentos me faltan?",
  "Cual es mi proximo plazo?",
  "Como consigo el CIRBE?",
];

const QUICK_CHIPS_ADMIN = [
  "Buscar jurisprudencia LSO",
  "Redactar resumen caso",
  "Casos similares",
];

export default function Carlota({ user, currentModule = "general", currentContext = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasPulse, setHasPulse] = useState(true);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  const firstName = (user?.full_name || user?.name || "").split(" ")[0] || "usuario";
  const role = user?.role || "client";
  const subtitle = MODULE_SUBTITLES[currentModule] || MODULE_SUBTITLES.general;
  const chips = role === "client" ? QUICK_CHIPS_CLIENT : QUICK_CHIPS_ADMIN;

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Hola ${firstName}! Soy Carlota, tu asistente legal de LibreApp.\n\nPuedo ayudarte con:\n\n* Dudas sobre tu expediente\n* Documentacion necesaria\n* Plazos legales\n* Busqueda de jurisprudencia\n\nEn que puedo ayudarte?${DISCLAIMER}`,
        timestamp: Date.now(),
      }]);
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

  async function sendMessage(text) {
    const msg = (text || input).trim();
    if (!msg || isTyping) return;
    setInput("");

    const userMsg = { role: "user", content: msg, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (apiKey) {
      // ═══ MODO REAL: Claude API ═══
      try {
        const systemPrompt = buildSystemPrompt(firstName, role, currentModule, currentContext);
        const apiMessages = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .concat([{ role: 'user', content: msg }])
          .map(m => ({ role: m.role, content: m.content }));

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: apiMessages,
          }),
        });

        const data = await res.json();
        const reply = data.content?.map(b => b.text || '').join('') || 'Disculpa, no he podido procesar tu pregunta. ¿Puedes reformularla?';
        setMessages(prev => [...prev, { role: 'assistant', content: reply + DISCLAIMER, timestamp: Date.now() }]);
      } catch (e) {
        console.error('Claude API error:', e);
        // Fallback to demo
        const reply = matchDemoResponse(msg, firstName);
        setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }]);
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

  function buildSystemPrompt(name, userRole, module, context) {
    const base = `Eres Carlota, la asistente legal de LibreApp, una plataforma SaaS para despachos de abogados especializados en Ley de Segunda Oportunidad y Concurso de Acreedores en España.

PERSONALIDAD:
- Profesional pero cercana, tuteas al usuario
- Especializada en derecho concursal español y LSO
- Citas fuentes siempre que puedas (sentencia, artículo, ley)
- NUNCA inventas jurisprudencia ni sentencias
- Respondes en español de España
- Mensajes concisos y útiles

LEGISLACIÓN CLAVE QUE CONOCES:
- TRLC (Real Decreto Legislativo 1/2020): Texto Refundido de la Ley Concursal
- Ley 16/2022: Reforma del TRLC, transpone Directiva UE 2019/1023
- Arts. 486-502 TRLC: Régimen del BEPI (Beneficio de Exoneración del Pasivo Insatisfecho)
- Art. 178 bis LC (antiguo): BEPI original
- RDL 1/2015: Primera regulación de segunda oportunidad en España

JURISPRUDENCIA CLAVE:
- STS 381/2019: Criterios de buena fe para BEPI
- STS 56/2020: Extensión BEPI a crédito público (AEAT, TGSS)
- STS 232/2022: Plan de pagos en concurso consecutivo
- STS 589/2023: BEPI y deuda hipotecaria
- STJUE C-869/19: Plazos de exoneración (Directiva insolvencia)

DOCUMENTACIÓN LSO (30 documentos en 7 categorías):
1. Datos personales: DNI/NIE, libro familia, empadronamiento, antecedentes penales
2. Situación laboral: 3 últimas nóminas, IRPF 4 años
3. Situación bancaria: Extractos 12 meses, contratos préstamos
4. Deudas: Certificados AEAT, TGSS, listado acreedores
5. Inventario bienes: Escrituras, IBI, vehículos
6. Gastos e ingresos mensuales
7. Contratos vigentes`;

    const roleContext = {
      client: `\n\nCONTEXTO: Estás hablando con ${name}, un CLIENTE del despacho. Usa lenguaje sencillo, sé motivadora, explica los conceptos legales de forma simple. No uses jerga legal sin explicarla.`,
      lawyer: `\n\nCONTEXTO: Estás hablando con ${name}, un LETRADO del despacho. Sé técnica y eficiente. Puedes usar terminología jurídica. Cita sentencias con formato STS sala/nº/fecha.`,
      admin: `\n\nCONTEXTO: Estás hablando con ${name}, ADMINISTRADOR del despacho. Puedes ayudar con KPIs, análisis de pipeline, y cuestiones de gestión además de temas legales.`,
      staff: `\n\nCONTEXTO: Estás hablando con ${name}, personal del despacho. Ayuda con cuestiones documentales y procedimentales.`,
    };

    const moduleContext = {
      lexdocs: '\n\nMÓDULO ACTIVO: LexDocs (portal documental del cliente). Enfócate en ayudar con documentación, qué falta, dónde conseguir cada documento, plazos.',
      lexcrm: '\n\nMÓDULO ACTIVO: LexCRM (gestión del despacho). Puedes ayudar con gestión de contactos, expedientes, pipeline de ventas.',
      lexconsulta: '\n\nMÓDULO ACTIVO: LexConsulta (búsqueda jurídica). Enfócate en jurisprudencia, legislación, análisis de sentencias.',
      general: '',
    };

    return base + (roleContext[userRole] || roleContext.client) + (moduleContext[module] || '');
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

      {/* ════ FLOATING BUTTON ════ */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
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
            zIndex: 1000,
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
      )}

      {/* ════ CHAT PANEL ════ */}
      {isOpen && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 400,
          height: 520,
          maxHeight: "calc(100vh - 48px)",
          borderRadius: 18,
          background: C.white,
          boxShadow: "0 12px 48px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.05)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          zIndex: 1001,
          animation: "carlotaSlideUp .3s ease both",
          fontFamily: font,
        }}
        className="carlota-panel"
        >

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
            <button
              onClick={() => setIsOpen(false)}
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
          </div>

          {/* ──── MESSAGES ──── */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 14px 8px",
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
                  animationDelay: `${i * 0.04}s`,
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
                <div style={{
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius: m.role === "user"
                    ? "14px 14px 4px 14px"
                    : "14px 14px 14px 4px",
                  background: m.role === "user"
                    ? `linear-gradient(135deg, ${C.primary}, ${C.violet})`
                    : C.white,
                  color: m.role === "user" ? "#fff" : C.text,
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  boxShadow: m.role === "user"
                    ? "none"
                    : "0 1px 4px rgba(0,0,0,.06)",
                }}>
                  {m.role === "user" ? m.content : renderContent(m.content)}
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
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta a Carlota..."
                rows={1}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontSize: 12.5,
                  fontFamily: font,
                  background: "transparent",
                  padding: "4px 0",
                  maxHeight: 72,
                  lineHeight: 1.5,
                  color: C.text,
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  flexShrink: 0,
                  background: input.trim()
                    ? `linear-gradient(135deg, ${C.primary}, ${C.violet})`
                    : C.border,
                  color: input.trim() ? "#fff" : C.textMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: input.trim() ? "pointer" : "default",
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
              Informacion orientativa. No constituye asesoramiento legal vinculante.
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
      `}</style>
    </>
  );
}
