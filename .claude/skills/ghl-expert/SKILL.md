---
name: ghl-expert
description: Referencia operativa experta de GoHighLevel (GHL) para Grupo Libredeuda / LibreDeuda — jerarquía agencia/subcuenta, Private Integration Tokens, conexión MCP, y setup/troubleshooting de WhatsApp Business Cloud API. Úsala SIEMPRE que la tarea toque GoHighLevel, GHL, la subcuenta "Grupo Libredeuda", el MCP de leadconnectorhq.com, WhatsApp Business dentro de GHL, o cualquier error de conexión/token/verificación relacionado con estas cosas — incluso si el usuario no menciona "GHL" explícitamente y solo habla de "el CRM", "WhatsApp del despacho" o pega un error de GoHighLevel. Consúltala antes de reintentar cualquier verificación de número o token que ya haya fallado una vez, para no repetir un diagnóstico ya resuelto.
---

# GHL Expert — Grupo Libredeuda

Esta skill existe porque varias cosas de GoHighLevel **no son intuitivas ni están bien documentadas**, y descubrirlas a base de prueba y error cuesta tiempo real. Cada sección de abajo es una lección aprendida en producción, no teoría general — síguelas antes de reinventar el diagnóstico.

## 1. Jerarquía de cuenta: Agencia → Subcuentas (Locations)

GHL tiene dos niveles: la **Agencia** (panel superior, con secciones como "Subcuentas", "Reventa", "Portal de afiliados") y cada **Subcuenta / Location** individual (donde vive el CRM real: contactos, conversaciones, WhatsApp, etc.).

- El MCP oficial y casi toda la configuración operativa (WhatsApp, Conversaciones, Contactos) viven **a nivel de Location**, no de Agencia.
- Para entrar en una subcuenta concreta: panel de Agencia → **Subcuentas** → botón **"Cambiar a subcuenta"** en la fila correspondiente. Esto navega a `/v2/location/<id>/dashboard`.
- **Gotcha:** las URLs con `/v2/location/<id>/...` (por ejemplo `/v2/location/<id>/marketplace` o `/v2/location/<id>/settings/phone-numbers`) pueden cargar en blanco si se navega directo a ellas sin haber "entrado" antes a la subcuenta vía la UI. Si una URL con `/v2/location/` no carga, ve primero por Subcuentas → Cambiar a subcuenta, y desde ahí navega con los enlaces del menú lateral (no adivinando la URL).
- Location de referencia actual: **"Grupo Libredeuda"**, Location ID `hCWgQz5TZK5uOhImx2OX`.

## 2. Private Integration Token (PIT)

Formato: `pit-` + UUID → **40 caracteres exactos**.

**Gotcha crítico:** GHL solo muestra el token **completo una única vez**, en el instante en que se crea la integración (Settings → Private Integrations → Create new integration). Si vuelves después a ver esa misma integración en el listado, GHL muestra una versión que **parece** un token válido (mismo formato `pit-xxxxxxxx-xxxx-...`, 40 caracteres) pero que en realidad está enmascarada y da `401 Invalid Private Integration token` al usarla.

Cómo reconocerlo y arreglarlo:
- Si un token tiene el formato correcto (empieza por `pit-`, 40 caracteres) pero sigue dando 401, **no sigas ajustando el formato** — el token en sí no es el real.
- Solución: borrar esa integración privada y crear una nueva. Copiar el token con el **botón de copiar** de GHL **en el momento exacto** en que se muestra tras crearla — no volver a por él después.
- Otro fallo común al pegar manualmente: el token queda **duplicado** (80 caracteres en vez de 40) si se pega dos veces sin querer. Si la longitud no es exactamente 40, ese es el problema.

**No se pueden editar los scopes de una integración ya creada.** La pantalla de gestión de cada Private Integration (Settings → Private Integrations → clic en el nombre) solo ofrece **rotar/caducar el token** — no hay ninguna opción para añadir o quitar permisos a posteriori. Si el token actual se quedó corto de scopes (por ejemplo, solo tiene `locations.readonly` y hace falta `contacts.readonly`, `opportunities.readonly`, etc.), la única vía es **crear una integración nueva desde cero** con los scopes correctos — no hay forma de "ampliar" la existente. Mismo protocolo de siempre: copiar el token nuevo en el instante en que se muestra.

## 3. Conectar el MCP de GHL (`.mcp.json`)

Configuración estándar:
```json
{
  "mcpServers": {
    "gohighlevel": {
      "type": "http",
      "url": "https://services.leadconnectorhq.com/mcp/",
      "headers": {
        "Authorization": "Bearer <PIT>",
        "locationId": "<LOCATION_ID>"
      }
    }
  }
}
```

**Gotcha crítico (app de escritorio):** la app de escritorio de Claude Code **no hereda variables de entorno del shell** (`~/.zshrc`, `export VAR=...`). Si el header usa `Authorization: Bearer ${GHL_LC_PIT}` y el token se exportó en una terminal, la app de escritorio no lo verá nunca, aunque la terminal lo confirme con `echo $GHL_LC_PIT`. Solución: poner el token **inline directamente** en `.mcp.json` en vez de una variable de entorno (siempre que el archivo esté fuera de git — comprobar con `git check-ignore .mcp.json`).

Tras cualquier cambio en `.mcp.json` o en el token, hace falta **reiniciar la app por completo** (Cmd+Q, no solo cerrar la ventana) para que recargue la conexión MCP.

**Diagnóstico rápido** — para aislar si un fallo 401 es del token o de la carga del entorno, probar el token directo contra la API, sin pasar por el MCP:
```bash
curl -H "Authorization: Bearer <pit>" -H "Version: 2021-07-28" \
  "https://services.leadconnectorhq.com/locations/<locationId>"
```
HTTP 200 confirma que el token es válido de verdad (aísla el problema de la carga en la app). 401 con este curl confirma que el token en sí es inválido (ver sección 2).

## 4. WhatsApp Business Cloud API vía GHL

Ruta correcta dentro de la subcuenta: **Configuración → WhatsApp** (URL interna: `/v2/location/<id>/settings/whatsapp?tab=numbers`).

**No está en el Marketplace/Integraciones** — es fácil perder tiempo buscándolo ahí. Se accede desde el menú lateral de Configuración de la propia subcuenta, sección "Servicios Empresariales".

Si la WABA (WhatsApp Business Account) ya existe y está vinculada a Meta desde antes (mismo Meta Business Manager), puede aparecer **ya listada** en esta pantalla con estado **"Desconectado"** y un botón **"Verificar"** — en ese caso NO hace falta repetir el asistente completo de Embedded Signup de Meta (login OAuth, selección de WABA, etc.), basta con verificar el número existente.

## 5. Verificación de número (OTP) — el gotcha que más tiempo cuesta

Al pulsar "Verificar" sobre un número, GHL ofrece dos vías para recibir un código:
- **Verificar Vía Cuerpo Mensaje** (SMS al número)
- **Verificar la llamada de Vía Teléfono** (llamada de voz)

**Si falla repetidamente con "Error al subir OTP — Request code failed: Please try again in some time" en AMBOS métodos**, esto casi siempre es el **rate-limit de registro de Meta** para ese número de teléfono — no un fallo de configuración de GHL, ni de la WABA, ni del token.

Confirmación cruzada: si al intentar dar de alta ese mismo número en la app de WhatsApp de un móvil aparece *"Este número no se puede usar ahora, inténtalo en 1 hora"*, eso confirma el rate-limit (es el wording estándar de Meta para este límite, no una caída real de servidores).

**Punto clave — es un contador compartido**: cualquier intento de verificación de ese número, venga de GHL, de la app del móvil, o de que la agencia/soporte lo intente por su cuenta, cuenta contra **el mismo límite de Meta**. Reintentar en bucle no soluciona nada — cada fallo nuevo puede **reiniciar** la ventana de espera.

**Protocolo correcto:**
1. Confirmar primero que el número no está activo en ninguna app de WhatsApp de ningún móvil (causa alternativa — ver más abajo).
2. Si se confirma que es rate-limit: **parar TODOS los intentos, en todos los canales, durante 1 hora completa** (no solo desde GHL).
3. Pasada la hora, hacer **un único intento limpio**. No repetir varias veces seguidas "por si acaso".

**Causa alternativa a descartar primero:** un número en API Cloud solo puede estar activo en un sitio de Meta a la vez. Si el número sigue registrado en la app de WhatsApp (normal o Business) de un móvil, hay que liberarlo ahí antes: Ajustes → Cuenta → Eliminar mi cuenta (confirmando el número). Espera 5-10 min tras eliminarlo antes de reintentar desde GHL.

## 6. No confundir dos verificaciones distintas

- **Verificación de NÚMERO** (sección 5 arriba) — rate-limit corto, ~1 hora, específico del número de teléfono.
- **Verificación de NEGOCIO de Meta** (Business Verification) — proceso completamente distinto, a nivel de Meta Business Manager, mostrado como badge separado en la pantalla de WhatsApp de GHL ("Verificación de negocio de Meta: No verificado"). Es relevante para poder enviar plantillas/mensajes de marketing (HSM), y puede tardar **de horas a varios días** (no minutos). Se gestiona desde `business.facebook.com` → Configuración del negocio → Centro de seguridad, aportando documentación de la empresa (CIF, dirección, teléfono).

No traten estos dos procesos como si fueran el mismo bloqueo — tienen causas, tiempos y soluciones distintas.

## 6b. Plantillas de WhatsApp (HSM) — NUNCA se pueden editar una vez aprobadas, y borrar tiene un coste alto

Antes de tocar cualquier plantilla existente en GHL → WhatsApp → Plantillas, **revisa primero el listado completo** (puede haber 30+ plantillas ya construidas, con nombres poco descriptivos, formando un embudo completo de bot/cualificación/seguimiento/reactivación). No asumas que hace falta crear algo nuevo sin comprobar antes si ya existe algo equivalente — buscar por palabras clave ("seguim", "reactiv", "llamad"...) antes de proponer plantillas nuevas.

**Gotcha crítico — no se puede editar una plantilla ya aprobada por Meta:**
- El botón "Editar plantilla" aparece disponible y deja escribir cambios, pero al guardar devuelve **HTTP 422**: *"The status for this message template can't be changed. You can only delete or add templates."* — no hay ningún indicador previo en la UI de que esto vaya a fallar.
- Diagnóstico: para ver el error real (la UI no siempre lo muestra como toast visible), interceptar la petición XHR en la página vía `javascript_tool` parcheando `XMLHttpRequest.prototype.send` para loguear `responseText` de peticiones a `/template/`.
- Única solución real: **borrar y volver a crear la plantilla**, no editarla.

**Gotcha aún más crítico — borrar y recrear con el MISMO nombre/contenido puede bloquearse 4 semanas:**
- Al borrar una plantilla y crear inmediatamente otra con el mismo nombre y cuerpo (mismo idioma), Meta puede rechazar la creación con: *"New Spanish content can't be added while the existing Spanish content is being deleted. Try again in 4 weeks or consider creating a new..."*
- Es decir: **el borrado dispara una ventana de "contenido en proceso de eliminación" de hasta 4 semanas** durante la cual no se puede recrear esa combinación exacta de nombre+idioma+contenido.
- **Antes de borrar una plantilla aprobada para "arreglarla"**, sopesarlo: si el fix es trivial (como una variable rota), puede ser mejor crear una plantilla nueva con nombre distinto (ej. `nombre_original_v2`) que perder el nombre original durante un mes.
- Si aun así hay que borrar y recrear ya: usa un **nombre nuevo** (sufijo `_v2`, `_fix`, etc.) para evitar el bloqueo — no reutilices el nombre+contenido exacto.
- Consecuencia a comunicar siempre al usuario antes de borrar: cualquier workflow/automatización que referencie la plantilla vieja **por su ID interno** (no por nombre) dejará de funcionar hasta que se actualice manualmente — el ID de la plantilla nueva es distinto aunque el nombre sea parecido.

## 7. Enlaces de referencia oficiales

- [Developer docs (Marketplace)](https://marketplace.gohighlevel.com/docs/)
- [Private Integrations — Everything You Need to Know](https://help.gohighlevel.com/support/solutions/articles/155000003054-private-integrations-everything-you-need-to-know)
- [¿Puedo usar mi número de WhatsApp existente para el registro?](https://help.gohighlevel.com/support/solutions/articles/155000006748-can-i-use-my-existing-whatsapp-number-for-registration-in-gohighlevel)
- [Troubleshooting cuenta de WhatsApp restringida](https://help.gohighlevel.com/support/solutions/articles/155000004737-troubleshooting-a-restricted-whatsapp-business-account)
- [In-App Business Verification for WhatsApp](https://help.gohighlevel.com/support/solutions/articles/155000006341-in-app-business-verification-for-whatsapp)

## 8. Integración Claude Code + GHL vía API pública (guía de Chema Aznar)

Fuente: canal de YouTube [@chema-aznar](https://www.youtube.com/@chema-aznar) (agencia española especializada en GHL), transcripciones extraídas directamente de sus vídeos técnicos. Esto complementa (no sustituye) al MCP oficial que ya usamos — es la ruta que sigue este creador para dar a Claude Code acceso de trabajo diario sobre una subcuenta de GHL.

**Requisito de suscripción:** Claude Code viene incluido gratis con una suscripción de pago Claude Pro o Max (desde 15 €/mes) — el plan gratuito de Claude no lo incluye.

**Setup base (local, sencillo):**
1. Instalar Visual Studio Code.
2. Instalar la extensión **"Claude Code"** desde el marketplace de VS Code (verificar que el publisher sea `anthropic.com`).
3. Autenticarse eligiendo la opción **"Claude AI subscription"** (no API key) cuando lo pida.
4. Abrir como carpeta de trabajo una **carpeta vacía dedicada** (Open Folder) — no una carpeta ya llena de archivos de otros proyectos. Razón práctica: si la carpeta no está vacía, Claude Code coge automáticamente todo lo que hay dentro como contexto, generando ruido.
5. Pegar en el chat un "prompt de arranque" (documento propio del creador) que hace de entrevista de onboarding — genera automáticamente una estructura de carpetas de contexto (quién eres, tu rol, tu equipo, tus objetivos) que luego usa para personalizar cualquier tarea futura sin tener que repetir contexto cada vez. La lección de fondo: **la mejora real viene de darle más contexto permanente, no de mejores prompts puntuales.**
6. Para no tener que aprobar cada acción manualmente, existe un flag de "saltar permisos" que el propio vídeo deja documentado en su descripción (equivalente a `--dangerously-skip-permissions`) — usarlo con cuidado, ya que da autonomía total sobre esa carpeta.

**Conectar esa instancia de Claude Code a una subcuenta de GHL (vía API pública, sin el MCP oficial):**
1. En GHL, dentro de la subcuenta: copiar el **Location ID** (Perfil).
2. **Settings → Private Integrations → Create new integration.**
3. **Al elegir scopes: seleccionar todos EXCEPTO el que gestiona usuarios** (aparece marcado en amarillo/advertencia) — la razón que da el creador es que ese scope permitiría a la IA borrar o editar usuarios de la cuenta, que es un riesgo real e innecesario para tareas normales. El resto de scopes los deja todos activados.
4. Copiar el token generado (mismo gotcha que en la sección 2 — se muestra una sola vez) y pegarlo directamente en el chat de Claude Code, indicando que es la integración privada / API de esa subcuenta.
5. Si pide instalar Python, aceptar — lo usa para parte de la tooling.

**Limitación importante confirmada en la práctica (vía API pública/REST, distinto del MCP oficial):** con esta conexión, Claude **NO puede editar ni Workflows ni Funnels** de GHL — la propia plataforma no lo permite vía esta vía. **SÍ puede**: leer conversaciones, leer y editar/borrar contactos (incluye borrar duplicados, borrar contactos sin email/teléfono), crear y borrar etiquetas, leer oportunidades. Ten esto en cuenta al plantear qué automatizaciones pedir — para tocar workflows/funnels hace falta hacerlo manualmente en la UI de GHL.

**Caso de uso de ejemplo mostrado:** una "skill" personalizada tipo "auditor de subcuentas GHL" que, conectada así, genera un informe (hallazgos críticos, mejoras recomendadas, plan de acción) y lo exporta a PDF con marca propia si se le entrena antes con guías de marca (logo, colores, tipografías).

**Arquitectura avanzada (opcional, para acceso 24/7 desde cualquier dispositivo):** el creador ejecuta todo esto no en local sino en un **VPS propio 24/7** — VS Code + extensión Claude Code en el VPS, accesible desde móvil vía **Termius** (cliente SSH). Para notas/memoria persistente usa **Obsidian instalado directamente en el mismo VPS** (no en local con sincronización), con el plugin **"Self-host LiveSync"** para sincronizar en tiempo real entre dispositivos — la razón que da: cuando tenía Obsidian en local, dar permisos de escritura a la IA sobre esos archivos locales generaba fricción constante; al vivir todo en el mismo servidor, no hace falta gestionar permisos cruzados. Evitó además el bot nativo / integraciones tipo "Open Cloud" de GHL por coste descontrolado (le llegó a costar ~100 €/día sin querer).

**Nota sobre modo SaaS (solo si en el futuro LibreDeuda revende licencias GHL — no aplica de momento):** al vincular un plan de pago SaaS a una subcuenta cliente, GHL obliga a elegir explícitamente si el producto/plan viene de **Stripe vinculado a la vista de Agencia**, o de **Stripe vinculado a una Subcuenta concreta** que gestione esos productos — agencia y subcuenta no comparten catálogo de productos Stripe entre sí. Elegir la opción que no coincide con dónde se creó el plan hace que ni siquiera aparezca en la lista al proceder. Es una fuente de confusión habitual que, según el creador, ni el propio soporte de GHL acierta a explicar bien.

## Cuándo NO basta con esta skill

Esta skill cubre configuración de cuenta, conexión y WhatsApp. Para trabajo dentro del CRM ya conectado (contactos, pipelines, workflows de nurturing, automatizaciones), combina esto con las herramientas MCP `mcp__gohighlevel__*` directamente — esta skill es el mapa de terreno, no un sustituto de esas herramientas.
