# Verificación del rediseño

Todas las operaciones de las suites de navegador utilizan datos simulados. El frontend local debe apuntar al servidor SSR de fixtures **5099**, nunca al backend real. Las llamadas de Auth/Storage/API en Chrome se interceptan. Checkout/Portal son páginas locales simuladas. Las suites se ejecutan secuencialmente porque comparten fixtures SSR.

Preparación local y herramientas QA: consultar `../../microsites/verification/README.md`. No hay nuevas dependencias de aplicación; Playwright/vue-tsc/TypeScript están en `/tmp/carteliax-microsites/qa` y Chrome en `/usr/bin/google-chrome`.

Comandos desde la raíz:

```sh
node docs/ui-redesign/verification/run.cjs
node docs/microsites/verification/typecheck.cjs
node --test --experimental-test-isolation=none docs/ui-redesign/verification/design-system.test.cjs
```

Desde frontend: `npm run build`. Desde backend: `npm test`.

- `responsive.cjs before|after`: 104 combinaciones de 13 rutas × 8 anchuras, errores JS, geometría y capturas de 390/1440.
- `interactions.cjs`: secciones y guardado, validación entre secciones/acordeones, múltiples errores y foco, teléfonos, imágenes, navegación móvil, QR/feedback, acciones secundarias por teclado y errores de autenticación.
- `run.cjs`: ambos scripts y las ocho suites de regresión existentes. Solo cambian sus pasos de navegación cuando una acción pasa a otra sección o acordeón; se mantienen sus comprobaciones de datos y contratos. Matrices públicas, idiomas y diálogos se amplían a las ocho anchuras solicitadas.
- `profile-language.cjs`: original español/inglés/valenciano, selección válida y guardado manual sin generación.
- `design-system.test.cjs`: contraste AA de tokens de texto/estados y comparación de 32 manejadores originales, más SHA-256 de backend, SQL, SSR, Auth, URLs, idioma público y renderizador de carta preservados.
- `before-source.tar.gz`: 98 fuentes previas, sin `.env`, sin node_modules y sin datos de usuarios. `before-manifest.json` identifica su contenido.

La regresión SQL/API usa el PostgreSQL desechable de la verificación anterior, protegido por puerto 55432 y data_directory `/tmp/carteliax-languages/`; no se conecta a Supabase. No se reaplican migraciones en producción.

Resultados y capturas finales en esta carpeta y `../screenshots/`; el informe principal es `../../../UI_UX_REDESIGN.md`. Los tamaños táctiles y el teclado se comprueban en Chrome. No sustituyen una auditoría WCAG con lector de pantalla ni una prueba en Safari/iPhone físicos. Las pruebas de servicios externos son simuladas.
