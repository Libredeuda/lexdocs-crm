# Seguridad e Infraestructura — LexDocs / LibreApp

Documento de referencia de la postura de seguridad. Define **servidores, protección
y aislamiento** del SaaS legal multi-tenant. Es la base del compromiso de seguridad
frente a los despachos que compran licencias (nivel DPA).

Estado: `✅ hecho` · `⚠️ parcial` · `❌ pendiente`. Última revisión: 2026-09-11.

---

## 1. Alcance y modelo de responsabilidad compartida

LexDocs es **serverless**: no operamos servidores propios. La infraestructura la
gestionan proveedores; nosotros somos responsables de su **configuración** y del
**código de aplicación**.

| Capa | Proveedor | Gestiona el proveedor | Gestionamos nosotros |
|---|---|---|---|
| Frontend (SPA) | **Vercel** | TLS, CDN, edge, DDoS L3/L4 | headers/CSP, qué vars se publican |
| BBDD + Auth + Storage + Edge Functions | **Supabase** (AWS eu-west-1) | cifrado en reposo, parches Postgres, backups | RLS, secretos, roles, policies |
| Pagos | **Stripe** | PCI-DSS, datos de tarjeta | webhooks firmados, claves |
| IA | **Anthropic** | modelo, infra | clave server-side, no exponerla |
| Email | **Resend** | entrega | clave server-side |
| Workers sync (BOE/CENDOJ) | scripts Node manuales | — | ejecución, credenciales |

**Frontera de confianza clave:** el navegador es **hostil**. Solo recibe valores
públicos (`VITE_*`: URL Supabase, anon key, clave publicable de Stripe, VAPID
pública). Todo secreto vive server-side (Edge Functions / Supabase secrets).

---

## 2. Topología y fronteras de confianza

```
[ Navegador ]  --HTTPS-->  [ Vercel CDN: SPA estática ]
     |  (anon key + JWT de usuario)
     v
[ Supabase ]
   ├─ Auth (JWT)                         ← identidad
   ├─ PostgREST + RLS                    ← TODO acceso a datos pasa por RLS
   ├─ Storage (bucket privado, signed URLs)
   └─ Edge Functions (Deno)              ← única superficie con service_role
        ├─ públicas: webhooks (Stripe/Meta/WhatsApp) — firma HMAC
        └─ con sesión: carlota-chat, ai-lead-scorer, verify-document, mfa-email, ...
[ pg_cron ] --X-Cron-Secret--> crons (recordatorios, renovaciones, automations)
[ Workers ] --service_role--> tablas legislation/jurisprudence (manual/cron)
```

Regla de oro: **el cliente nunca habla con service_role**. El `service_role` solo
existe dentro de Edge Functions/workers y **bypassa RLS**, por lo que toda función
que lo use DEBE validar el `org_id` del llamador antes de tocar datos.

---

## 3. Aislamiento multi-tenant (la garantía que vendemos)

Es la propiedad de seguridad central: **ningún despacho puede ver datos de otro.**

- ✅ **RLS habilitado en las 35 tablas** con `org_id`/`tenant_id`, vía helpers
  `auth_org_id()` / `auth_tenant_id()` (`SECURITY DEFINER`, `STABLE`).
- ✅ **Storage aislado por `org_id`** en el path (`migration-011`), bucket privado.
- ✅ **Edge Functions con service_role validan `org_id`** del llamador
  (stripe-webhook, pay-installment, ai-agent-respond, **ai-lead-scorer** ya
  corregida — antes era un IDOR cross-tenant).
- ✅ **Migraciones 015 + 016 aplicadas** en prod (verificado el 2026-09-11).
- ✅ **Verificación automatizada de RLS**: `src/schema.test.js` en `npm test` (RLS al final de las
  migraciones, `mfa_email_gate` en tablas nuevas, `_bootstrap.sql` al día).

---

## 4. Gestión de secretos

**Clasificación:**
- *Público (puede ir al bundle, prefijo `VITE_`)*: URL Supabase, anon key, clave
  publicable Stripe (`pk_`), VAPID pública.
- *Secreto (SOLO server-side, `supabase secrets set`)*: `SUPABASE_SERVICE_ROLE_KEY`,
  `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `META_APP_SECRET`,
  `META_PAGE_ACCESS_TOKEN`, `WHATSAPP_TOKEN`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`,
  `CRON_SECRET`, `INTERNAL_FUNCTION_SECRET`, `GOOGLE_CLIENT_SECRET`.

**Estado / acciones:**
- 🔴 **`VITE_ANTHROPIC_API_KEY` estaba viva en `.env`** → eliminada del `.env`.
  **ACCIÓN MANUAL: revocar y rotar esa clave en console.anthropic.com** (se considera
  comprometida). La de Anthropic solo debe existir como secret de Edge Function.
- ✅ `.env` y `supabase/.temp/` en `.gitignore` (no se versionan).
- ✅ Webhooks/crons *fail-closed* si falta su secreto (salvo `ALLOW_INSECURE_WEBHOOKS`
  que **nunca** debe estar a `true` en prod).
- ❌ **Política de rotación documentada** (objetivo: rotar service_role y claves de
  API cada 90 días; runbook de rotación de emergencia ante fuga). Pendiente.
- ✅ Sin URLs de proyecto fijas en el código: `ApiKeys.jsx`/`Integrations.jsx` usan `VITE_SUPABASE_URL`
  (antes apuntaban a un proyecto ajeno, `agzcaq…`, ya inexistente; corregido el 2026-09-11).
- ✅ Vercel: solo `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (tipo *config*, pública a propósito) y
  `VITE_GOOGLE_CLIENT_ID`. `.vercelignore` impide subir `.env*` en los despliegues desde la CLI.

---

## 5. Autenticación y control de acceso

- ✅ Supabase Auth (JWT) como fuente de identidad; RLS deriva permisos del JWT.
- ⚠️ **API keys de tenant hasheadas** (`key_hash` + `key_prefix`, nunca raw) con
  permisos y revocación (`is_active`), pero **ninguna función las valida todavía**: la API REST no
  está activa (la pantalla lo avisa). *Falta el punto de entrada, expiración y auditoría de uso.*
- ✅ **Cuentas DEMO** (`src/demoUsers.js`) solo con `VITE_DEMO_MODE=true`; el build de producción no
  contiene `admin1234` ni `maria@demo.com` (verificado en el bundle publicado el 2026-09-11).
  `seed.sql` sigue creando usuarios con `admin1234`: **no ejecutarlo en producción** (usar
  `_seed_despacho.sql`). Producción solo tiene la cuenta del administrador.
- ⚠️ **MFA/2FA** (opt-in por usuario, sin forzar todavía):
  - TOTP (app de autenticación) vía Supabase Auth → sesión `aal2`.
  - **Código por email** (`migration-019` + Edge Function `mfa-email`): el código (hash, 10 min,
    5 intentos, 1 envío/min y 5/15 min) se liga al `session_id` del JWT. Una política
    **RESTRICTIVA** `mfa_email_gate` en todas las tablas de `public` y en `storage.objects`
    exige `mfa_email_ok()`, así que una sesión con contraseña pero sin código no lee ni escribe
    nada aunque hable directamente con PostgREST. Las Edge Functions con `service_role` que
    actúan por un usuario lo comprueban con `_shared/mfaEmail.ts`. **Toda tabla nueva debe
    añadir su `mfa_email_gate`.** Necesita `RESEND_API_KEY`.
  - Pendiente: hacerlo obligatorio para staff (admin/lawyer).
- ❌ **Rate limiting / lockout de login** (anti fuerza bruta). Pendiente.
- ❌ **Timeout de sesión** e indicios de sesión concurrente. Pendiente.

---

## 6. Superficie pública / Edge Functions

- ✅ Webhooks validan **firma HMAC** (Stripe `Stripe-Signature`, Meta `X-Hub-Signature-256`).
- ✅ Funciones con sesión validan JWT + `org_id`. `send-notification`, `gcal-check-availability` y
  `gcal-sync-event` (antes abiertas: el gateway acepta la anon key como JWT) usan desde el 2026-09-11
  `_shared/llamador.ts` y solo actúan dentro del despacho del llamador; `web-push-send` solo acepta
  llamadas internas (service_role o `X-Internal-Secret`). El frontend envía el token de sesión.
  Sin desplegar (no lo estaban).
  `verify-document` se corrigió y desplegó el 2026-09-11 (exige sesión de usuario y limita la imagen a ~5 MB).
- ⚠️ **Rate limiting** en funciones de IA: **hecho en código, sin desplegar** (migration-020
  `consume_usage` + `_shared/limites.ts`): `carlota-chat` y `verify-document` limitan por usuario
  (minuto y día) y por despacho (día) antes de llamar a Anthropic. Si el contador falla, deja pasar
  (no tumba el servicio). Webhooks: pendiente (límite por IP).
- ⚠️ **CORS `*`** en todas las funciones. Con JWT+org el riesgo baja, pero conviene
  restringir `Access-Control-Allow-Origin` al dominio del frontend.
- ⚠️ **Límite de tamaño de payload**: `verify-document` (imagen ≤ ~5 MB, desplegado) y `carlota-chat` (≤ 200.000 caracteres, sin desplegar).
- ⚠️ `tenant_slug` en querystring de webhooks de leads permite enumerar tenants.

---

## 7. Protección de datos y recuperación (DR)

- ✅ Cifrado **en tránsito** (HTTPS forzado por Vercel/Supabase) y **en reposo**
  (Supabase/AWS, discos cifrados).
- ✅ Storage **privado** + signed URLs. → *documentar expiración máx. (≤ 1h).*
- ❌ **Backups / PITR documentados** (RPO/RTO). Verificar el tier de Supabase y
  documentar la ventana de recuperación. Pendiente → ver `DISASTER_RECOVERY.md`.
- ❌ **Política de retención y borrado RGPD** (expedientes, documentos rechazados,
  historial). Obligatorio (RGPD art. 5). Pendiente.
- ❌ **Derechos del interesado (acceso/supresión/portabilidad, art. 15/17/20)**:
  no hay export/borrado. Obligatorio antes de operar con datos reales.

---

## 8. Frontend (Vercel)

- ✅ **`vercel.json`** con headers: `Content-Security-Policy`, `Strict-Transport-Security`
  (HSTS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`. CSP limita conexiones a Supabase y
  fuentes a Google Fonts. *Validar tras el primer deploy; si algo se rompe, pasar a
  `Content-Security-Policy-Report-Only` temporalmente.*
- ✅ Sin source maps en producción (Vite build, default off).
- ✅ Sin secretos en el bundle (verificado: ni service_role ni claves privadas).

---

## 9. Detección, logging y respuesta a incidentes

- ⚠️ Tabla `activities` sirve de traza funcional, **no de audit log de seguridad**.
- ❌ **Audit log de seguridad** (logins, accesos a datos sensibles, cambios de
  permisos, uso de service_role) con IP/user-agent. Pendiente.
- ⚠️ **Error tracking**: tabla `function_errors` + `_shared/errores.ts` (migration-020, sin desplegar),
  usada por `carlota-chat` y `verify-document`. Faltan alertas y extenderlo al resto de funciones.
- ❌ **Filtrado de PII/secretos en logs** (`console.log` en Edge Functions). Pendiente.
- ❌ **Runbook de respuesta a incidentes** + **notificación de brecha RGPD (72h)**.
  Pendiente → ver `INCIDENT_RESPONSE.md`.

---

## 10. Cumplimiento (RGPD)

Datos personales sensibles (clientes, deudas, expedientes). Antes de vender licencias:
- Registro de actividades de tratamiento; base jurídica.
- **DPA** con cada despacho (somos encargado del tratamiento) y lista de
  **subencargados** (Supabase, Vercel, Stripe, Anthropic, Resend, Meta).
- Derechos ARCO operativos (ver §7).
- Procedimiento de notificación de brechas (72h) (ver §9).

---

## 11. Checklist de hardening priorizado

### 🔴 P0 — antes del primer cliente de pago
- [ ] **Revocar + rotar** la clave Anthropic comprometida (manual, Anthropic console).
- [x] Eliminar credenciales DEMO del bundle de producción (detrás de `VITE_DEMO_MODE`).
- [x] Cerrar IDOR cross-tenant en `ai-lead-scorer` (auth + `org_id`).
- [x] Aplicar migraciones 015 + 016 en prod (verificado 2026-09-11; 001–019 aplicadas).
- [ ] Configurar **todos** los secrets de Edge Functions en el proyecto Supabase.
- [ ] Programar los **crons** (recordatorios, renovaciones, dunning) — hoy no corren.
- [ ] **MFA** obligatorio para staff + rate limiting/lockout de login. *(MFA por email y TOTP ya disponibles opt-in)*
- [x] Autenticar al llamador en `verify-document` (2026-09-11).
- [x] Autenticar al llamador en `send-notification`, `web-push-send`, `gcal-check-availability`, `gcal-sync-event` (código, 2026-09-11).
- [ ] Derechos RGPD (export/borrado) + política de retención + DPA.

### 🟠 P1 — antes de escalar
- [x] Security headers + CSP (`vercel.json`).
- [~] Rate limiting + límite de payload en Edge Functions de IA (código listo, migration-020 sin aplicar); webhooks pendiente.
- [ ] Restringir CORS al dominio del frontend.
- [ ] Audit log de seguridad + error tracking (Sentry) + alertas.
- [ ] Backups/PITR documentados (`DISASTER_RECOVERY.md`).
- [ ] CI/CD que valide lint/test/build en cada push.
- [ ] MFA en las cuentas proveedoras (Supabase/Vercel/Stripe).

### 🟡 P2 — mejora continua
- [ ] Expiración + auditoría de uso de API keys de tenant.
- [ ] Network Restrictions del proyecto Supabase (whitelist IPs).
- [x] Test automatizado de cobertura RLS para tablas nuevas (`src/schema.test.js`, en `npm test`).
- [ ] Rotación documentada de secretos (90 días) + runbook.
- [ ] Timeout/gestión de sesiones concurrentes.

---

*Para reportar una vulnerabilidad: [definir buzón de seguridad].*
