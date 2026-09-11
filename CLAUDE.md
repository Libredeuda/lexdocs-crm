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
  _bootstrap.sql          Esquema completo desplegable de cero (generado con _generate_bootstrap.py)
  migration-001..018      Historial de migraciones (001 tenants … 018 fix RLS users)
  seed.sql                Tipos de documento LSO/concurso, etapas de pipeline, datos del tenant libredeuda
  functions/              17 Edge Functions (ver tabla en SECURITY.md §2)
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
supabase functions deploy <nombre> --project-ref fmwmjxntbifqquyaddkx
supabase secrets set KEY=VALUE --project-ref fmwmjxntbifqquyaddkx
```

Variables: copia `.env.example` a `.env`. Solo las `VITE_*` llegan al navegador. Todo lo demás son secretos de Edge Functions.

## Reglas que no se negocian

1. **Aislamiento entre despachos.** Toda tabla con datos de negocio lleva `org_id` o `tenant_id` y RLS activado. Ninguna consulta desde el frontend puede saltarse `auth_org_id()`. Si creas una tabla nueva, creas su política RLS en la misma migración.
2. **El navegador es hostil.** Ninguna clave secreta (Anthropic, Stripe secreta, Resend, service_role) entra en `src/`. Lo que necesite un secreto va a una Edge Function que valida el `org_id` del llamador antes de tocar datos.
3. **Secreto profesional.** Cualquier rol de "agencia" o "supervisor" futuro solo ve metadatos (número de expedientes, estados, facturación), nunca el contenido de documentos ni mensajes.
4. **Carlota cita fuentes, avisa de que no sustituye al abogado y nunca inventa jurisprudencia.** Estos guardarraíles viven en el system prompt de `carlota-chat` y no se relajan.
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

- `node_modules/` y `dist/` están **trackeados en git** a pesar del `.gitignore` (6.200+ archivos). Hay que sacarlos del índice (`git rm -r --cached node_modules dist`) en el primer commit.
- `vitest` figura como dependencia no instalada (`npm ls` la marca UNMET) — revisar `package-lock.json`.
- Migraciones 015 y 016 estaban sin aplicar en producción en la última revisión (2026-06-16). Verificar antes de seguir.
- Proyecto Supabase `lexdocs-prod` en plan gratuito: se pausa tras 7 días sin actividad. Reactivar desde el panel de Supabase antes de probar contra producción.
- Sin rate limiting en funciones de IA ni en webhooks; sin audit log de seguridad; sin runbook RGPD. Detalle completo en `SECURITY.md`.
