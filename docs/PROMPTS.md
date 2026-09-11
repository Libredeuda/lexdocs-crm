# Prompts para Claude Code — LexDocs / LibreApp

Cómo usarlos: abre la terminal en la carpeta del repositorio, escribe `claude` y pega el prompt. Uno por sesión. No pases al siguiente hasta que el anterior termine con `npm run lint && npm test && npm run build` en verde y un commit.

## Antes de nada: poner el proyecto en tu Mac

```bash
# 1. Instalar Claude Code (una sola vez)
npm install -g @anthropic-ai/claude-code

# 2. Clonar el repositorio
cd ~/Desktop            # o la carpeta donde quieras tenerlo
git clone https://github.com/Libredeuda/lexdocs-crm.git
cd lexdocs-crm

# 3. Copiar CLAUDE.md y docs/ del paquete de traspaso a esta carpeta

# 4. Arrancar Claude Code
claude
```

Antes del prompt 1, reactiva el proyecto Supabase `lexdocs-prod` desde https://supabase.com/dashboard (está pausado por inactividad) y ten a mano su URL y anon key para el `.env`.

---

## Prompt 1 — Reconocimiento y saneamiento (no rompe nada)

```
Lee CLAUDE.md, SECURITY.md, docs/ESTADO.md y docs/ROADMAP.md antes de tocar nada.

Tarea de esta sesión: Fase 0 del roadmap. Haz esto en orden y para a preguntarme si algo no cuadra:

1. Recorre el repositorio y confirma o corrige lo que dice docs/ESTADO.md. Si encuentras algo construido que no está documentado, o algo documentado que no existe, anótalo en ESTADO.md.
2. Saca node_modules/ y dist/ del índice de git sin borrarlos del disco (git rm -r --cached). Arregla la dependencia vitest para que npm ls no marque nada como UNMET.
3. Crea .env a partir de .env.example con la URL y anon key del proyecto Supabase lexdocs-prod que te voy a dar cuando me lo pidas. No pongas ningún secreto en ningún archivo trackeado.
4. Arranca npm run dev y confírmame que la pantalla de login carga sin errores en consola. Si falla, diagnostica y explícamelo en castellano llano.
5. Ejecuta npm run lint, npm test y npm run build. Arregla solo lo que impida que pasen; no refactorices.
6. Haz un commit con mensaje en castellano describiendo el saneamiento.

Al terminar, dame un resumen de tres líneas: qué funciona, qué has cambiado y qué te preocupa.
```

## Prompt 2 — Comprobar producción y migraciones pendientes

```
Contexto en CLAUDE.md y docs/ESTADO.md.

Necesito saber si el esquema de producción (Supabase lexdocs-prod) coincide con supabase/_bootstrap.sql. Usa la CLI de Supabase (supabase link --project-ref fmwmjxntbifqquyaddkx) o, si prefieres, prepara las consultas SQL que yo ejecutaré en el editor SQL del panel y me pides los resultados.

Quiero saber:
1. Qué migraciones de supabase/migration-0XX están aplicadas y cuáles no (en especial 015 y 016).
2. Si hay tablas del esquema public sin RLS activado.
3. Cuántos tenants, organizations y users reales hay (sin mostrarme datos personales, solo recuentos).

Con eso, propón un plan para aplicar lo que falte. No apliques nada en producción sin que yo diga "adelante".
```

## Prompt 3 — Test de RLS y rate limiting (Fase 1)

```
Contexto en CLAUDE.md, SECURITY.md y docs/ROADMAP.md (Fase 1).

Implementa en esta sesión:

1. Un test que falle si alguna tabla del esquema public queda sin RLS. Puede ser un test de Vitest que parsea supabase/_bootstrap.sql y comprueba que cada CREATE TABLE tiene su ALTER TABLE ... ENABLE ROW LEVEL SECURITY, más una consulta SQL equivalente documentada en SECURITY.md para ejecutar contra producción.
2. Rate limiting en las Edge Functions carlota-chat y verify-document: nueva migración 019 con tabla usage_counters (org_id, user_id, function_name, window_start, count), helper en Deno compartido entre funciones, límites configurables por variable de entorno con valores por defecto sensatos (por ejemplo 30 llamadas por usuario y minuto, 500 por org y día). Al superar el límite, responder 429 con un mensaje en castellano que el frontend muestre de forma amable.
3. Límite de tamaño de cuerpo en esas dos funciones (rechazar por encima de 5 MB en verify-document y 32 KB en carlota-chat).
4. Actualiza SECURITY.md marcando como hecho lo que quede resuelto, regenera _bootstrap.sql con _generate_bootstrap.py y añade las variables nuevas a .env.example.

Explícame cada decisión en dos frases como si yo no fuera programador. Commit al terminar.
```

## Prompt 4 — Alta self-service de despachos (Fase 2)

```
Contexto en CLAUDE.md y docs/ROADMAP.md (Fase 2). Modelo comercial: precio fundador 49 €/mes de por vida para los primeros 100 despachos, precio público 79 €/mes. Planes ya existentes en BillingSettings.jsx y stripe-checkout.

Construye el flujo de alta de un despacho nuevo sin intervención manual:

1. Pantalla pública de registro accesible desde el login ("¿Eres un despacho? Crea tu cuenta"): nombre del despacho, slug (autogenerado y editable, validado), nombre y email del administrador, elección de plan. Estilo coherente con Login.jsx.
2. Edge Function tenant-signup que, en una transacción: crea tenant + organization + usuario admin en Supabase Auth (invitación por email), inicia el periodo de prueba y devuelve la URL de Stripe Checkout. Valida que el slug no exista. Sin service_role expuesto al cliente.
3. Email de bienvenida por Resend con enlace para fijar contraseña (reutiliza send-notification si encaja).
4. Primer arranque del admin: asistente de tres pasos (logo y colores, invitar equipo, crear primer expediente de prueba) usando OrgSettings y TeamMembers existentes.
5. Test de que dos tenants creados así no ven nada el uno del otro.

Primero enséñame el plan en diez líneas y espera mi confirmación antes de escribir código.
```

## Prompt 5 — Agency Master (Fase 3)

```
Contexto en CLAUDE.md, docs/ESTADO.md y docs/ROADMAP.md (Fase 3). Restricción absoluta: un usuario de agencia NUNCA puede leer contenido de expedientes (documents, messages, notes, carlota_messages, storage). Solo metadatos y facturación.

Diseña e implementa la capa Agency Master por etapas, pidiéndome confirmación al final de cada una:

Etapa A — Migración 019 (o la siguiente libre): tablas agencies y agency_users, columna agency_id en tenants, rol agency_admin, políticas RLS para que la agencia lea tenants, organizations, users (solo nombre/email/rol), payments y recuentos de cases, y NINGUNA otra tabla. Escribe un test SQL que demuestre que agency_admin recibe cero filas de documents.

Etapa B — Dashboard de agencia en src/agency/: lista de despachos con estado de licencia, usuarios activos y facturación mensual agregada; botón para crear despacho (reutiliza tenant-signup); acceso solo si el usuario tiene rol agency_admin.

Etapa C — Marca blanca: campo branding en agencies (logo, colores, nombre comercial, dominio); TenantContext aplica la marca de la agencia cuando el tenant tiene agency_id y la agencia tiene white_label activo.

Etapa D — Stripe: producto Agency Master con cuota base y precio medido por sub-cuenta activa; stripe-webhook actualiza el recuento cada mes.

Actualiza SECURITY.md, .env.example y docs/ESTADO.md al terminar cada etapa.
```

## Prompt 6 — LexConsulta con búsqueda semántica (Fase 4)

```
Contexto en CLAUDE.md y docs/ROADMAP.md (Fase 4). Fuentes permitidas: solo BOE (API oficial) y CENDOJ (scraping respetuoso, con pausas). Nada de bases comerciales.

1. En server/src/workers, añade generación de embeddings con Cohere embed-multilingual-v3 (1024 dimensiones, coincide con las columnas embedding existentes) al insertar o actualizar filas en legislation y jurisprudence. Clave COHERE_API_KEY en server/.env.example.
2. RPC search_semantic(query_embedding vector, p_limit int) en una migración nueva, que combine similitud coseno con la búsqueda de texto completo en español ya existente, respetando RLS.
3. Edge Function lexconsulta-search que recibe texto, genera el embedding con Cohere (clave server-side) y llama a la RPC.
4. SearchView.jsx: búsqueda en lenguaje natural, resultados con fuente, fecha y enlace oficial, y botón "Preguntar a Carlota" que abre Carlota con el documento como contexto citado.
5. Dockerfile o railway.json para ejecutar run-sync.js cada noche en Railway.

Enséñame el plan antes de codificar.
```

## Prompt de mantenimiento (para cualquier sesión)

```
Lee CLAUDE.md y docs/ESTADO.md. Antes de hacer nada, dime en cinco líneas en qué estado está el proyecto y qué fase del roadmap toca. Luego espera mis instrucciones.
```
