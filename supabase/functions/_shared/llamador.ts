// ¿Quién llama a esta Edge Function?
//  - "interno": otra función o un cron, con la service_role como Bearer o con la
//    cabecera X-Internal-Secret = INTERNAL_FUNCTION_SECRET.
//  - "usuario": un JWT de usuario válido (y MFA por email verificado, si lo tiene
//    activo), con su despacho: staff en users, cliente en contacts por email.
//  - null: nadie reconocible (la anon key sola NO basta) → responder 401.

import { sesionConMfaEmailOk } from "./mfaEmail.ts";

export type Llamador =
  | { tipo: "interno" }
  | { tipo: "usuario"; userId: string; email: string; orgId: string | null; rol: string };

const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_FUNCTION_SECRET") || "";

function iguales(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// deno-lint-ignore no-explicit-any
export async function identificarLlamador(req: Request, admin: any): Promise<Llamador | null> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (iguales(jwt, SERVICE_ROLE)) return { tipo: "interno" };
  if (iguales(req.headers.get("x-internal-secret") || "", INTERNAL_SECRET)) return { tipo: "interno" };
  if (!jwt) return null;

  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return null;
  if (!(await sesionConMfaEmailOk(jwt))) return null;

  const { data: staff } = await admin.from("users").select("org_id, role").eq("id", user.id).maybeSingle();
  if (staff) return { tipo: "usuario", userId: user.id, email: user.email || "", orgId: staff.org_id, rol: staff.role || "staff" };

  const { data: contacto } = await admin.from("contacts").select("org_id").eq("email", user.email || "").maybeSingle();
  return { tipo: "usuario", userId: user.id, email: user.email || "", orgId: contacto?.org_id || null, rol: "client" };
}

export const noAutorizado = (cors: Record<string, string>) =>
  new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
    status: 401, headers: { ...cors, "Content-Type": "application/json" },
  });
