# Rediseño UI/UX de Carteliax

7 de octubre de 2026. Rediseño sobre la aplicación existente: Nuxt/Vue/Tailwind, contratos y funcionalidades conservados. No se ha desplegado ni se han realizado escrituras o migraciones sobre Supabase real.

## 1. Auditoría inicial y estado previo

Se revisaron las páginas, layout, formularios, estados, estilos, navegación móvil, componentes, manejadores, composables, middleware, rutas públicas SSR, tipos y las dependencias con Auth, Storage, Stripe y traducciones. Se contrastaron los contratos con el registro de rutas Express, los validadores, ownership, guards y la auditoría anterior de micrositios.

Auditoría detallada: [AUDITORIA.md](docs/ui-redesign/AUDITORIA.md).

Antes de modificar la aplicación se guardaron **98 archivos de fuentes** y sus SHA-256. Copia original en `/tmp/carteliax-ui-redesign/before`, y copia persistente en [before-source.tar.gz](docs/ui-redesign/verification/before-source.tar.gz), con [manifiesto](docs/ui-redesign/verification/before-manifest.json). Excluye `.env`, node_modules y datos de usuarios. No se realizó un commit en el Git padre del Escritorio porque incluye cambios ajenos al proyecto.

Baseline: **32 tests backend**, y **104 combinaciones de 13 rutas × 8 anchuras** sin desbordamiento ni errores JS. Capturas previas y posteriores de cada ruta a 390/1440 px. [Resultados previos](docs/ui-redesign/verification/before-responsive.json), [posteriores](docs/ui-redesign/verification/after-responsive.json).

## 2. Problemas UX detectados

- Botones y cajas con demasiado peso visual; acciones frecuentes, secundarias y destructivas compitiendo.
- Configuración del restaurante muy larga, con imágenes, enlace, QR y datos alejados del guardado.
- Acciones de carta dispersas entre pantallas, sin navegación compartida.
- Confusión entre actualización inmediata de productos y publicación del diseño/idiomas.
- Compartir el enlace del QR escondido dentro de personalización.
- Autenticación y landing poco conectadas visualmente con el panel.
- Falta de ejemplos y validación comprensible para enlaces de contacto/redes.
- Portada móvil del restaurante retrasando la carta.
- Errores técnicos reenviados a la interfaz y estados vacíos poco orientativos.

## 3. Sistema visual

Tokens en `frontend/app/assets/css/main.css`, compartidos por el panel y la autenticación. El renderizador de la carta conserva los colores y fuentes del propietario.

| Elemento | Decisión |
| --- | --- |
| Marca | Verde profundo `#235747`; sidebar `#193e34` |
| Fondo / superficies | Fondo cálido `#f5f5f0`, tarjetas blancas |
| Texto | Principal `#1e302b`, secundario `#52655d`, metadata `#5f6d64` |
| Estados | Tokens independientes para éxito, advertencia, peligro e información |
| Espaciado | Escala 4, 8, 12, 16, 20, 24, 32, 40 y 48 px |
| Radios | 8 px controles, 12 px agrupaciones, 18 px superficies |
| Sombras | Sutiles en tarjetas, elevación reservada a diálogos |
| Tipografía | Inter con fallback del sistema; títulos claros y metadata subordinada |
| Iconos | Lucide existente, sin añadir otra familia |
| Interacción | Hover, pressed, foco visible, estado ocupado y reduced motion |

El contraste de los tokens de texto y estados supera **4,5:1** sobre sus superficies. Es una comprobación de la paleta de la aplicación, no una certificación WCAG de cada carta personalizada.

## 4. Componentes nuevos y modificados

Nuevos componentes de presentación:

- `UiPageHeader`: título, contexto y acción principal.
- `UiNotice`: feedback accesible de información, éxito, error y advertencia.
- `UiSkeleton`: carga sin sustituir datos por una pantalla vacía.
- `UiMenuNavigation`: Productos, Diseño, Idiomas y QR, con estado activo.
- `UiAuthFrame`: marca y composición compartidas para acceso y registro.

`uiErrors.ts` presenta fallos conocidos en español y evita mostrar detalles de transporte, SQL o proveedores. Conserva mensajes específicos de conflictos de traducción mediante sus códigos existentes.

Se modificó la presentación de ProductManager, SubscriptionBadge, PublicProfileEditor, MenuThemeEditor, MenuQrGenerator y RestaurantSite. Se mantuvo MenuLivePreview sin cambios. No se creó una librería UI ni se sustituyeron todos los controles existentes.

El plugin de accesibilidad de diálogos conserva su gestión de teclado y retorno de foco, y ahora respeta un campo que el usuario ya haya elegido durante la apertura.

## 5. Cambios por pantalla y comparación

| Pantalla | Resultado | Funcionalidad conservada |
| --- | --- | --- |
| Landing | Identidad editorial, ejemplo de carta, tarjetas con iconos, precio y FAQ legibles | Enlaces, contenido, registro; sin clientes, reviews ni estadísticas ficticias |
| Login / registro | Composición común, formulario claro, errores en español | Supabase, mostrar contraseña, validación y confirmación por correo |
| Navegación | Sidebar sobria, contexto, cuenta/facturación y navegación inferior móvil | Rutas, logout, drawer, Escape e inert |
| Inicio | Restaurante protagonista y acción para gestionar cartas; enlace a web cuando existe | Suscripciones reales; sin nuevas métricas ni llamadas protegidas adicionales |
| Establecimientos | Crear con nombre y dirección web; datos secundarios desplegables | Dirección permanente, idiomas y paso posterior de suscripción |
| Configuración | Información / Web y contacto / Imágenes; guardado persistente | Perfil, horario, traducciones manuales, logo, portada, color, preview y QR general |
| Listado de cartas | Acción principal y accesos claros; Ajustes, Duplicar y Eliminar bajo Más opciones | Todas las acciones, publicación y confirmaciones existentes |
| Editor | Navegación compartida, filas compactas, categorías abiertas en escritorio y plegables en móvil | Catálogo reutilizable, relaciones, filtros, precio, fotos, alérgenos y disponibilidad |
| Categorías / productos vacíos | Explican cómo continuar y dónde añadir contenido | No se ocultan categorías ni productos del catálogo |
| Diseño | Jerarquía de guardar/publicar, controles y preview coherentes | Todos los ajustes, estilos, layouts, borrador, reset y protección de salida |
| Idiomas | Estado comprensible, revisión original/traducción más legible | Cola, límites, revisión, manual, actualización, publicación y fallback |
| QR | Destino explicado; enlace visible; personalización secundaria y feedback de descarga | General/específico, logo, colores, canvas, PNG/PDF y legacy |
| Facturación | Plan, estado, fechas y acciones con jerarquía | Trial, Checkout, Portal, pendientes, cancelación y guards |
| Micrositio | Cabecera compacta, carta pronto y cuatro identidades visuales | Una/varias/sin cartas, idiomas, datos opcionales, contacto, mapa y SEO |

Comparación con fuentes previas: **22 archivos existentes de aplicación modificados**, seis nuevos archivos de UI (cinco componentes y una utilidad). Los contratos de llamadas de las páginas/componentes Vue modificados se contrastaron con el estado previo. Las acciones secundarias siguen disponibles y se prueban también por teclado.

Capturas en [docs/ui-redesign/screenshots](docs/ui-redesign/screenshots), con nombres `before-…` y `after-…` por pantalla/anchura; se incluyen las cuatro plantillas públicas.

## 6. Decisiones UX importantes

- Se conserva un único formulario de configuración: cambiar sección mantiene los cambios. La validación revela la sección y acordeón del primer campo incorrecto antes de enfocarlo, incluso con varios errores en secciones distintas.
- La información adicional al crear se completa opcionalmente o después; no se introduce un wizard.
- La carta conserva tres vistas: por categorías, una categoría y todo el negocio. El catálogo compartido no desaparece.
- Las acciones destructivas mantienen sus confirmaciones. No se modificaron los procedimientos de borrado o duplicación.
- Se explica que productos, precios y disponibilidad se actualizan al guardar. Diseño e idiomas se publican por separado. La marca de publicación de la carta también necesita diseño publicado para aparecer en el QR.
- La dirección web permanece inmutable y no se altera al renombrar el restaurante.
- Las cuatro plantillas de mini web comparten datos y componentes: Moderna (verde claro y composición actual), Elegante (oscura y serif), Minimal (blanca y esencial), Clásica (cálida, serif y composición centrada en escritorio).

## 7. Mejoras mobile

Se verifican **320, 375, 390, 430, 768, 1024, 1280 y 1440 px**.

- Navegación inferior para acciones frecuentes y drawer para cuenta/cierre de sesión.
- Las secciones de carta pasan a cuatro accesos táctiles compactos.
- Filas de producto adaptadas: acciones a la derecha en escritorio y debajo en móvil.
- Categorías organizables sin ocupar permanentemente la primera pantalla del móvil.
- Guardado accesible sobre la navegación inferior; acciones de diseño también adaptadas.
- Modales dentro del viewport, incluso con alturas de 360/420 px.
- Selector de portada limitado al ancho disponible; corregido un desbordamiento detectado a 320 px.
- Micrositio con portada móvil de 88 × 122 px y CTA a Carta visible arriba. La información del restaurante sigue después de los platos.

## 8. Accesibilidad

Foco visible, skip link, labels, controles con nombres accesibles, estado activo, errores/feedback con roles, teclado en desplegables, focus trap y retorno de foco en modales, Escape, inert y bloqueo/restauración del scroll móvil. Inputs móviles de al menos 16 px y objetivos táctiles de 44 px en los controles comprobados.

Se corrigió una carrera detectada al escribir inmediatamente después de abrir un diálogo: el enfoque inicial ya no mueve la escritura a otro campo.

El selector de textos del establecimiento elige otro idioma válido cuando el original es español, inglés o valenciano, evitando una selección vacía. La validación de enlaces da ejemplos y errores junto a los campos, revela controles plegados y bloquea el envío inválido. El backend sigue siendo la autoridad. No se admite HTML en los textos del perfil.

Las animaciones respetan `prefers-reduced-motion`. No se añadió animación pesada, glassmorphism ni dependencias de efectos.

## 9. Funcionalidades críticas preservadas

**67 archivos conservan exactamente su SHA-256**, incluyendo los 49 archivos del backend auditados, cuatro archivos Supabase, dos proxies SSR y los archivos críticos de Auth, API, rutas públicas, URLs, localización y renderizador de carta. **32 manejadores originales** de datos, publicación, Storage, QR y suscripción conservan su código.

- Sin cambios de endpoints, payloads, ownership, JWT, RLS, service role, guards, Stripe ni migraciones.
- Sin cambios de IDs, modelo multi-carta, category_products, precios, disponibilidad o alérgenos.
- Logo y portada conservan sus transportes y permisos distintos; no se modifican buckets.
- Los idiomas conservan generación privada, Groq en backend, hashes, revisión, publicación persistida, stale detection, límites y fallback.
- Visitas y cambios de idioma públicos no generan traducciones ni llaman a Groq. La integración local verifica 100 lecturas de micrositio sin trabajos ni peticiones externas.
- `/:publicSlug`, `?menu=`, `#carta`, `?lang=` y `/c/:businessId/:slug` mantienen sus resoluciones/redirecciones.
- SSR, title, description, canonical, Open Graph, JSON-LD y robots existentes permanecen intactos.

## 10. Pruebas realizadas

Pruebas locales, datos simulados y PostgreSQL desechable. Detalle y comandos: [verification/README.md](docs/ui-redesign/verification/README.md).

Cobertura de navegador: Auth, registro/logout, establecimientos, perfil/portada/logo, cartas y duplicación, categorías y orden, productos/relaciones/fotos/precios/alérgenos/disponibilidad, diseño/preview/publicación/guards, idiomas/manual/publicación/fallback, QR general/específico/PNG/PDF/enlace, billing/trial/Checkout/Portal/402, micrositios/SSR/SEO/legacy y responsive.

Las pruebas heredadas mantienen sus aserciones de datos y contratos; solo se adaptó el acceso a acciones que ahora están en secciones o desplegables y el texto de un estado vacío. Se ampliaron matrices y diálogos a las ocho anchuras. Nuevas pruebas cubren validación entre secciones, foco, QR general y contraste/integridad.

## 11. Resultados

Los resultados finales se registran en [results.json](docs/ui-redesign/verification/results.json), junto a los logs y JSON de cada suite.

| Comprobación | Resultado |
| --- | --- |
| Build frontend (`npm run build`) | PASS |
| Typecheck raíz/app/server/shared/node | 5/5 PASS |
| Tests backend existentes | 32/32 PASS |
| Traducciones/micrositios SQL locales | 95/95 aserciones PASS |
| Concurrencia local | 3/3 PASS |
| Integraciones API locales | 18/18 PASS |
| Contraste e integridad de fuentes/manejadores | 3/3 PASS |
| Flujos privados heredados | 45/45 PASS |
| Estados, diálogos y teclado heredados | 44/44 PASS |
| Diseños/layouts de carta pública | 99/99 PASS |
| Multiidioma | 37/37 PASS |
| Micrositios y portada en ocho anchuras | 49/49 PASS |
| Creación de establecimiento con datos públicos | 1/1 PASS |
| Nuevas interacciones, secciones y QR general | 70/70 PASS |
| Selector de textos con original es/en/ca | 3/3 PASS |
| Responsive posterior | 104/104 PASS |

**452 comprobaciones de navegador posteriores**, más 104 de baseline previo. Cero excepciones JS y cero desbordamientos horizontales en los escenarios comprobados; cero peticiones públicas a Groq. Build final sin errores; no se añadieron dependencias de aplicación.

Incidencias corregidas durante la verificación: anchura del input de portada, contraste del texto secundario, validación de campos ocultos y carrera del enfoque inicial del diálogo. No quedan fallos conocidos en las suites ejecutadas.

## 12. Limitaciones de lo comprobado

- Auth, Storage y Checkout/Portal se prueban con mocks. No se han creado usuarios reales, subido imágenes remotas, realizado cobros ni abierto sesiones reales de Stripe.
- Las pruebas SQL/API utilizan PostgreSQL local y un adaptador de transporte de Supabase. No certifican las políticas originales ni credenciales del proyecto remoto.
- No se han probado cámaras, Safari/iOS físicos, lector de pantalla real ni teclado virtual físico. Las anchuras corresponden a viewports de Chrome.
- No se realiza una auditoría WCAG completa ni se garantiza el contraste de cualquier color/fuente elegido por un restaurante.
- PNG/PDF, contenido del enlace y descargas se comprueban en navegador; el escaneo óptico exige un dispositivo real.
- No se ha desplegado en producción. Las funcionalidades conservan los flags y requisitos de infraestructura que ya tenían; este rediseño no los activa ni cambia.

## 13. Archivos modificados

Aplicación existente:

- `frontend/app/assets/css/main.css`
- `frontend/app/layouts/dashboard.vue`
- `frontend/app/plugins/dialog-accessibility.ts`
- `frontend/app/composables/useSubscription.ts` — únicamente presentación de errores.
- `frontend/app/components/ProductManager.vue`
- `frontend/app/components/SubscriptionBadge.vue`
- `frontend/app/components/businesses/PublicProfileEditor.vue`
- `frontend/app/components/menuEditor/MenuThemeEditor.vue`
- `frontend/app/components/menus/MenuQrGenerator.vue`
- `frontend/app/components/public/RestaurantSite.vue`
- `frontend/app/pages/index.vue`, `login.vue`, `register.vue`, `dashboard.vue`
- `frontend/app/pages/businesses/index.vue`, `[id].vue`
- `frontend/app/pages/menus/index.vue`
- `frontend/app/pages/menus/[id]/index.vue`, `design.vue`, `languages.vue`, `qr.vue`
- `frontend/app/pages/billing/[businessId].vue`

Nuevos: `frontend/app/components/ui/{PageHeader,Notice,Skeleton,MenuNavigation,AuthFrame}.vue`, `frontend/app/utils/uiErrors.ts`.

Pruebas/documentación: esta entrega, `docs/ui-redesign/**`, y pasos de navegación/matrices de las suites existentes en `docs/microsites/verification/{regression-flows,regression-extended,regression-additional,regression-states,regression-public-matrix,regression-languages,microsites-browser,new-business-browser}.cjs`.

## 14. Dependencias

**Ninguna nueva dependencia de aplicación.** No se modifican package.json ni locks, no se introduce una librería UI. Se reutilizan Lucide, qrcode, jsPDF, Vue y Tailwind existentes. Las herramientas QA locales de la verificación anterior se reutilizan fuera del bundle.

## 15. Riesgos reales

Cambiar la ubicación de algunas acciones requiere familiarizarse con las secciones y Más opciones; las pruebas comprueban que siguen disponibles. Los estados de acceso dependen del backend y del proyecto remoto, que no se alteraron ni se ejercitaron contra producción. La publicación sigue teniendo los comportamientos previos, ahora explicados; no se añadió una capa de borradores para productos.

La revisión visual con propietarios reales y móviles físicos puede descubrir ajustes de legibilidad o interacción no reproducibles con fixtures. La copia de fuentes permite comparar y recuperar el estado previo sin afectar a datos.

## PASOS MANUALES PARA JORDI

No hay nuevas migraciones, buckets, variables de entorno ni cambios de infraestructura por este rediseño. No es necesario reiniciar ni modificar el backend.

1. Publicar el frontend con tu flujo habitual de despliegue. En desarrollo, reiniciar Nuxt solo si no recoge los cambios automáticamente.
2. Revisar en un móvil físico el editor, las secciones del establecimiento, las cuatro plantillas y el escaneo de un QR nuevo y uno antiguo.
3. En tu entorno de pruebas, validar con servicios reales el acceso/confirmación de correo, subida de logo/portada y Stripe Checkout/Portal en modo test. Estas integraciones se han comprobado localmente con simulaciones, sin escrituras en producción.
