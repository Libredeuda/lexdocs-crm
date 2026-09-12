# LexDocs / LibreApp — Guía para Claude Code

Este archivo va en la raíz del repositorio `Libredeuda/lexdocs-crm`. Claude Code lo lee automáticamente al arrancar. Mantenlo actualizado cuando cambien decisiones importantes.

## Qué es este proyecto

LibreApp (nombre público de LexDocs) es un SaaS legal multi-tenant para despachos de abogados especializados en insolvencia: Ley de Segunda Oportunidad (LSO) y concurso de acreedores. Lo construye LibreDeuda Abogados (Zaragoza) y su primer cliente es el propio despacho (tenant `libredeuda`).

Tres módulos en una sola SPA:

- **LexDocs** — portal del cliente: onboarding documental, subida y verificación de documentos con IA, hoja de ruta del expediente, agenda, mensajes con el despacho, pagos.
- **LexCRM** — panel del despacho: contactos y pipeline de ventas, expedientes, equipo legal, agenda con recordatorios, automatizaciones, agentes de IA, facturación de la licencia, integraciones (WhatsApp Business, Meta Ads, Zapier, API REST).
- **LexConsulta** — buscador de legislación (BOE) y jurisprudencia (CENDOJ) con búsqueda semántica (pgvector).

**Carlota** es la asistente de IA presente en todos los módulos (Edge Function `carlota-chat`, modelo Claude). Adapta el tono por rol: cercana con el cliente, técnica con el abogado.

El dueño del producto (José) no es programador. Explica las decisiones técnicas en castellano llano, con analogías, y entrega siempre algo ejecutable.

## Stack

| Capa | Tecnología | Dónde |
|---|---|---|
| Frontend | React 18 + Vite 5, un solo bundle SPA, sin router (estado + lazy imports) | `src/` |
| Datos, auth, storage, funciones | Supabase (Postgres + RLS + Auth + Storage + Edge Functions en Deno) | `supabase/` |
| Workers de sincronización BOE/CENDOJ | Node.js, scripts manuales sin servidor HTTP | `server/src/workers/` |
| Pagos | Stripe (checkout + webhook firmado + SEPA) | `supabase/functions/stripe-*` |
| Email | Resend | `send-notification` |
| Despliegue frontend | Vercel — https://lexdocs-crm.vercel.app | `vercel.json` (CSP y cabeceras) |
| Proyecto Supabase de producción | `lexdocs-prod` (ref `fmwmjxntbifqquyaddkx`, organización "Lexdocs LibreApp") | — |
| Calidad | ESLint 9 + Vitest | `eslint.config.js`, `src/utils.test.js` |

Iconos: `lucide-react`. Estilos: CSS en línea + `src/styles.css`. Fuente: Poppins. Colores del tenant por defecto: `#5B6BF0` / `#7C5BF0`.

## Mapa del código

```
src/
  App.jsx                 Entrada: sesión Supabase, resolución de rol, lazy load de Client/Admin
  lib/TenantContext.jsx   Resuelve el tenant por subdominio o ?tenant= y carga su marca (RPC get_tenant_by_slug)
  lib/supabase.js         Cliente Supabase (solo anon key)
  lib/currentOrg.js       org_id del usuario autenticado
  components/             Login, Onboarding, Carlota, CaseRoadmap, NotificationBell, MilestoneModal
  client/ClientApp.jsx    Todo el portal del cliente (1.400 líneas, candidato a trocear)
  admin/AdminApp.jsx      Shell del panel del despacho; pestañas en admin/{contacts,cases,agenda,automations,settings,integrations,lexconsulta}
  demoUsers.js            Cuentas demo — SOLO se incluyen en el bundle con VITE_DEMO_MODE=true
supabase/
  schema.sql              Esquema base (la "migración 000"); _generate_bootstrap.py lo concatena con las migraciones
  _bootstrap.sql          Esquema completo desplegable de cero. EMPIEZA CON drop schema public cascade: nunca en prod con datos
  migration-001..020      Historial de migraciones (… 019 MFA por email, 020 límites de IA + function_errors)
  _seed_despacho.sql      Datos iniciales de un despacho existente (embudo + 66 tipos de documento). Re-ejecutable
  seed.sql                Despacho DEMO completo con usuarios admin1234: solo local, NUNCA en producción
  functions/              18 Edge Functions + _shared/ (mfaEmail, limites, errores, llamador)
server/src/workers/       boe-sync.js, cendoj-sync.js, run-sync.js
libertadhipotecaria/      Microsite estático independiente (otro negocio); no tocar salvo petición expresa
```

## Comandos

```bash
npm install                      # dependencias del frontend
npm run dev                      # http://localhost:5173
VITE_DEMO_MODE=true npm run dev  # con cuentas demo visibles en el login
npm run lint                     # ESLint
npm test                         # Vitest
npm run build                    # dist/ para Vercel

cd server && npm install && npm run sync:all   # workers BOE + CENDOJ (necesita service_role en server/.env)
supabase functions deploy <nombre> --use-api --project-ref fmwmjxntbifqquyaddkx
supabase secrets set KEY=VALUE --project-ref fmwmjxntbifqquyaddkx
supabase db query --linked -f archivo.sql       # SQL contra producción (proyecto ya enlazado)
npx vercel deploy --prod                        # publicar la web: Vercel NO está conectado a GitHub
```

Variables: copia `.env.example` a `.env`. Solo las `VITE_*` llegan al navegador. Todo lo demás son secretos de Edge Functions.

## Reglas que no se negocian

1. **Aislamiento entre despachos.** Toda tabla con datos de negocio lleva `org_id` o `tenant_id` y RLS activado. Ninguna consulta desde el frontend puede saltarse `auth_org_id()`. Si creas una tabla nueva, creas su política RLS en la misma migración.
2. **El navegador es hostil.** Ninguna clave secreta (Anthropic, Stripe secreta, Resend, service_role) entra en `src/`. Lo que necesite un secreto va a una Edge Function que valida el `org_id` del llamador antes de tocar datos.
3. **Secreto profesional.** Cualquier rol de "agencia" o "supervisor" futuro solo ve metadatos (número de expedientes, estados, facturación), nunca el contenido de documentos ni mensajes.
4. **Carlota tiene dos niveles (decisión de José, 2026-09-12) y en los dos cita fuentes y nunca inventa jurisprudencia.** *Nivel usuario* (clientes del portal): informa, no asesora ni interpreta su caso, avisa de que no sustituye al abogado y deriva a él. *Nivel despacho* (roles admin, owner, lawyer, staff, procurador, sales): lee e interpreta documentos y redacta borradores (demandas, solicitudes, planes de pagos), siempre marcados como borrador para que los revise el letrado y con `[●]` en los datos que no conozca. El nivel lo decide el servidor por el rol en BD, nunca el navegador. Estos guardarraíles viven en el system prompt de `carlota-chat` y no se relajan.
5. **Fuentes legales permitidas:** BOE (API oficial) y CENDOJ (scraping respetuoso). No clonar Aranzadi, vLex ni ninguna base comercial.
6. **Webhooks siempre firmados** (Stripe, Meta, WhatsApp). `ALLOW_INSECURE_WEBHOOKS` solo en local.
7. **Cambios de esquema = migración numerada nueva** (`migration-019-...sql`) + regenerar `_bootstrap.sql` con `_generate_bootstrap.py`. Nunca editar migraciones ya aplicadas.
8. **Idioma:** código y comentarios en castellano (nombres de variables en inglés está bien), textos de interfaz en castellano sin anglicismos innecesarios. Mensajes de commit en castellano.

## Cómo trabajar en este repositorio

- Antes de tocar nada, lee `SECURITY.md` (postura de seguridad, con lista de pendientes) y `docs/ESTADO.md` (qué hay hecho y qué no).
- Cambios pequeños y verificables: un commit por funcionalidad, `npm run lint && npm test && npm run build` antes de cada commit.
- No hagas refactors masivos sin pedirlo. `ClientApp.jsx` es grande a propósito; trocéalo solo cuando toques esa zona y de forma incremental.
- Cuando añadas una Edge Function, añade también su fila en la tabla de `SECURITY.md` §2 y sus secretos en `.env.example`.
- Cuando termines una tarea, actualiza `docs/ESTADO.md` (marca lo hecho, anota lo que descubriste).
- Si algo del esquema de producción no coincide con `_bootstrap.sql`, para y avisa antes de migrar.

## Deuda conocida (prioridad alta)

- ~~`node_modules/` y `dist/` trackeados en git; `vitest` UNMET~~ → resuelto el 2026-09-11 (Fase 0).
- ~~Proyecto Supabase ajeno `agzcaq…` fijo en el código~~ → resuelto el 2026-09-11. La API REST, el formulario web y Zapier siguen sin backend (marcados "Próximamente").
- Migraciones 001–020 aplicadas en producción (2026-09-12). Antes de aplicar una nueva, comprobar el estado con `supabase db query --linked`.
- Toda tabla nueva necesita RLS y su política `mfa_email_gate` en la misma migración (lo comprueba `npm test`).
- Proyecto Supabase `lexdocs-prod` en plan gratuito: se pausa tras 7 días sin actividad. Reactivar desde el panel de Supabase antes de probar contra producción.
- Sin rate limiting en webhooks; sin audit log de seguridad; sin runbook RGPD. Detalle completo en `SECURITY.md`. Estado vivo en `docs/ESTADO.md`.
