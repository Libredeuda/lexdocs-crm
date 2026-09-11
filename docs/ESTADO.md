# Estado del proyecto — LexDocs / LibreApp

Última auditoría: 2026-09-11, sobre `main` en commit `0d0c2ba` (28-08-2026). 42 commits, un solo autor, trabajo concentrado en abril 2026 (MVP completo en 9 días), sprint de seguridad el 19-06-2026 y un commit de mantenimiento el 28-08-2026.

## Dónde está todo

| Recurso | Ubicación |
|---|---|
| Repositorio | https://github.com/Libredeuda/lexdocs-crm (público, cuenta GitHub `Libredeuda`, correo `experto@libredeudaabogados.com`) |
| Producción frontend | https://lexdocs-crm.vercel.app (cuenta Vercel `libredeuda-1808`) |
| Supabase producción | proyecto `lexdocs-prod`, ref `fmwmjxntbifqquyaddkx`, organización "Lexdocs LibreApp" — plan gratuito, se pausa a los 7 días de inactividad |
| Supabase antiguo | "Libredeuda's Project", ref `ujhulpkcllrcgftqeelx` — probablemente el primer intento; confirmar si está vacío y borrarlo |
| Dominio previsto | `app.libredeudaabogados.com` (en `.env.example`, sin verificar que apunte a Vercel) |
| Repositorio hermano | `Libredeuda/libredeuda-web` (web corporativa, despliegue a IONOS por SFTP; el flujo lleva fallando desde julio) |

## Lo que está construido (verificado en el código)

### Base de datos (Supabase, 35 tablas, RLS en todas)
`tenants`, `organizations`, `users`, `contacts`, `contact_tags`, `tags`, `pipelines`, `pipeline_stages`, `cases`, `documents`, `document_types`, `notes`, `activities`, `events`, `messages`, `message_templates`, `payments`, `api_keys`, `ai_agents`, `ai_conversations`, `ai_messages`, `automation_workflows`, `automation_steps`, `automation_runs`, `carlota_conversations`, `carlota_messages`, `notifications_inbox`, `notifications_log`, `push_subscriptions`, `google_calendar_connections`, `legislation`, `jurisprudence`, `procedural_knowledge`, `saved_items`, `search_history`.

18 migraciones + `_bootstrap.sql` (esquema completo de cero) + `seed.sql` con tipos de documento LSO/concurso y datos del tenant `libredeuda`. pgvector activado con embeddings de 1024 dimensiones (compatible con Cohere multilingual).

### Edge Functions (17)
`carlota-chat`, `verify-document` (Claude Vision), `ai-agent-respond`, `ai-lead-scorer`, `automation-runner`, `send-notification` (email Resend + WhatsApp), `stripe-checkout`, `stripe-webhook`, `pay-installment`, `renewal-reminders-cron`, `task-reminders-cron`, `web-push-send`, `webhook-meta-leads`, `webhook-whatsapp`, `gcal-oauth-callback`, `gcal-check-availability`, `gcal-sync-event`.

### Portal del cliente (LexDocs) — `src/client/`
Login, onboarding, subida de documentos (archivo, foto, escáner), verificación con IA (estados verificado / incompleto / incorrecto / caducado / en revisión / no aplica), progreso por categoría, hoja de ruta del expediente con hitos, agenda, mensajes con el despacho, Carlota, facturación (estado de pagos, cuotas, domiciliación SEPA), notificaciones push.

### Panel del despacho (LexCRM) — `src/admin/`
Dashboard con pestañas, contactos con pipeline kanban y detalle (tareas, reuniones, adjuntos), expedientes con revisión documental por el letrado, asignación de abogado y procurador, agenda con recurrencia y recordatorios, automatizaciones (constructor de flujos, plantillas, agentes de IA, conversaciones), integraciones (WhatsApp Business, Meta Ads, formulario web, Zapier, API REST con claves), configuración (despacho, equipo, pipeline, Google Calendar, facturación de la licencia con planes Individual/Team mensual/anual, seguridad con MFA TOTP).

### LexConsulta — `src/admin/lexconsulta/` + `server/`
Buscador y detalle de resultados sobre las tablas `legislation` y `jurisprudence`. Workers `boe-sync.js` y `cendoj-sync.js` para poblarlas (ejecución manual).

### Multi-tenancy
Resuelta por subdominio (`xyz.dominio.com`) o parámetro `?tenant=`, con marca por tenant (colores, nombre, módulos activos, Carlota activable), planes y periodo de prueba, enforcement de licencias por número de usuarios. **Sí existe** aunque documentación anterior decía lo contrario.

### Seguridad (sprint 19-06-2026)
RLS completo, storage por `org_id`, webhooks firmados, clave Anthropic fuera del cliente, CSP y cabeceras en Vercel, MFA opcional para staff, reset de contraseña, cuentas demo fuera del bundle de producción, `SECURITY.md` como documento de referencia.

## Lo que NO está hecho

| Bloque | Estado | Nota |
|---|---|---|
| **Agency Master** (capa de agencia: tablas `agencies`, `agency_users`, dashboard de agencia, marca blanca, facturación por sub-cuenta) | ❌ No existe nada en el código | Era el brief para el equipo de desarrollo; nunca se implementó. Es el bloqueo del modelo comercial con la agencia distribuidora |
| Embeddings reales en LexConsulta | ❌ | Las columnas `embedding` existen; falta el paso que genera embeddings (Cohere) en los workers y la búsqueda semántica en `SearchView` |
| Workers en Railway con cron | ❌ | Hoy son scripts manuales |
| Migraciones 015 y 016 en producción | ⚠️ | Sin aplicar a fecha 16-06-2026 según `SECURITY.md` |
| Rate limiting (IA, login, webhooks) | ❌ | Riesgo de coste por abuso de `carlota-chat` y `verify-document` |
| Audit log de seguridad, error tracking (Sentry), runbook de incidentes, retención RGPD, derechos ARCO | ❌ | Listado completo en `SECURITY.md` §5–§8 |
| Test automatizado de que toda tabla nueva tenga RLS | ❌ | Un test SQL de 20 líneas cierra el riesgo más caro |
| Limpieza del repositorio | ❌ | `node_modules/` y `dist/` trackeados (6.200 archivos); `vitest` no instalado según `npm ls` |
| Dominio propio en Vercel | ? | Comprobar `app.libredeudaabogados.com` |
| Onboarding self-service de un despacho nuevo (alta de tenant + primer admin + Stripe) | ⚠️ | Existe `_create_admin.sql` manual; no hay flujo de registro público |

## Decisiones ya tomadas (no reabrir sin motivo)

- Serverless: Vercel + Supabase, sin servidores propios. Workers como scripts.
- Un solo repositorio, una sola SPA con tres módulos, sin router de rutas (navegación por estado).
- Esquema versionado con migraciones numeradas + `_bootstrap.sql` regenerado.
- Cuentas demo solo con `VITE_DEMO_MODE=true`.
- Modelo comercial: fundadores 49 €/mes de por vida, público 79 €/mes; agencia distribuidora con 40 % recurrente o licencia Agency Master tipo GoHighLevel.

## Puntos de duda a resolver con José antes de codificar

1. ¿Sigue en pie la agencia externa como canal principal? Si sí, Agency Master es la fase 1. Si no, la fase 1 es el alta self-service de despachos.
2. ¿El proyecto Supabase `ujhulpkcllrcgftqeelx` se puede borrar?
3. ¿Hay ya despachos reales (aparte de LibreDeuda) con datos en `lexdocs-prod`? Condiciona cuánto cuidado hace falta con las migraciones.
4. ¿Se mantiene `libertadhipotecaria/` dentro de este repositorio o se mueve al suyo?
