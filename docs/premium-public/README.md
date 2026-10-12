# Miniwebs, cartas y creación guiada

Implementación local, 12 de octubre de 2026. No se ha desplegado ni escrito en servicios externos.

## Experiencia pública

- Moderna: galería gastronómica, composición asimétrica, fotografía amplia, serif editorial y acentos suaves del color del restaurante.
- Elegante: sala oscura, fotografía en arco, títulos en cursiva, reglas finas y productos en una composición continua.
- Minimalista: espacio en blanco, tipografía limpia, portada desplazada y listas abiertas.
- Clásica: papel cálido, cabecera centrada, dobles filetes y fotografía con remate arqueado.

Las cartas históricas conservan Moderna, Minimalista, Premium y Mediterránea, sus paletas y sus fuentes. Se mantienen los tres formatos, las opciones de imagen/descripción/alérgenos, precios, disponibilidad y relaciones. Las miniwebs siguen usando la identidad del establecimiento; ahora también respetan la densidad y el radio configurados en cada carta.

Animaciones de títulos mediante recorte, revelado de fotografías, líneas de entrada, aparición escalonada de platos, profundidad de portada con CSS cuando el navegador la soporta, y microinteracciones. IntersectionObserver actúa como mejora progresiva: no oculta el contenido SSR. Se respeta `prefers-reduced-motion`. No se añadieron dependencias al proyecto ni fotografías ficticias a los restaurantes.

## Creación y publicación

1. Información crea **un único borrador** y continúa al editor de contenido.
2. Categorías y platos se guardan mediante las operaciones existentes. Cuando una carta en borrador tiene una única categoría, el formulario de producto la preselecciona; se mantiene la opción de catálogo.
3. Diseño permite guardar borrador, previsualizar y guardar para continuar a revisión. La personalización de la identidad compartida abre la configuración de miniweb con regreso a esta carta y protección de cambios pendientes. Esa identidad se guarda en la web pública inmediatamente, como antes; el diseño de la carta sigue teniendo borrador/publicación separados.
4. Revisión muestra información, contenido visible, diseño guardado y vista previa móvil/ordenador. Requiere confirmación explícita. Detecta un borrador de diseño cambiado en otra pestaña y exige actualizar la vista previa. Publica el diseño guardado mediante el endpoint existente y después la carta mediante el PATCH existente. Los errores permiten reintentar sobre el mismo ID. Una carta vacía sigue siendo publicable, con advertencia y confirmación consciente.

El listado remite a revisión para publicar; retirar publicación mantiene su operación. Guardar información no cambia el estado. Las cartas publicadas conservan edición directa, sin repetir el recorrido de creación. Los productos/precios/disponibilidad siguen actualizándose al guardar en una carta pública: no se presenta esa edición como un borrador de contenido. Los idiomas siguen gestionando su publicación en su sección.

La publicación de diseño y carta usa dos operaciones existentes, sin introducir una transacción nueva de backend. Si la segunda operación falla, el diseño puede haber quedado publicado, pero no se da por publicada la carta; se muestra el error y se permite reintentar.

## Alcance preservado

No se modificaron la landing comercial, el dashboard general, la sidebar, las rutas QR/públicas, autenticación, RLS, Stripe ni contratos de backend. El cambio previo de precio comercial permanece en el árbol de trabajo y es independiente de este rediseño.

## Verificación

Evidencias en `verification/` y capturas con datos ficticios en `screenshots/`. Las pruebas usan Chrome, API/Auth/Storage simulados y un servidor local para SSR. No certifican escrituras persistidas en Supabase real, cobros, escaneo con cámara ni Google Maps externo.

Reproducción local (requiere Playwright disponible fuera de las dependencias de la aplicación):

```bash
node docs/microsites/verification/public-server.cjs
# En frontend, en otra terminal, arrancar la compilación o Nuxt con estos overrides temporales:
# NUXT_API_BASE_URL=http://127.0.0.1:5099
# NUXT_PUBLIC_API_URL=http://127.0.0.1:5099
# NUXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:5099
# NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-public
# host 127.0.0.1, puerto 3001. No cambiar .env.
PLAYWRIGHT_MODULE=/tmp/carteliax-premium-qa/node_modules/playwright QA_SUPABASE_AUTH_STORAGE_KEY=sb-127-auth-token node docs/premium-public/verification/browser.cjs
QA_SECTION=admin PLAYWRIGHT_MODULE=/tmp/carteliax-premium-qa/node_modules/playwright QA_SUPABASE_AUTH_STORAGE_KEY=sb-127-auth-token node docs/premium-public/verification/browser.cjs
```

No ejecutar simultáneamente suites que cambien el estado del servidor SSR de fixtures. Detener el servidor antes de regenerar `.nuxt` o `.output`.

## Resultados finales

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| Nuxt producción | PASS | `verification/build.log` |
| TypeScript app y server | PASS | `verification/typecheck.log` |
| Miniwebs, cuatro idiomas, SSR, reduced motion, fallbacks y cartas históricas | 34 PASS, sin errores JS/hidratación detectados | `verification/browser.json` |
| Creación, retroceso, borrador, publicación, doble clic, error, diseño desactualizado e identidad compartida | 7 PASS, sin errores JS/hidratación detectados | `verification/admin.json` |
| Edición de contenido y publicación/retirada | 7 PASS | `verification/regression-flows.json` |
| Fotos, relaciones y gestión de categorías/productos | 6 PASS | `verification/editor.json` |
| 4 plantillas históricas × 3 formatos × 8 anchuras + opciones, fotos y estado no publicado; radio personalizado de 27 px | 99 PASS | `verification/public-matrix.json` |
| Borrador de diseño, revisión/publicación, QR PNG/PDF y acceso público | 5 PASS | `verification/design-qr.json` |
| Publicación backend (adaptador unitario) | 4 PASS | `verification/publication.log` |

**158 comprobaciones de navegador dentro del alcance, todas correctas.** Las cuatro pruebas backend usan un adaptador local, no PostgreSQL real.

Una comprobación adicional ajena al rediseño, incluida después de las pruebas QR en una suite antigua, falló esperando «Suscripción activa». El fixture de suscripción no incorpora `billing_compatibility`; la implementación actual, sin cambios, clasifica esa respuesta como no verificada y muestra «Referencia de facturación anterior». Se conservan el fallo y su log completos en `verification/extended-with-billing.json` y `.log`. No se ha modificado facturación ni debilitado sus controles para hacer pasar esa comprobación.

## Archivos de implementación

- `frontend/app/assets/css/restaurant.css`
- `frontend/app/components/public/RestaurantSite.vue`
- `frontend/app/components/public/RestaurantMenu.vue`
- `frontend/app/components/menuEditor/MenuLivePreview.vue`
- `frontend/app/components/ProductManager.vue`
- `frontend/app/components/ui/MenuNavigation.vue`
- `frontend/app/components/menus/CreationProgress.vue` (nuevo)
- `frontend/app/composables/useRestaurantMotion.ts` (nuevo)
- `frontend/app/composables/useMenuPreviewData.ts` (nuevo)
- `frontend/app/pages/menus/index.vue`
- `frontend/app/pages/menus/[id]/index.vue`
- `frontend/app/pages/menus/[id]/design.vue`
- `frontend/app/pages/menus/[id]/review.vue` (nuevo)
- `frontend/app/pages/businesses/[id].vue`: solamente contexto de regreso desde la carta y protección de esa navegación.

Las suites existentes de creación/publicación se adaptaron al paso de revisión. La matriz visual añade la comprobación del radio personalizado. El generador QR y sus URLs no se modificaron; la suite antigua ahora busca su enlace vigente «Ver esta carta».
