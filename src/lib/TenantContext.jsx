import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const TenantContext = createContext(null);

export function useTenant() {
  return useContext(TenantContext);
}

function resolveTenantSlug() {
  // 1. Check subdomain
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // Skip if localhost, vercel.app, or IP
  if (hostname === 'localhost' || hostname.includes('vercel.app') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    // 2. Check query param
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant');
    if (tenantParam) return tenantParam;

    // 3. Default tenant
    return 'libredeuda';
  }

  // Has subdomain: xyz.libreapp.com -> slug = "xyz"
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub !== 'www' && sub !== 'app') return sub;
  }

  return 'libredeuda';
}

// Config por defecto del despacho (branding) por si el tenant no se puede leer
// antes del login (RLS / función aún no desplegada). No bloquea el arranque: tras
// autenticarse, el acceso a datos va por org_id vía RLS, no por esto.
const DEFAULT_TENANT = {
  slug: 'libredeuda',
  name: 'LibreDeuda Abogados',
  plan: 'pro',
  is_active: true,
  primary_color: '#5B6BF0',
  secondary_color: '#7C5BF0',
  modules_enabled: ['lexdocs', 'lexcrm', 'lexconsulta'],
  carlota_enabled: true,
  carlota_settings: {},
  trial_ends_at: null,
};

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadTenant() {
      try {
        const slug = resolveTenantSlug();
        // Lookup vía RPC SECURITY DEFINER (devuelve solo campos de marca). Si falla
        // (RLS pre-login o función aún no desplegada), caemos al default y seguimos.
        let data = null;
        try {
          const { data: rows } = await supabase.rpc('get_tenant_by_slug', { p_slug: slug });
          data = Array.isArray(rows) ? rows[0] : null;
        } catch (rpcErr) {
          console.warn('Tenant lookup falló, usando config por defecto:', rpcErr?.message);
        }
        if (!data) data = { ...DEFAULT_TENANT, slug };

        // Check trial expiry (solo si el tenant real está en trial)
        if (data.trial_ends_at && new Date(data.trial_ends_at) < new Date() && data.plan === 'trial') {
          setError('El periodo de prueba ha expirado. Contacta con soporte para activar tu plan.');
          setLoading(false);
          return;
        }

        setTenant(data);
      } catch (e) {
        console.error(e);
        setTenant({ ...DEFAULT_TENANT });
      } finally {
        setLoading(false);
      }
    }
    loadTenant();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F7', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #E5E5EA', borderTopColor: '#5B6BF0', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#7A7A8A', fontSize: 14 }}>Cargando despacho...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E1E2E', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <span style={{ fontSize: 28 }}>&#9888;&#65039;</span>
          </div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No se pudo cargar</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{error}</p>
          <a href="https://libreapp.com" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #5B6BF0, #7C5BF0)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Ir a LibreApp</a>
        </div>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}
