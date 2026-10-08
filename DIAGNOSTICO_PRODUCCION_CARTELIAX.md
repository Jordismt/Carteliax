# Diagnóstico y correcciones de producción de Carteliax

Fecha: 8 de octubre de 2026. Precio preservado: **17,49 €/mes por restaurante, IVA incluido del 21 %, y siete días de prueba**.

**Resultado:** corregidos el destino del proxy SSR, CORS y la detección del modo Live con claves Stripe restringidas. El frontend corregido renderiza localmente el restaurante real publicado usando la API de producción: HTTP 200; un restaurante inexistente devuelve 404. Los cambios todavía no están desplegados. La web pública de producción sigue devolviendo 502 en la comprobación registrada.

No se han ejecutado despliegues, cobros, escrituras sobre datos reales, migraciones ni operaciones de Stripe Live. No se han cambiado precios, contratos, RLS, traducciones o QR.

## 1. Causa del 502: evidencia e incertidumbre exacta

La ruta real del repositorio es `frontend/app/pages/[publicSlug].vue`, no `frontend/pages/[publicSlug].vue`.

Flujo antes de la corrección:

```text
GET /restaurante-jordi
  → useFetch('/api/public/sites/restaurante-jordi') durante SSR
  → handler Nitro frontend/server/api/public/sites/[slug].get.ts
  → runtimeConfig.apiBaseUrl + '/api/public/sites/restaurante-jordi'
  → API Express → Supabase público → datos publicados
```

La URL del navegador, `runtimeConfig.public.apiUrl`, no intervenía en ese proxy. `apiBaseUrl` tenía el valor por defecto **http://localhost:5000**, que corresponde a desarrollo local, no al backend de Vercel. Si faltaba `NUXT_API_BASE_URL`, configurar correctamente `NUXT_PUBLIC_API_URL` no solucionaba SSR.

El proxy convertía cualquier fallo en 502 y la página volvía a lanzar 502 con «Esta web no está disponible». La respuesta observada contiene ese mensaje de la aplicación: hay evidencia de un error gestionado por Nuxt, no solamente un código genérico de caída del proveedor.

Comprobación directa de producción, de solo lectura, registrada en [production-readonly.json](docs/production-fix/verification/production-readonly.json):

| Ruta | HTTP observado |
|---|---:|
| `https://www.carteliax.com/` | 200 |
| `https://www.carteliax.com/restaurante-jordi` | 502 |
| `https://www.carteliax.com/api/public/sites/restaurante-jordi` | 502 |
| `https://carteliax-api.vercel.app/api/health` | 200 |
| `https://carteliax-api.vercel.app/api/public/sites/restaurante-jordi` | 200, respuesta pública con establecimiento |

Esto localiza el fallo en el trayecto del proxy de Nuxt: la API pública sí responde correctamente cuando se consulta directamente. CORS del navegador no explica el fallo de una petición servidor → servidor.

Se reprodujo antes de modificar el código con un destino SSR local explícitamente inaccesible: proxy **502 en 17,8 ms**, página **502**, landing **200**. Un puerto cerrado provoca rechazo inmediato, compatible con la invocación de unos 35 ms sin solicitudes externas indicada por Jordi. Una petición interna de Nuxt y un intento contra loopback no equivalen a una solicitud externa a la API de Vercel. Véase [before-local.json](docs/production-fix/verification/before-local.json).

**Límite importante:** no hay Vercel CLI instalado ni vínculo local con sus proyectos. No se han leído las variables o los logs privados de ese despliegue. Por tanto, no afirmo haber comprobado que `NUXT_API_BASE_URL` esté ausente o tenga exactamente `localhost:5000` en Vercel. Eso es la explicación respaldada por el defecto de configuración y la reproducción; falta comprobar el valor efectivo remoto. Se solicitó esa información no secreta durante el trabajo. Un valor privado explícito incorrecto debe corregirse manualmente; el nuevo código no lo sustituye silenciosamente por otro.

La corrección elimina el localhost implícito y utiliza la URL pública configurada cuando la privada no existe. Se comprobó además el **frontend corregido contra la API pública real** con `NUXT_API_BASE_URL` vacío y `NUXT_PUBLIC_API_URL=https://carteliax-api.vercel.app`: render SSR 200, HTML del restaurante, JSON-LD y 404 real para un slug inexistente. [Evidencia](docs/production-fix/verification/production-local-render.json). Esta prueba es local, no un despliegue reparado.

## 2. Auditoría de SSR e inicialización

Se revisaron la página dinámica, ambos handlers públicos de Nitro, `RestaurantSite`, `RestaurantMenu`, `RestaurantProduct`, los utilitarios de URLs/idiomas, `usePublicMenuLanguage`, `useApi`, `useAuth`, el middleware de autenticación y los plugins Supabase, sesión y accesibilidad.

- `useFetch` usa la ruta interna de Nuxt y conserva SSR/hidratación. Los productos no se convierten en contenido dependiente exclusivamente de JavaScript.
- `useRuntimeConfig(event)` se consulta dentro de cada petición del proxy. No se utiliza una variable pública como contenedor de secretos.
- El código de `document` para fragmentos se ejecuta en `onMounted` o durante cambios de navegación del cliente. El selector utiliza almacenamiento/navegador al montar o al interactuar. Las operaciones DOM de la directiva de diálogos están en sus hooks de montaje; `getSSRProps` sigue disponible.
- Supabase tiene un plugin universal: sus variables públicas deben existir también durante SSR. No se convirtió en un plugin solo de cliente ni se cambió la autenticación. Las pruebas no encontraron una excepción de inicialización del plugin con configuración válida.
- La página pública no atraviesa el middleware privado ni necesita JWT. La API pública utiliza un cliente público de Supabase; no se alteró ese límite.
- Se conserva el 404 para restaurante/carta no publicados o inexistentes. Ausencia de configuración de API se distingue como 503; un proveedor inaccesible sigue produciendo 502.
- No se han eliminado secciones, estilos, SEO, idiomas, componentes, cartas ni redirecciones antiguas.

## 3. Correcciones aplicadas

| Archivo | Cambio y propósito |
|---|---|
| `frontend/nuxt.config.ts` | `apiBaseUrl` deja de tener un localhost implícito. No cambia SSR ni el preset automático. |
| `frontend/server/utils/publicApiConfig.ts` | Resuelve primero URL privada explícita y, si está vacía, la URL pública. Valida URL absoluta HTTP/HTTPS y rechaza credenciales, query y fragmento. Configuración ausente/inválida falla de forma controlada, sin revelar valores. |
| `frontend/server/utils/publicApiProxy.ts` | Peticiones externas centralizadas, `useRuntimeConfig(event)`, `$fetch` importado explícitamente, timeout 15 s y errores sanitizados. Preserva 404; fallo del proveedor → 502. |
| `frontend/server/api/public/sites/[slug].get.ts` | Usa el proxy común; conserva validación del slug y query de carta. |
| `frontend/server/api/public/menus/[businessId]/[slug].get.ts` | Usa el mismo destino y manejo de errores para cartas y acceso legacy. |
| `frontend/app/pages/[publicSlug].vue` | Preserva el 503 de configuración además del 404/502 existentes. |
| `frontend/.env.example` | Documenta variables correctas del servidor y navegador, separadas del backend. |
| `backend/src/config/cors.js` | Allowlist exacta: origen configurado por `FRONTEND_URL`, `https://www.carteliax.com` y `https://carteliax.com`. Sin wildcard de previews. |
| `backend/src/app.js` | Instala esa configuración antes de rutas privadas y mantiene webhook raw antes de JSON. |
| `backend/src/modules/subscriptions/stripeService.js` | Deriva Live de `env.STRIPE_MODE`, ya validado contra claves `sk_`/`rk_`. |
| `backend/.env.example` | Aclara compatibilidad y permisos necesarios de claves restringidas. |
| `backend/test/deployment.test.js` | Regresiones de CORS, las cuatro combinaciones de clave/modo, guard de precio e identificación de webhooks firmados. |
| `.gitignore` | Excluye metadata y artefactos locales `.vercel/`. |
| `docs/production-fix/verification/*` | Scripts repetibles, evidencia JSON sanitizada y logs locales de las pruebas. |
| `DIAGNOSTICO_PRODUCCION_CARTELIAX.md` | Este informe. |

### CORS

Antes, `cors({ origin: env.FRONTEND_URL })` devolvía siempre una cabecera fija. En producción, OPTIONS desde el dominio sin `www` recibía `Access-Control-Allow-Origin: https://www.carteliax.com`. El navegador rechaza esa combinación. La cabecera fija observada para un origen ajeno tampoco lo autorizaba realmente: no coincidía con el origen del atacante.

Ahora los dos dominios autorizados reciben su propio origen exacto. Orígenes ajenos no reciben `Access-Control-Allow-Origin`; no se habilitan credenciales ni se elimina JWT. Las llamadas SSR, CLI y webhooks sin `Origin` siguen funcionando. No se autoriza cualquier `*.vercel.app`.

### Stripe con claves restringidas

Zod ya admitía `rk_live_` en el estado inicial del repositorio y comprobaba su coincidencia con `STRIPE_MODE`. Se conservó esa corrección.

Sin embargo, `STRIPE_LIVE_MODE` seguía calculándose con `startsWith('sk_live_')`. Una clave `rk_live_` válida se clasificaba como Test: el Price Live se rechazaba y un webhook auténtico Live podía devolver 400. La corrección usa el modo validado y mantiene todos los controles de precio, IVA, autenticidad y ownership.

Los tests de modo Live usan **claves ficticias y SDK local con llamadas remotas simuladas**. No consultan Stripe Live ni prueban los permisos de tu clave real. Precio 1.749 céntimos, EUR mensual, intervalo 1, IVA inclusivo 21 %, trial y método de pago obligatorio siguen intactos.

## 4. Vercel y entrypoints

No hay `vercel.json` ni metadata de proyectos vinculados en el repositorio inicial. No se han inventado rewrites manuales ni impuesto un preset a todos los entornos.

Configuración que debe verificarse en los paneles:

| Proyecto | Root Directory | Framework | Build / salida |
|---|---|---|---|
| Frontend de `www.carteliax.com` | `frontend` | Nuxt | `npm run build`; salida detectada por Vercel/Nitro, no `generate` ni SPA estática |
| Backend de `carteliax-api.vercel.app` | `backend` | Express | Entry reconocido `src/app.js`, que importa Express y exporta `app` por defecto; sin salida de frontend |

El `src/server.js` del backend conserva el listener y el worker para ejecución local/persistente. No se modificó su comportamiento. Un worker permanente no queda certificado por ejecutar el handler de Express en una función serverless; la operación de traducciones en Vercel debe seguir revisándose conforme a la auditoría anterior.

Se construyó explícitamente con `NITRO_PRESET=vercel`. El output declara **Node 22**, incluye la función alias `/[publicSlug]`, los dos proxies públicos y el handler común. Se invocó ese **handler generado** localmente: restaurante 200, inexistente 404, proxy 200 y legacy 302. No es una ejecución en infraestructura Vercel. [Output](docs/production-fix/verification/vercel-output.json), [handler](docs/production-fix/verification/vercel-handler.json).

Después se restauró un build Node de producción para que `node frontend/.output/server/index.mjs` siga siendo utilizable localmente. Los artefactos `.vercel` no deben desplegarse como `--prebuilt` desde esta máquina: se generaron con la configuración local de QA/build, no con las variables verificadas del proyecto de producción.

Referencias oficiales: [runtimeConfig de Nuxt 4](https://nuxt.com/docs/4.x/guide/going-further/runtime-config), [Nuxt en Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt), [Express en Vercel](https://vercel.com/docs/frameworks/backend/express). Nuxt reemplaza las claves de runtime con variables de nombre correspondiente; configurar la variable pública no reemplaza una privada diferente. Express admite el export por defecto utilizado aquí.

## 5. Variables de entorno en Vercel

Estos son valores **esperados**, no un inventario de valores remotos leído de Vercel. Las variables deben estar en **Production** y en **Preview** cuando se necesiten allí. Un cambio de variable requiere un nuevo deployment; no modifica una función ya desplegada.

### Proyecto frontend

| Nombre | Valor de Production | Exposición |
|---|---|---|
| `NUXT_API_BASE_URL` | `https://carteliax-api.vercel.app` | Servidor de Nuxt. Recomendada explícitamente; si falta se usa la URL pública configurada. |
| `NUXT_PUBLIC_API_URL` | `https://carteliax-api.vercel.app` | Pública; navegador y fallback SSR. Sin `/api` al final. |
| `NUXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase que corresponde al entorno de producción | Pública; necesaria también al inicializar el plugin en SSR. |
| `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable/anon del mismo proyecto; introducirla en Vercel | Pública, **nunca** service role/secret. No copiada al informe. |

No colocar `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY` ni `GROQ_API_KEY` en el proyecto frontend, y nunca prefijarlas con `NUXT_PUBLIC_`.

### Proyecto backend

| Nombre | Valor/configuración de Production |
|---|---|
| `FRONTEND_URL` | `https://www.carteliax.com`, sin path; se usa también para retornos Stripe. El apex está autorizado por CORS. |
| `SUPABASE_URL` | URL del mismo proyecto Supabase de producción |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable/anon de ese proyecto |
| `SUPABASE_SECRET_KEY` | Credencial privilegiada del servidor de ese proyecto; secreto, no copiado |
| `STRIPE_MODE` | `live` para la integración Live declarada por Jordi; `test` en QA aislado |
| `STRIPE_SECRET_KEY` | Clave `sk_live_` o `rk_live_` del entorno correspondiente; secreto |
| `STRIPE_WEBHOOK_SECRET` | Secreto `whsec_` del endpoint de ese mismo entorno |
| `STRIPE_PRICE_ID` | ID Live del Price activo de **1.749 céntimos, EUR, mensual, intervalo 1, inclusivo** |
| `STRIPE_VAT_TAX_RATE_ID` | ID Live de tasa activa IVA ES **21 %, inclusiva**, modo coincidente |
| `MICROSITES_ENABLED` | `true` para publicar micrositios, con migración de micrositios ya aplicada. La API pública actual devuelve 200. |
| `TRANSLATIONS_ENABLED` | Conservar configuración existente; `true` requiere migración y ejecución de traducciones verificadas. No cambiar para solucionar el 502. |
| `GROQ_API_KEY` | Secreto backend cuando traducciones IA estén habilitadas; no utilizado por la web pública |
| `GROQ_TRANSLATION_MODEL` | Conservar modelo configurado; default del código `openai/gpt-oss-20b` |
| `NODE_ENV` | `production`, normalmente gestionado por Vercel; no utilizar `test` para el despliegue real |
| `PORT` | Para ejecución local del listener, default 5000. No necesita ser la URL pública ni una configuración especial del export Express en Vercel. |

En Preview con autenticación, usa una API de Preview/QA, Stripe Test y Supabase aislado. El `FRONTEND_URL` de ese backend debe autorizar el origen concreto del frontend Preview. No se abre CORS a todos los previews para facilitar las pruebas.

La clave restringida de Stripe debe disponer de los permisos necesarios para las llamadas reales del backend: lectura de Prices/Tax Rates/Customers/Invoice Items/Subscriptions, creación/lectura/caducidad de Checkout Sessions y creación de sesiones del Customer Portal. Verificar los permisos en Stripe; no sustituir el guard ni compartir la clave para resolver un permiso insuficiente. No se comprobó esa configuración real.

## 6. Validaciones ejecutadas

| Comprobación | Resultado | Naturaleza |
|---|---|---|
| Lectura de producción y preflights actuales | API health/site 200; web/proxy Nuxt 502; CORS apex incorrecto | Real, solo lectura, cambios no desplegados |
| Reproducción antes de editar | Proxy/página 502, landing 200 | Build producción local con destino SSR cerrado |
| `npm test --prefix backend` | **114/114 PASS** | Fixtures; incluye cuatro tipos/modos de clave y webhooks firmados SDK sin Stripe remoto |
| Pruebas de resolución de configuración | **2/2 PASS** | Node, utilitario real de Nuxt |
| Express/HTTP/CORS | **8 PASS** | HTTP real local, sin servicios remotos; GET privado sin JWT sigue en 401 |
| SSR de producción con fixtures | **34 PASS** | URLs pública/privada, configuración ausente/inaccesible, 404, cuatro plantillas, query e idioma, legacy y error de proveedor sanitizado |
| Frontend corregido → API pública real | **200 y 404 PASS** | Render local contra backend de producción, únicamente lectura pública |
| Build Node Nuxt | **PASS** | Producción local; restaurado al finalizar |
| Build preset Vercel | **PASS** | Compilación local con Nitro `vercel` |
| Handler Vercel generado | **4 PASS** | Invocación local del bundle Node 22, no infraestructura Vercel |
| TypeScript Nuxt app/server/shared/node | **PASS** | `vue-tsc --noEmit` con herramienta local ya disponible |
| Navegador Chrome | **32 PASS, 0 errores** | Servicios interceptados/ficticios; ocho anchuras, precios, dashboard, QR PNG/PDF, cartas, idiomas y legacy |
| Recorrido completo de interfaz | **PASS** | Registro/Checkout/Auth/Storage/API simulados; publicación, QR y web |
| Escaneo de secretos, build Node | **PASS**, 777 archivos | No coincidencias con valores privados locales del backend |
| Escaneo de secretos, output Vercel | **PASS**, 779 archivos | Sin coincidencias; no incluye claves remotas de Vercel que no se conocen |
| Sintaxis Express/configuración/Stripe y `git diff --check` | **PASS** | Validación local |
| Deploy/Preview real Vercel | **NO EJECUTADO** | Sin autorización de despliegue ni acceso vinculado |
| Dashboard autenticado real, permisos Stripe Live, webhook Live | **NO EJECUTADO** | No sustituir por resultados de mocks |

Los comandos principales y evidencia sanitizada están en [docs/production-fix/verification](docs/production-fix/verification). Los logs `.log` permanecen localmente e ignorados por Git; los JSON se pueden revisar y versionar sin secretos.

```bash
npm test --prefix backend
npm run build --prefix frontend
NITRO_PRESET=vercel npm run build --prefix frontend
node --test --experimental-test-isolation=none docs/production-fix/verification/api-config.test.mjs
node docs/production-fix/verification/cors-http.cjs
node docs/production-fix/verification/ssr.cjs
# Ejecutar después del build vercel, antes de restaurar el build Node:
node docs/production-fix/verification/vercel-handler.cjs
# Lecturas públicas reales explícitas, sin escrituras:
node docs/production-fix/verification/production-readonly.cjs
node docs/production-fix/verification/production-local-render.cjs
# TypeScript: desde frontend, con vue-tsc instalado en el entorno temporal existente:
node /tmp/carteliax-public-qa/node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p .nuxt/tsconfig.app.json
# Repetido con tsconfig.server.json, tsconfig.shared.json y tsconfig.node.json.
```

Los scripts HTTP requieren poder abrir puertos locales; los de lectura real requieren red. El navegador reutiliza los harness existentes y datos de prueba. La prueba `ssr.cjs` requiere el build Node que inicia un listener; no ejecutarla sobre el index exportado por el preset Vercel.

## 7. Commit, push y despliegue

No se ha hecho commit, push ni deploy. Antes de ejecutar estos comandos, revisar cambios y confirmar el proyecto seleccionado. La rama inicial era `main`, con remoto `origin` del repositorio Carteliax existente.

```bash
git switch -c fix/production-public-ssr
git diff --check
git diff
git add -- .gitignore backend/.env.example backend/src/app.js backend/src/config/cors.js backend/src/modules/subscriptions/stripeService.js backend/test/deployment.test.js frontend/.env.example frontend/nuxt.config.ts 'frontend/app/pages/[publicSlug].vue' 'frontend/server/api/public/sites/[slug].get.ts' 'frontend/server/api/public/menus/[businessId]/[slug].get.ts' frontend/server/utils/publicApiConfig.ts frontend/server/utils/publicApiProxy.ts docs/production-fix DIAGNOSTICO_PRODUCCION_CARTELIAX.md
git diff --cached --stat
git commit -m "fix: public SSR API configuration, CORS and restricted Stripe mode"
git push -u origin fix/production-public-ssr
```

Vercel puede generar Preview automáticamente al publicar esa rama. Revisar variables de Preview antes de utilizarla para pruebas autenticadas. Para vincular el monorepo y desplegar manualmente, **comandos para Jordi**, no ejecutados:

```bash
npx vercel@latest login
npx vercel@latest link --repo
# Elegir los DOS proyectos existentes y verificar sus Root Directories.
npx vercel@latest deploy --cwd backend
npx vercel@latest deploy --cwd frontend
```

Después de aprobar configuración y Preview, y solo cuando decidas desplegar en producción:

```bash
npx vercel@latest deploy --prod --cwd backend
npx vercel@latest deploy --prod --cwd frontend
```

También puedes revisar/mergear la rama mediante el flujo Git existente; merge/push a la rama Production puede disparar despliegues automáticos. No mezclar un deploy CLI de artefactos locales con un despliegue Git que ya realiza el build correcto. Referencias: [monorepos Vercel](https://vercel.com/docs/monorepos), [link](https://vercel.com/docs/cli/link), [deploy](https://vercel.com/docs/cli/deploy).

## PASOS MANUALES PARA JORDI

1. En **frontend → Settings → Environment Variables → Production**, comprobar y configurar:
   - `NUXT_API_BASE_URL=https://carteliax-api.vercel.app`
   - `NUXT_PUBLIC_API_URL=https://carteliax-api.vercel.app`
   - Las dos variables públicas Supabase del mismo proyecto. Sin secretos de servidor.
2. Verificar Root Directory `frontend`, framework Nuxt y build `npm run build`. No cambiar SSR por SPA ni utilizar `npm run generate` como solución.
3. En **backend**, comprobar Root Directory `backend`, Express y `FRONTEND_URL=https://www.carteliax.com`. Mantener `STRIPE_MODE=live` si se usa una clave Live, incluida `rk_live_`, y revisar todos los nombres de la tabla. No pegar valores secretos en informes o chats.
4. Revisar permisos de la clave restringida y Price/tasa Live **sin cambiar contratos**. El código continúa exigiendo 17,49 € IVA incluido y siete días cuando corresponda. Si la configuración de facturación no cumple el guard, Checkout debe permanecer bloqueado; no desactivarlo para resolver esta incidencia.
5. No hace falta ninguna migración, cambio RLS ni cambio Storage para esta corrección. Mantener migraciones/features ya existentes. La API pública real devuelve datos: no se ha usado una cuenta privilegiada ni se han modificado esos datos.
6. Desplegar los cambios y variables revisados en ambos proyectos. No se ha realizado ese despliegue durante el trabajo. Si solo se cambian variables, crear igualmente un nuevo deployment que las cargue.
7. Tras desplegar, verificar `/api/health` 200, API pública 200, proxy Nuxt 200, `/restaurante-jordi` 200, slug inexistente 404 y OPTIONS desde los dos dominios con `Access-Control-Allow-Origin` correspondiente. Probar login/dashboard real con tu cuenta autorizada, QR y selección de cartas/idiomas. No realizar un cobro Live para esta verificación.
8. Si queda un 502, revisar los nuevos logs `[PUBLIC_API_PROXY]`: `PUBLIC_API_CONFIGURATION` indica URL ausente/inválida; `ECONNREFUSED` o un estado upstream localizan conexión/proveedor. No registrar URLs con credenciales, tokens ni objetos completos de error. El valor efectivo remoto y los logs privados de Vercel siguen siendo la parte del diagnóstico no inspeccionada aquí.

**Producción no se declara reparada hasta desplegar y repetir esas comprobaciones.** La evidencia positiva actual corresponde al código corregido ejecutado localmente, incluido el render de datos publicados reales.
