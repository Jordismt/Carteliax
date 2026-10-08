# Verificación local — segunda pasada

No ejecutar contra Supabase ni Stripe. Se reutiliza el harness del rediseño: API SSR de fixtures en **5099**, Nuxt en **3001** con NUXT_API_BASE_URL/NUXT_PUBLIC_API_URL apuntando a 5099. Auth/Storage/API y Checkout/Portal están interceptados por `docs/microsites/verification/browser.cjs`. Los SQL/API usan exclusivamente PostgreSQL desechable puerto55432/data_directory/tmp/carteliax-languages; el runner y adaptador rechazan otras conexiones.

Preparación de herramientas/servidores en `../../microsites/verification/README.md`. No hay dependencias de aplicación nuevas. Chrome requiere permisos locales de sockets en el sandbox.

Desde la raíz:

```sh
PLAYWRIGHT_MODULE=/tmp/carteliax-microsites/qa/node_modules/playwright node docs/landing-qr-pricing/verification/browser.cjs
PLAYWRIGHT_MODULE=/tmp/carteliax-microsites/qa/node_modules/playwright node docs/landing-qr-pricing/verification/journey.cjs
node docs/ui-redesign/verification/run.cjs
node docs/microsites/verification/typecheck.cjs
node --test --experimental-test-isolation=none docs/ui-redesign/verification/design-system.test.cjs docs/landing-qr-pricing/verification/contracts.test.cjs
node docs/microsites/verification/run-database.cjs
```

Ejecutar las suites de navegador **secuencialmente**: comparten el estado del fixture SSR. Build: desde frontend `npm run build`; tests unitarios: desde backend `npm test`.

`browser.cjs` verifica landing y QR en ocho anchuras, SEO/CTA/anchors/FAQ/demos, precio, una/varias/ninguna carta, idioma, 302 legacy, nombre desde formulario, enlaces directos y denegación/missing slug. Descarga PNG/PDF reales. `decode-qr.py` usa Pillow y libzbar ya instalados, sin red; pdftoppm rasteriza el PDF y se decodifica su QR. Resultados en /tmp/carteliax-landing-qr, copiados a esta carpeta al entregar. Los artefactos PNG/raster y los hashes documentan las descargas; no se añade el PDF de 7 MB al repositorio.

`journey.cjs` recorre landing → registro → establecimiento → Checkout/trial simulado → carta/publicación/diseño → QR → web. No comprueba cobros o permisos remotos reales.

`contracts.test.cjs` compara SHA-256 con la copia previa y permite únicamente los nueve ficheros de aplicación del alcance; verifica fuente de precio y el contrato Stripe sin consultar Stripe. La suite del rediseño sigue comparando los 32 manejadores críticos originales.

No se sobreescriben los informes/capturas históricos de la primera pasada. Las suites usan sus directorios /tmp heredados para resultados de ejecución; la evidencia final de esta pasada se copia aquí. La situación remota de Stripe queda pendiente de la comprobación/configuración manual descrita en `../../../CARTELIAX_LANDING_QR_PRICING.md`.
