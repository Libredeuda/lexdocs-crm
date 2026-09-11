// Comprobación compartida del MFA por email (migration-019) para Edge Functions
// que actúan en nombre de un usuario con service_role (y por tanto se saltan la
// política restrictiva "mfa_email_gate" de la base de datos).
//
// Pregunta a la BD con el JWT del propio usuario: mfa_email_ok() es la única
// fuente de verdad. Falla cerrado: si la RPC no responde, devuelve false.
// → Aplicar migration-019 ANTES de desplegar funciones que importen esto.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function sesionConMfaEmailOk(jwt: string): Promise<boolean> {
  const cliente = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await cliente.rpc("mfa_email_ok");
  if (error) console.error("mfa_email_ok:", error.message);
  return !error && data === true;
}
