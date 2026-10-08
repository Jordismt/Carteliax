# QA del rediseño público

Los scripts usan datos ficticios. No arrancar el backend real ni conectar Supabase para esta verificación.

Herramientas temporales:

```sh
npm install --prefix /tmp/carteliax-public-qa playwright vue-tsc typescript@5.9.3 --no-audit --no-fund
npm run build --prefix frontend
npm test --prefix backend
```

En dos terminales, desde la raíz y desde `frontend` respectivamente:

```sh
node docs/microsites/verification/public-server.cjs
```

```sh
NUXT_API_BASE_URL=http://127.0.0.1:5099 NUXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:5099 NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-only NITRO_PORT=3001 node .output/server/index.mjs
```

Desde la raíz, ejecutar secuencialmente (comparten el fixture SSR):

```sh
node docs/public-redesign/verification/browser.cjs
node docs/public-redesign/verification/private.cjs
node docs/public-redesign/verification/details.cjs
```

Chrome utiliza `/usr/bin/google-chrome`. `private.cjs` reutiliza el harness existente de micrositios para sesión y APIs simuladas; el harness espera el `.env` local habitual, pero no imprime ni envía sus credenciales. Los servidores de QA usan exclusivamente los valores ficticios anteriores.

Typecheck desde `frontend`, para `tsconfig.json` y cada `.nuxt/tsconfig.{app,server,shared,node}.json`:

```sh
node /tmp/carteliax-public-qa/node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p .nuxt/tsconfig.app.json
```

`browser.json` registra los grupos aprobados, errores de consola/hidratación y solicitudes externas. Los errores 404 de imágenes se provocan deliberadamente para verificar fallback; no son fallos de carga inesperados. Las imágenes de prueba provienen de los SVG locales existentes. Las capturas históricas `before-*` proceden de la verificación anterior de micrositios, no de un fixture idéntico regenerado durante este cambio.
