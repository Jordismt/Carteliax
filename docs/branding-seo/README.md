# QA local de branding y SEO

No ejecutar contra Supabase o Stripe reales. La API local de fixtures no utiliza servicios externos. Los scripts de navegador mockean autenticación/Storage y no certifican esas integraciones.

1. `python3 docs/branding-seo/tools/prepare-logo.py`: crea el master RGBA desde el PNG original. Incluye comprobación SHA de la fuente; la zona de retirada de sombra se calibra únicamente para este original autorizado.
2. `python3 docs/branding-seo/tools/build-icons.py`: genera PNG/WebP/ICO y valida tamaños, alfa y RGB opaco original. Pillow y NumPy ya estaban instalados.
3. `npm test --prefix backend`; `node --experimental-strip-types docs/branding-seo/verification/seo.test.mjs`.
4. `npm run build --prefix frontend`; comprobar los cuatro proyectos `.nuxt/tsconfig.{app,server,shared,node}.json` con vue-tsc.
5. Servidor de datos: `node docs/microsites/verification/public-server.cjs` (5099).
6. Nuxt local, con variables no secretas de QA:

```bash
PORT=3001 HOST=127.0.0.1 NUXT_API_BASE_URL='' NUXT_PUBLIC_SITE_URL=http://127.0.0.1:3001 NUXT_PUBLIC_API_URL=http://127.0.0.1:5099 NUXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:5099 NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-only node frontend/.output/server/index.mjs
```

7. Ejecutar **secuencialmente**, comparten fixtures:

```bash
PLAYWRIGHT_MODULE=/tmp/carteliax-public-qa/node_modules/playwright QA_SUPABASE_AUTH_STORAGE_KEY=sb-127-auth-token node docs/branding-seo/verification/browser-seo.cjs
PLAYWRIGHT_MODULE=/tmp/carteliax-public-qa/node_modules/playwright QA_SUPABASE_AUTH_STORAGE_KEY=sb-127-auth-token node docs/landing-qr-pricing/verification/browser.cjs after
node docs/branding-seo/tools/run-public-regression.cjs
```

El wrapper de la regresión pública conserva las expectativas de `docs/public-redesign/verification/browser.cjs` y cambia sólo los destinos de sus capturas/JSON. No sobrescribe las evidencias anteriores.

8. `seo-hosts.cjs` necesita una segunda instancia local en 3002, con `NUXT_PUBLIC_SITE_URL=https://www.carteliax.com` y el resto de valores QA anteriores. Usa HTTP nativo para enviar Host correctamente: no requiere DNS ni peticiones al dominio real.
9. Lighthouse disponible únicamente como herramienta QA temporal en `/tmp/carteliax-seo-tools`:

```bash
CHROME_PATH=/usr/bin/google-chrome node /tmp/carteliax-seo-tools/node_modules/lighthouse/cli/index.js http://127.0.0.1:3001/ --chrome-flags='--headless --no-sandbox --disable-dev-shm-usage' --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=docs/branding-seo/verification/lighthouse-after.json --quiet
```

10. Detener el servidor antes de cambiar su build. Validar también `NITRO_PRESET=vercel npm run build --prefix frontend`, luego restaurar build Node. `node docs/branding-seo/tools/check-build-secrets.cjs` escanea ambos artefactos y sus symlinks; sólo imprime nombres/conteos, nunca valores secretos. No despliega.

Los tools temporales no son dependencias de la aplicación. Para reproducir en otra máquina hay que disponer de Chrome, Playwright, vue-tsc, Lighthouse, Pillow y NumPy. La suite histórica `docs/microsites/verification/microsites-browser.cjs` presupone un CTA de navegación visible en móvil y un selector de idioma de botones; ambos supuestos preceden al rediseño público ya existente. Se conserva sin cambiar expectativas; usar la suite vigente de `docs/public-redesign` para esa UI.
