// Registro de errores de Edge Functions en public.function_errors (migration-020).
// Nunca lanza: si el registro falla, solo queda en consola. No guardar aquí
// contenido de documentos ni mensajes (secreto profesional): solo el error y
// datos técnicos mínimos.

// deno-lint-ignore no-explicit-any
export async function registrarError(admin: any, functionName: string, error: unknown, ctx: { userId?: string | null; orgId?: string | null; extra?: Record<string, unknown> } = {}) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${functionName}:`, message);
  try {
    await admin.from("function_errors").insert({
      function_name: functionName,
      user_id: ctx.userId ?? null,
      org_id: ctx.orgId ?? null,
      message: message.slice(0, 2000),
      context: ctx.extra ?? {},
    });
  } catch (e) {
    console.error("registrarError:", e instanceof Error ? e.message : e);
  }
}
