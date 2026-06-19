# Seguridad e Infraestructura — LexDocs / LibreApp

Documento de referencia de la postura de seguridad. Define **servidores, protección
y aislamiento** del SaaS legal multi-tenant. Es la base del compromiso de seguridad
frente a los despachos que compran licencias (nivel DPA).

Estado: `✅ hecho` · `⚠️ parcial` · `❌ pendiente`. Última revisión: 2026-06-16.

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
        └─ con sesión: carlota-chat, ai-lead-scorer, verify-document, ...
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
- ⚠️ **Migraciones 015 + 016 sin aplicar**: 015 cierra el límite de licencias en
  `UPDATE`; 016 hace `search_history` privado por usuario. → aplicar en prod.
- ❌ **Verificación automatizada de RLS** (test que falle si una tabla nueva queda
  sin policy). Pendiente.

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
- ⚠️ Fallbacks de URL de proyecto hardcodeados en `ApiKeys.jsx`/`Integrations.jsx`:
  bajo riesgo (la URL es semipública) pero conviene exigir la env var.

---

## 5. Autenticación y control de acceso

- ✅ Supabase Auth (JWT) como fuente de identidad; RLS deriva permisos del JWT.
- ✅ **API keys de tenant hasheadas** (`key_hash` + `key_prefix`, nunca raw) con
  permisos y revocación (`is_active`). — *falta expiración y auditoría de uso.*
- 🔴 **Login DEMO con password `1234`** hardcodeado en `src/constants.js` y como
  fallback en `App.jsx`, además publicado en `README.md`. Aunque un login DEMO no
  obtiene sesión Supabase (RLS bloquea los datos), expone credenciales en el bundle
  y es mala praxis. → eliminar de prod (gate por flag de dev o build separado).
- ❌ **MFA/2FA** para staff (admin/lawyer): Supabase soporta TOTP → activar y forzar.
- ❌ **Rate limiting / lockout de login** (anti fuerza bruta). Pendiente.
- ❌ **Timeout de sesión** e indicios de sesión concurrente. Pendiente.

---

## 6. Superficie pública / Edge Functions

- ✅ Webhooks validan **firma HMAC** (Stripe `Stripe-Signature`, Meta `X-Hub-Signature-256`).
- ✅ Funciones con sesión validan JWT + `org_id`.
- ❌ **Rate limiting** en funciones de IA y webhooks → riesgo de **amplificación de
  coste** (Anthropic/Resend) y spam de contactos. Pendiente (límite por org/IP).
- ⚠️ **CORS `*`** en todas las funciones. Con JWT+org el riesgo baja, pero conviene
  restringir `Access-Control-Allow-Origin` al dominio del frontend.
- ❌ **Límite de tamaño de payload** (carlota-chat, verify-document). Pendiente.
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
- ❌ **Error tracking + alertas** (Sentry/equivalente): hoy un webhook de Stripe o un
  cron que falla se pierde en logs que nadie mira. Pendiente.
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
- [ ] Eliminar credenciales DEMO (`1234`) del código/bundle y del README.
- [x] Cerrar IDOR cross-tenant en `ai-lead-scorer` (auth + `org_id`).
- [ ] Aplicar migraciones 015 + 016 en prod.
- [ ] Configurar **todos** los secrets de Edge Functions en el proyecto Supabase.
- [ ] Programar los **crons** (recordatorios, renovaciones, dunning) — hoy no corren.
- [ ] **MFA** obligatorio para staff + rate limiting/lockout de login.
- [ ] Derechos RGPD (export/borrado) + política de retención + DPA.

### 🟠 P1 — antes de escalar
- [x] Security headers + CSP (`vercel.json`).
- [ ] Rate limiting + límite de payload en Edge Functions de IA/webhooks.
- [ ] Restringir CORS al dominio del frontend.
- [ ] Audit log de seguridad + error tracking (Sentry) + alertas.
- [ ] Backups/PITR documentados (`DISASTER_RECOVERY.md`).
- [ ] CI/CD que valide lint/test/build en cada push.
- [ ] MFA en las cuentas proveedoras (Supabase/Vercel/Stripe).

### 🟡 P2 — mejora continua
- [ ] Expiración + auditoría de uso de API keys de tenant.
- [ ] Network Restrictions del proyecto Supabase (whitelist IPs).
- [ ] Test automatizado de cobertura RLS para tablas nuevas.
- [ ] Rotación documentada de secretos (90 días) + runbook.
- [ ] Timeout/gestión de sesiones concurrentes.

---

*Para reportar una vulnerabilidad: [definir buzón de seguridad].*
