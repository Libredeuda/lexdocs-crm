# Hoja de ruta — LexDocs / LibreApp

Orden pensado para desbloquear la venta cuanto antes sin romper lo que ya funciona. Cada fase termina con `lint + test + build` en verde y un despliegue a Vercel.

## Fase 0 — Reactivar y sanear (1 sesión)

Objetivo: volver a tener un entorno que arranca y un repositorio limpio.

- Reactivar el proyecto Supabase `lexdocs-prod` (panel de Supabase → Restore).
- Clonar el repositorio en el Mac, `npm install`, `.env` con las claves de `lexdocs-prod`, `npm run dev` y confirmar que el login funciona.
- Sacar `node_modules/` y `dist/` del índice de git. Arreglar la dependencia `vitest`.
- Comprobar en Supabase qué migraciones están aplicadas; aplicar 015 y 016 si faltan.
- Añadir `CLAUDE.md` y `docs/` al repositorio. Commit: "Saneamiento del repositorio y documentación para Claude Code".

Resultado: la app arranca en local contra producción y Claude Code tiene contexto.

## Fase 1 — Cerrar el hueco de seguridad barato (1 sesión)

- Test SQL que falla si alguna tabla del esquema `public` no tiene RLS activado (se ejecuta en `npm test` contra `_bootstrap.sql` o como comprobación en CI).
- Rate limiting básico en `carlota-chat` y `verify-document`: límite por usuario y por org en una tabla `usage_counters`, ventana de un minuto y de un día. Sin esto, una clave anon filtrada puede generar factura de Anthropic sin límite.
- Límite de tamaño de payload en las dos funciones anteriores.
- Error tracking mínimo: capturar excepciones de Edge Functions en una tabla `function_errors` o en Sentry.

## Fase 2 — Alta self-service de un despacho (2 sesiones)

Sin esto no hay SaaS: hoy dar de alta un despacho requiere SQL a mano.

- Página pública `/registro`: nombre del despacho, slug, email del administrador, plan.
- Edge Function `tenant-signup`: crea `tenant` + `organization` + primer `user` admin + sesión de Stripe Checkout (precio fundador 49 € o público 79 €).
- Email de bienvenida con Resend y enlace para fijar contraseña.
- Pantalla de primer arranque: subir logo, colores, invitar equipo.
- Enforcement de trial (`trial_ends_at`) ya existe; conectarlo al flujo.

## Fase 3 — Agency Master (3–4 sesiones)

Solo si la agencia distribuidora sigue siendo el canal. Diseño ya definido en el brief técnico:

- Migración 019: tablas `agencies`, `agency_users`; columna `agency_id` en `tenants`; políticas RLS que dan a la agencia acceso **solo a metadatos** de sus despachos (nunca a `documents`, `messages`, `carlota_messages`, `notes`).
- Rol `agency_admin` en `users` y en `auth_org_id()` / helpers.
- Dashboard de agencia: lista de despachos, estado de licencia, usuarios activos, facturación agregada, botón "crear despacho" (reutiliza `tenant-signup`).
- Marca blanca: `agencies.branding` (logo, colores, dominio) que sobrescribe la marca del tenant cuando el tenant pertenece a la agencia.
- Stripe: producto Agency Master con cuota base + precio por sub-cuenta activa (facturación medida).
- Test específico: un `agency_admin` no puede leer ninguna fila de `documents` de sus despachos.

## Fase 4 — LexConsulta útil (2 sesiones)

- Workers: generar embeddings con Cohere `embed-multilingual-v3` al insertar en `legislation` y `jurisprudence`.
- RPC `search_semantic(query_embedding, org_id, limit)` con `<=>` sobre pgvector, combinada con la búsqueda de texto completo ya existente.
- `SearchView`: campo de búsqueda natural, resultados con fuente y fecha, botón "preguntar a Carlota sobre este resultado" (Carlota cita el documento).
- Desplegar los workers en Railway con cron nocturno y `service_role` en variables de entorno.

## Fase 5 — Operación y cumplimiento (transversal)

- Audit log de seguridad (logins, exportaciones, accesos a documentos) en tabla `security_audit`.
- Política de retención y borrado RGPD; endpoint de portabilidad y supresión por cliente.
- Runbook de incidentes y notificación de brecha en 72 h.
- Backups: confirmar tier de Supabase y PITR antes de tener despachos de pago.
- Dominio `app.libredeudaabogados.com` en Vercel y subdominios wildcard por tenant.

## Lo que se deja fuera a propósito

- Reescribir `ClientApp.jsx` o migrar a un router: no aporta valor comercial ahora.
- Migrar a TypeScript: el código es JavaScript con JSDoc suficiente; posponer.
- App móvil nativa: el portal es responsive y el escáner funciona en navegador.
