import { useState } from "react";
import { Plus, Copy, Check, Trash2, Key, Shield, Eye, EyeOff, X, Info } from "lucide-react";
import { C } from "../../constants";

const font = "'Poppins', sans-serif";

const MOCK_KEYS = [
  { id: '1', name: 'Integracion WhatsApp', permissions: { contacts: 'read', cases: 'read' }, created_at: '2026-03-15', last_used_at: '2026-04-14', is_active: true },
  { id: '2', name: 'Webhook Stripe', permissions: { payments: 'write' }, created_at: '2026-02-01', last_used_at: '2026-04-10', is_active: true },
];

const PERM_OPTIONS = [
  { key: "contacts", label: "Contactos" },
  { key: "cases", label: "Expedientes" },
  { key: "documents", label: "Documentos" },
  { key: "payments", label: "Pagos" },
];

const PERM_LEVELS = ["read", "write"];

function permBadge(perm, level) {
  const isWrite = level === "write";
  return {
    padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
    background: isWrite ? C.orangeSoft : C.blueSoft,
    color: isWrite ? C.orange : C.blue,
    marginRight: 4, marginBottom: 4, display: "inline-block",
  };
}

export default function ApiKeys() {
  const [keys, setKeys] = useState(MOCK_KEYS);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPerms, setNewPerms] = useState({});
  const [generatedKey, setGeneratedKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [showCurl, setShowCurl] = useState(true);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id || "key");
    setTimeout(() => setCopiedId(null), 1800);
  };

  const createKey = () => {
    if (!newName.trim()) return;
    const fakeKey = `lxd_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 18)}`;
    const newEntry = {
      id: String(Date.now()),
      name: newName,
      permissions: { ...newPerms },
      created_at: new Date().toISOString().slice(0, 10),
      last_used_at: null,
      is_active: true,
    };
    setKeys((prev) => [...prev, newEntry]);
    setGeneratedKey(fakeKey);
    setNewName("");
    setNewPerms({});
  };

  const revokeKey = (id) => {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: false } : k)));
    showToast("API Key revocada");
  };

  const togglePerm = (key, level) => {
    setNewPerms((prev) => {
      const copy = { ...prev };
      if (copy[key] === level) {
        delete copy[key];
      } else {
        copy[key] = level;
      }
      return copy;
    });
  };

  const card = {
    background: C.white, borderRadius: 14,
    border: `1px solid ${C.border}`, padding: "20px 24px", marginBottom: 18,
  };

  const input = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1px solid ${C.border}`, fontSize: 13, fontFamily: font,
    color: C.text, outline: "none", background: C.white,
  };

  return (
    <div style={{ maxWidth: 800, animation: "fadeIn .35s ease" }}>
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

      {/* Info box */}
      <div style={{
        ...card,
        background: `linear-gradient(135deg, ${C.primary}06, ${C.violet}04)`,
        borderLeft: `3px solid ${C.primary}`,
        display: "flex", alignItems: "flex-start", gap: 12,
      }}>
        <Info size={18} color={C.primary} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>API Keys</p>
          <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
            Usa API keys para conectar LexDocs con herramientas externas (WhatsApp, Stripe, tu web, etc.)
          </p>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: C.textMuted }}>{keys.filter((k) => k.is_active).length} claves activas</p>
        <button
          onClick={() => { setShowModal(true); setGeneratedKey(null); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 10,
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 12, fontWeight: 600,
            boxShadow: `0 4px 16px ${C.primary}30`,
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
          display: "grid",
          gridTemplateColumns: "1.5fr 2fr 1fr 1fr 0.7fr 100px",
          padding: "12px 20px", background: "#f8f8fa", minWidth: 700,
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11, fontWeight: 600, color: C.textMuted,
          textTransform: "uppercase", letterSpacing: ".04em",
        }}>
          <span>Nombre</span>
          <span>Permisos</span>
          <span>Creada</span>
          <span>Ultimo uso</span>
          <span>Estado</span>
          <span style={{ textAlign: "right" }}>Acciones</span>
        </div>
        {keys.map((k) => (
          <div key={k.id} style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 2fr 1fr 1fr 0.7fr 100px",
            padding: "14px 20px", alignItems: "center", minWidth: 700,
            borderBottom: `1px solid ${C.border}`,
            opacity: k.is_active ? 1 : 0.45,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Key size={14} color={C.primary} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{k.name}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {Object.entries(k.permissions).map(([p, l]) => (
                <span key={p} style={permBadge(p, l)}>
                  {PERM_OPTIONS.find((o) => o.key === p)?.label || p}: {l === "write" ? "R/W" : "R"}
                </span>
              ))}
            </div>
            <span style={{ fontSize: 12, color: C.textMuted }}>{k.created_at}</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>{k.last_used_at || "-"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: k.is_active ? C.green : C.red }} />
              <span style={{ fontSize: 11, color: k.is_active ? C.green : C.red, fontWeight: 500 }}>
                {k.is_active ? "Activa" : "Revocada"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {k.is_active && (
                <button
                  onClick={() => revokeKey(k.id)}
                  style={{
                    padding: "6px 12px", borderRadius: 7,
                    background: C.redSoft, color: C.red,
                    fontSize: 11, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Trash2 size={11} /> Revocar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* cURL example */}
      <div style={card}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Ejemplo de uso</p>
        <div style={{
          position: "relative", background: C.sidebar, borderRadius: 10,
          padding: "16px 18px", fontFamily: "'Courier New', monospace",
          fontSize: 12, color: "#e0e0e0", lineHeight: 1.6, overflowX: "auto",
        }}>
          <button
            onClick={() => copyText('curl -H "X-API-Key: tu-clave" https://api.lexdocs.com/api/contacts', "curl")}
            style={{
              position: "absolute", top: 10, right: 10,
              padding: "4px 8px", borderRadius: 6,
              background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)",
              fontSize: 10, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {copiedId === "curl" ? <Check size={11} /> : <Copy size={11} />}
            {copiedId === "curl" ? "Copiado" : "Copiar"}
          </button>
          <span style={{ color: C.tealLight }}>curl</span>{" "}
          -H <span style={{ color: C.orange }}>"X-API-Key: tu-clave"</span>{" "}
          <span style={{ color: C.primaryLight }}>https://api.lexdocs.com/api/contacts</span>
        </div>
      </div>

      {/* Modal: Create API Key */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={() => { setShowModal(false); setGeneratedKey(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)" }} />
          <div style={{
            position: "relative", background: C.white, borderRadius: 16,
            padding: "28px 32px", maxWidth: 480, width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            animation: "fadeIn .25s ease",
          }}>
            <button
              onClick={() => { setShowModal(false); setGeneratedKey(null); }}
              style={{
                position: "absolute", top: 14, right: 14,
                background: "none", color: C.textMuted,
              }}
            >
              <X size={18} />
            </button>

            {!generatedKey ? (
              <>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>Nueva API Key</h3>
                <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
                  Configura el nombre y los permisos de la clave
                </p>

                <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                  Nombre
                </label>
                <input
                  style={{ ...input, marginBottom: 18 }}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Integracion WhatsApp"
                />

                <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 10 }}>
                  Permisos
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 22 }}>
                  {PERM_OPTIONS.map((opt) => (
                    <div key={opt.key} style={{
                      padding: "10px 14px", borderRadius: 10,
                      border: `1px solid ${C.border}`, background: "#fafafa",
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>{opt.label}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        {PERM_LEVELS.map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => togglePerm(opt.key, lvl)}
                            style={{
                              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: newPerms[opt.key] === lvl ? (lvl === "write" ? C.orangeSoft : C.blueSoft) : "#eee",
                              color: newPerms[opt.key] === lvl ? (lvl === "write" ? C.orange : C.blue) : C.textMuted,
                              border: newPerms[opt.key] === lvl ? `1px solid ${lvl === "write" ? C.orange : C.blue}30` : "1px solid transparent",
                            }}
                          >
                            {lvl === "read" ? "Lectura" : "Escritura"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={createKey}
                  disabled={!newName.trim()}
                  style={{
                    width: "100%", padding: "11px 0", borderRadius: 10,
                    background: newName.trim() ? `linear-gradient(135deg, ${C.primary}, ${C.violet})` : "#ddd",
                    color: newName.trim() ? "#fff" : "#aaa",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  Generar API Key
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: C.greenSoft, margin: "0 auto 12px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Shield size={22} color={C.green} />
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>API Key generada</h3>
                </div>

                <div style={{
                  background: C.sidebar, borderRadius: 10, padding: "14px 16px",
                  fontFamily: "'Courier New', monospace", fontSize: 13, color: C.tealLight,
                  wordBreak: "break-all", marginBottom: 12, position: "relative",
                }}>
                  {generatedKey}
                  <button
                    onClick={() => copyText(generatedKey, "genkey")}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      padding: "4px 8px", borderRadius: 6,
                      background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)",
                      fontSize: 10, display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    {copiedId === "genkey" ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>

                <div style={{
                  padding: "10px 14px", borderRadius: 8,
                  background: C.redSoft, borderLeft: `3px solid ${C.red}`,
                  marginBottom: 18,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.red }}>
                    No podras volver a ver esta clave
                  </p>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    Copiala ahora y guardala en un lugar seguro.
                  </p>
                </div>

                <button
                  onClick={() => { setShowModal(false); setGeneratedKey(null); }}
                  style={{
                    width: "100%", padding: "11px 0", borderRadius: 10,
                    background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
                    color: "#fff", fontSize: 13, fontWeight: 600,
                  }}
                >
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
