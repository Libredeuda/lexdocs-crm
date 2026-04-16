import { useState } from "react";
import { AlertCircle, LogOut } from "lucide-react";
import { LOGO, font, C } from "../constants";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [ld, setLd] = useState(false);

  async function go() {
    setLd(true);
    setErr("");
    try {
      await onLogin(email, pass);
    } catch (e) {
      setErr(e.message || "Credenciales incorrectas");
    } finally {
      setLd(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: font, background: C.sidebar, position: "relative", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box;margin:0;padding:0}input:focus{outline:none;border-color:${C.primary}!important;box-shadow:0 0 0 3px rgba(91,107,240,.2)}button{cursor:pointer;border:none;font-family:${font}}@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@media(max-width:768px){.login-hero{display:none!important}.login-form{flex:1!important;padding:20px!important}}`}</style>
      <div style={{ position: "absolute", top: -80, right: -60, width: 300, height: 300, borderRadius: "50%", background: C.teal, opacity: .06 }} />
      <div style={{ position: "absolute", bottom: -100, left: -40, width: 250, height: 250, borderRadius: "50%", background: C.primary, opacity: .08 }} />
      <div className="login-hero" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 50, maxWidth: 520 }}>
        <div style={{ animation: "fadeIn .6s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
            <img src={LOGO} alt="LibreApp" style={{ width: 48, height: 48, borderRadius: 12 }} />
            <div><span style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>LibreApp</span><p style={{ fontSize: 11, color: C.textLight }}>Suite Legal</p></div>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 14 }}>Tu expediente,<br /><span style={{ background: `linear-gradient(90deg,${C.primary},${C.teal})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>verificado por IA</span></h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.4)", lineHeight: 1.7, maxWidth: 380 }}>Sube cada documento y la IA lo verifica al instante. Si algo está mal, te decimos qué hacer.</p>
        </div>
      </div>
      <div className="login-form" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: "100%", maxWidth: 380, background: C.white, borderRadius: 20, padding: "40px 32px", boxShadow: "0 20px 60px rgba(0,0,0,.3)", animation: "fadeIn .6s ease .2s both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}><img src={LOGO} alt="" style={{ width: 28, height: 28, borderRadius: 6 }} /><span style={{ fontSize: 18, fontWeight: 700, color: C.dark }}>Acceder</span></div>
          <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 4, color: C.textMuted }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="maria@demo.com" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13.5, fontFamily: font, background: C.bg, marginBottom: 14 }} />
          <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 4, color: C.textMuted }}>Contraseña</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••" onKeyDown={e => e.key === "Enter" && go()} style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13.5, fontFamily: font, background: C.bg, marginBottom: 18 }} />
          {err && <div style={{ padding: "9px 12px", borderRadius: 8, background: C.redSoft, color: C.red, fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}><AlertCircle size={13} />{err}</div>}
          <button onClick={go} disabled={ld} style={{ width: "100%", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600, background: `linear-gradient(135deg,${C.primary},${C.violet})`, color: "#fff", opacity: ld ? .7 : 1 }}>{ld ? "Accediendo..." : "Iniciar sesión"}</button>
          <div style={{ marginTop: 20, padding: 12, borderRadius: 10, background: C.bg, border: `1px dashed ${C.border}`, fontSize: 11, color: C.textMuted, lineHeight: 1.7 }}>
            <strong style={{ color: C.dark }}>Admin:</strong> carlos@libredeuda.com / admin1234<br />
            <strong style={{ color: C.dark }}>Letrado:</strong> ana@libredeuda.com / admin1234<br />
            <strong style={{ color: C.dark }}>Staff:</strong> laura@libredeuda.com / admin1234<br />
            <span style={{ display: "block", borderTop: `1px dashed ${C.border}`, margin: "6px 0" }} />
            <strong style={{ color: C.dark }}>Demo particular:</strong> maria@demo.com / 1234<br />
            <strong style={{ color: C.dark }}>Demo empresa:</strong> empresa@demo.com / 1234
          </div>
        </div>
      </div>
    </div>
  );
}
