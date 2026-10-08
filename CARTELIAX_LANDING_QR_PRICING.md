> Actualización comercial del 08/10/2026: el precio oficial para nuevas suscripciones es **17,49 €/mes, IVA incluido (21 %)**. Las tarifas y evidencias de este informe describen el momento de su auditoría; consulta [ACTUALIZACION_PRECIO_CARTELIAX.md](ACTUALIZACION_PRECIO_CARTELIAX.md) para la configuración y pruebas vigentes.

# Carteliax — Landing, un QR y precio

Segunda pasada del 7 de octubre de 2026. Alcance: presentación comercial, QR principal por establecimiento y precio. Se conserva el rediseño del SaaS; no se crea otro sistema visual ni se rehace el dashboard.

## 1. Auditoría y estado previo

Se revisaron landing/CTA/FAQ/header/footer/SEO, registro y creación, facturación/trial/Checkout/Portal, todos los consumidores de MenuQrGenerator, generador PNG/PDF/logo, publicUrls, public_slug, multimenú, idioma, SSR y redirecciones legacy. Se comprobaron tokens y componentes del rediseño anterior antes de modificar la aplicación.

[Auditoría previa](docs/landing-qr-pricing/AUDITORIA.md). Copia de **106 fuentes**, sin `.env`, claves ni datos personales: [before-source.tar.gz](docs/landing-qr-pricing/verification/before-source.tar.gz), con [SHA-256](docs/landing-qr-pricing/verification/before-manifest.json). El repositorio Git pertenece al directorio padre con cambios ajenos; no se alteró. Las capturas anteriores se conservan para comparar.

## 2. Sistema QR

La pantalla común es `/businesses/qr/:id`, con título **Tu QR**. Carga únicamente el establecimiento por el endpoint existente, con autenticación y ownership del backend. No necesita una carta ni una publicación.

Todos los nuevos QR codifican exclusivamente `/<public_slug>`, sin `menu`, `lang`, fragmento o UUID. No hay selector de destino/carta/idioma. Colores, logo, canvas, PNG y PDF siguen utilizando el generador existente. Los ficheros se nombran por restaurante. El cartel PDF comunica web y carta digital.

Configuración y listado de establecimientos dan acceso al mismo QR. El listado de cartas muestra **un acceso común**, en lugar de repetir un QR por carta. Las secciones del editor conservan su acceso QR, que conduce a la pantalla del restaurante.

Los accesos privados anteriores `/menus/:id/qr` se conservan: la API de carta comprueba el acceso y después la página lleva al QR común. Nunca se toma un business_id sin comprobarlo en el backend.

Si falta la dirección pública, se explica la indisponibilidad y se deshabilitan las descargas. No se fabrica un QR técnico nuevo. La infraestructura antigua sigue funcionando; desplegar esta entrega presupone el micrositio ya instalado en la etapa anterior.

## 3. Compatibilidad

- Una carta publicada: la misma web muestra esa carta sin navegación extra.
- Varias: la misma web utiliza el multimenú existente.
- Ninguna: web válida con el aviso de carta disponible próximamente; el QR se puede preparar igualmente.
- Cambiar el nombre: no cambia public_slug ni QR; comprobado desde el formulario.
- `/<public_slug>?menu=<menuSlug>#carta` sigue funcionando. Acción secundaria **Copiar enlace directo** en Más opciones de la carta.
- `?menu=...&lang=en#carta` conserva selección e idioma.
- `/c/:businessId/:menuSlug`: mismo endpoint y misma redirección **302**, con carta, idioma y fragmento. Ningún QR impreso se invalida por esta entrega.
- Los enlaces antiguos específicos siguen abriendo su carta. Se retira su generación como QR nuevo, no su compatibilidad.
- Auth, RLS, suscripciones, Checkout/Portal/webhooks, Storage, publicación, edición, traducciones y renderizado público mantienen su arquitectura.

## 4. Landing anterior y nueva

| Anterior | Nueva |
|---|---|
| Propuesta centrada en editar una carta | Web del restaurante + carta + un QR + idiomas + panel |
| Carta genérica en un bloque | Smartphone con identidad, portada, platos, precios, multimenú e idioma |
| Seis tarjetas de funciones | Secciones editoriales y demostraciones de web, panel y QR |
| Cuatro preguntas frecuentes | Doce dudas reales, con respuestas sobre el funcionamiento actual |
| 18 €/mes | 15,99 €/mes y condiciones reales de los 7 días gratis |
| Poco protagonismo de web e idiomas | Previews compartidas, cuatro plantillas e idiomas interactivos |

Capturas anteriores y finales en [screenshots](docs/landing-qr-pricing/screenshots/). Las demos llevan etiquetas de ejemplo; La Sobremesa no se presenta como un cliente real.

## 5. Estructura

1. Header con Producto, Cómo funciona, Precio, Preguntas, Login y Registro; disclosure móvil.
2. Hero con propuesta, precio/trial, CTA y smartphone.
3. Tres pasos: restaurante, cartas, QR.
4. Web e información del restaurante, con preview.
5. Gestión de productos/precios/alérgenos/disponibilidad, con ejemplo de panel.
6. Un QR → una web → todas las cartas.
7. Identidad y cuatro idiomas: previews de Moderna, Elegante, Minimal y Clásica.
8. Un plan con doce beneficios y detalles agrupados desplegables.
9. Doce FAQ.
10. CTA final y footer con enlaces existentes.

## 6. Copy principal

- **Tu web. Tu carta. Un solo QR.**
- **Tu restaurante, online y siempre al día.**
- **Una web para tu restaurante, todas las cartas que necesites y un QR que solo imprimes una vez.**
- **Tu carta cambia. Tu QR permanece.**
- **Lo imprimes una vez. La carta evoluciona.**
- **Probar 7 días gratis.**

Se indica que la tarjeta se solicita al activar la suscripción, y que la prueba depende de que el establecimiento no la haya utilizado. No se promete puesta en marcha en un tiempo inventado, traducción perfecta o disponibilidad sin una suscripción vigente.

## 7. Funciones comunicadas

Web/URL permanente, logo, portada, color, descripción, Sobre nosotros, horarios, contacto, WhatsApp, mapa/ubicación, redes, responsive y SEO básico. Carta integrada, varias cartas, categorías/productos, fotos/descripciones/precios, alérgenos, disponible/agotado, publicación/vista previa. QR único, logo/colores, PNG/PDF, enlace general y directo, compatibilidad antigua. Español, valenciano, inglés y francés; generación privada, revisión, edición y publicación. Cuatro plantillas, gestión móvil/ordenador y facturación.

Las listas extensas se agrupan en tres detalles desplegables. No se anuncian reservas, pedidos, delivery, pagos de consumidores, dominio personalizado, app nativa, analytics, clientes, reviews o estadísticas inventadas. No se menciona Groq en la landing.

## 8. Precio

`frontend/app/utils/commercialPlan.ts` centraliza el precio comercial: **15,99 €/mes**, 15.99 EUR y 7 días. Lo consumen landing/SEO/FAQ, registro, creación, dashboard vacío y facturación. La imagen social también presenta 15,99 €.

En facturación, cuando existe acceso al Portal, se aclara que el precio mostrado corresponde a nuevas altas y que el importe contratado se consulta en Gestionar facturación. No se afirma que una suscripción anterior haya cambiado de importe automáticamente.

## 9. Todas las referencias anteriores relevantes

Inventario previo literal: [price-audit-before.json](docs/landing-qr-pricing/verification/price-audit-before.json). Líneas del estado anterior:

| Archivo | Línea(s) | Significado | Acción |
|---|---|---|---|
| frontend/app/pages/index.vue | 80, 116, 153 | FAQ, hero, precio 18 €/mes | Reescritos con COMMERCIAL_PLAN |
| frontend/app/pages/register.vue | 93 | Plan al registrarse | Precio centralizado |
| frontend/app/pages/dashboard.vue | 67 | Onboarding sin negocios | Precio centralizado |
| frontend/app/pages/businesses/index.vue | 173 | Creación/activación | Precio centralizado |
| frontend/app/pages/billing/[businessId].vue | 293, 372, 373, 391 | Precio, prueba, recontratación y botón | Precio centralizado y aclaración sobre contratos anteriores |
| backend/.env.example | 8 | STRIPE_PRICE_ID de ejemplo | Se conserva, sin ID inventado |
| backend/src/config/env.js | 43 | Valida STRIPE_PRICE_ID | Se conserva |
| backend/src/modules/subscriptions/stripeService.js | 7, 8, 17 | Carga/valida el Price externo | Se conserva |
| backend/.env local | valor no expuesto | Hay STRIPE_PRICE_ID configurado | No modificado ni consultado en Stripe |

Son **diez expresiones comerciales antiguas** en cinco páginas. No quedan importes comerciales de 18 € en fuentes de aplicación.

## 10. Coincidencias que no se cambian

`backend/test/translations-database-edges.sql` comprueba un **plato de 18 €**, y `docs/microsites/verification/run-database.cjs` prepara ese precio de producto. No son la tarifa SaaS. Versiones como dotenv 18.0.4, radios de 18 px, iconos de 18 px y conteos de 18 tests no son precios.

Las capturas, tar de seguridad e informes históricos siguen documentando el estado anterior; no son contenido comercial vigente. Las pruebas nuevas buscan el literal `18 €` para detectar regresiones. Este informe y el inventario lo conservan explícitamente como histórico. No se hizo un reemplazo global del número 18.

## 11. Situación real de Stripe — requisito antes del despliegue

Checkout envía `line_items: [{ price: PRICE_ID, quantity: 1 }]`; `PRICE_ID` viene de **STRIPE_PRICE_ID del backend**. No calcula el importe desde el frontend. La prueba continúa siendo `trial_period_days: 7` cuando corresponde, con tarjeta obligatoria y checks existentes.

Hay un Price ID configurado localmente. **No se consultó Stripe, por lo que su importe real no está verificado. Cambiar esta interfaz NO cambia el importe que cobra Checkout.** Si ese Price sigue siendo 18 €, seguirá cobrando 18 € hasta configurar el nuevo.

**No publicar la oferta nueva hasta verificar/configurar en Stripe un Price mensual EUR de 1599 céntimos y el STRIPE_PRICE_ID correspondiente.** Las suscripciones ya existentes conservan su Price; migrarlas, si se desea, requiere una decisión y operación separadas. No se crea/cambia/cancela ninguna suscripción por esta entrega.

## 12. Responsive y accesibilidad

Comprobado a 320, 375, 390, 430, 768, 1024, 1280 y 1440. Header móvil, texto → CTA → mockup siempre presente; columnas se apilan, panel y pricing se adaptan y QR escala sin alterar sus exportaciones.

Se reutilizan focus visible, contraste, objetivos táctiles y reduced motion del sistema actual. Menú móvil con aria-expanded, Escape y retorno de foco. FAQ/details por teclado; idioma/plantilla con aria-pressed y nombres accesibles; una sola h1, headings, nav/main/footer semánticos, skip-link, alt y dimensiones de imágenes. No se ocultan capacidades necesarias.

## 13. SEO

Title y descripción orientados a web para restaurantes/carta digital/QR, canonical al origen de la petición, Open Graph y Twitter con imagen local 1200×630, `lang=es`, headings y enlaces internos válidos. HTML inicial SSR con propuesta y precio. No se modificaron canonical, JSON-LD, SSR ni metadatos de micrositios.

## 14. Rendimiento

Sin dependencias nuevas, vídeo, librería de animación ni fuentes externas nuevas. Mockups compartidos en un componente de presentación, SVG propios ligeros y una imagen social PNG de aproximadamente 61 KB. Imágenes secundarias lazy; portada hero pequeña y dimensiones declaradas. Ninguna demo hace peticiones de datos/traducción. qrcode/jsPDF siguen en la experiencia privada de QR, no se cargan para dibujar el QR de ejemplo de la landing.

El QR de ejemplo es estático y abre la landing de Carteliax; su leyenda lo indica. No corresponde a un cliente o establecimiento real.

## 15. Pruebas y resultados

| Verificación | Resultado |
|---|---|
| Build Nuxt producción | PASS — 6,79 MB servidor / 1,65 MB gzip; sin dependencias nuevas |
| Typecheck root/app/server/shared/node | 5/5 PASS |
| Tests unitarios backend | 32/32 PASS |
| SQL local (traducciones/guards/reutilización/micrositios) | 95 comprobaciones PASS |
| Concurrencia de traducciones | 3/3 PASS |
| Integración API Express/PostgreSQL local | 18/18 PASS |
| Contraste/integridad anterior + contratos de esta pasada | 6/6 PASS; 32 manejadores críticos intactos |
| Regresión heredada (CRUD, diseño, idiomas, billing, público) | 275 comprobaciones PASS |
| Responsive general, interacciones, idiomas de perfil | 104 + 70 + 3 PASS |
| Landing/QR/precio y nueve casos QR | 32 comprobaciones PASS |
| Recorrido landing → web pública | 1 PASS, Auth/Checkout/trial simulados |
| Total navegador | **485 comprobaciones PASS** |
| Errores JS / overflow en escenarios comprobados | **0 / 0** |
| Llamadas públicas a Groq | **0** |

El recorrido completo crea el establecimiento y la carta, activa el trial simulado, publica carta/diseño y abre el QR/web. Las demás regresiones verifican productos, imágenes, precios, alérgenos, disponibilidad, categorías, orden, traducciones/manual/publicación/fallback, Portal y todos los estados de suscripción. El QR nuevo se decodifica desde PNG y desde los píxeles del PDF; legacy se verifica también como respuesta HTTP 302 real del Nuxt local.

[Resultados estructurados](docs/landing-qr-pricing/verification/results.json), [logs y pruebas reproducibles](docs/landing-qr-pricing/verification/README.md), [evidencia de decodificación](docs/landing-qr-pricing/verification/qr-decoding.json).

Las pruebas utilizan Auth/Storage/Stripe interceptados, fixtures HTTP locales y PostgreSQL desechable protegido por puerto/directorio. **No hay consultas ni escrituras en Supabase, Stripe o Groq reales.** PNG/PDF se descargan realmente; el PDF se rasteriza con pdftoppm y ambos se decodifican con libzbar. No se deduce su contenido del campo de URL.

## 16. Archivos modificados

Nueve fuentes existentes: `frontend/app/pages/index.vue`, `register.vue`, `dashboard.vue` (solo precio), `businesses/index.vue` (precio/acceso QR), `businesses/[id].vue` (acceso QR), `menus/index.vue` (QR común/copiar enlace), `menus/[id]/qr.vue` (compatibilidad privada), `billing/[businessId].vue` (precio/copy) y `components/menus/MenuQrGenerator.vue` (destino/composición).

Nuevos: `frontend/app/pages/businesses/qr/[id].vue`, `frontend/app/components/landing/RestaurantPreview.vue`, `frontend/app/utils/commercialPlan.ts`, `frontend/public/images/landing/{restaurant.svg,dish.svg,qr-example.svg,social.png}`, este informe y `docs/landing-qr-pricing/**`.

Las suites existentes adaptan únicamente pasos/expectativas de QR a la simplificación expresamente solicitada: `docs/microsites/verification/{regression-additional,regression-states,regression-extended,microsites-browser}.cjs` y `docs/ui-redesign/verification/interactions.cjs`. El resto de contratos/assertions se conservan. No cambian packages/locks, CSS global, shell, backend, SQL, políticas ni variables.

## 17. Riesgos y límites reales

- El importe remoto Stripe y las transacciones reales no se verifican: exige el paso manual antes de desplegar.
- Las pruebas de navegador no sustituyen móvil/cámara físicos, Safari o lector de pantalla. No se probó envío real de correo ni uploads reales; son simulados.
- El QR requiere el public_slug de los micrositios ya existentes; ante configuración incompleta se informa y se bloquea solo la generación nueva.
- No se certifican tiempos de carga en una red móvil física ni puntuaciones Lighthouse. Se comprueban build, SSR, tamaño de assets, geometría y flujos locales.
- Se conserva la facturación por establecimiento y las reglas previas de acceso. La permanencia de dirección no implica servicios activos sin suscripción.
- No hay logo definitivo identificable en el repositorio: se usa la marca/icono BookOpen del rediseño, sin referencias a imágenes inexistentes. El favicon existente se conserva.

## PASOS MANUALES PARA JORDI

**No hace falta SQL, ninguna operación en Supabase/Storage, nuevos buckets o nuevas migraciones. No hay variables nuevas.**

1. En Stripe, comprobar el Price actual. Si no es mensual EUR de **15,99 €**, crear un nuevo Price recurrente mensual de **1599 céntimos** para Carteliax. No se puede cambiar el importe de un Price existente. Prepararlo en el modo correspondiente: test para pruebas y live para producción.
2. Configurar **STRIPE_PRICE_ID del backend** con el ID correcto y reiniciar/desplegar el backend para que lo lea. No cambiar claves Stripe ni las variables de Supabase por este trabajo. Las suscripciones anteriores no migran automáticamente.
3. Antes de publicar la landing, comprobar en modo test: Checkout muestra **15,99 €/mes**, la prueba de **7 días** solo cuando corresponde, retorno al panel y Portal. No activar un cobro real para esta validación.
4. Desplegar el frontend con el flujo habitual **después de alinear Stripe y precio anunciado**.
5. Comprobar en un móvil físico un PNG/PDF escaneado, una web con una/varias/sin cartas, idioma y un QR antiguo `/c/...`. Recorrer landing → registro → negocio → activación → carta → publicación → QR → web en el entorno de pruebas.
6. Solo si quieres incorporar ahora el logo definitivo: colocar el SVG en `frontend/public/brand/carteliax.svg` y preparar el icono en `frontend/public/favicon.ico`. El SVG no se referencia hasta integrarlo; la marca actual funciona sin este paso. Header, auth y sidebar conservan los espacios de marca del design system.
