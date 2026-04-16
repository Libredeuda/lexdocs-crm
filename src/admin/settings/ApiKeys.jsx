import { useState, useEffect, useCallback } from "react";
import {
  Plus, Copy, Check, Trash2, Key, Shield, X, Info,
  ChevronDown, ChevronRight, Code2, BookOpen, Webhook,
  Globe, Zap, FileCode, ExternalLink, Terminal, Send
} from "lucide-react";
import { C } from "../../constants";
import { supabase } from "../../lib/supabase";

const font = "'Poppins', sans-serif";
const mono = "'SF Mono', 'Fira Code', 'Courier New', monospace";
const BASE_URL = "https://agzcaqgxlyrtbxtyxkwp.supabase.co";
const ANON_PLACEHOLDER = "YOUR_ANON_KEY";

const PERM_OPTIONS = [
  { key: "contacts", label: "Contactos" },
  { key: "cases", label: "Expedientes" },
  { key: "documents", label: "Documentos" },
  { key: "payments", label: "Pagos" },
];
const PERM_LEVELS = ["read", "write"];

// ── Hashing ──
async function hashKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Tabs config ──
const TABS = [
  { id: "keys", label: "API Keys", icon: Key },
  { id: "docs", label: "Documentacion", icon: BookOpen },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
];

// ── Method badge colors ──
const METHOD_COLORS = {
  GET: { bg: "rgba(34,197,94,0.12)", color: "#22c55e", border: "rgba(34,197,94,0.25)" },
  POST: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "rgba(59,130,246,0.25)" },
  PUT: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.25)" },
  DELETE: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", border: "rgba(239,68,68,0.25)" },
};

// ── API Endpoints data ──
const API_ENDPOINTS = [
  {
    group: "Contactos",
    icon: "users",
    endpoints: [
      {
        method: "GET",
        path: "/rest/v1/contacts?select=*&status=eq.lead",
        description: "Obtener contactos filtrados por estado. Soporta todos los operadores de PostgREST (eq, neq, gt, lt, like, ilike, in, is).",
        curl: `curl -X GET '${BASE_URL}/rest/v1/contacts?select=*&status=eq.lead' \\
  -H 'apikey: ${ANON_PLACEHOLDER}' \\
  -H 'Authorization: Bearer ${ANON_PLACEHOLDER}'`,
        response: `[
  {
    "id": "a1b2c3d4-...",
    "first_name": "Maria",
    "last_name": "Garcia",
    "email": "maria@ejemplo.com",
    "phone": "+34600111222",
    "status": "lead",
    "source": "website",
    "org_id": "aaaa-bbbb-...",
    "created_at": "2026-04-10T09:30:00Z"
  }
]`,
      },
      {
        method: "POST",
        path: "/rest/v1/contacts",
        description: "Crear un nuevo contacto/lead. Campos requeridos: first_name, email, org_id. Campos opcionales: last_name, phone, status, source, notes.",
        curl: `curl -X POST '${BASE_URL}/rest/v1/contacts' \\
  -H 'apikey: ${ANON_PLACEHOLDER}' \\
  -H 'Authorization: Bearer ${ANON_PLACEHOLDER}' \\
  -H 'Content-Type: application/json' \\
  -H 'Prefer: return=representation' \\
  -d '{
    "first_name": "Juan",
    "last_name": "Perez",
    "email": "juan@email.com",
    "phone": "+34600000000",
    "status": "lead",
    "source": "api",
    "org_id": "YOUR_ORG_ID"
  }'`,
        response: `{
  "id": "e5f6g7h8-...",
  "first_name": "Juan",
  "last_name": "Perez",
  "email": "juan@email.com",
  "phone": "+34600000000",
  "status": "lead",
  "source": "api",
  "org_id": "aaaa-bbbb-...",
  "created_at": "2026-04-16T14:22:00Z"
}`,
      },
      {
        method: "PUT",
        path: "/rest/v1/contacts?id=eq.{uuid}",
        description: "Actualizar un contacto existente por su ID. Solo los campos enviados se actualizan (PATCH semantics con PUT).",
        curl: `curl -X PATCH '${BASE_URL}/rest/v1/contacts?id=eq.a1b2c3d4-...' \\
  -H 'apikey: ${ANON_PLACEHOLDER}' \\
  -H 'Authorization: Bearer ${ANON_PLACEHOLDER}' \\
  -H 'Content-Type: application/json' \\
  -H 'Prefer: return=representation' \\
  -d '{"status": "client", "phone": "+34611222333"}'`,
        response: `{
  "id": "a1b2c3d4-...",
  "first_name": "Maria",
  "last_name": "Garcia",
  "email": "maria@ejemplo.com",
  "phone": "+34611222333",
  "status": "client",
  "source": "website",
  "org_id": "aaaa-bbbb-...",
  "created_at": "2026-04-10T09:30:00Z"
}`,
      },
    ],
  },
  {
    group: "Casos / Expedientes",
    icon: "briefcase",
    endpoints: [
      {
        method: "GET",
        path: "/rest/v1/cases?select=*,contact:contacts(first_name,last_name)",
        description: "Listar expedientes con datos del contacto asociado. Usa la sintaxis de relaciones de PostgREST para hacer joins automaticos.",
        curl: `curl -X GET '${BASE_URL}/rest/v1/cases?select=*,contact:contacts(first_name,last_name)' \\
  -H 'apikey: ${ANON_PLACEHOLDER}' \\
  -H 'Authorization: Bearer ${ANON_PLACEHOLDER}'`,
        response: `[
  {
    "id": "c1d2e3f4-...",
    "case_number": "1412a-2025",
    "type": "lso",
    "status": "active",
    "contact_id": "a1b2c3d4-...",
    "contact": {
      "first_name": "Maria",
      "last_name": "Garcia"
    },
    "created_at": "2026-01-05T10:00:00Z"
  }
]`,
      },
      {
        method: "POST",
        path: "/rest/v1/cases",
        description: "Crear un nuevo expediente vinculado a un contacto existente. Campos: contact_id, type (lso/concurso), status, case_number, org_id.",
        curl: `curl -X POST '${BASE_URL}/rest/v1/cases' \\
  -H 'apikey: ${ANON_PLACEHOLDER}' \\
  -H 'Authorization: Bearer ${ANON_PLACEHOLDER}' \\
  -H 'Content-Type: application/json' \\
  -H 'Prefer: return=representation' \\
  -d '{
    "contact_id": "a1b2c3d4-...",
    "type": "lso",
    "status": "active",
    "org_id": "YOUR_ORG_ID"
  }'`,
        response: `{
  "id": "new-case-id-...",
  "contact_id": "a1b2c3d4-...",
  "type": "lso",
  "status": "active",
  "org_id": "aaaa-bbbb-...",
  "created_at": "2026-04-16T15:00:00Z"
}`,
      },
    ],
  },
  {
    group: "Pagos",
    icon: "credit-card",
    endpoints: [
      {
        method: "GET",
        path: "/rest/v1/payments?case_id=eq.{uuid}",
        description: "Obtener los pagos asociados a un expediente. Filtra por case_id para ver el historial de pagos de un caso concreto.",
        curl: `curl -X GET '${BASE_URL}/rest/v1/payments?case_id=eq.c1d2e3f4-...' \\
  -H 'apikey: ${ANON_PLACEHOLDER}' \\
  -H 'Authorization: Bearer ${ANON_PLACEHOLDER}'`,
        response: `[
  {
    "id": "p1-uuid-...",
    "case_id": "c1d2e3f4-...",
    "amount": 208.33,
    "currency": "EUR",
    "status": "paid",
    "concept": "Mensualidad 1/12",
    "paid_at": "2026-01-15T00:00:00Z"
  },
  {
    "id": "p2-uuid-...",
    "case_id": "c1d2e3f4-...",
    "amount": 208.33,
    "currency": "EUR",
    "status": "pending",
    "concept": "Mensualidad 2/12",
    "due_date": "2026-02-15"
  }
]`,
      },
    ],
  },
  {
    group: "Actividades",
    icon: "activity",
    endpoints: [
      {
        method: "GET",
        path: "/rest/v1/activities?entity_type=eq.contact&entity_id=eq.{uuid}",
        description: "Obtener el historial de actividades de una entidad (contacto, caso). Incluye llamadas, emails, notas y cambios de estado.",
        curl: `curl -X GET '${BASE_URL}/rest/v1/activities?entity_type=eq.contact&entity_id=eq.a1b2c3d4-...&order=created_at.desc' \\
  -H 'apikey: ${ANON_PLACEHOLDER}' \\
  -H 'Authorization: Bearer ${ANON_PLACEHOLDER}'`,
        response: `[
  {
    "id": "act-1-...",
    "entity_type": "contact",
    "entity_id": "a1b2c3d4-...",
    "type": "note",
    "description": "Llamada de seguimiento realizada",
    "user_id": "admin-uuid-...",
    "created_at": "2026-04-15T16:30:00Z"
  }
]`,
      },
    ],
  },
];

// ── HTML form code ──
const HTML_FORM_CODE = `<form id="lead-form">
  <input name="first_name" placeholder="Nombre" required>
  <input name="last_name" placeholder="Apellidos">
  <input name="email" type="email" placeholder="Email" required>
  <input name="phone" placeholder="Telefono">
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.org_id = 'YOUR_ORG_ID';
  data.source = 'website';
  data.status = 'lead';

  await fetch('${BASE_URL}/rest/v1/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': '${ANON_PLACEHOLDER}',
      'Authorization': 'Bearer ${ANON_PLACEHOLDER}'
    },
    body: JSON.stringify(data)
  });

  alert('Gracias! Nos pondremos en contacto contigo.');
});
<\/script>`;

const ZAPIER_CURL = `curl -X POST '${BASE_URL}/rest/v1/contacts' \\
  -H 'apikey: ${ANON_PLACEHOLDER}' \\
  -H 'Authorization: Bearer ${ANON_PLACEHOLDER}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "first_name": "Juan",
    "last_name": "Perez",
    "email": "juan@email.com",
    "phone": "+34600000000",
    "source": "api",
    "status": "lead",
    "org_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
  }'`;


// ════════════════════════════════════════════
// SHARED STYLES
// ════════════════════════════════════════════
const s = {
  card: {
    background: C.white, borderRadius: 14,
    border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 18,
  },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font,
    color: C.text, outline: "none", background: C.white, boxSizing: "border-box",
  },
  codeBlock: {
    background: "#1E1E2E", borderRadius: 12, padding: "18px 20px",
    fontFamily: mono, fontSize: 12.5, color: "#e0e0e0", lineHeight: 1.7,
    overflowX: "auto", position: "relative", whiteSpace: "pre-wrap",
    wordBreak: "break-all", border: "1px solid #2d2d44",
  },
  copyBtn: {
    position: "absolute", top: 10, right: 10,
    padding: "5px 10px", borderRadius: 7,
    background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.55)",
    fontSize: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
    cursor: "pointer", border: "1px solid rgba(255,255,255,.08)",
    transition: "all .15s ease",
  },
  sectionTitle: {
    fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6,
    display: "flex", alignItems: "center", gap: 10,
  },
  sectionSub: {
    fontSize: 13, color: C.textMuted, marginBottom: 24, lineHeight: 1.5,
  },
};


// ════════════════════════════════════════════
// COPY BUTTON COMPONENT
// ════════════════════════════════════════════
function CopyButton({ text, id, copiedId, onCopy }) {
  return (
    <button
      onClick={() => onCopy(text, id)}
      style={s.copyBtn}
    >
      {copiedId === id ? <Check size={11} /> : <Copy size={11} />}
      {copiedId === id ? "Copiado!" : "Copiar"}
    </button>
  );
}


// ════════════════════════════════════════════
// METHOD BADGE
// ════════════════════════════════════════════
function MethodBadge({ method }) {
  const c = METHOD_COLORS[method] || METHOD_COLORS.GET;
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 6,
      fontSize: 11, fontWeight: 700, fontFamily: mono, letterSpacing: ".03em",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      minWidth: 48, textAlign: "center",
    }}>
      {method}
    </span>
  );
}


// ════════════════════════════════════════════
// ENDPOINT ACCORDION CARD
// ════════════════════════════════════════════
function EndpointCard({ ep, copiedId, onCopy }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: C.white, borderRadius: 12,
      border: `1px solid ${open ? C.primary + "40" : C.border}`,
      marginBottom: 10, overflow: "hidden",
      transition: "border-color .2s ease",
      boxShadow: open ? `0 2px 12px ${C.primary}10` : "none",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px", background: open ? `${C.primary}04` : "transparent",
          cursor: "pointer", border: "none", textAlign: "left",
        }}
      >
        <MethodBadge method={ep.method} />
        <span style={{
          flex: 1, fontSize: 13, fontFamily: mono, color: C.text, fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {ep.path}
        </span>
        {open ? <ChevronDown size={16} color={C.textMuted} /> : <ChevronRight size={16} color={C.textMuted} />}
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "14px 0 16px", lineHeight: 1.6 }}>
            {ep.description}
          </p>

          {/* cURL */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
            }}>
              <Terminal size={13} color={C.primary} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                cURL
              </span>
            </div>
            <div style={s.codeBlock}>
              <CopyButton text={ep.curl} id={`curl-${ep.path}`} copiedId={copiedId} onCopy={onCopy} />
              {ep.curl}
            </div>
          </div>

          {/* Response */}
          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
            }}>
              <Code2 size={13} color={C.green} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
                Respuesta
              </span>
            </div>
            <div style={{ ...s.codeBlock, borderLeft: `3px solid ${C.green}` }}>
              <CopyButton text={ep.response} id={`res-${ep.path}`} copiedId={copiedId} onCopy={onCopy} />
              {ep.response}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ════════════════════════════════════════════
// TAB 1: API KEYS
// ════════════════════════════════════════════
function ApiKeysTab({ copiedId, onCopy, showToast }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPerms, setNewPerms] = useState({});
  const [generatedKey, setGeneratedKey] = useState(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
    if (!error && data) setKeys(data);
    else setKeys([]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async () => {
    if (!newName.trim()) return;
    const rawKey = `lxd_${crypto.randomUUID()}-${crypto.randomUUID()}`;
    const keyHash = await hashKey(rawKey);
    const prefix = rawKey.slice(0, 12) + "...";

    const { data: userData } = await supabase.auth.getUser();
    const orgId = userData?.user?.user_metadata?.org_id || null;

    const { error } = await supabase.from("api_keys").insert({
      name: newName,
      key_hash: keyHash,
      key_prefix: prefix,
      permissions: { ...newPerms },
      is_active: true,
      org_id: orgId,
    });

    if (error) {
      showToast("Error al crear la clave");
      return;
    }

    setGeneratedKey(rawKey);
    setNewName("");
    setNewPerms({});
    fetchKeys();
  };

  const revokeKey = async (id) => {
    const { error } = await supabase.from("api_keys").update({ is_active: false }).eq("id", id);
    if (!error) {
      showToast("API Key revocada");
      fetchKeys();
    }
  };

  const togglePerm = (key, level) => {
    setNewPerms(prev => {
      const copy = { ...prev };
      if (copy[key] === level) delete copy[key];
      else copy[key] = level;
      return copy;
    });
  };

  return (
    <div>
      {/* Info box */}
      <div style={{
        ...s.card,
        background: `linear-gradient(135deg, ${C.primary}06, ${C.violet}04)`,
        borderLeft: `3px solid ${C.primary}`,
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <Info size={18} color={C.primary} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>Gestion de API Keys</p>
          <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
            Crea claves para conectar LexDocs con herramientas externas (WhatsApp, Stripe, tu web, Zapier, Make, etc.).
            Cada clave se muestra una sola vez al crearla. Guarda la clave en un lugar seguro.
          </p>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: C.textMuted }}>
          {loading ? "Cargando..." : `${keys.filter(k => k.is_active).length} claves activas`}
        </p>
        <button
          onClick={() => { setShowModal(true); setGeneratedKey(null); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 10,
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: "none", boxShadow: `0 4px 16px ${C.primary}30`,
          }}
        >
          <Plus size={15} /> Nueva API Key
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: C.white, borderRadius: 14,
        border: `1px solid ${C.border}`, overflow: "hidden", overflowX: "auto", marginBottom: 20,
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.5fr 2fr 1fr 1fr 0.7fr 100px",
          padding: "12px 20px", background: "#f8f8fa", minWidth: 700,
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11, fontWeight: 600, color: C.textMuted,
          textTransform: "uppercase", letterSpacing: ".04em",
        }}>
          <span>Nombre</span><span>Permisos</span><span>Creada</span>
          <span>Prefijo</span><span>Estado</span><span style={{ textAlign: "right" }}>Acciones</span>
        </div>
        {!loading && keys.length === 0 && (
          <div style={{ padding: "32px 20px", textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            No hay API keys creadas. Crea una para empezar a integrar.
          </div>
        )}
        {keys.map(k => (
          <div key={k.id} style={{
            display: "grid", gridTemplateColumns: "1.5fr 2fr 1fr 1fr 0.7fr 100px",
            padding: "14px 20px", alignItems: "center", minWidth: 700,
            borderBottom: `1px solid ${C.border}`, opacity: k.is_active ? 1 : 0.45,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Key size={14} color={C.primary} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{k.name}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {k.permissions && Object.entries(k.permissions).map(([p, l]) => (
                <span key={p} style={{
                  padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                  background: l === "write" ? C.orangeSoft : C.blueSoft,
                  color: l === "write" ? C.orange : C.blue,
                  display: "inline-block",
                }}>
                  {PERM_OPTIONS.find(o => o.key === p)?.label || p}: {l === "write" ? "R/W" : "R"}
                </span>
              ))}
            </div>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              {k.created_at ? new Date(k.created_at).toLocaleDateString("es-ES") : "-"}
            </span>
            <span style={{ fontSize: 11, fontFamily: mono, color: C.textMuted }}>{k.key_prefix || "---"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: k.is_active ? C.green : C.red }} />
              <span style={{ fontSize: 11, color: k.is_active ? C.green : C.red, fontWeight: 500 }}>
                {k.is_active ? "Activa" : "Revocada"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {k.is_active && (
                <button onClick={() => revokeKey(k.id)} style={{
                  padding: "6px 12px", borderRadius: 7, background: C.redSoft, color: C.red,
                  fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
                  border: "none", cursor: "pointer",
                }}>
                  <Trash2 size={11} /> Revocar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={() => { setShowModal(false); setGeneratedKey(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)" }} />
          <div style={{
            position: "relative", background: C.white, borderRadius: 16,
            padding: "28px 32px", maxWidth: 480, width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,.2)", animation: "fadeIn .25s ease",
          }}>
            <button onClick={() => { setShowModal(false); setGeneratedKey(null); }} style={{
              position: "absolute", top: 14, right: 14, background: "none", color: C.textMuted, border: "none", cursor: "pointer",
            }}>
              <X size={18} />
            </button>

            {!generatedKey ? (
              <>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Nueva API Key</h3>
                <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
                  Configura el nombre y los permisos de la clave
                </p>

                <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Nombre</label>
                <input style={{ ...s.input, marginBottom: 18 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Integracion WhatsApp" />

                <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 10 }}>Permisos</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 22 }}>
                  {PERM_OPTIONS.map(opt => (
                    <div key={opt.key} style={{
                      padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fafafa",
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>{opt.label}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        {PERM_LEVELS.map(lvl => (
                          <button key={lvl} onClick={() => togglePerm(opt.key, lvl)} style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                            background: newPerms[opt.key] === lvl ? (lvl === "write" ? C.orangeSoft : C.blueSoft) : "#eee",
                            color: newPerms[opt.key] === lvl ? (lvl === "write" ? C.orange : C.blue) : C.textMuted,
                            border: newPerms[opt.key] === lvl ? `1px solid ${lvl === "write" ? C.orange : C.blue}30` : "1px solid transparent",
                          }}>
                            {lvl === "read" ? "Lectura" : "Escritura"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={createKey} disabled={!newName.trim()} style={{
                  width: "100%", padding: "11px 0", borderRadius: 10, border: "none", cursor: "pointer",
                  background: newName.trim() ? `linear-gradient(135deg, ${C.primary}, ${C.violet})` : "#ddd",
                  color: newName.trim() ? "#fff" : "#aaa", fontSize: 13, fontWeight: 600,
                }}>
                  Generar API Key
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%", background: C.greenSoft,
                    margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Shield size={22} color={C.green} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>API Key generada</h3>
                </div>

                <div style={{
                  background: "#1E1E2E", borderRadius: 10, padding: "14px 16px",
                  fontFamily: mono, fontSize: 13, color: "#7DD4B8",
                  wordBreak: "break-all", marginBottom: 12, position: "relative",
                }}>
                  {generatedKey}
                  <button onClick={() => onCopy(generatedKey, "genkey")} style={s.copyBtn}>
                    {copiedId === "genkey" ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>

                <div style={{
                  padding: "10px 14px", borderRadius: 8, background: C.redSoft,
                  borderLeft: `3px solid ${C.red}`, marginBottom: 18,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.red }}>No podras volver a ver esta clave</p>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Copiala ahora y guardala en un lugar seguro.</p>
                </div>

                <button onClick={() => { setShowModal(false); setGeneratedKey(null); }} style={{
                  width: "100%", padding: "11px 0", borderRadius: 10, border: "none", cursor: "pointer",
                  background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                  color: "#fff", fontSize: 13, fontWeight: 600,
                }}>
                  Entendido
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ════════════════════════════════════════════
// TAB 2: API DOCS
// ════════════════════════════════════════════
function ApiDocsTab({ copiedId, onCopy }) {
  return (
    <div>
      {/* Header */}
      <div style={{
        ...s.card,
        background: `linear-gradient(135deg, ${C.sidebar}, #252540)`,
        borderColor: "#2d2d44", padding: "28px 28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
          }}>
            <Code2 size={18} color="#fff" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>API Reference</h2>
          <span style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
            background: "rgba(91,191,160,0.15)", color: "#7DD4B8", marginLeft: 4,
          }}>
            REST v1
          </span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.6, margin: 0 }}>
          LexDocs expone una API REST completa a traves de Supabase (PostgREST). Todas las tablas
          son accesibles con autenticacion por API key. Base URL:
        </p>
        <div style={{
          marginTop: 12, background: "rgba(0,0,0,.3)", borderRadius: 8, padding: "10px 14px",
          fontFamily: mono, fontSize: 13, color: "#7DD4B8", display: "flex",
          alignItems: "center", justifyContent: "space-between",
        }}>
          <span>{BASE_URL}</span>
          <button onClick={() => onCopy(BASE_URL, "base-url")} style={{
            ...s.copyBtn, position: "static",
          }}>
            {copiedId === "base-url" ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>
      </div>

      {/* Auth info */}
      <div style={{ ...s.card, borderLeft: `3px solid ${C.orange}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Shield size={15} color={C.orange} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Autenticacion</span>
        </div>
        <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
          Todas las peticiones requieren el header <code style={{ fontFamily: mono, background: "#f0f0f5", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>apikey</code> con
          tu clave de Supabase. Para operaciones autenticadas, incluye tambien el header <code style={{ fontFamily: mono, background: "#f0f0f5", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>Authorization: Bearer TU_CLAVE</code>.
        </p>
        <div style={s.codeBlock}>
          <CopyButton text={`-H 'apikey: ${ANON_PLACEHOLDER}'\n-H 'Authorization: Bearer ${ANON_PLACEHOLDER}'`} id="auth-headers" copiedId={copiedId} onCopy={onCopy} />
          <span style={{ color: "#f59e0b" }}>Headers requeridos:</span>{"\n"}
          {`apikey: ${ANON_PLACEHOLDER}\nAuthorization: Bearer ${ANON_PLACEHOLDER}`}
        </div>
      </div>

      {/* Endpoint groups */}
      {API_ENDPOINTS.map(group => (
        <div key={group.group} style={{ marginBottom: 28 }}>
          <h3 style={{
            fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 12,
            display: "flex", alignItems: "center", gap: 8,
            paddingBottom: 8, borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: C.blueSoft,
            }}>
              <Globe size={14} color={C.blue} />
            </div>
            {group.group}
            <span style={{
              fontSize: 10, fontWeight: 500, color: C.textMuted, marginLeft: "auto",
            }}>
              {group.endpoints.length} endpoint{group.endpoints.length > 1 ? "s" : ""}
            </span>
          </h3>
          {group.endpoints.map((ep, i) => (
            <EndpointCard key={i} ep={ep} copiedId={copiedId} onCopy={onCopy} />
          ))}
        </div>
      ))}
    </div>
  );
}


// ════════════════════════════════════════════
// TAB 3: WEBHOOKS
// ════════════════════════════════════════════
function WebhooksTab({ copiedId, onCopy }) {
  return (
    <div>
      <p style={s.sectionTitle}>
        <Webhook size={20} color={C.primary} />
        Webhooks y Formularios Web
      </p>
      <p style={s.sectionSub}>
        Conecta tu web, Zapier, Make o Meta Ads para enviar leads directamente a LexDocs.
        Cada lead se crea como contacto con estado "lead" en tu pipeline.
      </p>

      {/* ── Section 1: HTML Form ── */}
      <div style={{ ...s.card, padding: "24px 28px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: C.blueSoft,
          }}>
            <FileCode size={16} color={C.blue} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>1. Formulario HTML para tu web</h3>
            <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>Copia y pega este formulario en cualquier pagina web</p>
          </div>
        </div>

        <div style={{
          margin: "16px 0", padding: "12px 16px", borderRadius: 8,
          background: C.greenSoft, borderLeft: `3px solid ${C.green}`,
        }}>
          <p style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 2 }}>Como funciona</p>
          <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
            Cuando un usuario rellena el formulario en tu web, se crea automaticamente un contacto
            en LexDocs con estado "lead" y source "website". Aparecera en tu pipeline al instante.
          </p>
        </div>

        <div style={s.codeBlock}>
          <CopyButton text={HTML_FORM_CODE} id="html-form" copiedId={copiedId} onCopy={onCopy} />
          {HTML_FORM_CODE}
        </div>

        <div style={{
          marginTop: 12, padding: "10px 14px", borderRadius: 8,
          background: C.orangeSoft, borderLeft: `3px solid ${C.orange}`,
        }}>
          <p style={{ fontSize: 11, color: C.orange, fontWeight: 600 }}>
            Recuerda reemplazar YOUR_ORG_ID y YOUR_ANON_KEY con tus valores reales.
          </p>
        </div>
      </div>

      {/* ── Section 2: Zapier/Make ── */}
      <div style={{ ...s.card, padding: "24px 28px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: C.orangeSoft,
          }}>
            <Zap size={16} color={C.orange} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>2. Zapier / Make (Integromat)</h3>
            <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>Usa un webhook HTTP para enviar leads desde cualquier automatizacion</p>
          </div>
        </div>

        <div style={{ margin: "16px 0" }}>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
            En Zapier o Make, configura una accion "Webhooks by Zapier" o "HTTP Request" con estos parametros:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Metodo", value: "POST" },
              { label: "URL", value: `${BASE_URL}/rest/v1/contacts` },
              { label: "Header: apikey", value: ANON_PLACEHOLDER },
              { label: "Header: Content-Type", value: "application/json" },
            ].map((item, i) => (
              <div key={i} style={{
                padding: "10px 14px", borderRadius: 8, background: "#f8f8fa",
                border: `1px solid ${C.border}`,
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>
                  {item.label}
                </p>
                <p style={{ fontSize: 12, fontFamily: mono, color: C.text, wordBreak: "break-all" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
        }}>
          <Terminal size={13} color={C.primary} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: ".05em" }}>
            cURL de ejemplo
          </span>
        </div>
        <div style={s.codeBlock}>
          <CopyButton text={ZAPIER_CURL} id="zapier-curl" copiedId={copiedId} onCopy={onCopy} />
          {ZAPIER_CURL}
        </div>
      </div>

      {/* ── Section 3: Meta Ads ── */}
      <div style={{ ...s.card, padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: `rgba(59,130,246,0.08)`,
          }}>
            <Send size={16} color={C.blue} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>3. Meta Ads Lead Forms</h3>
            <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>Conecta tus formularios de Facebook/Instagram Ads</p>
          </div>
        </div>

        <div style={{ margin: "16px 0" }}>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 16 }}>
            Conecta tus formularios de captacion de Meta Ads para que cada lead entre automaticamente en LexDocs:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                step: "1",
                title: "Crear un Zap en Zapier",
                desc: 'Usa el trigger "Facebook Lead Ads - New Lead" y selecciona tu pagina y formulario.',
              },
              {
                step: "2",
                title: "Configurar la accion HTTP",
                desc: `Anade la accion "Webhooks by Zapier - POST". URL: ${BASE_URL}/rest/v1/contacts. Anade los headers apikey y Authorization.`,
              },
              {
                step: "3",
                title: "Mapear campos",
                desc: 'Mapea los campos del formulario de Meta: first_name, last_name, email, phone. Anade los campos fijos: org_id, source="meta_ads", status="lead".',
              },
              {
                step: "4",
                title: "Activar y probar",
                desc: "Prueba el Zap con un lead de prueba desde Meta. El contacto aparecera en tu pipeline de LexDocs en segundos.",
              },
            ].map(item => (
              <div key={item.step} style={{
                display: "flex", gap: 14, padding: "14px 18px",
                background: "#f8f8fa", borderRadius: 10, border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 12, fontWeight: 700,
                }}>
                  {item.step}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>{item.title}</p>
                  <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 16, padding: "12px 16px", borderRadius: 8,
          background: `${C.primary}06`, borderLeft: `3px solid ${C.primary}`,
        }}>
          <p style={{ fontSize: 12, color: C.primary, fontWeight: 600, marginBottom: 2 }}>Alternativa: Make (Integromat)</p>
          <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
            El proceso es identico en Make. Usa el modulo "Facebook Lead Ads" como trigger
            y un modulo "HTTP - Make a request" como accion con los mismos parametros.
          </p>
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════
export default function ApiKeys() {
  const [activeTab, setActiveTab] = useState("keys");
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id || "key");
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div style={{ maxWidth: 860, animation: "fadeIn .35s ease" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, background: C.sidebar,
          color: "#fff", padding: "12px 22px", borderRadius: 10, fontSize: 13,
          fontWeight: 500, zIndex: 9999, display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,.18)", animation: "fadeIn .25s ease",
        }}>
          <Check size={15} /> {toast}
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          API y Integraciones
        </h1>
        <p style={{ fontSize: 13, color: C.textMuted }}>
          Gestiona tus API keys, explora los endpoints disponibles y conecta herramientas externas.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 28,
        background: "#f4f4f8", borderRadius: 12, padding: 4,
        border: `1px solid ${C.border}`,
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "10px 16px", borderRadius: 9, cursor: "pointer",
                background: active ? C.white : "transparent",
                color: active ? C.primary : C.textMuted,
                fontSize: 13, fontWeight: active ? 700 : 500,
                border: active ? `1px solid ${C.border}` : "1px solid transparent",
                boxShadow: active ? "0 2px 8px rgba(0,0,0,.06)" : "none",
                transition: "all .2s ease",
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "keys" && <ApiKeysTab copiedId={copiedId} onCopy={copyText} showToast={showToast} />}
      {activeTab === "docs" && <ApiDocsTab copiedId={copiedId} onCopy={copyText} />}
      {activeTab === "webhooks" && <WebhooksTab copiedId={copiedId} onCopy={copyText} />}
    </div>
  );
}
