import { useState, useEffect } from "react";
import { ShieldCheck, ShieldAlert, Check, X, Loader, Mail } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import { estadoMfaEmail, enviarCodigoEmail, verificarCodigoEmail } from "../../lib/mfaEmail";

// Verificación en dos pasos por email (migration-019). Opt-in por usuario: para
// activarla o desactivarla hay que confirmar un código enviado a su email.
function EmailMfaCard({ card, btn, busy, setBusy, showToast }) {
  const [enabled, setEnabled] = useState(null);   // null = cargando
  const [pending, setPending] = useState(null);   // "enroll" | "disable" mientras se espera el código
  const [code, setCode] = useState("");

  useEffect(() => { estadoMfaEmail().then(st => setEnabled(st.enabled)); }, []);

  async function start(purpose) {
    setBusy(true);
    const r = await enviarCodigoEmail(purpose);
    setBusy(false);
    if (!r.ok && !r.yaEnviado) { showToast(r.error); return; }
    showToast(r.ok ? `Te hemos enviado un código a ${r.enviado_a}.` : r.error);
    setPending(purpose); setCode("");
  }

  async function confirm() {
    if (code.trim().length < 6) { showToast("Introduce el código de 6 dígitos del email."); return; }
    setBusy(true);
    const r = await verificarCodigoEmail(pending, code.trim());
    setBusy(false);
    if (!r.ok) { showToast(r.error); return; }
    const activada = pending === "enroll";
    setEnabled(activada); setPending(null); setCode("");
    showToast(activada ? "✅ Verificación por email activada." : "Verificación por email desactivada.");
  }

  if (enabled === null) return null;

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {enabled ? <ShieldCheck size={22} color={C.green} /> : <Mail size={22} color={C.orange} />}
        <span style={{ fontSize: 15, fontWeight: 600, color: C.dark }}>
          Código por email {enabled ? "activado" : "desactivado"}
        </span>
      </div>
      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
        {enabled
          ? "Cada vez que inicies sesión te enviaremos un código de 6 dígitos a tu email."
          : "Recomendado: al iniciar sesión, además de la contraseña, te pediremos un código que te llegará por email."}
      </p>
      {!pending && (enabled
        ? <button onClick={() => start("disable")} disabled={busy} style={btn(C.redSoft, C.red)}>Desactivar</button>
        : <button onClick={() => start("enroll")} disabled={busy} style={btn(`linear-gradient(135deg,${C.primary},${C.violet})`)}>Activar código por email</button>)}
      {pending && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" autoComplete="one-time-code"
            onKeyDown={e => e.key === "Enter" && confirm()}
            style={{ flex: 1, maxWidth: 160, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 16, letterSpacing: 4, fontFamily: font, background: C.bg }} />
          <button onClick={confirm} disabled={busy} style={btn(C.green)}><Check size={15} style={{ verticalAlign: "-2px" }} /> Confirmar</button>
          <button onClick={() => setPending(null)} disabled={busy} style={btn("transparent", C.textMuted)}><X size={15} style={{ verticalAlign: "-2px" }} /> Cancelar</button>
        </div>
      )}
    </div>
  );
}

// Verificación en dos pasos (MFA / TOTP). Opt-in: cada usuario la activa para su
// propia cuenta. Compatible con Google Authenticator, Authy, 1Password, etc.
export default function SecuritySettings() {
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState(null);      // factor TOTP verificado existente
  const [enroll, setEnroll] = useState(null);       // { id, qr, secret } durante el alta
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadFactors(); }, []);

  async function loadFactors() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error) setFactor((data?.totp || []).find(f => f.status === "verified") || null);
    setLoading(false);
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 4000); }

  async function startEnroll() {
    setBusy(true);
    // Limpia factores TOTP a medias (no verificados) para no acumular
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of (list?.all || []).filter(f => f.factor_type === "totp" && f.status === "unverified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `TOTP ${Date.now()}` });
    setBusy(false);
    if (error) { showToast(error.message || "No se pudo iniciar el alta de MFA"); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setCode("");
  }

  async function confirmEnroll() {
    if (code.trim().length < 6) { showToast("Introduce el código de 6 dígitos de tu app."); return; }
    setBusy(true);
    const ch = await supabase.auth.mfa.challenge({ factorId: enroll.id });
    if (ch.error) { setBusy(false); showToast(ch.error.message); return; }
    const v = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.data.id, code: code.trim() });
    setBusy(false);
    if (v.error) { showToast("Código incorrecto. Inténtalo de nuevo."); return; }
    setEnroll(null); setCode("");
    showToast("✅ Verificación en dos pasos activada.");
    loadFactors();
  }

  async function disableMfa() {
    if (!confirm("¿Desactivar la verificación en dos pasos de tu cuenta?")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) { showToast(error.message); return; }
    showToast("Verificación en dos pasos desactivada.");
    loadFactors();
  }

  const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, maxWidth: 560 };
  const btn = (bg, color = "#fff") => ({ padding: "10px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, background: bg, color, border: "none", cursor: "pointer", fontFamily: font, opacity: busy ? .6 : 1 });

  if (loading) return <div style={{ padding: 24, color: C.textMuted, fontFamily: font }}><Loader size={16} /> Cargando…</div>;

  return (
    <div style={{ fontFamily: font }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, margin: "0 0 4px" }}>Seguridad de la cuenta</h2>
      <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 20px" }}>Verificación en dos pasos (MFA) para proteger tu acceso.</p>

      {toast && <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, fontSize: 13, color: C.text }}>{toast}</div>}

      <EmailMfaCard card={card} btn={btn} busy={busy} setBusy={setBusy} showToast={showToast} />

      <h3 style={{ fontSize: 14, fontWeight: 600, color: C.dark, margin: "8px 0 10px" }}>App de autenticación (opcional)</h3>

      {/* Estado activado */}
      {factor && !enroll && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <ShieldCheck size={22} color={C.green} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.dark }}>Verificación en dos pasos activada</span>
          </div>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>Cada vez que inicies sesión te pediremos un código de tu app de autenticación.</p>
          <button onClick={disableMfa} disabled={busy} style={btn(C.redSoft, C.red)}>Desactivar</button>
        </div>
      )}

      {/* Estado desactivado — ofrecer alta */}
      {!factor && !enroll && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <ShieldAlert size={22} color={C.orange} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.dark }}>Verificación en dos pasos desactivada</span>
          </div>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
            Recomendado para despachos: añade una capa extra de seguridad. Necesitas una app como Google Authenticator, Authy o 1Password.
          </p>
          <button onClick={startEnroll} disabled={busy} style={btn(`linear-gradient(135deg,${C.primary},${C.violet})`)}>Activar MFA</button>
        </div>
      )}

      {/* Flujo de alta */}
      {enroll && (
        <div style={card}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.dark, display: "block", marginBottom: 14 }}>1) Escanea este QR con tu app de autenticación</span>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
            {typeof enroll.qr === "string" && enroll.qr.trim().startsWith("<svg")
              ? <div style={{ width: 168, height: 168, border: `1px solid ${C.border}`, borderRadius: 10, background: "#fff", padding: 6, display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: enroll.qr }} />
              : <img src={enroll.qr} alt="QR MFA" style={{ width: 168, height: 168, border: `1px solid ${C.border}`, borderRadius: 10, background: "#fff" }} />}
            <div style={{ fontSize: 12, color: C.textMuted }}>
              ¿No puedes escanear? Introduce esta clave a mano:
              <div style={{ marginTop: 6, padding: "8px 10px", background: C.bg, borderRadius: 8, fontFamily: "monospace", fontSize: 12, color: C.dark, wordBreak: "break-all", userSelect: "all" }}>{enroll.secret}</div>
            </div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.dark, display: "block", marginBottom: 8 }}>2) Introduce el código de 6 dígitos</span>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric"
              onKeyDown={e => e.key === "Enter" && confirmEnroll()}
              style={{ flex: 1, maxWidth: 160, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 16, letterSpacing: 4, fontFamily: font, background: C.bg }} />
            <button onClick={confirmEnroll} disabled={busy} style={btn(C.green)}><Check size={15} style={{ verticalAlign: "-2px" }} /> Confirmar</button>
            <button onClick={() => setEnroll(null)} disabled={busy} style={btn("transparent", C.textMuted)}><X size={15} style={{ verticalAlign: "-2px" }} /> Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
