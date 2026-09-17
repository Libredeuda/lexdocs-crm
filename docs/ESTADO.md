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
| ~~Agency Master~~ (capa de agencia, marca blanca, facturación por sub-cuenta) | 🚫 Descartado (2026-09-12) | José confirma que la agencia distribuidora ya no es el canal. No se construye salvo que cambie el modelo comercial |
| Embeddings reales en LexConsulta | ❌ | Las columnas `embedding` existen; falta el paso que genera embeddings (Cohere) en los workers y la búsqueda semántica en `SearchView` |
| Workers en Railway con cron | ❌ | Hoy son scripts manuales |
| Migraciones 015 y 016 en producción | ✅ 2026-09-11 | Verificado en `lexdocs-prod`: 015–018 aplicadas, 35 tablas, 0 sin RLS |
| Rate limiting (IA, login, webhooks) | ❌ | Riesgo de coste por abuso de `carlota-chat` y `verify-document` |
| Audit log de seguridad, error tracking (Sentry), runbook de incidentes, retención RGPD, derechos ARCO | ❌ | Listado completo en `SECURITY.md` §5–§8 |
| Test automatizado de que toda tabla nueva tenga RLS | ❌ | Un test SQL de 20 líneas cierra el riesgo más caro |
| Limpieza del repositorio | ✅ 2026-09-11 | `node_modules/`, `dist/` y `.DS_Store` fuera del índice; devDependencies instaladas, `npm ls` limpio |
| Dominio propio en Vercel | ? | Comprobar `app.libredeudaabogados.com` |
| **MFA por email: puesta en marcha** | ⏸️ Aparcado (2026-09-11, decisión de José: estamos en test) | Código y BD ya en producción, inactivo para todos. Falta: 1) cuenta Resend + secreto `RESEND_API_KEY` en Supabase; 2) verificar el dominio `libredeudaabogados.com` en Resend (sin eso solo envía al email de la cuenta) y fijar `FROM_EMAIL`; 3) publicar el frontend en Vercel; 4) activarlo en Configuración → Seguridad; 5) decidir si se hace obligatorio para staff. Hasta entonces, pulsar "Activar código por email" muestra "El envío de emails no está configurado". |
| Onboarding self-service de un despacho nuevo (alta de tenant + primer admin + Stripe) | ⚠️ | Existe `_create_admin.sql` manual; no hay flujo de registro público |

## Verificación Fase 0 (2026-09-11) — discrepancias entre documentación y código

Confirmado: 35 tablas en `_bootstrap.sql`, las 35 con `ENABLE ROW LEVEL SECURITY`; 17 Edge Functions; embeddings `vector(1024)`; multi-tenancy por subdominio/`?tenant=` vía RPC `get_tenant_by_slug`; MFA TOTP opt-in; reset de contraseña; cuentas demo detrás de `VITE_DEMO_MODE`; LexConsulta hace búsqueda de texto completo (`textSearch`, config `spanish`) sobre `title`/`summary`.

Hallazgos nuevos:

- 🔴 **Tercer proyecto Supabase en el código: `agzcaqgxlyrtbxtyxkwp`.** No es `lexdocs-prod` ni el antiguo. Aparece fijo (sin variable de entorno) en `src/admin/settings/ApiKeys.jsx` (`BASE_URL`, la URL que se enseña al despacho en la documentación de la API), como valor por defecto en `src/admin/integrations/Integrations.jsx` y en los comentarios de `webhook-meta-leads` y `webhook-whatsapp`. Hay que confirmar qué proyecto es y sustituirlo por `VITE_SUPABASE_URL`.
- ⚠️ **La "API REST con claves" solo está a medias.** La pantalla genera claves de tenant y guarda su hash en `api_keys`, pero ninguna Edge Function comprueba después `key_hash`. Los ejemplos `curl` que ve el despacho usan la anon key directamente contra PostgREST, y sin el JWT de un usuario RLS no devuelve nada. En la práctica la API no funciona para un tercero (Zapier incluido).
- ⚠️ **`supabase/schema.sql`** (esquema base, lo que sería la "migración 000") no sale en el mapa de `CLAUDE.md`. `_generate_bootstrap.py` lo concatena con las migraciones.
- 🔴 **`_bootstrap.sql` empieza con `drop schema if exists public cascade`.** Borra la base de datos entera. Solo sirve para un proyecto vacío; **nunca** se debe ejecutar contra `lexdocs-prod` si ya tiene datos.
- ⚠️ **`SECURITY.md` §5 y §11 están desfasados.** Dicen que la contraseña demo `1234` está en `constants.js`/`App.jsx`/`README.md` y que no hay MFA. Hoy la demo está detrás del flag y el MFA opcional existe. Además, `Login.jsx` (solo en modo demo) muestra cuentas de staff `carlos@`/`ana@`/`laura@libredeuda.com` con contraseña `admin1234`: hay que confirmar que no existen en producción con esa contraseña.
- ℹ️ La tabla `search_history` (la que hace privada la migración 016) no se usa desde el frontend; `saved_items` sí se usa.
- ℹ️ `npm ls` no solo marcaba `vitest`: faltaban 7 devDependencies (`eslint`, `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `globals`, `jsdom`, `vitest`). `package-lock.json` era correcto; simplemente no estaban instaladas.
- ℹ️ Estaban en git 6.233 archivos de `node_modules/` y 2 de `dist/` (6.235 en total), además de `.DS_Store`.
- ⚠️ **El alta self-service sí existe en la interfaz, pero no puede funcionar.** El botón "¿No tienes cuenta? Crear despacho gratis" del login abre `src/components/Onboarding.jsx`, que llama a `supabase.auth.signUp` y luego intenta insertar en `tenants`, `organizations`, `users`, `pipelines`, etc. directamente desde el navegador. `tenants` y `organizations` no tienen política RLS de `INSERT`, así que la inserción falla y queda creado un usuario de Auth huérfano. Además, que el navegador cree tenants choca con la regla 2 de `CLAUDE.md`. La Fase 2 del roadmap (Edge Function `tenant-signup`) debe sustituir este flujo, y mientras tanto conviene ocultar el botón.
- ⚠️ **El trial del tenant `libredeuda` venció el 02-07-2026** (`trial_ends_at` en producción) aunque tiene `plan = 'pro'`. Hay que comprobar si la app bloquea algo por ello.
- ℹ️ Tampoco figuran en el mapa: `src/client/Messages.jsx`, `src/lib/hooks/` (`useContacts`, `useWebPush`), `public/sw.js` (service worker de push) y `.claude/launch.json` (arranca el repo hermano `../libredeuda-web`).

### Resultado de la Fase 0 (2026-09-11)

- ✅ `lexdocs-prod` reactivado (estaba pausado; ahora `ACTIVE_HEALTHY`). La RPC `get_tenant_by_slug('libredeuda')` responde con la anon key y RLS devuelve `[]` al leer `contacts` sin sesión.
- ✅ `node_modules/`, `dist/` y `.DS_Store` fuera del índice de git (siguen en disco).
- ✅ `npm install` → `npm ls` sin nada UNMET. `package-lock.json` no ha cambiado.
- ✅ `.env` local creado con URL + anon key de `lexdocs-prod` (ignorado por git).
- ✅ `npm run dev` → el login carga sin errores en consola (Chrome headless, comprobado por protocolo de depuración).
- ✅ `npm run lint` (0 errores, 80 avisos: variables sin usar y dependencias de `useEffect`), `npm test` (12/12) y `npm run build` en verde.
- ✅ El bundle de producción no contiene `admin1234`, cuentas demo ni secretos (`service_role`, `sk_live`, `sk-ant`, `whsec_`).
- ⏳ Sin hacer en esta sesión (sigue en la Fase 0 del roadmap): comprobar qué migraciones están aplicadas en producción y aplicar 015/016 si faltan.
- ⏳ `npm audit` avisa de vulnerabilidades en dependencias de desarrollo (babel, vitest/mocker, brace-expansion, browserslist). No llegan al navegador; revisar con `npm audit fix` en una sesión aparte.

### Resumen de dirección (dashboard de CEO) — 2026-09-13

Petición de José: dashboard limpio para CEO con **Ventas** (leads nuevos, ventas cerradas = contrato firmado + primer pago, citas agendadas, tasa de asistencia, contactabilidad y mediana hasta primer contacto), **Marketing** (campañas y anuncios ganadores/perdedores) y **Expedientes** (pendientes de documentación, presentados, presentados +3 meses sin notificación del juzgado con lista de alertas, ganados, desestimados y tasa de éxito). Solo admin/owner. Periodos: este mes, mes anterior, 90 días y año, siempre comparados con el periodo anterior equivalente.
- `migration-022-ceo-dashboard.sql`: `contacts.contacted_at` (trigger al salir de "lead"), `contract_signed_at`, UTM y campaña/anuncio de Meta; `events.attendance`; `cases.filed_at` (trigger al pasar a presentado), `last_court_notice_at`, `outcome` (won/partial/dismissed/withdrawn), `resolved_at`; tabla `marketing_spend` (solo escribe service_role); RPC `ceo_summary(desde, hasta)` SECURITY INVOKER que exige rol admin/owner. Probada con 15 casos en PGlite (dos despachos, RLS y roles).
- Pantallas: pestaña **Resumen** en el dashboard (`src/admin/dashboard/ResumenCEO.jsx`), ventana **Juzgado** en cada expediente (`CaseJudicialModal.jsx`), botones **Asistió / No asistió** en reuniones y llamadas pasadas de la agenda, campo **Contrato firmado** y campaña de origen en la ficha del contacto. `webhook-meta-leads` pide `campaign_id/name` y `ad_id/name` de cada lead (sin desplegar hasta conectar Meta).
- ⏳ Falta para Marketing completo: conectar la cuenta publicitaria de Meta y sincronizar el gasto diario en `marketing_spend` (coste por lead y por venta); capturar UTM en el formulario web cuando exista el punto de entrada de leads.

### Publicación de la web (2026-09-13)

Vercel está **conectado a GitHub**: cada `git push` a `main` publica lexdocs-crm.vercel.app en producción (hay alias `lexdocs-crm-git-main-…`). El despliegue manual con `npx vercel deploy --prod` responde ahora "Not authorized". Login con casilla "Mostrar contraseña" y email normalizado, publicado y comprobado.

### Transferencia de la Página "Libredeuda Abogados" a Grupo Libredeuda — pendiente, sin resolver (2026-09-16)

La Página de Facebook `843251898879439` (la que recibe los leads de Meta Ads, vía el número 799950776118219 = negocio Pz Finanz SL) debería pasar a ser propiedad del portfolio **Grupo Libredeuda** (la sociedad actualmente responsable del negocio), según decisión de José. Se intentó 6 veces desde Configuración del negocio → Grupo Libredeuda → Páginas → Agregar → "Agregar una página de Facebook existente" y fallaron por motivos distintos, resueltos en cadena:

1. **Bloqueada por un conjunto de datos de eventos vinculado** (`Datos formulario_MVP_Test_11-25`, ID `1321742036359862`, sin recibir eventos). Se resolvió: Configuración → Pz Finanz SL → Orígenes de datos → Conjuntos de datos y píxeles → ese dataset → botón "..." → **Desvincular página**. Esto ya está hecho.
2. Tras resolver (1), la solicitud se sigue colgando indefinidamente al confirmar (el perfil de Instagram vinculado `@libredeudaabogados` se pide autenticar en el mismo paso). Probado desde José el mismo navegador con inicio de sesión de Instagram: el error real es **"No puedes reclamar esta página porque no eres administrador o solo tienes acceso a través de una agencia."**

**Causa raíz identificada:** José (como Alberto Ayarza) tiene "acceso total" a la Página **vía asignación de tareas del Business Manager** (Pz Finanz SL), pero no el **rol clásico de Administrador de la Página** de Facebook que este flujo de reclamar/transferir exige. Son dos sistemas de permisos distintos en Meta.

**Pendiente para retomarlo:** añadir a José como Administrador clásico de la Página desde la configuración de la propia Página en Facebook (Ajustes de la Página → Acceso a la Página, no desde Business Suite/Configuración del negocio), y reintentar la transferencia desde ahí. Alternativa: contactar con soporte de Meta.

**Mientras tanto:** el acceso de tareas (Acceso total) que ya existe en Pz Finanz SL es suficiente para generar tokens y configurar el webhook de leads sin depender de esta transferencia.

### Conexión con Meta (Meta Ads + WhatsApp) — en curso (2026-09-16)

Petición de José: conectar Meta (leads de anuncios) y después WhatsApp y email. Decisiones tomadas en esta sesión: WhatsApp va **directo con la Cloud API de Meta** (no vía GoHighLevel, para no perder margen de maniobra aunque se pierdan las plantillas ya creadas en GHL); "conectar Meta" incluye tanto **leads de Meta Ads** como **WhatsApp Business**. Meta no permite combinar los casos de uso "API de marketing" (leads) y "WhatsApp" en la misma app — hacen falta **dos apps de Meta separadas**.

**App de Meta creada:** `LexDocs`, App ID `2532426117236581`, vinculada al negocio **Grupo Libredeuda** (verificación de negocio ya completada, lo que evita la espera de Business Verification para poder enviar plantillas HSM más adelante). App Secret obtenido y **pendiente de guardar como `META_APP_SECRET`** en los secretos de Supabase (el comando `supabase secrets set` está bloqueado por el clasificador de permisos de Claude Code en esta sesión — hay que ejecutarlo a mano o ampliar el permiso).

**WhatsApp — Paso 2: Configurar webhooks → ✅ hecho y verificado.** `webhook-whatsapp` desplegada en producción con `--no-verify-jwt` (sin esto, el gateway de Supabase devuelve 401 antes de que la función vea la petición de Meta). URL registrada: `https://fmwmjxntbifqquyaddkx.supabase.co/functions/v1/webhook-whatsapp?tenant_slug=libredeuda`, verify token `libreapp_meta_2026`. Falta suscribir el campo `messages` del webhook (el toggle no se activó al probarlo; puede depender de tener ya un número de teléfono asociado).

**WhatsApp — número de prueba:** solicitado un número de prueba gratuito de Meta: `+1 (555) 148-3802`, Phone Number ID `1400774049775355`, WhatsApp Business Account ID `2555251991614325`. El botón "Generar token" del asistente nuevo de Meta falló repetidas veces sin dar error (posible bug de esa interfaz). Como alternativa, el Explorador de la API Graph (`developers.facebook.com/tools/explorer`) sí genera un token de usuario válido con los permisos `whatsapp_business_management` y `whatsapp_business_messaging` — pero es de corta duración (horas), solo sirve para pruebas puntuales, no para `WHATSAPP_TOKEN` en producción (hace falta un token permanente de System User).

**Pendiente, requiere intervención de José:**
- Guardar `META_APP_SECRET` en Supabase (bloqueado para Claude Code, ver arriba).
- Decidir el **número de teléfono real** para producción (José pidió "un número nuevo dedicado a LexDocs", aún sin concretar cuál) y verificarlo — ojo con el límite de intentos de Meta al verificar por SMS/llamada (si falla, esperar 1 hora completa antes de reintentar, ver lección aprendida en la skill `ghl-expert`).
- Crear un **System User** en Meta Business Suite (Configuración del negocio → Usuarios → Usuarios del sistema) para generar un `WHATSAPP_TOKEN` permanente, en vez de depender de tokens temporales del Explorador.
- Segunda app de Meta para el caso de uso "API de marketing" (leads de Meta Ads) — aún no creada.
- Desplegar `webhook-meta-leads` y `send-notification` (aún no están en producción) y configurar sus secretos (`META_PAGE_ACCESS_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`, `RESEND_API_KEY`).

### ⚠️ Contraseña provisional débil (2026-09-13)

José pidió poner a su cuenta de administrador de `lexdocs-prod` una **contraseña corta y fácil de adivinar** mientras se trabaja en fase de test. El cambio desde Claude Code quedó bloqueado por el sistema de permisos; si José la pone él mismo (SQL Editor), aplica este aviso (la contraseña no se anota aquí: el repositorio es público). La base de datos es la misma para la app local y para la web publicada. **Cambiarla por una robusta antes de introducir datos reales** y, idealmente, activar la verificación en dos pasos (TOTP o código por email).

### Fase 1 — seguridad barata (2026-09-11; activada en producción el 2026-09-12)

- ✅ `src/schema.test.js` (en `npm test`): falla si una tabla de public termina sin RLS, si una migración posterior a la 010 desactiva RLS, si una tabla creada después de la 019 no lleva `mfa_email_gate`, si hay huecos en la numeración o si `_bootstrap.sql` no está regenerado. Comprobado con una migración falsa.
- ✅ `migration-020-usage-limits-errors.sql`: `usage_counters` + `consume_usage()` (contador atómico por usuario/minuto, usuario/día y despacho/día; solo `service_role`) y `function_errors`. Probada con 8 casos en PGlite.
- ✅ `carlota-chat`: límite de uso (10/min por usuario; diario por usuario = `tenants.max_carlota_messages_per_day`; 1.000/día por despacho), petición ≤ 200.000 caracteres, registro de errores. **Corrige un fallo**: pedía `users.first_name`, que no existe, así que la consulta fallaba y trataba a todo el staff como cliente.
- ✅ `verify-document`: límite (10/min, 100/día por usuario; 1.000/día por despacho) y registro de errores.
- ✅ `Carlota.jsx`: si el servidor devuelve límite o error, muestra un mensaje claro en vez de una respuesta de demostración (que parecía consejo legal real).
- ✅ Todas las funciones cambiadas pasan `deno check`.
- ✅ **Activado el 2026-09-12 con el OK de José:** migración 020 aplicada (39 tablas, 0 sin RLS, 39 con `mfa_email_gate`; `consume_usage` no ejecutable por `authenticated`); `carlota-chat` y `verify-document` desplegadas. `carlota-chat` responde 401 sin registrar en `function_errors` (antes cualquier petición anónima dejaba una fila). Commits subidos a GitHub.
- ⏳ **Falta republicar la web** para que el nuevo `Carlota.jsx` (mensajes de límite/error) y el token de sesión en las llamadas lleguen a producción: `npx vercel deploy --prod` (bloqueado por permisos en la sesión; lo lanza José o lo autoriza de forma explícita).
- ✅ `send-notification`, `gcal-check-availability` y `gcal-sync-event` exigen usuario con despacho y solo actúan dentro de él; `web-push-send` solo acepta llamadas internas (`_shared/llamador.ts`). Los 5 puntos de la app que las llaman envían ya el token de sesión, no la anon key. `deno check` OK salvo un aviso de tipos de la librería `web-push` que ya existía antes.
- ⏳ Falta de la Fase 1: alertas cuando `function_errors` reciba errores.

### Arreglos de lo roto (2026-09-11)

- ✅ **Datos iniciales cargados en `lexdocs-prod`** con el nuevo `supabase/_seed_despacho.sql` (script manual y re-ejecutable): 1 embudo con 5 etapas y 66 tipos de documento (30 LSO + 36 concurso). Sin usuarios ni datos de demostración.
- ✅ **`verify-document` protegida y desplegada**: exige la sesión del usuario (y el MFA por email, si está activo) y limita la imagen. `ClientApp.jsx` ahora le envía el token de sesión en vez de la anon key. Probado: sin sesión responde 401.
- ✅ **"Crear despacho gratis" oculto** (`ALTA_DESPACHOS_ACTIVA = false` en `App.jsx`) hasta la Fase 2.
- ✅ **Proyecto ajeno `agzcaq…` eliminado** de `ApiKeys.jsx`, `Integrations.jsx` y de los comentarios de los webhooks; se usa `VITE_SUPABASE_URL`.
- ✅ **Formulario web, Zapier y API REST marcados como "Próximamente"**, con aviso en pantalla: escriben en PostgREST con la anon key (RLS lo impide) y el formulario llevaba fijo el `org_id` de demostración. Hace falta una Edge Function de entrada de leads que valide la clave de API.
- ✅ **Web publicada arreglada**: Vercel no tenía `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY` (la dirección del proyecto ajeno venía fija en el código). Añadidas en Production (la anon key como `--type config`, pública a propósito) y publicada la versión de `main` desde la CLI (`npx vercel deploy --prod`). El proyecto de Vercel **no está conectado a GitHub**: se publica a mano desde la CLI. `.vercelignore` impide subir `.env*`, `server/`, `supabase/`, etc. Verificado: el bundle apunta a `fmwmjxntbifqquyaddkx`, el login carga sin errores y no contiene secretos.
- ⏳ Revisar en Supabase → Authentication → URL Configuration que el Site URL sea `https://lexdocs-crm.vercel.app` (afecta a los enlaces de "¿Olvidaste tu contraseña?").

### Estado real de producción (2026-09-11)

- 🔴 **La web publicada (lexdocs-crm.vercel.app) está rota**: su bundle apunta a `agzcaqgxlyrtbxtyxkwp.supabase.co`, que ya no existe (no resuelve DNS). Hay que cambiar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel para que apunten a `lexdocs-prod` y republicar.
- 🔴 **`lexdocs-prod` está casi vacío**: 1 tenant, 1 organización, 1 usuario; 0 `document_types`, 0 `pipelines`, 0 contactos y expedientes, 0 `legislation`/`jurisprudence`. `seed.sql` nunca se aplicó. Ojo: `seed.sql` también crea usuarios de Auth con contraseña `admin1234`; hay que aplicar solo la parte de datos.
- `app.libredeudaabogados.com` no resuelve.
- Mapa visual completo (árbol, arquitectura, arreglos y fases): https://claude.ai/code/artifact/ac79aca3-6d89-4ee0-bb78-abb8ec531290

### MFA por email (2026-09-11)

**Desplegado el 2026-09-11**: migración 019 aplicada en `lexdocs-prod` (37 tablas con `mfa_email_gate`); `mfa-email`, `carlota-chat` y `ai-lead-scorer` desplegadas. Falta el secreto `RESEND_API_KEY` y publicar el frontend en Vercel. Hecho en código: `migration-019-mfa-email.sql`, Edge Function `mfa-email`, `_shared/mfaEmail.ts` (añadido a `carlota-chat`, `ai-lead-scorer`, `pay-installment`, `stripe-checkout`, `ai-agent-respond` y `automation-runner`), pantalla de código en el login (`App.jsx`) y tarjeta en Configuración → Seguridad. Probado con 17 casos sobre PGlite (Postgres en WASM) que imita Supabase: sin código no se ve nada, con código solo lo del propio despacho, y el navegador no puede desactivarlo por su cuenta. **Orden de despliegue:** migración 019 → `mfa-email` + redeploy de `carlota-chat` y `ai-lead-scorer` → secreto `RESEND_API_KEY`. Si una función que importa `_shared/mfaEmail.ts` se despliega antes que la migración, falla cerrada y bloquea su uso.

Descubierto en producción al preparar el despliegue:
- Solo 3 de 17 Edge Functions están desplegadas (`carlota-chat`, `ai-lead-scorer`, `verify-document`).
- Secretos configurados: solo `ANTHROPIC_API_KEY` (más los automáticos de Supabase). Falta Resend, Stripe, Meta, WhatsApp, VAPID, CRON, etc.
- 🔴 `verify-document`, `send-notification`, `web-push-send`, `gcal-check-availability` y `gcal-sync-event` no comprueban quién las llama (ver `SECURITY.md` §6). `verify-document` está desplegada.
- El formulario de alta muestra un plan "Premium 139 €/mes/letrado" que no coincide con el modelo comercial (49 € / 79 €).

## Decisiones ya tomadas (no reabrir sin motivo)

- Serverless: Vercel + Supabase, sin servidores propios. Workers como scripts.
- Un solo repositorio, una sola SPA con tres módulos, sin router de rutas (navegación por estado).
- Esquema versionado con migraciones numeradas + `_bootstrap.sql` regenerado.
- Cuentas demo solo con `VITE_DEMO_MODE=true`.
- Modelo comercial: venta directa a despachos con alta self-service. **Sin agencia distribuidora** (decisión de José, 2026-09-12).
- **Planes (decisión de José, 2026-09-12; pendiente de ajustes tras el análisis):** Starter 89 €/mes (1 usuario), Company 149 €/mes (hasta 3), Top 10 349 €/mes (hasta 10), y "a medida" para más de 10 (contacto). Pago mensual con opción anual "2 meses gratis" (= 10 mensualidades). Solo cuentan como usuarios los roles del despacho (admin, owner, lawyer, staff, sales, procurador), no los clientes (trigger de `migration-014`).
- **Catálogo implementado en código (2026-09-12, sin desplegar):** `src/lib/planes.js` (app) y `supabase/functions/_shared/planes.ts` (Stripe), comprobados iguales por `src/planes.test.js`. **Team = hasta 5 usuarios a 229 €** (confirmado por José el 2026-09-12). Anual = 10 mensualidades. Precios "+ IVA"; cómo se cobra el IVA (Stripe Tax o tipo fijo) se decide al configurar Stripe. `BillingSettings.jsx` rehecho: interruptor Mensual/Anual con "¡2 meses gratis!", 4 planes, garantía de 14 días y plan A medida con botón de WhatsApp (número en `VITE_WHATSAPP_VENTAS`, pendiente). `stripe-checkout` cobra un plan por línea y pide dirección y NIF; `stripe-webhook` fija `license_count` según el plan. **`migration-021`** admite los planes nuevos y los estados `incomplete_expired`/`paused` de Stripe (antes el webhook habría fallado al guardar "team" o "individual"); probada en PGlite, **sin aplicar**.
- ⏳ Con Stripe (pendiente de que José cree la cuenta): aplicar la 021, desplegar `stripe-checkout` y `stripe-webhook`, crear el webhook en Stripe, decidir el IVA, flujo de devolución en 14 días y alta self-service (`tenant-signup`).
- **Alta:** se paga al darse de alta, con garantía de devolución de 14 días. **Primer servicio a conectar: Stripe.** Sustituye a los planes antiguos del código (Individual/Team en `BillingSettings.jsx` y `stripe-checkout`; 139 € en `Onboarding.jsx`).
- ✅ **IA migrada a Claude Opus 5** (decisión de José, 2026-09-12): `carlota-chat` y `verify-document` dejan `claude-sonnet-4-20250514` (deprecado) y usan el SDK oficial (`npm:@anthropic-ai/sdk@0.125.0`) desde `_shared/claude.ts`, con `effort: "medium"`, `max_tokens` ampliado (Opus 5 piensa por defecto) y `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) para que un rechazo de los clasificadores de seguridad se reintente en otro modelo. Se trata `stop_reason: "refusal"`. `verify-document` usa salida estructurada (JSON Schema) y manda a revisión manual los formatos que Claude no acepta (p. ej. HEIC). Carlota: instrucción de brevedad y tono correcto para `owner`/`procurador`; guardarraíles legales sin tocar.
- ✅ **Carlota acepta fotos y PDF** (petición de José, 2026-09-12): botón de clip en el chat, hasta 3 archivos y 6 MB por mensaje (JPG, PNG, GIF, WebP, PDF). No se guardan: van solo con el mensaje en que se adjuntan; en el historial queda una nota con el nombre. Límite aparte `carlota-adjuntos` (5/min y 30/día por usuario, 300/día por despacho). Regla nueva en el prompt, coherente con las PROHIBICIONES: identifica el documento, si corresponde y si es legible, pero no lo interpreta jurídicamente ni repite datos personales. `carlota-chat` desplegada.
- ⏳ **Bandeja de conversaciones (petición de José, 2026-09-12):** todo lo de WhatsApp Business y email, guardado en cada contacto como histórico. Fases: A) base unificada (conversaciones + mensajes por canal, sección "Conversaciones", pestaña en la ficha del contacto, mensajes del portal dentro); B) WhatsApp; C) email; D) Carlota resume y propone respuestas. Hoy hay piezas sueltas: `webhook-whatsapp` guarda lo entrante en `contacts.notes_text` y en `messages` (tabla del portal); `send-notification` envía plantillas; `ai_conversations`/`ai_messages` para agentes. Pendiente de decisión: WhatsApp vía GHL, directo con Meta o ambos (el número de LibreDeuda vive en GoHighLevel con +30 plantillas y un bot de cualificación); email vía Gmail/Outlook, dirección de captura o solo lo enviado desde LibreApp.
- ⏳ **Automatización "WhatsApp de bienvenida al lead"** (petición de José, 2026-09-12). Texto: "¡Hola {{nombre}}! Gracias por contactar a LibreDeuda. Recibimos tu solicitud para informarte sobre la Ley de Segunda Oportunidad. Por favor, confírmanos: ¿Tienes deudas con más de un acreedor o entidad (bancos, tarjetas, financieras, etc.)?". Debe ser **plantilla aprobada por Meta** (el lead no ha escrito antes). Huecos detectados: `automation-runner` envía WhatsApp como texto libre (no plantilla con variables); nadie dispara el trigger `contact_created` (ni `webhook-meta-leads`, ni `webhook-whatsapp`, ni el alta manual); motor y WhatsApp sin desplegar ni configurar. Comprobar antes si ya existe en GHL (plantillas/workflows). **Decisiones de José (2026-09-12):** los leads entran por formulario web y anuncios de Meta; plantilla aprobada con dos botones de respuesta ("Sí, con varios" / "No, solo con uno"); **cada lead nuevo se asigna siempre al admin, y al admin le llegan un email y un WhatsApp avisando del lead nuevo**.
- ✅ **Dictado por voz en Carlota** (2026-09-12): botón de micrófono con el reconocimiento del navegador (`es-ES`, Chrome/Edge/Safari; en Firefox no aparece). No pasa por LibreApp ni por Anthropic (en Chrome lo procesa Google).
- ✅ **Adjuntos ampliados** (petición de José, 2026-09-12): PDF, Word (.docx), Excel (.xlsx, .xls, .ods), CSV, TXT y fotos (JPG, PNG, WebP, GIF). Word y Excel se convierten a texto en el navegador (`src/lib/adjuntos.js`, con `mammoth` y SheetJS 0.20.3 desde cdn.sheetjs.com, porque la versión de npm tiene fallos de seguridad al abrir archivos manipulados); se cargan solo al adjuntar uno. Más de 200.000 caracteres por archivo: se avisa en vez de leerlo a medias. `.doc` antiguo: se pide guardarlo como .docx o PDF. Tests en `src/adjuntos.test.js`.
- ✅ **Carlota en dos niveles** (decisión de José, 2026-09-12): *usuario* (clientes, restricciones de siempre) y *despacho* (lee e interpreta documentos, redacta borradores de escritos y demandas, `effort: "high"`, 20 mensajes de historial y documentos disponibles durante la conversación con caché de prompt). Burbuja abajo a la derecha con el texto "Pregúntale a la IA" en los dos niveles; en el panel del despacho, además, la sección **Asistente IA Legal** del menú (página completa, copiar respuesta, conversación nueva). CLAUDE.md regla 4 actualizada.
- ⏳ **Pendiente de decisión de José:** (1) audios: dictado por voz en el navegador o notas de voz transcritas por un proveedor externo (nuevo subencargado RGPD); (2) ~~análisis a fondo para el despacho~~ → sí, nivel despacho; (3) ~~Word/Excel~~ → hecho.
- ℹ️ `ai-lead-scorer`, `ai-agent-respond` y `automation-runner` siguen con `claude-sonnet-4-5-20250929` (activo) y `fetch` directo: migrarlas al cliente común cuando se toquen.
- ⏳ Pendiente, necesita la cuenta de Meta: **bot de WhatsApp para el plan a medida** que cualifica y perfila al despacho interesado (reutilizar `webhook-whatsapp` + `ai-agent-respond`).

## Puntos de duda a resolver con José antes de codificar

1. ~~¿Sigue en pie la agencia externa como canal principal?~~ **No** (2026-09-12). La prioridad comercial es el alta self-service de despachos (Fase 2); Agency Master queda descartado.
2. ¿El proyecto Supabase `ujhulpkcllrcgftqeelx` se puede borrar?
3. ¿Hay ya despachos reales (aparte de LibreDeuda) con datos en `lexdocs-prod`? Condiciona cuánto cuidado hace falta con las migraciones.
4. ¿Se mantiene `libertadhipotecaria/` dentro de este repositorio o se mueve al suyo?
5. ¿Qué es el proyecto Supabase `agzcaqgxlyrtbxtyxkwp` que aparece en `ApiKeys.jsx` e `Integrations.jsx`?
6. ~~¿Existen en producción las cuentas `carlos@`/`ana@`/`laura@libredeuda.com` con `admin1234`?~~ **No** (verificado el 2026-09-11: `lexdocs-prod` tiene un único usuario, `libredeudaabogados@gmail.com`, admin de `libredeuda`, sin MFA).
