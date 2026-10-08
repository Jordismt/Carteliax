# Mini web del restaurante + carta QR + multiidioma

Implementación y verificación local: 7 de octubre de 2026. **No se ejecutó ninguna migración ni escritura contra Supabase real.** La activación en producción requiere los pasos manuales del final.

## Arquitectura elegida

La mini web pertenece a `businesses`; las cartas siguen perteneciendo al establecimiento. Nuxt renderiza la nueva página con SSR, consulta su proxy Nitro y este consulta Express. Express reutiliza `loadPublicMenu`, extraído del controlador público existente conservando consultas, filtros y respuesta: publicación de carta y diseño, categorías visibles, relaciones, productos disponibles, precios, imágenes y alérgenos.

La presentación reutiliza `MenuLivePreview`, el mismo componente de la carta y del editor. La propiedad opcional `embedded` evita repetir portada, identidad y footer dentro de la mini web, conservando bienvenida, navegación por categorías, productos, configuración visual y selector de idioma. El modo anterior y los previews privados conservan su presentación completa. Si falta una portada propia del establecimiento, se aprovecha la portada publicada de la carta seleccionada.

`PublicMenuContent` comparte la presentación pública y `usePublicMenuLanguage` comparte la lógica de selección, idioma explícito, preferencia del navegador, almacenamiento local y fallback. No hay otro motor de cartas ni un page builder.

La carta aparece después de una cabecera breve, antes de Sobre nosotros, contacto, horario y ubicación. Un CTA visible en la navegación permanece accesible; los enlaces a una carta llevan directamente a `#carta`.

Auditoría anterior a los cambios: [docs/microsites/AUDITORIA.md](docs/microsites/AUDITORIA.md). Copia previa de fuentes en `/tmp/carteliax-microsites/before`. El repositorio no contiene el esquema ni políticas originales completos; la consulta de inspección entregada permite contrastarlos en el proyecto real.

## URL, varias cartas y QR

- General: `/restaurante-jordi`.
- Carta concreta: `/restaurante-jordi?menu=bebidas#carta`.
- Idioma explícito: `/restaurante-jordi?menu=bebidas&lang=en#carta`.
- La ruta de un segmento utiliza `businesses.public_slug`, único y permanente. No utiliza el UUID del establecimiento.
- El parámetro `menu` usa el identificador legible existente de la carta. Se evita crear otra ruta dinámica de dos segmentos y sus posibles conflictos con rutas privadas Nuxt.
- Con una carta publicada no aparecen pestañas. Con varias, aparecen sus nombres; por defecto se elige la primera por orden y fecha de creación. Solo se incluyen cartas publicadas que también tengan diseño publicado.
- Una selección inexistente o retirada devuelve 404; no expone borradores ni cambia silenciosamente a otra carta.
- Sin cartas publicadas, la mini web puede mostrar la información del restaurante y un aviso de carta próxima.
- Los nombres y la información pueden cambiar sin cambiar la dirección. No se permite editar la dirección después de creada, tampoco mediante escrituras directas en la base. Esto elimina la necesidad de aliases en esta primera implementación y protege los QR impresos frente a cambios de nombre.
- Normalización en backend, validación en backend y SQL, índice único y trigger. Se reservan todas las rutas internas actuales y otras previsibles. Los nombres reservados y duplicados históricos se resuelven con sufijos numéricos durante el backfill. Los UUIDs tampoco se aceptan como dirección nueva del establecimiento.
- `/c/:businessId/:menuSlug` y su API se conservan. Con la función activada, la página legacy valida la publicación usando el lector original y redirige con **302** a la dirección limpia, conservando carta e idioma. La redirección temporal facilita rollback; no se ha elegido una redirección irreversible en la caché del navegador.
- El generador QR permite elegir esta carta directamente o la mini web general. Configuración también ofrece un QR general. Se conservan `qrcode`, `jspdf`, personalización, logo y descarga PNG/PDF.
- Los QRs impresos antiguos siguen entrando por la ruta legacy. Si se retira una carta, su QR muestra que no está disponible, como antes. Borrar un establecimiento o una carta sigue retirando ese recurso; no se promete supervivencia tras borrado.

## Datos y SQL aditivo

Nueva migración: `supabase/migrations/202610070001_business_microsites.sql`. No se modificó `202610060001_menu_translations.sql`.

| Tabla existente | Columna nueva | Uso |
| --- | --- | --- |
| businesses | public_slug text, no nulo | Dirección única, segura y permanente |
| businesses | public_profile jsonb, no nulo, por defecto {} | Perfil público tipado y validado |
| businesses | cover_url text, nullable | Portada procesada en Storage |

No se crea ninguna tabla de negocio ni se modifican IDs, slugs históricos, cartas o datos de suscripciones. Se mantiene nombre, descripción, logo, color e idioma existentes.

El perfil contiene únicamente plantilla, Sobre nosotros, teléfono, WhatsApp, email público, dirección, localidad, código postal, Google Maps, Instagram, Facebook, TikTok, web externa, horario y textos traducidos manualmente. Este objeto se edita mediante campos normales, sin mostrar JSON al propietario. Es una configuración acotada, con límites, tipos y claves permitidas tanto en Zod como en SQL.

El horario es una lista de días (0 lunes a 6 domingo) con hasta dos intervalos `{open,close}` por día. Día ausente = sin indicar; intervalos vacíos = cerrado. Cierre anterior a apertura = turno nocturno. Se validan horas, días únicos, límites y solapamientos, incluidos los que cruzan medianoche dentro del día configurado. No se incorporan calendarios de festivos ni horarios de temporada.

Funciones nuevas: `cx_public_slug_valid`, `cx_normalize_public_slug`, `cx_public_profile_valid`, `cx_business_public_address`. Constraints para dirección, perfil y URL de portada. Índice único `businesses_public_slug_unique`. Trigger de asignación e inmutabilidad de dirección. Backfill determinista y transaccional: solo rellena la columna nueva.

## Seguridad, RLS y Storage

Las columnas nuevas heredan la RLS y los permisos existentes de `businesses`. **No se añaden políticas de lectura pública sobre businesses ni se amplían permisos generales de esa tabla.** Las escrituras API conservan JWT, ownership por `owner_id`, cliente de usuario y comprobación de suscripción existente.

Nuevo bucket público `business-covers`, límite 5 MB, MIME `image/webp`. La migración lo crea. Políticas nuevas de Storage: `cx_cover_owner_insert`, `cx_cover_owner_select`, `cx_cover_owner_delete`. Exigen pertenencia de la carpeta al establecimiento del propietario; la inserción también valida el nombre del archivo. No se permite sobrescribir mediante una política de update. No se modifican buckets/políticas de logos ni productos.

La subida backend valida imagen real mediante sharp, admite JPEG/PNG/WebP, limita píxeles y tamaño, aplica orientación, reduce a un máximo de 1600×1000 y genera WebP. Guarda mediante actualización condicional para detectar cambios concurrentes. Una respuesta de red ambigua se verifica antes de borrar el archivo nuevo. La portada anterior se limpia después de guardar la nueva y solo dentro del bucket y carpeta esperados.

URLs de redes y mapas exigen HTTPS, sin credenciales/puertos explícitos y con hosts permitidos. La web externa exige HTTPS. Sobre nosotros y traducciones se tratan como texto y rechazan HTML; Vue los escapa. JSON-LD escapa `<`. No se añade `v-html`, claves privadas, cambios de CORS ni nuevos permisos multi-tenant.

La comparación con la copia previa confirma que Stripe, middleware de Auth/suscripción, proveedor/worker/repositorio de traducciones y migración multiidioma permanecen intactos.

## Rutas y endpoints

| Tipo | Cambio |
| --- | --- |
| Nuxt pública | Nueva `/:publicSlug` |
| Nuxt legacy | `/c/:businessId/:slug`, conservada con redirección opcional |
| Nitro | Nuevo `GET /api/public/sites/:slug?menu=…` |
| Express pública | Nuevo `GET /api/public/sites/:slug?menu=…` |
| Express legacy | `GET /api/public/menus/:businessId/:slug`, mismo contrato con public_slug opcional cuando se activa |
| Express privada | `GET/POST/PATCH /api/businesses…`, extensiones aditivas de datos/validación |
| Express privada | Nuevos `POST /api/businesses/:id/cover` y `DELETE /api/businesses/:id/cover` |
| Express privada | `GET /api/menus/:id` añade dirección pública al resultado cuando se activa, para sus enlaces |

`GET /api/businesses` comunica `microsites_enabled`. Con la bandera desactivada se omiten campos de micrositio de las respuestas privadas usadas para construir enlaces; QR y enlaces siguen utilizando legacy aunque ya se haya aplicado el SQL.

## Páginas y componentes

Nuevos: `pages/[publicSlug].vue`, `components/public/RestaurantSite.vue`, `components/public/PublicMenuContent.vue`, `components/businesses/PublicProfileEditor.vue`, `composables/usePublicMenuLanguage.ts`, `types/publicSite.ts`, `utils/publicUrls.ts`, `utils/publicSiteCopy.ts`, proxy Nitro y módulo Express `publicSites`.

Modificados: configuración y creación de establecimientos; lista/editor/QR de cartas; página pública legacy; `MenuLivePreview`; generador QR; controladores/esquemas/rutas de establecimientos; lector público y respuesta privada de carta. `useApi.ts` solo recibe una precisión de tipos para evitar inferencia circular de rutas Nitro; su comportamiento y validación de sesión son los mismos.

Crear un establecimiento mantiene el paso posterior de suscripción y un formulario breve. La configuración existente permite completar los datos públicos, elegir plantilla, subir/quitar portada, copiar dirección, abrir la web, generar QR y previsualizar los cambios. Datos menos frecuentes se agrupan en bloques desplegables. Los campos vacíos desaparecen de la web.

## Traducciones

Las cartas continúan leyendo `cx_public_translations`, sus publicaciones persistidas, idiomas habilitados, hashes/fallback y selección existente. No se cambió generación, edición manual, publicación de idiomas, duplicación con idioma fuente ni límites de Groq.

Los textos del establecimiento se amplían de forma conservadora con traducciones **manuales** de descripción y Sobre nosotros, guardadas dentro del perfil. Siguen el idioma disponible de la carta y comparten su selector. Incluyen una referencia al texto fuente: si cambia descripción, Sobre nosotros o idioma del establecimiento, la versión anterior deja de mostrarse hasta revisión; mientras tanto se muestra el original. Los datos de contacto, dirección y horario no se traducen automáticamente.

La cola actual está diseñada por carta y por recursos menu/category/product. Añadir generación automática para un recurso business exigiría alterar sus contratos y control de concurrencia. Se evita esa modificación para preservar el sistema recién implantado. No hay un segundo proveedor ni una llamada a Groq desde las nuevas rutas públicas. Los textos del perfil se hacen públicos al guardar; no tienen un flujo adicional de borrador/publicación. Las traducciones de carta sí conservan exactamente su flujo actual.

## Plantillas, móvil, ubicación y SEO

Cuatro estilos: **Moderna**, **Elegante** (oscura, serif), **Minimal** (blanca y compacta), **Clásica** (papel cálido, identidad centrada). Comparten datos y componentes, con diferencias en color de fondo, tipografía, composición, bordes y portada. El color principal y logo se mantienen; el diseño de las cartas sigue siendo independiente.

Verificados 320, 375, 390, 430, 768, 1024 y 1440 px. CTA inmediatamente visible, objetivos táctiles de al menos 44 px, enlaces tel/WhatsApp/Maps, carta primero y selector de idiomas junto a ella. No se observaron desbordamientos horizontales. Productos siguen cargando sus imágenes de forma diferida; portada propia se comprime a WebP. No se añade ninguna dependencia de runtime ni animación pesada. Se cargan únicamente las familias tipográficas seleccionadas de la carta.

Ubicación: dirección textual, enlace directo y mapa tras pulsar Mostrar mapa; no se descarga el iframe durante la lectura inicial. Se construye una URL HTTPS de Google a partir de nombre/dirección, sin recibir HTML de iframe. El enlace suministrado por el propietario permite señalar la ubicación exacta; si no existe, se construye una URL de indicaciones. **Maps URLs no requiere clave API**, según [Google](https://developers.google.com/maps/documentation/urls/get-started). El iframe de búsqueda depende del servicio público de Google; no se contrata Google Maps Platform. Una dirección ambigua puede situar el mapa incorrectamente: comprobarla manualmente.

SEO: SSR, título, descripción, Open Graph, Twitter Card, canonical de la mini web general, `lang`, un H1 por página, secciones semánticas, alt, datos estructurados Restaurant con contacto/dirección/horarios/enlaces/carta cuando existen. Canonical agrupa variantes `menu`/`lang` en la web general. Se conserva robots.txt; no se introduce sitemap dinámico sin necesidad de infraestructura nueva.

## Pruebas y resultados

Evidencias y scripts en `docs/microsites/verification/`; resumen `results.json`. Todas las cifras corresponden a esta ejecución, no a informes previos.

| Verificación | Resultado |
| --- | --- |
| Baseline antes de cambios | Build correcto; 28 tests backend; auditoría de todos los flujos y consumidores |
| Build final frontend | PASS |
| vue-tsc raíz/app/server/shared/node | 5 proyectos PASS |
| npm test backend | 32/32 PASS, incluidos tests multiidioma existentes |
| Cuatro suites SQL de traducciones | 65 comprobaciones PASS |
| SQL nuevo de micrositios | 30 comprobaciones PASS |
| Aplicación desde cero de ambas migraciones en base nueva local | PASS, con backfill/constraints/RLS nuevos |
| Concurrencia de traducciones | PASS |
| Integración Express → PostgreSQL de traducciones | PASS |
| Integración Express → PostgreSQL de micrositios | PASS; mismo contenido legacy/nuevo, multimenú, filtros, negativos de ownership/HTML/dirección, activación deshabilitada |
| Matriz de geometría de páginas existentes | 60 combinaciones; cero overflow y errores de JS |
| Suites heredadas de UI | 168 comprobaciones PASS: auth, CRUD, imágenes, precios, alérgenos, disponibilidad, diseño, preview/publicación, QR PNG/PDF, billing/Checkout/Portal y multiidioma |
| Suite mini web | 37 comprobaciones PASS: cuatro plantillas × siete anchos, idioma, multimenú, legacy, opcionales, sin cartas, SEO, QR, configuración y portada |
| Creación con datos esenciales de mini web | PASS, conservando flujo de suscripción |
| Visitas públicas sin Groq | 100 lecturas completas de API nueva sin trabajos ni peticiones externas; 20 lecturas API legacy sin proveedor; cambio público de idioma sin generación |
| Preservación de fuentes críticas | Migración multiidioma, Stripe, middleware y núcleo de traducción idénticos a copia previa |

Las regresiones de UI incluyen login/registro/logout, dashboard, establecimientos y configuración, crear/editar/duplicar cartas y productos, categorías/relaciones, precios/alérgenos/disponibilidad, imágenes, diseño/publicación, QR/PNG/PDF y estados de facturación. En multiidioma incluyen generación simulada, edición manual, conflictos, publicación, desactivación/reactivación, selector público, SSR y ausencia de solicitudes AI públicas.

## Límites reales y estado de producción

- No se ejecutaron migraciones, cambios de cuentas, operaciones Stripe ni escrituras de Storage en servicios reales.
- No existe dump de las políticas/funciones originales. RLS nueva se probó sobre un fixture de ownership; hay que contrastar las políticas originales con `supabase/inspection/microsites-preflight.sql`. Las funciones de duplicación originales se modelaron en el fixture, no se certifica su implementación remota.
- Stripe Checkout/Portal, usuarios y Storage de navegador se prueban con mocks. La API y las migraciones nuevas sí se prueban con Express/PostgreSQL real local y un adaptador de transporte que bloquea servicios externos.
- No se ha probado la cámara de un móvil, Safari físico, la geolocalización exacta del negocio ni el mapa en todas las redes. Las vistas móviles se verificaron en Chrome.
- La dirección del establecimiento no se puede editar. Los textos de establecimiento se traducen manualmente y siguen los idiomas públicos de la carta seleccionada; sin cartas publicadas no hay selector independiente.
- Cada visita consulta datos persistidos; no se añadió una capa de caché que pudiese mostrar una carta retirada. No se realizó una prueba de carga de producción.
- Los permisos existentes de la tabla y las políticas de logos/productos no se alteraron. Si el proyecto usa permisos por columna en lugar de por tabla, contrastarlos antes de desplegar las columnas nuevas.
- Los QR PNG/PDF nuevos conservan su motor; el escaneo con cámara y la impresión deben comprobarse manualmente tras activar el dominio real.

## PASOS MANUALES PARA JORDI

1. **SQL.** En Supabase SQL Editor ejecutar primero la consulta de solo lectura `supabase/inspection/microsites-preflight.sql` y comprobar ownership/RLS de businesses y recuentos. Después ejecutar **una sola vez** `supabase/migrations/202610070001_business_microsites.sql`. No volver a ejecutar ni modificar la migración multiidioma ya aplicada. La migración nueva es una transacción: si aparece un error, no activar la bandera hasta resolverlo. Después comprobar `select id,name,slug,public_slug from public.businesses order by created_at;` y repetir recuentos. El slug antiguo y los IDs deben seguir iguales; los sufijos de direcciones se asignan automáticamente cuando hacen falta. No ejecutar archivos de `backend/test` o `schema-fixture.sql` en Supabase.
2. **Buckets/configuración.** El mismo SQL crea `business-covers` público, 5 MB, MIME image/webp y tres políticas de propietario. Verificarlo en Storage. Si ese bucket ya existía, el SQL conserva su configuración: contrastar público/límite/MIME con esos valores. No recrear ni cambiar `business-logos` ni `product-images`.
3. **Variables.** Añadir en el backend `MICROSITES_ENABLED=true` **después del SQL**. Se documenta en backend/.env.example. Mantener `TRANSLATIONS_ENABLED=true` si el sistema multiidioma ya estaba activado. No hace falta una clave de Maps ni otra variable frontend. Mantener NUXT_API_BASE_URL apuntando al backend del entorno y NUXT_PUBLIC_API_URL/FRONTEND_URL coherentes con el despliegue existente. No copiar valores de los fixtures 5099/3001 a producción.
4. **Reiniciar/desplegar.** Reiniciar/desplegar el backend con la variable anterior. Hacer `npm run build` desde frontend y desplegar/reiniciar Nuxt en su alojamiento habitual. No hay nuevos paquetes de runtime. No es necesario reiniciar Stripe ni Supabase. Para rollback de aplicación, desactivar MICROSITES_ENABLED y reiniciar backend; dejar el SQL aditivo aplicado y usar las URLs legacy.
5. **URLs.** Abrir la dirección exacta que muestra Configuración → Dirección de tu web. Si es restaurante-jordi: `https://carteliax.vercel.app/restaurante-jordi`, `?menu=<dirección-de-carta>#carta` y `?menu=<dirección-de-carta>&lang=en#carta`. Probar también `/login`, `/register`, `/dashboard`, `/businesses`, `/menus` y `/billing/<id>`: siguen siendo rutas internas. Usar nombres de cartas realmente publicados; cada diseño también debe estar publicado.
6. **Flujo completo.** Iniciar sesión y registrar un usuario de prueba si procede. Crear un establecimiento con datos esenciales; comprobar el paso de suscripción. En configuración completar contacto, horario, portada, plantilla y textos manuales; guardar, copiar enlace y abrir preview/web. Probar cada plantilla y quitar opcionales para comprobar que desaparecen. Crear/editar/duplicar cartas, categorías/productos, imágenes, precios, alérgenos, marcar agotado/disponible, publicar carta y diseño. Probar una carta, varias y retirada de una carta concreta. Descargar QR general y específico en PNG/PDF, escanearlos con un móvil; entrar en billing y comprobar Checkout/Portal en el modo Stripe apropiado.
7. **QR y URL antiguos.** Escanear un QR ya impreso o abrir un enlace real `/c/<businessId>/<menuSlug>`, por ejemplo el que utilizabas antes. Debe llegar a la mini web limpia con esa carta seleccionada. Probar también con `?lang=en`. Cambiar solo el nombre del restaurante y volver a probar QR viejo y nuevo: la dirección pública permanece igual. En DevTools Network, el acceso legacy debe redirigir 302 al nombre público cuando la carta está publicada. El endpoint legacy sigue respondiendo; una carta retirada permanece no disponible, como antes.
8. **Multiidioma y consumo.** Desde Idiomas de una carta generar/revisar/publicar una traducción y comprobar edición manual/fallback. Anotar el contador/uso de Groq; después abrir repetidamente web nueva y enlace legacy en incógnito y cambiar entre idiomas publicados, sin pulsar Generar desde el panel. Las visitas deben leer solo GET públicos (Nitro/Express); no deben aparecer POST `/languages/.../translate`. Contrastar también logs backend, número de trabajos `menu_translation_jobs` y contador de solicitudes de Groq antes/después: las visitas no deben crear trabajos ni solicitudes al proveedor. Los textos manuales del establecimiento tampoco deben consumir Groq. No confundir una generación privada pendiente con el tráfico de visitas públicas.
