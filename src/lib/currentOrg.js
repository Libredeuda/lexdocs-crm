import { supabase } from './supabase';

let cachedOrgId = null;
let inflight = null;

export async function getCurrentOrgId() {
  if (cachedOrgId) return cachedOrgId;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.rpc('auth_org_id');
    if (error || !data) {
      inflight = null;
      throw new Error('No org_id for current user');
    }
    cachedOrgId = data;
    inflight = null;
    return data;
  })();
  return inflight;
}

export function clearOrgCache() {
  cachedOrgId = null;
  inflight = null;
}

// Limpia la caché cuando el usuario cambia de sesión (logout / login).
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
    clearOrgCache();
  }
});
