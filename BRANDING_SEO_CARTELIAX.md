# Branding y SEO de Carteliax

## Resultado y alcance

**Implementación y validación local terminadas; pendiente de revisión de Jordi.** No se ha hecho commit, push ni despliegue. No se modificaron datos reales, Stripe, Supabase, Storage, RLS, suscripciones o traducciones. El precio permanece en **17,49 €/mes por restaurante, IVA del 21 % incluido**, con siete días de prueba según la elegibilidad existente.

El logo transparente y todos los iconos definitivos están integrados. La web conserva su diseño, secciones y animaciones. El SEO de la plataforma y el de los establecimientos se gestionan separadamente, con datos disponibles durante SSR. La validación contra el catálogo real de Supabase y el despliegue real de Vercel sigue pendiente: las pruebas locales no certifican la configuración remota.

## Auditoría de arquitectura y problemas detectados

Antes de modificar archivos se inspeccionaron Nuxt 4 y Nitro, sus proxies públicos, la landing, autenticación, layout privado, rutas públicas modernas y legacy, componentes de carta, fuentes, imágenes, variables de entorno y el backend de publicación. Se mantuvo SSR y la arquitectura de los dos proyectos de Vercel.

Hallazgos corregidos:

- El PNG original de marca tenía fondo blanco incrustado, sin alfa, y una sombra crema exterior mezclada con ese fondo.
- La navegación corporativa usaba un símbolo genérico; faltaba una integración compartida del logo original.
- Faltaban sitemap y datos estructurados de plataforma; robots no anunciaba sitemap.
- Las páginas privadas necesitaban una exclusión global consistente en metadatos y cabeceras.
- El canonical de restaurantes dependía del dominio de la petición, generando variantes de host/preview.
- La ruta legacy tenía Open Graph incompleto y podía mostrar una carta inexistente con HTTP 200.
- El escape anterior del JSON-LD de restaurantes podía alterar el texto original.
- Varios logos competían con la portada por prioridad alta de descarga.
- El footer público todavía enlazaba al antiguo dominio `carteliax.vercel.app`.

No hay plantillas corporativas de email editables en el repositorio. Los correos gestionados por Supabase/Stripe no se modificaron. La autenticación y las comprobaciones de propiedad/suscripción del backend permanecen intactas.

## Logo: recorte determinista definitivo

Fuente: `frontend/public/favicon.png`, PNG RGB de **1254 × 1254**, sin texto. Se conserva intacta y también está copiada en `docs/branding-seo/originals/carteliax-original.png`. El ICO anterior está respaldado en `docs/branding-seo/originals/favicon-original.ico`.

SHA-256 verificado del PNG original y su copia:

`bc58668369b3438fbd16e082618b038d2997e596474c4862488eb4ac08ba6290`

El master nuevo es [carteliax-logo-transparent.png](frontend/public/images/brand/carteliax-logo-transparent.png). Mantiene el lienzo original y utiliza alfa real **0–255**.

Se utilizó **Pillow y NumPy ya instalados**, sin nuevas dependencias de aplicación. No se utilizó IA para el resultado definitivo. Los recortes generativos de la primera fase fueron rechazados y no se integraron.

Técnica:

1. Máscara de píxeles casi blancos/neutros y flood fill conectado a los bordes; no se aplica una eliminación global de blanco.
2. Conservación de regiones blancas interiores cerradas: tenedor, papel y detalles del QR.
3. Retirada de la sombra crema exterior **expresamente autorizada por Jordi**, en una zona calibrada para este original. Se conserva una banda del borde sólido alrededor del contorno medido de la cubierta; no se dibuja un nuevo borde ni se regenera el símbolo.
4. Corrección de antialiasing/descontaminación de blanco limitada al contorno exterior de tres píxeles. Los RGB de esos píxeles parcialmente transparentes pueden cambiar para retirar el mate blanco; **todos los píxeles que permanecen completamente opacos conservan exactamente el RGB original**.
5. Recorte de márgenes transparentes sólo en derivados, escalado proporcional y padding transparente para iconos. No se estira el símbolo.

Resultados: 1.155.370 píxeles exteriores transparentes, 4.446 píxeles adicionales de sombra retirados y 5.447 píxeles de contorno tratados. Las muestras del tenedor, página crema, bisel sólido y centro QR permanecen opacas e idénticas al original. La ligera pérdida del degradado exterior es la autorizada; no se presenta como una conservación del sombreado eliminado.

El script comprueba el hash de la fuente antes de procesar: no debe reutilizarse automáticamente sobre un logo distinto sin revisar la máscara de sombra.

Revisión visual efectuada en blanco, negro, verde y terracota: [comparativa final](docs/branding-seo/verification/logo-background-review.png). También se revisaron los iconos a tamaño de uso: [16–64 px](docs/branding-seo/verification/favicon-size-review.png). La ambigüedad detectada en la primera prueba y su borrador se conservan como evidencias históricas, no como assets de producción.

## Favicon, formatos e integración

Assets definitivos:

| Archivo público | Tamaño/formato |
|---|---|
| `favicon.ico` | ICO con entradas PNG RGBA de 16, 32 y 48 px |
| `favicon-16x16.png` | 16 × 16, RGBA |
| `favicon-32x32.png` | 32 × 32, RGBA |
| `apple-touch-icon.png` | 180 × 180, RGBA |
| `android-chrome-192x192.png` | 192 × 192, RGBA |
| `android-chrome-512x512.png` | 512 × 512, RGBA |
| `images/brand/carteliax-logo-transparent.png` | Master RGBA 1254 × 1254 |
| `images/brand/carteliax-mark-{64,96,512}.{png,webp}` | Derivados cuadrados proporcionales, PNG y WebP lossless |

La marca de interfaz utiliza WebP de 64/96 px, aproximadamente 4/7 KB; el master de alta resolución no se descarga para representar un logo de 32 px. Los derivados de 512 px quedan disponibles para metadatos y reutilización.

`UiBrandMark` comparte las imágenes y reserva sus dimensiones; se integra en navbar/footer comercial, login/registro, sidebar del dashboard y página de error. Se conservan tipografía, colores y composición de la marca escrita. Se corrigió un espacio accidental antes del punto de “Carteliax.” en autenticación. El alt del símbolo decorativo es vacío porque el enlace ya contiene el nombre visible.

Nuxt declara globalmente ICO, PNG 16/32, apple-touch-icon y manifest, sin declaraciones contradictorias. `site.webmanifest` mantiene nombre/idioma de Carteliax, scope y start URL; usa `display: browser`. Los iconos de 192/512 no implican soporte offline o una nueva PWA.

Los logos personalizados de restaurantes no se sustituyen. Sus imágenes siguen utilizándose en contenido, Open Graph y Schema. El favicon corporativo es global, conforme al alcance solicitado. El footer conserva su presentación y ahora enlaza a `https://www.carteliax.com`.

## SEO de Carteliax

- Origen canonical configurado mediante `NUXT_PUBLIC_SITE_URL`, por defecto `https://www.carteliax.com`, independiente del host de la petición.
- Redirección 308 del dominio apex al www oficial para GET/HEAD, preservando ruta/query. No se redirigen otros hosts a partir de parámetros del cliente.
- `noindex, nofollow` en HTML y `X-Robots-Tag` para dashboard, login, registro, establecimientos/cartas privados, facturación y ruta interna de prueba. Cabeceras de exclusión en API y previews.
- Robots anuncia el sitemap. Las páginas privadas no se bloquean en robots para permitir que el buscador lea su `noindex`; la protección real sigue siendo autenticación/autorización. [Criterio de Google](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- Landing: title específico sobre carta digital QR, description con oferta real y copy que explica la utilidad para restaurantes, bares y cafeterías. H1 semántico, sin quitar secciones ni introducir testimonios/estadísticas ficticias.
- Open Graph y Twitter con URL, identidad, descripción y recurso social real. Idioma principal español.
- JSON-LD de Organization, WebSite, SoftwareApplication y FAQPage con información visible. Oferta mensual 17,49 EUR, por restaurante, IVA incluido; sin reviews ni ratings inventados.
- FAQPage refleja las preguntas reales; no promete rich results. Google restringe esa presentación a sitios gubernamentales/sanitarios autorizados. [Documentación oficial](https://developers.google.com/search/blog/2023/08/howto-faq-changes).
- No se añadieron migas BreadcrumbList inexistentes ni datos empresariales no disponibles. El Schema de aplicación no pretende cumplir requisitos de rich results inventando valoraciones. [SoftwareApplication](https://developers.google.com/search/docs/appearance/structured-data/software-app).

## Sitemap e indexación de restaurantes

Nitro genera `/sitemap.xml` con raíz y slugs de establecimientos que tienen carta y configuración publicadas. El nuevo GET backend `/api/public/sitemap` devuelve exclusivamente `{slugs,nextOffset}`: no propietarios, UUIDs, suscripciones ni datos privados. La proyección y los filtros están cubiertos por tests. Respeta el flag de micrositios.

El catálogo pagina en bloques de 500 registros, con límites de URLs/páginas; no inventa fechas lastmod ni URLs. Fallos del proveedor producen 503. Si el endpoint está deshabilitado o el backend anterior aún devuelve 404, se incluye únicamente la raíz. Para catálogos que superen esos límites será necesario un sitemap index.

Sólo se anuncian URLs canonical; no se incluyen variantes de cartas/idiomas, privadas o previews. [Sitemaps de Google](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

Los restaurantes tienen título, descripción, Open Graph/Twitter y Restaurant JSON-LD con sus datos públicos reales. Teléfono, dirección, horarios, enlaces e imágenes sólo se añaden cuando existen. Las webs sin cartas publicadas quedan `noindex` y fuera del sitemap.

Se preservan `?menu=…&lang=…#carta`, traducciones almacenadas y redirecciones legacy 302. Las variantes comparten el canonical del establecimiento; no se inventan hreflang para traducciones completas no verificadas. [Canonical de Google](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

La carta legacy aún sin slug público tiene canonical y OG propios; una carta inexistente responde HTTP 404 y mantiene su pantalla de reintento. La página de error de Nuxt también ofrece HTML accesible y `noindex`, sin detalles internos.

El JSON-LD se escapa sin alterar datos originales, incluidas cadenas que contienen `</script>`. Durante QA se detectó y corrigió una llamada a `useRequestURL()` desde un computed resuelto por Unhead fuera del contexto Nuxt: el host se captura durante setup. Se reprodujo `NUXT_E1001` y se repitió SSR con éxito; no se atribuye ese hallazgo local al antiguo 502 de producción.

## Rendimiento y accesibilidad

Se generan gzip/Brotli de assets estáticos en build, sin cachear HTML privado. Los assets de marca tienen caché de 24 horas. Sólo la portada gastronómica mantiene prioridad alta; los logos visibles conservan eager con prioridad automática. Productos mantienen lazy loading, dimensiones reservadas y fallback. El backend ya optimiza fotos a WebP; no se añadieron transformaciones de pago ni un proxy abierto de imágenes.

Se conservan fuentes, animaciones, reduced motion, foco visible, navegación por teclado y componentes táctiles. No se ocultó contenido a la espera de JavaScript ni se convirtió Nuxt en SPA.

### Lighthouse real, local, perfil móvil

| Métrica | Build local anterior disponible | Build final |
|---|---:|---:|
| Rendimiento | 70 | **90** |
| Accesibilidad | 100 | **100** |
| Buenas prácticas | 100 | **100** |
| SEO | 100 | **100** |
| FCP | 4,7 s | 2,7 s |
| LCP | 5,0 s | 3,0 s |
| TBT | 10 ms | 30 ms |
| CLS | 0 | 0 |

Lighthouse 13.5.0, Chrome local, build de producción Node/Nitro y throttling móvil de laboratorio. Informes JSON conservados. La referencia anterior es la build local disponible al inicio, no una medición de producción ni una reconstrucción exacta del commit anterior. Los resultados no garantizan Core Web Vitals de usuarios reales; no se midió INP de campo. LCP de laboratorio todavía supera 2,5 s. Queda JavaScript compartido no utilizado en la landing: no se cambió la inicialización de autenticación para perseguir una puntuación.

## Pruebas ejecutadas

| Comando/comprobación | Resultado real y límite |
|---|---|
| `python3 docs/branding-seo/tools/prepare-logo.py` | PASS: fuente intacta, blancos interiores, alfa y contorno; inspección visual completada |
| `python3 docs/branding-seo/tools/build-icons.py` | PASS: 11 PNG/WebP, tamaños exactos, alfa 0–255; ICO 16/32/48; RGB de todos los píxeles opacos del master idéntico al original |
| `npm run build --prefix frontend` | PASS: build final Node/Nitro |
| `NITRO_PRESET=vercel npm run build --prefix frontend` | PASS: packaging Vercel; no despliegue. Luego se restauró build Node para QA |
| vue-tsc en `.nuxt/tsconfig.{app,server,shared,node}.json` | PASS en los cuatro proyectos |
| `npm test --prefix backend` | PASS: **117/117**, incluidas tres pruebas nuevas del catálogo; mocks/fixtures, no Supabase remoto |
| `node --experimental-strip-types docs/branding-seo/verification/seo.test.mjs` | PASS: **3/3**, escape y roundtrip JSON-LD, URLs sin credenciales/tokens y clasificación de privadas |
| `browser-seo.cjs` | PASS: **27** bloques SSR/branding; iconos 200, manifest, canonical, metadatos, JSON-LD, 404/legacy, borradores, 20 combinaciones de rutas/anchuras; consola y pageerrors vacíos |
| `seo-hosts.cjs` | PASS: **5**, apex 308, www, previews, privadas y API con noindex; Host simulado mediante HTTP nativo, todo local |
| Regresión `docs/landing-qr-pricing/verification/browser.cjs` | PASS: **32**, landing a 320–1440 px, dashboard, precios, QR PNG/PDF decodificados, cartas, idiomas y legacy, con fixtures |
| Suite vigente `docs/public-redesign/verification/browser.cjs`, mediante wrapper de artefactos | PASS: **43**, cuatro plantillas a ocho anchuras, textos largos, traducciones/fallback, imágenes fallidas, vacíos, categorías, alérgenos, teclado y reduced motion; sin pageerrors ni hosts externos |
| Suite histórica `docs/microsites/verification/microsites-browser.cjs` | **FAIL por expectativa obsoleta:** intenta medir un CTA de navegación oculto en móvil. `git show HEAD:frontend/app/assets/css/restaurant.css` confirma que ya estaba oculto antes de esta intervención. No se cambió su expectativa ni la interfaz para ocultar el fallo; se ejecutó la suite vigente del rediseño |
| `node docs/branding-seo/tools/check-build-secrets.cjs` | PASS: **1.768 archivos** Node/Vercel, incluidos symlinks, sin coincidencias de los valores secretos locales buscados. No certifica secretos desconocidos/remotos |
| `git diff --check` | PASS |
| Vercel/Supabase reales con estos cambios | **NO EJECUTADO**, pendientes de despliegue autorizado. La consulta pública durante la fase inicial devolvió 200 en landing/restaurante, pero corresponde a la versión desplegada anterior |

Las pruebas de navegador mockean autenticación, Storage y facturación; no certifican esas integraciones. Ninguna consume Groq real. Los informes Lighthouse son reales, locales. La validación JSON-LD comprueba serialización y datos SSR; no se ha solicitado validación externa de Google ni se promete rich result.

Capturas y evidencias: `docs/branding-seo/verification/`. Instrucciones reproducibles en [README de QA](docs/branding-seo/README.md).

## Capturas para revisión

- [Antes: landing móvil](docs/branding-seo/verification/before/landing-hero-390.png).
- [Después: landing móvil](docs/branding-seo/verification/after/landing-390-viewport.png).
- [Después: landing desktop](docs/branding-seo/verification/after/landing-1440-viewport.png).
- [Login desktop](docs/branding-seo/verification/after/login-1440-viewport.png).
- [Dashboard desktop](docs/branding-seo/verification/after/dashboard-1440-viewport.png).
- [Logo en cuatro fondos](docs/branding-seo/verification/logo-background-review.png).
- [Iconos a tamaño de uso](docs/branding-seo/verification/favicon-size-review.png).
- Cuatro plantillas y casos extensos: `docs/branding-seo/verification/public-templates/`.

## Archivos modificados o creados

**Frontend:**

- `frontend/nuxt.config.ts`, `frontend/.env.example`.
- `frontend/app/app.vue`, `frontend/app/error.vue`, `frontend/app/utils/seo.ts`.
- `frontend/app/components/ui/BrandMark.vue`, `frontend/app/components/ui/AuthFrame.vue`, `frontend/app/layouts/dashboard.vue`, `frontend/app/assets/css/main.css`.
- `frontend/app/pages/index.vue`, `login.vue`, `register.vue`, `[publicSlug].vue`, `c/[businessId]/[slug].vue`.
- `frontend/app/components/public/RestaurantImage.vue`, `RestaurantSite.vue`.
- `frontend/server/middleware/seo.ts`, `frontend/server/routes/sitemap.xml.get.ts`.
- `frontend/public/robots.txt`, `site.webmanifest`, `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`.
- `frontend/public/images/brand/carteliax-logo-transparent.png` y `carteliax-mark-{64,96,512}.{png,webp}`.

**Backend:** `backend/src/app.js`, `backend/src/modules/publicSites/publicSitemapController.js`, `backend/test/seo-sitemap.test.js`.

**QA/documentación:** `docs/microsites/verification/fixtures.cjs` añade sólo el catálogo simulado; `docs/branding-seo/README.md`, `originals/`, `tools/{prepare-logo.py,build-icons.py,run-public-regression.cjs,check-build-secrets.cjs}`, `verification/{seo.test.mjs,browser-seo.cjs,seo-hosts.cjs}` y sus mediciones/capturas/JSON; este informe. Logs de ejecución pueden estar excluidos por `.gitignore`; los JSON y las capturas conservan evidencias.

El PNG original **no se modificó**. No se modificaron dependencias de frontend/backend ni sus lockfiles. Playwright/vue-tsc y Lighthouse se utilizaron como herramientas QA temporales externas al repositorio.

## Riesgos y recomendaciones pendientes

- Validar el nuevo catálogo contra PostgREST real después de un despliegue autorizado. La consulta está cubierta con mocks, no con el Supabase remoto. El cliente público del backend ya utilizaba una credencial privilegiada antes de esta intervención; se conserva esa arquitectura y se limita explícitamente la salida a slugs publicados.
- Comprobar los headers, compresión, CDN y redirecciones en Vercel real; compilar el preset no certifica la configuración de dominios/env del panel.
- Medir Core Web Vitals con tráfico real y trabajar después sobre JavaScript compartido/LCP si los datos lo requieren, sin degradar auth o SSR.
- Registrar el sitemap en Search Console y revisar indexación/inspección de URLs. No se accedió a esa propiedad ni se garantizan rankings.
- No se verificaron Safari/iPhone físicos ni instalación en pantalla de inicio; se validaron recursos y tamaños Apple, no el comportamiento de un dispositivo real.
- No ejecutar la máscara de sombra sobre un logo diferente sin recalibración. Una futura fuente con alfa nativo evita el tratamiento del mate exterior.

## PASOS MANUALES PARA JORDI

**Ahora:** revisar el logo, iconos y capturas. No se ha hecho commit, push ni despliegue y no se solicita autorización para ejecutarlos en este turno.

No hacen falta migraciones SQL, cambios de RLS, configuración de Supabase/Storage ni cambios en Stripe. No hace falta actualizar imágenes de restaurantes. La única pérdida visual deliberada es la sombra exterior autorizada del logo de Carteliax.

Cuando decidas desplegar:

1. Frontend Vercel: `NUXT_PUBLIC_SITE_URL=https://www.carteliax.com` (también es el default). Mantener `NUXT_API_BASE_URL` y `NUXT_PUBLIC_API_URL` en `https://carteliax-api.vercel.app`, sin `/api`. Mantener las variables públicas Supabase existentes; nunca añadir credenciales privilegiadas al frontend.
2. Backend: conservar variables existentes y `MICROSITES_ENABLED=true` cuando los micrositios estén habilitados. El catálogo no necesita una clave nueva.
3. Desplegar backend y frontend con sus directorios raíz actuales. El backend actualizado es necesario para que el sitemap incluya restaurantes; una API anterior produce un sitemap sólo con raíz.
4. Comprobar favicon/Apple/manifest, landing, login/dashboard noindex, restaurante publicado, inexistente 404, variantes de carta/idioma, `/robots.txt`, `/sitemap.xml`, redirects apex→www y previews noindex.
5. Enviar `https://www.carteliax.com/sitemap.xml` en Search Console e inspeccionar URLs públicas.

Comandos de entrega **sólo para cuando apruebes el resultado**; no se han ejecutado:

```bash
git status --short
git diff --check
git add backend/src/app.js backend/src/modules/publicSites/publicSitemapController.js backend/test/seo-sitemap.test.js frontend docs/branding-seo docs/microsites/verification/fixtures.cjs BRANDING_SEO_CARTELIAX.md
git diff --cached --stat
git commit -m "Improve Carteliax branding and SSR SEO"
git push origin main
```

Revisar el staging completo antes del commit. Un push puede activar el despliegue automático de Vercel: no hacerlo antes de autorizar también ese despliegue. No se requiere intervención manual sobre establecimientos anteriores para el logo/SEO; los enlaces permanentes, QR, cartas e idiomas se conservan.
