import { useState, useEffect, lazy, Suspense } from "react";
import Login from "./components/Login";
import { supabase } from "./lib/supabase";
import { useTenant } from "./lib/TenantContext";

// Modo demo de producto: OFF salvo build/entorno con VITE_DEMO_MODE=true.
// En producción esta constante es false → la rama de demo (y su módulo de
// credenciales) se elimina del bundle por dead-code elimination.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

// Rutas pesadas en chunks aparte: el bundle inicial solo carga Login.
const Onboarding = lazy(() => import("./components/Onboarding"));
const ClientApp = lazy(() => import("./client/ClientApp"));
const AdminApp = lazy(() => import("./admin/AdminApp"));

function FullScreenLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F7', fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #E5E5EA', borderTopColor: '#5B6BF0', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#7A7A8A', fontSize: 14 }}>Cargando...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

// Pantalla para fijar nueva contraseña tras volver del email de recuperación.
function SetNewPassword({ onDone }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [ld, setLd] = useState(false);
  async function save() {
    if (pass.length < 8) { setErr("Mínimo 8 caracteres."); return; }
    setLd(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password: pass });
    setLd(false);
    if (error) { setErr(error.message || "No se pudo actualizar la contraseña."); return; }
    onDone();
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E1E2E', fontFamily: "'Poppins', sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 20, padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E1E2E', margin: '0 0 6px' }}>Nueva contraseña</h2>
        <p style={{ fontSize: 13, color: '#7A7A8A', margin: '0 0 20px' }}>Introduce una contraseña nueva para acceder.</p>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Nueva contraseña (mín. 8)" onKeyDown={e => e.key === 'Enter' && save()} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13.5, marginBottom: 14, fontFamily: "'Poppins', sans-serif" }} />
        {err && <div style={{ padding: '9px 12px', borderRadius: 8, background: '#FEECEC', color: '#E5484D', fontSize: 12, marginBottom: 14 }}>{err}</div>}
        <button onClick={save} disabled={ld} style={{ width: '100%', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg,#5B6BF0,#7C5BF0)', color: '#fff', border: 'none', cursor: 'pointer', opacity: ld ? .7 : 1, fontFamily: "'Poppins', sans-serif" }}>{ld ? 'Guardando...' : 'Guardar contraseña'}</button>
      </div>
    </div>
  );
}

// Devuelve el factorId TOTP si la sesión necesita elevarse a aal2 (MFA pendiente).
async function pendingMfaFactor() {
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      const { data: f } = await supabase.auth.mfa.listFactors();
      return (f?.totp || [])[0]?.id || null;
    }
  } catch { /* MFA no disponible */ }
  return null;
}

// Reto MFA: pide el código TOTP tras introducir la contraseña.
function MfaChallenge({ factorId, onVerified, onCancel }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [ld, setLd] = useState(false);
  async function verify() {
    if (code.trim().length < 6) { setErr("Introduce el código de 6 dígitos."); return; }
    setLd(true); setErr("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setLd(false);
    if (error) { setErr("Código incorrecto. Inténtalo de nuevo."); return; }
    onVerified();
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E1E2E', fontFamily: "'Poppins', sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 20, padding: '36px 32px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1E1E2E', margin: '0 0 6px' }}>Verificación en dos pasos</h2>
        <p style={{ fontSize: 13, color: '#7A7A8A', margin: '0 0 20px' }}>Introduce el código de 6 dígitos de tu app de autenticación.</p>
        <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" onKeyDown={e => e.key === 'Enter' && verify()} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 18, letterSpacing: 6, textAlign: 'center', marginBottom: 14, fontFamily: "'Poppins', sans-serif" }} />
        {err && <div style={{ padding: '9px 12px', borderRadius: 8, background: '#FEECEC', color: '#E5484D', fontSize: 12, marginBottom: 14 }}>{err}</div>}
        <button onClick={verify} disabled={ld} style={{ width: '100%', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'linear-gradient(135deg,#5B6BF0,#7C5BF0)', color: '#fff', border: 'none', cursor: 'pointer', opacity: ld ? .7 : 1, fontFamily: "'Poppins', sans-serif" }}>{ld ? 'Verificando...' : 'Verificar'}</button>
        <button onClick={onCancel} disabled={ld} style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 10, fontSize: 12, fontWeight: 500, background: 'transparent', color: '#7A7A8A', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>Cancelar y salir</button>
      </div>
    </div>
  );
}

export default function App() {
  const tenant = useTenant();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [mfaPending, setMfaPending] = useState(null);
  const [appError, setAppError] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("onboarding") === "true";
  });

  // On mount: check if there's an existing Supabase session
  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const factorId = await pendingMfaFactor();
          if (factorId) {
            setMfaPending({ factorId });
          } else {
            const profile = await fetchProfile(session.user.id);
            if (profile) setUser(profile);
          }
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Al volver del email de recuperación, Supabase emite PASSWORD_RECOVERY →
  // mostramos la pantalla para fijar la nueva contraseña.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, organizations(*)')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Profile exception:', e);
      return null;
    }
  }

  async function handleLogin(email, password) {
    // Try Supabase auth first
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const factorId = await pendingMfaFactor();
      if (factorId) {
        setMfaPending({ factorId });
        return;
      }
      const profile = await fetchProfile(data.user.id);
      if (profile) {
        setUser(profile);
        return;
      }
    } catch (e) {
      console.log('Supabase auth failed:', e.message);
    }

    // Fallback de credenciales DEMO: SOLO en modo demo explícito (nunca en prod).
    // El import es dinámico y dentro de la rama gated → se elimina del bundle real.
    if (DEMO_MODE) {
      const { DEMO } = await import('./demoUsers');
      const found = DEMO.find(c => c.email === email && c.password === password);
      if (found) {
        setUser(found);
        return;
      }
    }

    throw new Error('Credenciales incorrectas');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (loading) {
    return <FullScreenLoader />;
  }

  if (recovery) {
    return <SetNewPassword onDone={async () => {
      setRecovery(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (profile) setUser(profile);
      }
    }} />;
  }

  if (mfaPending) {
    return <MfaChallenge
      factorId={mfaPending.factorId}
      onVerified={async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setMfaPending(null);
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          if (profile) setUser(profile);
        }
      }}
      onCancel={async () => { await supabase.auth.signOut(); setMfaPending(null); setUser(null); }}
    />;
  }

  if (!user) {
    if (showOnboarding) {
      return (
        <Suspense fallback={<FullScreenLoader />}>
          <Onboarding onBack={() => setShowOnboarding(false)} />
        </Suspense>
      );
    }
    return <Login onLogin={handleLogin} onShowOnboarding={() => setShowOnboarding(true)} />;
  }

  const role = user.role;
  const isStaff = role === 'admin' || role === 'owner' || role === 'lawyer' || role === 'staff';

  return (
    <Suspense fallback={<FullScreenLoader />}>
      {isStaff
        ? <AdminApp user={user} onLogout={handleLogout} tenant={tenant} />
        : <ClientApp user={user} onLogout={handleLogout} tenant={tenant} />}
    </Suspense>
  );
}
