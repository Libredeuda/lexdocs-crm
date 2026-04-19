import { useState, useEffect } from "react";
import { Calendar, Check, X, AlertCircle, RefreshCw, ExternalLink, Bell } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import { useWebPush } from "../../lib/hooks/useWebPush";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/gcal-oauth-callback`;

export default function CalendarIntegration({ user }) {
  const [conn, setConn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const { supported: pushSupported, permission: pushPermission, isSubscribed, requestPermission, unsubscribe, error: pushError } = useWebPush(user?.id, user?.org_id);

  useEffect(() => {
    if (user?.id) loadConnection();
  }, [user?.id]);

  async function loadConnection() {
    setLoading(true);
    const { data } = await supabase.from("google_calendar_connections").select("*").eq("user_id", user.id).maybeSingle();
    setConn(data);
    setLoading(false);
  }

  function handleConnect() {
    if (!GOOGLE_CLIENT_ID) {
      setToast("Falta configurar VITE_GOOGLE_CLIENT_ID en Vercel");
      setTimeout(() => setToast(null), 3500);
      return;
    }
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
      access_type: "offline",
      prompt: "consent",
      state: user.id,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async function handleDisconnect() {
    if (!window.confirm("¿Desconectar Google Calendar? Las citas dejarán de sincronizarse automáticamente.")) return;
    await supabase.from("google_calendar_connections").delete().eq("user_id", user.id);
    setConn(null);
    setToast("Google Calendar desconectado");
    setTimeout(() => setToast(null), 2500);
  }

  async function toggleOption(field, value) {
    await supabase.from("google_calendar_connections").update({ [field]: value, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    loadConnection();
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 8px 30px rgba(0,0,0,.2)" }}>{toast}</div>}

      {/* Google Calendar */}
      <div style={{ background: C.card, borderRadius: 14, padding: "22px 24px", border: `1px solid ${C.border}`, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(66,133,244,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Calendar size={22} color="#4285F4" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Google Calendar</h3>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Sincroniza tus citas de LibreApp con tu Google Calendar personal y bloquea slots ocupados.</p>
          </div>
          {!loading && conn && (
            <span style={{ padding: "4px 10px", background: C.greenSoft, color: C.green, fontSize: 11, fontWeight: 700, borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={11} /> CONECTADO
            </span>
          )}
        </div>

        {loading && <p style={{ fontSize: 12, color: C.textMuted, padding: 10 }}>Cargando...</p>}

        {!loading && !conn && (
          <button onClick={handleConnect} style={{ width: "100%", padding: "12px 20px", borderRadius: 10, background: "#4285F4", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Calendar size={15} /> Conectar Google Calendar
          </button>
        )}

        {!loading && conn && (
          <>
            <div style={{ background: C.bg, borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <Check size={16} color={C.green} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 600 }}>{conn.google_email}</p>
                <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>Conectado desde {new Date(conn.connected_at).toLocaleDateString("es-ES")}</p>
              </div>
              <button onClick={handleDisconnect} style={{ padding: "7px 12px", borderRadius: 7, background: C.redSoft, color: C.red, fontSize: 11, fontWeight: 600, border: `1px solid ${C.red}40`, cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 4 }}>
                <X size={11} /> Desconectar
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ToggleRow
                label="Bloquear slots ocupados al crear cita"
                desc="Antes de guardar una reunión, comprueba si tu Google Calendar tiene un evento a esa hora y avisa de conflictos."
                checked={conn.block_busy_slots}
                onChange={(v) => toggleOption("block_busy_slots", v)}
              />
              <ToggleRow
                label="Sincronizar también tareas"
                desc="Crea eventos en Google Calendar también para tareas internas (no sólo reuniones con cliente)."
                checked={conn.sync_tasks}
                onChange={(v) => toggleOption("sync_tasks", v)}
              />
            </div>
          </>
        )}
      </div>

      {/* Web Push */}
      <div style={{ background: C.card, borderRadius: 14, padding: "22px 24px", border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: `${C.primary}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Bell size={22} color={C.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Notificaciones del navegador (Push)</h3>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Recibe avisos al instante de tareas, plazos y mensajes — aunque no tengas LibreApp abierta.</p>
          </div>
          {pushSupported && isSubscribed && (
            <span style={{ padding: "4px 10px", background: C.greenSoft, color: C.green, fontSize: 11, fontWeight: 700, borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={11} /> ACTIVO
            </span>
          )}
        </div>

        {!pushSupported && (
          <div style={{ padding: "12px 14px", background: C.orangeSoft, borderRadius: 8, fontSize: 12, color: C.text, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={14} color={C.orange} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Tu navegador no soporta notificaciones push. Considera usar Chrome, Edge o Firefox de escritorio.</span>
          </div>
        )}

        {pushSupported && pushPermission === "denied" && (
          <div style={{ padding: "12px 14px", background: C.redSoft, borderRadius: 8, fontSize: 12, color: C.text, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={14} color={C.red} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Has bloqueado las notificaciones para este sitio. Cámbialo en la configuración del navegador → permisos → notificaciones.</span>
          </div>
        )}

        {pushSupported && pushPermission !== "denied" && !isSubscribed && (
          <button onClick={requestPermission} style={{ width: "100%", padding: "12px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Bell size={15} /> Activar notificaciones del navegador
          </button>
        )}

        {pushSupported && isSubscribed && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <p style={{ flex: 1, fontSize: 12, color: C.textMuted }}>Recibirás notificaciones de tareas, plazos urgentes y mensajes de cliente.</p>
            <button onClick={unsubscribe} style={{ padding: "8px 14px", borderRadius: 7, background: C.bg, color: C.text, fontSize: 11.5, fontWeight: 500, border: `1px solid ${C.border}`, cursor: "pointer", fontFamily: font }}>Desactivar</button>
          </div>
        )}

        {pushError && <p style={{ fontSize: 11, color: C.red, marginTop: 8 }}>Error: {pushError}</p>}
      </div>

      {/* Info */}
      <div style={{ marginTop: 18, padding: "14px 16px", background: `${C.primary}06`, borderRadius: 10, fontSize: 12, color: C.textMuted, lineHeight: 1.6, display: "flex", gap: 10 }}>
        <AlertCircle size={14} color={C.primary} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          Las conexiones son individuales para cada miembro del despacho. Cada letrado/procurador conecta su propio Google Calendar y recibe avisos en su navegador. Los datos personales (email Google, tokens) se guardan cifrados y no se comparten.
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <label style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", borderRadius: 9, background: C.bg, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 4, cursor: "pointer", width: 16, height: 16, accentColor: C.primary }}
      />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{label}</p>
        <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2, lineHeight: 1.4 }}>{desc}</p>
      </div>
    </label>
  );
}
