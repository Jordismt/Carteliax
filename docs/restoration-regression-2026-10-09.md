# Restauración y regresiones de Carteliax — 9 de octubre de 2026

## Alcance y conclusión

Se han implementado correcciones en el repositorio, conservando Nuxt/Vue/Express, las políticas premium y los datos. No se ha desplegado, ejecutado SQL de escritura en Supabase, creado Checkout ni modificado Stripe. No se puede declarar todo el SaaS listo para clientes: faltan operaciones privadas integradas con cuentas reales, acceso directo a Stripe y logs de Vercel.

Historia comprobada: propietario autorizado → publicación → diseño público separado del borrador → API pública → Nuxt SSR → visitante anónimo → cambio de idioma. Para Checkout: regreso del navegador → lectura/refresco → recuperación del evento real → misma transacción de webhook con lease e idempotencia.

## Historial y causas

`101e874` es la referencia anterior al endurecimiento reciente; `e016573` introduce las restricciones de lanzamiento y la migración `20261009121557`; `a6844c5` ya contiene el arreglo del trabajador de traducciones. El primer commit disponible, `0306497`, ya tiene suscripciones, traducciones y publicación separada de temas: no existe en este Git una versión anterior a todas esas funcionalidades. No se ha hecho revert.

1. **Publicación incompleta.** `updateMenu` escribía `is_published=true` sin garantizar `menu_themes.published_at` y `published_config`. `loadPublicMenu` exige los tres. La lectura anterior identificó `menu-del-dia` y `menu-infantil` publicados sin tema; la lectura actual ya muestra publicación de tema a las 15:17 UTC y el GET de `menu-del-dia` devuelve 200. Los datos han cambiado externamente durante esta sesión; no los he reparado mediante SQL. El defecto sigue reproducible con una carta nueva y está corregido: publicar prepara un diseño público por defecto, conserva el borrador y cualquier diseño publicado, con comparación condicional ante concurrencia. El dashboard identifica publicación incompleta y permite completarla explícitamente. No publica borradores automáticamente.

2. **QR de una carta abría otra carta.** `/menus/[id]/qr` redirigía al QR general; el generador ignoraba el slug de carta. Ahora utiliza el mismo contrato de URL que los enlaces del dashboard: `/<public_slug>?menu=<slug>#carta`. El QR general sigue apuntando al restaurante. Si falta el micrositio, el QR de carta utiliza `/c/<businessId>/<slug>`.

3. **URL antigua dependía del micrositio.** `/c/[businessId]/[slug]` redirigía incondicionalmente al micrositio cuando existía `public_slug`. Ahora renderiza directamente la carta publicada y conserva la URL de los QR ya impresos. Continúa comprobando publicación, categorías visibles, productos disponibles y diseño publicado.

4. **Idioma al cambiar de carta.** La preferencia se restauraba sólo al montar y se guardaba por carta. Ahora también se guarda por restaurante y se restaura al cambiar los datos de la carta. Un `lang` válido en la URL tiene prioridad. Se conservan preferencias antiguas y todos los idiomas existentes; no se han inventado traducciones.

5. **Permiso de onboarding incoherente.** Express exigía suscripción para editar establecimiento, logo y portada, mientras PostgreSQL permite esas operaciones de onboarding con comprobación de propietario. Se han alineado esas rutas con la política existente: autenticación y propiedad siguen siendo obligatorias. Cartas, productos, categorías y funciones premium mantienen middleware, RLS y triggers.

6. **Checkout se consultaba una sola vez.** Al volver antes que el webhook, la página podía permanecer mostrando el estado pendiente hasta refrescar manualmente. Ahora realiza lecturas cada 2 segundos hasta 60 segundos, cancela el ciclo al desmontar/cambiar de establecimiento y descarta respuestas antiguas. Las respuestas API/proxy usan `Cache-Control: private, no-store`.

7. **Recuperación de Checkout completado ausente.** Se añade `POST /api/subscriptions/checkout/reconcile`, sólo para propietario. Usa únicamente la sesión e intento persistidos, valida entorno y metadatos de establecimiento/propietario/intento, consulta Stripe mediante GET y busca su evento REAL `checkout.session.completed`. Reutiliza `synchronize`, la lectura actual bajo lease y `cx_sync_billing_event`. No sintetiza eventos, no crea ni caduca Checkout y no escribe en Stripe. El RPC existente garantiza idempotencia y fencing. La búsqueda está limitada a 500 eventos; Stripe conserva Events 30 días. Si falta la sesión, el evento, permisos de lectura de Events o la vinculación, falla de forma explícita. La recuperación no se ha ejecutado en producción.

8. **Traducciones detenidas en 0/11.** La investigación anterior encontró trabajo encolado sin trabajador reclamándolo. El arreglo de ejecución asociada al runtime y progreso ligero está en `a6844c5`. La lectura actual confirma que `2f9f6976-7b48-4372-8b7e-96e4bc69186d` terminó 11/11 a las 15:00:54 UTC. Otros trabajos de 11 textos terminaron en aproximadamente 2 segundos a las 15:01 UTC. Estas duraciones son evidencia de esos trabajos, no una garantía de latencia universal.

Los puntos de publicación, QR, URL y onboarding también existen en la referencia anterior al endurecimiento; no se atribuyen falsamente a la migración reciente. El endurecimiento hace visibles algunos estados incompletos y referencias históricas, pero no demuestra que todos los errores sean RLS.

## Datos y seguridad reales

Lecturas de producción realizadas mediante Supabase y HTTP anónimo, sin mutaciones:

- Proyecto: `cyknlbxcadjuyvypqtbn`.
- `GET https://carteliax-api.vercel.app/api/public/menus/c630dd10-4ea8-4763-a130-c0213e7aff51/menu-del-dia`: **200**, 4 categorías, 6 productos; español, inglés, francés y valenciano disponibles; 11 textos publicados por idioma traducido.
- Suscripciones `c630dd10-4ea8-4763-a130-c0213e7aff51`, `250f51e3-4630-4126-bd43-4ffb5630823f` y `27da34ba-0183-4662-9268-cee6b9f99a81`: `trialing`, `stripe_livemode=true`, cliente/suscripción vinculados, prueba y período hasta el 16 de octubre. No se concede acceso basándose sólo en `trialing`.
- La referencia de `8ad4ed49-afbe-40f2-abd4-5c1041add780` tiene modo no verificado y prueba vencida el 8 de octubre: que no habilite premium es el comportamiento de seguridad esperado.
- Eventos almacenados incluyen `checkout.session.completed`, `customer.subscription.created` e `invoice.paid`. Por ejemplo `evt_1UOeviLOcmwyXKbtxRAMP0JO` y `evt_1UOeaALOcmwyXKbtiiX9PHof` para Checkout. Esto demuestra procesamiento persistido; no demuestra entrega de TODOS los eventos desde Stripe ni acceso directo al estado Stripe LIVE.
- El lector público es server-side y privilegiado, con selección explícita de campos y filtros de publicación. Los visitantes no necesitan suscripción ni sesión. No se han reabierto las tablas premium a `anon`.
- Se han inspeccionado políticas originales de propiedad, restricciones premium, grants y RPC de sincronización. No se ha encontrado evidencia de un fallo general de RLS que bloquee el lector público.

Firma: el webhook conserva `express.raw` antes de `express.json` y `stripe.webhooks.constructEvent`; rechaza firma inválida, modo incorrecto y cuentas Connect. El valor/configuración desplegada de `STRIPE_WEBHOOK_SECRET`, los intentos de entrega Stripe y logs de Express/Vercel siguen pendientes de acceso. No se exponen secretos en este informe.

Endpoint LIVE: `https://carteliax-api.vercel.app/api/subscriptions/webhook`. Eventos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`.

## Pruebas ejecutadas

| Comprobación | Resultado | Límite |
|---|---|---|
| Suite backend `npm test` | 186/186 | Unitarias y adaptadores simulados; incluyen firma SDK real, billing, imágenes, traducciones y nuevos casos de publicación/reconciliación |
| `launch-crud.cjs` | 29 comprobaciones HTTP | Express real; Auth/PostgREST/datos simulados |
| `launch-database.cjs` | Pasa | PostgreSQL 14 real local: migraciones, restricciones, RPC, duplicados y leases; esquema base aproximado |
| `public-publication-database.cjs` | Pasa | PostgreSQL real local; reemplaza políticas permisivas de fixture por predicados originales leídos de producción; no es Supabase alojado |
| `qr-contract.cjs` | Pasa | Genera PNG reales y decodifica con libzbar: URL específica, antigua y general; no descarga desde dashboard |
| `public-readonly-browser.cjs` | Pasa, 1440 y 390 px | Chrome → build Nuxt local corregido → API desplegada → datos reales; sin sesión ni escrituras |
| Inglés/francés/valenciano en navegador | Pasa | Nombres comparados con traducciones publicadas reales, idioma HTML, persistencia, recarga y URL antigua; sin errores de página ni desbordamiento horizontal |
| `frontend npm run typecheck` | Pasa | Tipado app/server |
| `frontend npm run build` | Pasa | Build final de producción; no despliegue |
| `git diff --check` | Pasa | Integridad del diff |

Pruebas A–G solicitadas:

- **A:** publicación y lectura pública verificadas con DB real local; visitante sobre API real también comprobado. Publicación mediante dashboard autenticado contra Supabase alojado pendiente.
- **B:** PNG QR decodificado apunta a la carta concreta; esa URL abre sin sesión en navegador. Descarga PNG/PDF desde dashboard y escaneo físico pendientes.
- **C:** cambio en/fr/val y persistencia comprobados en navegador con traducciones reales publicadas.
- **D:** actualización real de producto y nueva lectura pública comprobadas en PostgreSQL local. Escritura de producto alojado desde dashboard pendiente.
- **E:** escritura directa sin premium denegada por PostgreSQL real; políticas/grants de producción inspeccionados. JWT real contra PostgREST alojado pendiente.
- **F:** firmas y controladores comprobados con SDK real/Stripe remoto simulado; RPC, idempotencia y leases con PostgreSQL real; producción tiene pruebas LIVE y eventos persistidos. No se ha generado ni reenviado un evento LIVE para esta prueba.
- **G:** aislamiento de propietario comprobado con predicados reales en PostgreSQL local y autorización Express simulada. Dos sesiones Auth reales contra datos alojados pendientes.

## Dashboard: verificado y pendiente

Crear/editar/eliminar cartas vacías, categorías, productos, relaciones, alérgenos, publicar/despublicar, edición de establecimiento y estados premium tienen regresión HTTP simulada. Seguridad, modo, expiración, triggers y concurrencia tienen pruebas DB locales. Lectura pública y selector de idiomas sí se han verificado con datos alojados reales.

Registro/login/recuperación de contraseña con correo real, logos/portadas/imágenes en Storage alojado, ordenación desde UI, personalización desde editor, descargas QR/PDF y operación privada completa con sesión real quedan pendientes. Las pruebas de errores y recuperación de imágenes existentes utilizan adaptadores; no se presentan como cargas reales en Storage.

**Eliminar establecimientos no existe como flujo en la versión inicial disponible ni en la actual.** La revocación actual impide borrarlos directamente y dejar huérfana la facturación. No se ha añadido un borrado destructivo o una cancelación Stripe bajo el pretexto de restauración. Requiere definir su ciclo de vida y autorización aparte. Los borrados de cartas/categorías/productos conservan sus condiciones y conflictos de relaciones existentes.

## Archivos modificados

Backend: `src/app.js`, `src/modules/businesses/businessRoutes.js`, `src/modules/menus/menuController.js`, nuevo `src/modules/menuThemes/menuPublication.js`, `src/modules/subscriptions/{subscriptionController,subscriptionRoutes,stripeWebhookController}.js` y nuevo `checkoutReconciliation.js`.

Frontend: `app/components/menus/MenuQrGenerator.vue`, `app/composables/usePublicMenuLanguage.ts`, `app/pages/billing/[businessId].vue`, `app/pages/c/[businessId]/[slug].vue`, `app/pages/menus/index.vue`, `app/pages/menus/[id]/{index,qr}.vue` y `server/utils/publicApiProxy.ts`.

Pruebas nuevas: `backend/test/{menu-publication,checkout-reconciliation}.test.js`, `backend/test/{public-publication-database,public-readonly-browser,qr-contract}.cjs`, `backend/test/fixtures/production-ownership.sql`. El SQL de fixture tiene guard de clúster desechable y **no es una migración**.

## Reproducción local

Desde la raíz:

```sh
npm --prefix backend test
npm --prefix frontend run typecheck
npm --prefix frontend run build
node backend/test/launch-crud.cjs
node backend/test/qr-contract.cjs
```

Las pruebas DB necesitan el clúster desechable `/tmp/carteliax-hardening-pg/data`, socket `/tmp/carteliax-hardening-pg/socket`, puerto `55439`, usuario local `jordi`. Si no existe, inicializar con PostgreSQL 14 `initdb`, nunca sobre datos existentes; `pg_ctl` debe usar `-k /tmp/carteliax-hardening-pg/socket -p 55439 -h ''`. Ejecutar, en orden:

```sh
node backend/test/launch-database.cjs
node backend/test/public-publication-database.cjs
```

La segunda prueba usa la DB `carteliax_launch_*` más reciente, cuya creación corresponde a la primera. No acepta otra ruta/puerto. El esquema base es aproximado; las políticas originales de propiedad están en el fixture separado. PIL/libzbar y Chrome son dependencias locales de las pruebas QR/browser. Playwright se instaló exclusivamente en `/tmp/carteliax-regression-tools`.

Para browser se sirve `.output/server/index.mjs` local en `127.0.0.1:5077` con `NUXT_API_BASE_URL` y `NUXT_PUBLIC_API_URL` apuntando al backend público desplegado; Supabase cliente usa un valor fixture, sin login. Ejecutar `node backend/test/public-readonly-browser.cjs`. El script bloquea métodos del navegador distintos de GET/HEAD. No reconstruir `.output` mientras ese servidor está en marcha: reiniciarlo después del build evita referencias a chunks antiguos.

## Migración y despliegue

**No se necesita una migración nueva.** Las funciones `cx_acquire_billing_sync`, `cx_sync_billing_event` y `cx_release_billing_sync` ya existen en producción. No ejecutar el SQL de fixtures en Supabase. No reparar masivamente referencias históricas ni forzar `trialing`.

No he desplegado. Antes de hacerlo hay que avisar al propietario, revisar este diff y disponer de acceso a los proyectos Vercel correctos. Backend primero; frontend después. No promover frontend antes del backend porque utiliza el endpoint nuevo de reconciliación y `public_ready`.

Comandos desde la raíz del repositorio, verificando que los proyectos son los existentes:

```sh
npx --yes vercel login
npx --yes vercel link --cwd backend --project carteliax-api --scope jordis-projects-5029b899
npx --yes vercel link --cwd frontend --project carteliax --scope jordis-projects-5029b899
npx --yes vercel env ls production --cwd backend --scope jordis-projects-5029b899
npx --yes vercel env ls production --cwd frontend --scope jordis-projects-5029b899
npx --yes vercel deploy --cwd backend --scope jordis-projects-5029b899
npx --yes vercel deploy --cwd frontend --scope jordis-projects-5029b899
```

Los dos últimos crean previews para validar antes de promoción. No conectar un preview a un webhook LIVE nuevo ni crear suscripciones de prueba. Confirmar nombre/Root Directory del proyecto existente antes de aceptar el link; si difiere, seleccionar el proyecto real, no crear otro.

Backend: Root Directory `backend`, entrada Express `src/app.js`, `vercel.json` ya fija 300 segundos. Verificar presencia de `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `STRIPE_MODE=live`, clave LIVE de Stripe, `STRIPE_PRICE_ID`, `STRIPE_VAT_TAX_RATE_ID`, secret LIVE del webhook, `FRONTEND_URL=https://www.carteliax.com`, `GROQ_API_KEY`, `TRANSLATIONS_ENABLED=true`, `MICROSITES_ENABLED=true`. Si la clave Stripe es restringida, la recuperación necesita permiso de lectura de Checkout Sessions, Subscriptions y Events. No imprimir ni pegar valores secretos en logs.

Frontend: Root Directory `frontend`, preset Nuxt, variables públicas de Supabase y `NUXT_PUBLIC_API_URL=https://carteliax-api.vercel.app`; `NUXT_API_BASE_URL` para SSR apunta al mismo backend; `NUXT_PUBLIC_SITE_URL=https://www.carteliax.com`. Nunca incluir service key ni clave Stripe en `NUXT_PUBLIC_*`.

Después de revisar previews y avisar antes del despliegue de producción:

```sh
npx --yes vercel deploy --prod --cwd backend --scope jordis-projects-5029b899
npx --yes vercel deploy --prod --cwd frontend --scope jordis-projects-5029b899
```

Registrar IDs de despliegues previos y nuevos. Comprobar URL pública, URL antigua y traducciones anónimas; después una sesión de propietario existente con prueba válida, sin crear otra suscripción. Revisar entrega Stripe y logs de webhook; no usar el botón de contratar como comprobación de activación. Una carta incompleta se recupera con “Completar publicación” del propietario o publicación explícita del editor. Verificar también despublicación en sesión anónima y aislamiento con una segunda cuenta. Ante regresión, restaurar el despliegue Vercel previo del componente afectado; no revertir datos ni migraciones.
