import { useState } from "react";
import { Zap, Copy, Check, ExternalLink, AlertCircle, ChevronRight, Code, Globe, MessageCircle, Megaphone, Webhook, Sparkles } from "lucide-react";
import { C, font } from "../../constants";
import { useTenant } from "../../lib/TenantContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://agzcaqgxlyrtbxtyxkwp.supabase.co";

export default function Integrations() {
  const tenant = useTenant();
  const [active, setActive] = useState(null); // qué integración está abierta
  const [copied, setCopied] = useState(null);
  const tenantSlug = tenant?.slug || "libredeuda";
  const verifyToken = "libreapp_meta_2026"; // mismo del backend

  const webhookUrl = `${SUPABASE_URL}/functions/v1/webhook-meta-leads?tenant_slug=${tenantSlug}`;
  const apiBase = `${SUPABASE_URL}/rest/v1`;

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  const integrations = [
    {
      id: "meta",
      name: "Meta Ads (Facebook + Instagram)",
      desc: "Recibe leads de tus formularios de Lead Ads automáticamente como contactos en el CRM.",
      icon: Megaphone,
      color: "#0866ff",
      bg: "rgba(8,102,255,0.08)",
      status: "Listo para conectar",
      featured: true,
    },
    {
      id: "webform",
      name: "Formulario web",
      desc: "Embebe un formulario en tu web para captar leads. Llegan automáticos al CRM.",
      icon: Globe,
      color: "#22c55e",
      bg: "rgba(34,197,94,0.08)",
      status: "Disponible",
    },
    {
      id: "zapier",
      name: "Zapier / Make",
      desc: "Conecta con +5.000 apps externas (Google Sheets, Slack, Gmail, Notion, etc.).",
      icon: Webhook,
      color: "#ff4a00",
      bg: "rgba(255,74,0,0.08)",
      status: "Disponible",
    },
    {
      id: "api",
      name: "API REST",
      desc: "Integración personalizada vía API REST y API Keys con tus propias herramientas.",
      icon: Code,
      color: C.primary,
      bg: `${C.primary}15`,
      status: "Disponible",
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      desc: "Envía notificaciones a tu equipo y recibe mensajes entrantes como leads (Meta Cloud API).",
      icon: MessageCircle,
      color: "#25d366",
      bg: "rgba(37,211,102,0.08)",
      status: "Listo para conectar",
    },
  ];

  return (
    <div>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, borderRadius: 16, padding: "24px 28px", marginBottom: 22, color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Zap size={20} />
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", opacity: 0.8 }}>Integraciones</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>Conecta LibreApp con tus herramientas</h2>
          <p style={{ fontSize: 13.5, marginTop: 6, opacity: 0.9, maxWidth: 600 }}>Recibe leads desde Meta Ads, formularios web o cualquier sistema externo. Todo entra como contacto en tu CRM, listo para gestionar.</p>
        </div>
      </div>

      {/* Lista de integraciones */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 22 }}>
        {integrations.map(int => {
          const Icon = int.icon;
          return (
            <div
              key={int.id}
              onClick={() => !int.disabled && setActive(active === int.id ? null : int.id)}
              className="hover-lift"
              style={{
                cursor: int.disabled ? "default" : "pointer",
                background: C.card,
                borderRadius: 14,
                padding: "18px 20px",
                border: int.featured ? `2px solid ${int.color}` : `1px solid ${C.border}`,
                opacity: int.disabled ? 0.5 : 1,
                position: "relative",
              }}
            >
              {int.featured && (
                <span style={{ position: "absolute", top: -1, right: 16, background: int.color, color: "#fff", padding: "3px 10px", borderRadius: "0 0 7px 7px", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Destacado</span>
              )}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: int.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={21} color={int.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>{int.name}</h3>
                  <p style={{ fontSize: 10.5, color: int.disabled ? C.textMuted : C.green, fontWeight: 600, marginTop: 3 }}>{int.status}</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{int.desc}</p>
              {!int.disabled && (
                <button style={{ marginTop: 14, padding: "8px 14px", borderRadius: 8, background: active === int.id ? C.bg : `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: active === int.id ? C.text : "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 5 }}>
                  {active === int.id ? "Cerrar" : "Configurar"} <ChevronRight size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Detalle de integración seleccionada */}
      {active === "meta" && (
        <MetaIntegration webhookUrl={webhookUrl} verifyToken={verifyToken} copy={copy} copied={copied} />
      )}
      {active === "webform" && (
        <WebFormIntegration apiBase={apiBase} copy={copy} copied={copied} />
      )}
      {active === "zapier" && (
        <ZapierIntegration apiBase={apiBase} copy={copy} copied={copied} />
      )}
      {active === "api" && (
        <ApiIntegration apiBase={apiBase} copy={copy} copied={copied} />
      )}
      {active === "whatsapp" && (
        <WhatsAppIntegration tenantSlug={tenantSlug} verifyToken={verifyToken} copy={copy} copied={copied} />
      )}
    </div>
  );
}

// ════════════ WHATSAPP BUSINESS ════════════
function WhatsAppIntegration({ tenantSlug, verifyToken, copy, copied }) {
  const incomingWebhookUrl = `${SUPABASE_URL}/functions/v1/webhook-whatsapp?tenant_slug=${tenantSlug}`;
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "24px 28px", border: `2px solid #25d36630` }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <MessageCircle size={18} color="#25d366" /> WhatsApp Business
      </h3>
      <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 22, lineHeight: 1.6 }}>
        Conecta WhatsApp Business Cloud API (Meta) para 2 cosas:<br/>
        1) <strong>Enviar notificaciones</strong> a abogados y procuradores cuando se les asigna un caso o llega un mensaje del cliente.<br/>
        2) <strong>Recibir mensajes entrantes</strong> de potenciales clientes y crearlos como leads automáticamente en el CRM.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
        <Badge color="#22c55e">✓ Notificaciones de salida activas</Badge>
        <Badge color="#f59e0b">⏳ Webhook entrante: pendiente de configurar en Meta</Badge>
      </div>

      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, marginTop: 8, color: C.text }}>📤 Notificaciones de salida (ya configurado)</h4>
      <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
        Cuando asignas un caso a un abogado o procurador, o cuando un cliente envía un mensaje desde la app, se envía un WhatsApp con plantilla aprobada. Asegúrate de que cada miembro del equipo tenga su número de WhatsApp en <a style={{ color: C.primary }} href="#">Configuración → Equipo</a>.
      </p>

      <div style={{ background: "rgba(37,211,102,0.06)", borderRadius: 10, padding: "14px 16px", marginBottom: 24, fontSize: 12, color: C.text, lineHeight: 1.6 }}>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>Plantillas necesarias en Meta:</p>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li><code style={inlineCode}>case_assignment</code> · variables: nombre profesional, cliente, expediente</li>
          <li><code style={inlineCode}>new_message</code> · variables: nombre profesional, cliente, preview mensaje</li>
        </ul>
        <p style={{ marginTop: 8, fontSize: 11.5, color: C.textMuted }}>Crea las plantillas en <a style={{ color: C.primary }} href="https://business.facebook.com/wa/manage/message-templates" target="_blank" rel="noreferrer">business.facebook.com/wa/manage/message-templates</a> con categoría <strong>Utility</strong>. Aprobación: 5-30 min.</p>
      </div>

      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: C.text }}>📥 Recibir mensajes entrantes como leads</h4>
      <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 18, lineHeight: 1.6 }}>
        Conecta el webhook para que cuando alguien escriba a tu número de WhatsApp Business, se cree automáticamente como contacto/lead en el CRM (con el mensaje guardado en notas).
      </p>

      <Step number={1} title="Crea credenciales en Meta for Developers">
        <p>Ve a <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" style={{ color: C.primary }}>developers.facebook.com/apps</a> → tu app → producto <strong>WhatsApp</strong>.</p>
        <p style={{ marginTop: 6 }}>Necesitas: <strong>Phone Number ID</strong>, <strong>Access Token</strong> permanente (vía System User) y <strong>App Secret</strong>.</p>
      </Step>

      <Step number={2} title="Configura el webhook entrante">
        <p>En Meta → tu app → <strong>Webhooks</strong> → producto <strong>WhatsApp Business Account</strong> → Suscribirse a <code style={inlineCode}>messages</code>.</p>
        <CopyField label="URL de devolución de llamada" value={incomingWebhookUrl} copy={copy} copied={copied} field="wabUrl" />
        <CopyField label="Token de verificación" value={verifyToken} copy={copy} copied={copied} field="wabToken" />
      </Step>

      <Step number={3} title="Prueba el flujo">
        <p>Envía un mensaje desde un móvil personal a tu número de WhatsApp Business. Aparecerá como contacto nuevo en <strong>Contactos</strong> con fuente <strong>WhatsApp</strong> y el mensaje en notas.</p>
      </Step>

      <Note color="#25d366">
        <strong>Datos del equipo:</strong> los teléfonos WhatsApp internos del equipo nunca se muestran a los clientes. Solo se usan para enviar notificaciones automáticas. El cliente solo se comunica vía la pestaña <strong>"Mi abogado"</strong> de la plataforma.
      </Note>
    </div>
  );
}

function Badge({ children, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 7, background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>{children}</span>
  );
}

// ════════════ META ADS ════════════
function MetaIntegration({ webhookUrl, verifyToken, copy, copied }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "24px 28px", border: `2px solid #0866ff30` }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Megaphone size={18} color="#0866ff" /> Conectar Meta Ads
      </h3>
      <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 22, lineHeight: 1.6 }}>
        Cuando alguien rellena un formulario de Lead Ads en Facebook o Instagram, el lead llega <strong>al instante</strong> a tu CRM como contacto con estado "Lead", asignación pendiente y fuente "Anuncios". Puedes activar notificaciones automáticas para que tu equipo lo atienda en minutos.
      </p>

      <Step number={1} title="Crea tu formulario de Lead Ads en Meta">
        <p>Si no lo tienes, crea uno en <a href="https://business.facebook.com/latest/instant_forms" target="_blank" rel="noreferrer" style={{ color: C.primary }}>business.facebook.com/instant_forms</a>. Asegúrate de incluir al menos los campos <strong>Email</strong> y <strong>Nombre</strong>.</p>
      </Step>

      <Step number={2} title="Configura el Webhook en tu app de Meta">
        <p>En tu app de Meta for Developers → <strong>WhatsApp/Webhooks</strong> → <strong>"Page" subscriptions</strong> → suscribirse a <code style={inlineCode}>leadgen</code>.</p>
        <p style={{ marginTop: 8 }}>Usa estos datos:</p>

        <CopyField label="URL de devolución de llamada" value={webhookUrl} copy={copy} copied={copied} field="url" />
        <CopyField label="Token de verificación" value={verifyToken} copy={copy} copied={copied} field="token" />
      </Step>

      <Step number={3} title="Suscribe tu página de Facebook">
        <p>En la misma pantalla → <strong>Editar suscripciones</strong> → marcar el campo <code style={inlineCode}>leadgen</code> → <strong>Verificar y guardar</strong>.</p>
        <p style={{ marginTop: 6, color: C.textMuted, fontSize: 11 }}>Meta hará un GET a tu URL para verificar el token. Si ves error → revisa que el token coincida exactamente.</p>
      </Step>

      <Step number={4} title="Asocia tu formulario a la página suscrita">
        <p>En tu Business Manager → <strong>Configuración del negocio → Integraciones → Lead Access</strong> → asegúrate de que la página tiene acceso de lectura de leads.</p>
      </Step>

      <Step number={5} title="¡Prueba!">
        <p>Lanza una campaña de Lead Ads o usa la <a href="https://developers.facebook.com/tools/lead-ads-testing" target="_blank" rel="noreferrer" style={{ color: C.primary }}>herramienta de prueba de Meta</a> para enviar un lead de test. Aparecerá en <strong>Contactos</strong> en menos de 5 segundos.</p>
      </Step>

      <Note color="#0866ff">
        <strong>Importante:</strong> el campo <strong>Lead Access</strong> de Meta requiere que tu página esté vinculada a tu Business Manager. Si tu página es personal, antes hay que migrarla a Business Manager.
      </Note>
    </div>
  );
}

// ════════════ FORMULARIO WEB ════════════
function WebFormIntegration({ apiBase, copy, copied }) {
  const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // demo
  const html = `<form id="lead-form">
  <input name="first_name" placeholder="Nombre" required />
  <input name="last_name" placeholder="Apellidos" />
  <input name="email" type="email" placeholder="Email" required />
  <input name="phone" placeholder="Teléfono" />
  <button type="submit">Enviar</button>
</form>
<script>
document.getElementById('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.org_id = '${orgId}';
  data.source = 'website';
  data.status = 'lead';
  await fetch('${apiBase}/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': '${ANON_KEY}',
      'Authorization': 'Bearer ${ANON_KEY}'
    },
    body: JSON.stringify(data)
  });
  alert('¡Gracias! Te contactaremos pronto.');
});
</script>`;

  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "24px 28px", border: `2px solid #22c55e30` }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Globe size={18} color="#22c55e" /> Formulario web
      </h3>
      <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 18, lineHeight: 1.6 }}>
        Copia este HTML en cualquier página de tu web. Cada lead que se envíe se crea como contacto en tu CRM.
      </p>
      <CopyBlock value={html} copy={copy} copied={copied} field="webform" lang="html" />
    </div>
  );
}

// ════════════ ZAPIER ════════════
function ZapierIntegration({ apiBase, copy, copied }) {
  const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  const example = `curl -X POST "${apiBase}/contacts" \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer ${ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "org_id": "TU_ORG_ID",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@email.com",
    "phone": "+34600000000",
    "source": "api",
    "status": "lead"
  }'`;

  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "24px 28px", border: `2px solid #ff4a0030` }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Webhook size={18} color="#ff4a00" /> Zapier / Make
      </h3>
      <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 18, lineHeight: 1.6 }}>
        Crea un Zap (o escenario en Make) con un trigger ("nuevo email", "fila en Google Sheets", etc.) y como acción usa <strong>"Webhooks → POST"</strong> con esta URL y body:
      </p>
      <CopyField label="URL del endpoint" value={`${apiBase}/contacts`} copy={copy} copied={copied} field="zapierUrl" />
      <p style={{ fontSize: 12, color: C.text, fontWeight: 600, margin: "16px 0 8px" }}>Ejemplo cURL:</p>
      <CopyBlock value={example} copy={copy} copied={copied} field="zapierCurl" lang="bash" />
    </div>
  );
}

// ════════════ API REST ════════════
function ApiIntegration({ apiBase, copy, copied }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "24px 28px", border: `2px solid ${C.primary}30` }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Code size={18} color={C.primary} /> API REST
      </h3>
      <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 18, lineHeight: 1.6 }}>
        Para integraciones técnicas avanzadas. Ve a <strong>Configuración → API Keys</strong> para ver la documentación completa de endpoints, autenticación y ejemplos cURL.
      </p>
      <CopyField label="URL base de la API" value={apiBase} copy={copy} copied={copied} field="apiBase" />
      <Note color={C.primary}>
        Acceso a todos los recursos: <code style={inlineCode}>/contacts</code>, <code style={inlineCode}>/cases</code>, <code style={inlineCode}>/payments</code>, <code style={inlineCode}>/documents</code>, <code style={inlineCode}>/messages</code>, <code style={inlineCode}>/activities</code>.
      </Note>
    </div>
  );
}

// ════════════ HELPERS ════════════
function Step({ number, title, children }) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700 }}>{number}</div>
      <div style={{ flex: 1, fontSize: 12.5, color: C.text, lineHeight: 1.65 }}>
        <h4 style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 5 }}>{title}</h4>
        {children}
      </div>
    </div>
  );
}

function CopyField({ label, value, copy, copied, field }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 10.5, fontWeight: 600, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "stretch", background: "#1E1E2E", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
        <code style={{ flex: 1, padding: "10px 14px", color: "#7DD4B8", fontSize: 11.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflowX: "auto", whiteSpace: "nowrap" }}>{value}</code>
        <button onClick={() => copy(value, field)} style={{ padding: "0 14px", background: copied === field ? C.green : "rgba(255,255,255,0.1)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: font, display: "flex", alignItems: "center", gap: 5 }}>
          {copied === field ? <><Check size={12} /> ¡Copiado!</> : <><Copy size={12} /> Copiar</>}
        </button>
      </div>
    </div>
  );
}

function CopyBlock({ value, copy, copied, field, lang }) {
  return (
    <div style={{ background: "#1E1E2E", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "rgba(255,255,255,0.04)" }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: ".05em" }}>{lang}</span>
        <button onClick={() => copy(value, field)} style={{ padding: "4px 10px", background: copied === field ? C.green : "rgba(255,255,255,0.1)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: font, borderRadius: 5, display: "flex", alignItems: "center", gap: 4 }}>
          {copied === field ? <><Check size={11} /> ¡Copiado!</> : <><Copy size={11} /> Copiar</>}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "14px 16px", color: "#E0E0F0", fontSize: 11.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflow: "auto", lineHeight: 1.55 }}>{value}</pre>
    </div>
  );
}

function Note({ children, color }) {
  return (
    <div style={{ marginTop: 16, padding: "12px 16px", background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 10, fontSize: 12, color: C.text, lineHeight: 1.55, display: "flex", gap: 8, alignItems: "flex-start" }}>
      <AlertCircle size={14} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  );
}

const inlineCode = {
  background: "#1E1E2E",
  color: "#7DD4B8",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 11.5,
  fontFamily: "ui-monospace, monospace",
};
