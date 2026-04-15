import { useState } from "react";
import { Copy, Upload, Check, Building2, CreditCard } from "lucide-react";
import { C } from "../../constants";

const font = "'Poppins', sans-serif";

export default function OrgSettings() {
  const [orgName, setOrgName] = useState("LibreDeuda Abogados");
  const [slug] = useState("libredeuda");
  const [primaryColor, setPrimaryColor] = useState("#5B6BF0");
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const copySlug = () => {
    navigator.clipboard.writeText(`https://app.lexdocs.com/${slug}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const card = {
    background: C.white,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    padding: "24px 28px",
    marginBottom: 20,
  };

  const label = {
    fontSize: 12,
    fontWeight: 600,
    color: C.text,
    marginBottom: 6,
    display: "block",
  };

  const input = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    fontFamily: font,
    color: C.text,
    outline: "none",
    background: C.white,
    transition: ".2s",
  };

  return (
    <div style={{ maxWidth: 680, animation: "fadeIn .35s ease" }}>
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

      {/* Card: Datos del despacho */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.primary}18, ${C.violet}12)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Building2 size={18} color={C.primary} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Datos del despacho</h3>
            <p style={{ fontSize: 11, color: C.textMuted }}>Informacion general de tu organizacion</p>
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Nombre del despacho</label>
          <input
            style={input}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Nombre de tu despacho"
          />
        </div>

        {/* Slug */}
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Slug (URL)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center",
              background: "#f8f8fa", borderRadius: 10,
              border: `1px solid ${C.border}`, overflow: "hidden",
            }}>
              <span style={{ padding: "10px 0 10px 14px", fontSize: 12, color: C.textMuted, whiteSpace: "nowrap" }}>
                app.lexdocs.com/
              </span>
              <input
                style={{ ...input, border: "none", background: "transparent", padding: "10px 14px 10px 0" }}
                value={slug}
                readOnly
              />
            </div>
            <button
              onClick={copySlug}
              style={{
                padding: "10px 14px", borderRadius: 10,
                background: copied ? C.greenSoft : `${C.primary}10`,
                color: copied ? C.green : C.primary,
                fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 5,
                transition: ".2s",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Logo */}
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Logo del despacho</label>
          <div style={{
            width: "100%", height: 120, borderRadius: 12,
            border: `2px dashed ${C.border}`, background: "#fafafa",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 8, cursor: "pointer",
            transition: ".2s",
          }}>
            <Upload size={24} color={C.textMuted} />
            <span style={{ fontSize: 12, color: C.textMuted }}>Haz clic o arrastra tu logo aqui</span>
            <span style={{ fontSize: 10, color: C.textLight }}>PNG, JPG o SVG. Max 2MB</span>
          </div>
        </div>

        {/* Primary color */}
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Color primario</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              style={{
                width: 42, height: 42, borderRadius: 10, border: `2px solid ${C.border}`,
                padding: 2, cursor: "pointer", background: C.white,
              }}
            />
            <input
              style={{ ...input, maxWidth: 160 }}
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#5B6BF0"
            />
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: primaryColor,
              border: `1px solid ${C.border}`,
            }} />
          </div>
        </div>

        {/* Plan */}
        <div>
          <label style={label}>Plan actual</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: `linear-gradient(135deg, ${C.violet}18, ${C.primary}12)`,
              color: C.violet,
            }}>
              Pro
            </span>
            <span style={{ fontSize: 11, color: C.textMuted }}>Hasta 10 usuarios, expedientes ilimitados</span>
          </div>
        </div>
      </div>

      {/* Card: Facturacion */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${C.teal}12`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CreditCard size={18} color={C.teal} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Facturacion</h3>
            <p style={{ fontSize: 11, color: C.textMuted }}>Gestiona tu suscripcion y metodo de pago</p>
          </div>
        </div>
        <div style={{
          padding: "18px 20px", borderRadius: 10,
          background: "#f8f8fa", border: `1px solid ${C.border}`,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
            Conectar con Stripe para gestionar tu plan
          </p>
          <button style={{
            padding: "9px 22px", borderRadius: 8,
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 12, fontWeight: 600,
          }}>
            Conectar Stripe
          </button>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => showToast("Configuracion guardada")}
          style={{
            padding: "11px 32px", borderRadius: 10,
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 13, fontWeight: 600,
            boxShadow: `0 4px 16px ${C.primary}30`,
            transition: ".2s",
          }}
        >
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
