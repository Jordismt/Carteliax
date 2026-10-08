# Auditoría preproducción — entornos y repetición

Entorno ejecutado: Node 22.23.2, PostgreSQL 14, Nuxt 4.6.0. La suite que importa TypeScript usa el soporte nativo de Node >=22.18.

No hay operaciones sobre Supabase real ni cobros Live. Los JSON/logs distinguen el tipo de prueba.

## Unitarias y HTTP con dobles

```sh
npm test --prefix backend
node backend/test/api-audit.cjs
```

El segundo comando abre un puerto efímero local. `auditTransport` rechaza cualquier destino externo. La validación de identidades y PostgREST se simula deliberadamente SIN RLS para exigir ownership explícito al backend.

## PostgreSQL aislado

No ejecutar `schema-fixture.sql` en Supabase. Requiere binarios PostgreSQL 14 y un cluster nuevo exclusivamente local:

```sh
mkdir -p /tmp/carteliax-audit/pg /tmp/carteliax-audit/socket
/usr/lib/postgresql/14/bin/initdb -D /tmp/carteliax-audit/pg -U jordi --auth=trust
/usr/lib/postgresql/14/bin/pg_ctl -D /tmp/carteliax-audit/pg -l /tmp/carteliax-audit/postgres.log -o "-k /tmp/carteliax-audit/socket -p 55438 -c listen_addresses=''" start
node backend/test/database-audit.cjs
/usr/lib/postgresql/14/bin/pg_ctl -D /tmp/carteliax-audit/pg stop
```

Si el cluster ya está inicializado, omitir `initdb`. Cada ejecución crea una base nueva; no borra bases. El runner verifica puerto y data_directory. Aplica las migraciones reales sobre una aproximación documentada del esquema original; **no certifica RLS de producción**. Los tests concurrentes usan dos procesos psql.

## Stripe Test real

Estos scripts usan backend/.env sin imprimir secretos y rechazan claves Live:

```sh
node backend/test/stripe-readonly-audit.cjs
node backend/test/stripe-clock-audit.cjs
```

El primero solo lee Price/endpoints. El segundo CREA recursos nuevos etiquetados, avanza un Test Clock y altera únicamente sus propias suscripciones. NO es un Checkout E2E ni conecta webhooks con Supabase. Requiere red autorizada. NO repetir por rutina: crea nuevos fixtures; los IDs privados se guardan solo en /tmp/carteliax-stripe-audit-resources.json. El exit 1 observado significa precio incorrecto, no un cobro Live. Limpieza manual por la etiqueta registrada en stripe-clocks.json.

## Navegador

Arrancar los servidores ficticios como se indica en ../../public-redesign/verification/README.md. Después, ejecutar SECUENCIALMENTE:

```sh
node docs/preproduction/verification/sessions-browser.cjs
node docs/preproduction/verification/functional-browser.cjs
node docs/preproduction/verification/ssr-proxy.cjs
node docs/public-redesign/verification/browser.cjs
node docs/public-redesign/verification/private.cjs
node docs/public-redesign/verification/details.cjs
```

Chrome y Playwright temporales: /usr/bin/google-chrome y /tmp/carteliax-public-qa/node_modules/playwright. No se incorporó otro framework. La suite histórica microsites-browser utiliza la portada y botones de idioma anteriores: su cobertura pública está reemplazada por la suite vigente public-redesign/browser (32 composiciones + casos funcionales). La matriz LEGACY sigue verificándose aparte. El selector de categorías en regression-extended se actualizó de button a link conservando las aserciones de productos/precios/alérgenos. La clave ficticia de sesión se configura con QA_SUPABASE_AUTH_STORAGE_KEY cuando el servidor usa sb-127-auth-token.

## Build, tipos y secretos

```sh
npm run build --prefix frontend
node backend/test/secrets-build-audit.cjs
```

Ejecutar vue-tsc --noEmit para frontend/tsconfig.json y .nuxt/tsconfig.{app,server,shared,node}.json (herramienta temporal indicada en la documentación del rediseño). El escaneo solo compara secretos locales con el build; no valida las variables Vercel ni el historial Git remoto.

`supabase-readonly-preflight.sql` es un inventario de lectura para revisión MANUAL en QA. No se ejecutó contra Supabase real. Los scripts reproduce-*-before requieren snapshots temporales originales; solo documentan reproducciones anteriores y no forman parte de la batería repetible.
