# Rediseño de la web pública y carta de Carteliax

Fecha: 8 de octubre de 2026. Alcance: micrositios de establecimientos, carta integrada y ajustes mínimos del selector y preview privados. No se han modificado landing, autenticación, facturación, infraestructura ni backend.

## 1. Auditoría previa

Se inspeccionaron las rutas `frontend/app/pages/[publicSlug].vue` y `frontend/app/pages/c/[businessId]/[slug].vue`, los proxies Nitro públicos, `RestaurantSite.vue`, `PublicMenuContent.vue`, `MenuLivePreview.vue`, los tipos y presets de temas, el composable de idiomas, la proyección de traducciones, los controladores Express públicos, el editor del perfil y ambos previews privados.

El micrositio obtiene mediante `useFetch` SSR el establecimiento, las cartas publicadas y la carta seleccionada. El backend utiliza un lector compartido con los enlaces legacy; filtra publicación del diseño, visibilidad de categorías, disponibilidad de productos y traducciones publicadas. No expone borradores. Nitro mantiene la frontera de acceso al backend. La selección de carta procede de `?menu=`. Los textos se proyectan desde traducciones persistidas, con fallback al original; no se generan textos durante lecturas públicas.

La configuración global se guarda en `businesses.public_profile.template` y el color en `businesses.primary_color`. Cada carta conserva `menu_themes.draft_config` y `published_config`, con estilos propios y opciones de contenido. El editor del negocio ya tenía una previsualización del micrositio; el de carta utilizaba exclusivamente el renderizador histórico.

## 2. Problemas encontrados

- Dos sistemas visuales simultáneos: plantilla del perfil para la web y plantilla publicada de carta para productos y categorías.
- Elegante pasaba de una web oscura a una superficie de carta clara, con tipografía y colores independientes.
- CSS duplicado dentro del micrositio: sucesivas redefiniciones de las cuatro identidades y varios bloques responsive superpuestos.
- La carta renderizaba una sola categoría: las demás no aparecían simultáneamente en el HTML principal.
- El header sticky del establecimiento y el de categorías competían por el mismo espacio.
- Idioma seleccionado en memoria/localStorage, sin sincronizar el cambio manual con el parámetro URL.
- El selector privado indicaba que web y carta debían diseñarse por separado; la preview de carta no representaba el micrositio.
- No había reemplazo visual fiable para una imagen fallida, especialmente cuando el fallo precedía a la hidratación.

## 3. Nueva arquitectura visual

`RestaurantSite` compone navegación, portada, selección de cartas, información y footer. `RestaurantMenu` proyecta los datos localizados y organiza todas las categorías. `RestaurantProduct` presenta producto, precio, descripción y alérgenos. `RestaurantImage` encapsula carga, dimensiones, recorte y fallback. `restaurant.css` define los tokens y las diferencias de composición bajo la raíz pública; no aplica estilos al dashboard.

Los componentes reciben datos y opciones existentes. No realizan consultas de negocio ni llamadas de traducción. El composable existente sigue siendo responsable del idioma y la persistencia. El lector público y las APIs de edición permanecen intactos.

## 4. Sistema unificado y precedencia

Para establecimientos con micrositio:

1. `public_profile.template` controla toda la identidad: portada, carta, productos e información.
2. `primary_color` del establecimiento gobierna las acciones y estados seleccionados. Su texto se calcula con luminancia para mantener contraste.
3. La carta conserva `showImages`, `showDescriptions`, `showAllergens` y su mensaje de bienvenida, con traducciones almacenadas.
4. La portada del establecimiento tiene prioridad; si falta, se conserva el fallback histórico a `theme.branding.coverUrl`.
5. Colores, fuentes, radio, `productStyle` y plantilla histórica de carta se conservan guardados, pero no sustituyen la identidad global del micrositio.

No hay migración, sobrescritura automática ni eliminación de configuraciones. Los enlaces legacy de negocios sin micrositio siguen utilizando `PublicMenuContent` y `MenuLivePreview`, con sus temas originales. El editor conserva este modo cuando no existe `public_slug`.

## 5. Las cuatro plantillas

| Plantilla | Composición completa |
| --- | --- |
| Moderna | Fondos vegetales suaves, titulares contemporáneos, tarjetas refinadas, imágenes laterales, esquinas suaves y dos columnas en desktop. |
| Elegante | Fondo verde profundo continuo, titulares serif, portada con remate arqueado, platos separados por líneas y fotografías más amplias. |
| Minimal | Fondo blanco, títulos sobrios, listas abiertas, imágenes compactas, controles rectos y decoración mínima. |
| Clásica | Tonos crema, cabecera centrada, fotografía panorámica, titulares serif, reglas dobles y categorías que evocan una carta impresa. |

Las fuentes tienen fallback local, sin depender de descargar Google Fonts para el micrositio. El color configurado por el propietario se conserva en las cuatro identidades.

## 6. Componentes y panel

Creados: `RestaurantMenu.vue`, `RestaurantProduct.vue`, `RestaurantImage.vue` y `restaurant.css`.

Modificados: `RestaurantSite.vue`, el composable de idioma, SEO del micrositio, tipo de producto y los editores/previews privados. El editor de carta muestra la experiencia pública completa para negocios con micrositio. Oculta controles de apariencia que ya no gobiernan esa web, manteniendo sus valores y el editor legacy. Las opciones de contenido continúan publicándose mediante el flujo existente. El selector del perfil explica que una plantilla diseña toda la experiencia.

## 7. Movimiento

Entrada inicial breve del hero mediante opacity y transform, sin partir de contenido invisible. Feedback de pulsación, elevación leve de acciones, hover de tarjetas modernas y zoom de imágenes únicamente en dispositivos con hover. Transiciones discretas de color en categorías y cartas. Scroll suave al seleccionar categoría, con navegación inmediata bajo reduced motion.

No se añadieron librerías de animación, parallax ni listeners continuos de scroll. Todas las transiciones y animaciones se desactivan con `prefers-reduced-motion`. Se ha priorizado estabilidad al leer sobre efectos de reveal repetidos.

## 8. Navegación de carta

Todas las categorías y platos disponibles se renderizan desde SSR. Los enlaces de categoría funcionan como anchors reales sin JavaScript. En cliente, `IntersectionObserver` mantiene el estado activo y el rail desplaza horizontalmente el control seleccionado cuando queda fuera de su área visible.

Solo las categorías permanecen sticky; el header del restaurante se desplaza normalmente. Varias cartas se distinguen con un selector propio antes del rail, con estado activo y enlaces públicos reales. Con una carta se omite ese selector. Se conservan `/<public_slug>?menu=<menuSlug>&lang=en#carta` y las redirecciones `/c/:businessId/:menuSlug`.

El cambio de idioma actualiza `lang`, conserva `menu`, el resto de parámetros y el hash, y mantiene localStorage. Los cambios posteriores del parámetro explícito se reflejan en la selección. Las traducciones y el fallback siguen siendo proyecciones de datos almacenados.

## 9. Responsive e imágenes

Rejilla de productos de una columna en móvil y dos en desktop, con anchura máxima de contenido. Los productos únicos ocupan la anchura disponible. Precios con cifras tabulares y sin truncar; títulos y descripciones pueden ocupar varias líneas. Las tarjetas sin imagen no reservan huecos ficticios.

Portada compacta en móvil, recorte lateral para Moderna/Elegante/Minimal y franja horizontal para Clásica. Sin portada, la tipografía y composición sostienen la identidad. Logos, portadas y productos mantienen dimensiones; productos usan carga diferida y la portada prioridad alta. Se comprueba también `complete/naturalWidth` al montar para cubrir fallos previos a hidratación. El reemplazo conserva tamaño y alternativa accesible.

## 10. Accesibilidad

Jerarquía h1 del restaurante, h2 de carta/secciones, h3 de categoría y h4 de producto. Enlace de salto a la carta, selector nativo de idioma etiquetado y sin banderas, anchors para categorías, foco visible, controles de al menos 44 px y `aria-current` para selección. Alérgenos conservados como lista de etiquetas reales, con icono informativo discreto; no se infieren alérgenos de recetas.

Paletas con contraste de texto y fondos explícitos. El texto de los botones de marca elige blanco o negro según luminancia. Disponibilidad opcional usa etiqueta textual además del tratamiento visual. Se respeta reduced motion y el contenido principal no depende de animaciones ni JavaScript.

No se ha realizado una auditoría formal con lectores de pantalla ni dispositivos físicos; las comprobaciones de teclado y foco están incluidas en QA de navegador.

## 11. SEO y SSR

Se conserva `useFetch` SSR, canonical del establecimiento, metadescripción, Open Graph y schema.org Restaurant con horarios/contacto reales. Se completan título, descripción e imagen de Twitter. El HTML de prueba incluye productos de todas las categorías y traducción explícita antes de ejecutar JavaScript. Se verifica también una sesión de navegador sin JavaScript.

No cambian URLs, QR, filtros de publicación ni proxy. Se elimina del micrositio la descarga de fuentes derivada de una plantilla de carta cuya apariencia ya no gobierna esa web. La ruta legacy conserva su renderer y fuentes.

## 12. Compatibilidad

Los registros existentes siguen funcionando sin cambios de datos. Al desplegar, las cartas de micrositios adoptan automáticamente la plantilla de su establecimiento. Esta diferencia visual es intencionada y no requiere republicar cartas. Los datos publicados, precios, orden, traducciones manuales y opciones de contenido se conservan.

Si distintas cartas tenían colores/fuentes propios, pasan a compartir la identidad global. Sus configuraciones quedan disponibles para el modo histórico. Si se usa la portada histórica de una carta como fallback, puede variar al seleccionar otra carta; configurar portada del establecimiento proporciona una imagen global estable sin migrar datos.

## 13. Pruebas y resultados

Evidencia en `docs/public-redesign/verification/`:

- Build de producción Nuxt: PASS (`build.log`).
- Typecheck mediante vue-tsc: PASS para raíz, app, server, shared y node (`typecheck-final.log`, sin errores).
- Tests existentes del backend: 32/32 PASS (`tests.log`). No se ejecutaron pruebas SQL ni consultas sobre Supabase real.
- Chrome sobre build de producción y API de fixtures locales: matriz de cuatro plantillas × ocho anchuras, idiomas, enlaces directos, QR legacy, estados vacíos, imágenes fallidas, opciones de contenido, cartas extensas, SSR, teclado y reduced motion. 43 grupos de comprobación PASS, sin errores de consola/hidratación ni peticiones externas en la matriz. Resultado detallado en `browser.json` y `browser.log`.
- Contactos, dirección larga, horarios incompletos/nocturnos y mapa bajo demanda: PASS (`details.log`); el iframe se simula localmente.
- Editor privado con APIs simuladas: PASS para preview unificada, publicación de mensaje sin alterar plantilla, cambio/guardado de plantilla del establecimiento y preview (`private.log`).

Las herramientas de QA se instalaron exclusivamente en `/tmp/carteliax-public-qa` (Playwright, vue-tsc y TypeScript 5.9.3). No se añadieron dependencias ni scripts de producción al proyecto. No se cambiaron expectativas de los tests existentes. La nueva prueba de scroll espera la llegada efectiva a la categoría final, porque un tiempo fijo breve no cubre el scroll suave de una carta extensa.

## 14. Capturas y revisión visual

Capturas finales de las cuatro plantillas a 390, 768 y 1440 px en `docs/public-redesign/screenshots/`. Se revisaron imágenes reales de las capturas para comprobar continuidad, composición, legibilidad y distribución; no solo overflow. La revisión detectó y corrigió la ocupación de media rejilla para categorías con un único plato y el fallo de fallback previo a hidratación.

- [Moderna móvil](docs/public-redesign/screenshots/modern-390.png)
- [Elegante móvil](docs/public-redesign/screenshots/elegant-390.png)
- [Minimal tablet](docs/public-redesign/screenshots/minimal-768.png)
- [Clásica móvil](docs/public-redesign/screenshots/classic-390.png)
- [Moderna desktop](docs/public-redesign/screenshots/modern-1440.png)

Las capturas `before-modern-390.png` y `before-elegant-390.png` proceden del archivo de verificación previo de micrositios del repositorio. Sirven de referencia histórica; no se presentan como una comparación del mismo fixture exactamente. Las capturas `*-rich-390.png` utilizan ilustraciones locales del repositorio para probar recortes y dimensiones, no fotografías nuevas de restaurantes reales.

## 15. Archivos modificados

- `frontend/app/components/public/RestaurantSite.vue`
- `frontend/app/components/public/RestaurantMenu.vue` (nuevo)
- `frontend/app/components/public/RestaurantProduct.vue` (nuevo)
- `frontend/app/components/public/RestaurantImage.vue` (nuevo)
- `frontend/app/assets/css/restaurant.css` (nuevo)
- `frontend/app/composables/usePublicMenuLanguage.ts`
- `frontend/app/types/menuTheme.ts`
- `frontend/app/pages/[publicSlug].vue`
- `frontend/app/pages/menus/[id]/design.vue`
- `frontend/app/components/menuEditor/MenuThemeEditor.vue`
- `frontend/app/components/businesses/PublicProfileEditor.vue`
- `docs/public-redesign/verification/*` y `docs/public-redesign/screenshots/*` (evidencia nueva)
- `REDISENO_WEB_PUBLICA_CARTELIAX.md`

## 16. Limitaciones pendientes

El lector público actual filtra `is_available=true` y no devuelve productos agotados. Se conserva exactamente esta lógica por la restricción de no cambiar disponibilidad. El componente admite `is_available=false` y una etiqueta localizada, pero ese estado no se recibirá del endpoint actual. El contrato visual de agotado y múltiples alérgenos se verificó con una respuesta de QA simulada, sin modificar el endpoint. Mostrar agotados en producción requeriría decidir un cambio funcional separado del backend y sus expectativas de publicación.

Se validó Chrome local con fixtures, no Safari/iOS, Android físico ni datos de cientos de restaurantes reales. No se midieron Core Web Vitals de producción ni se probó Google Maps en vivo. Tampoco se ejecutaron pruebas de facturación, SQL, RLS o infraestructura, que no se modificaron. Las verificaciones privadas cubren diseño y publicación simulada, no constituyen una certificación completa del dashboard.

No se añadieron generación de imágenes, nuevos recursos visuales de marca ni dependencias de mapas. Las fotografías reales conservan sus URLs y calidad de origen; el rediseño no transforma ni comprime los objetos almacenados.

## 17. Riesgos y decisiones técnicas

Renderizar toda la carta mejora SSR, navegación y lectura continua, pero aumenta el DOM frente al antiguo renderizador de una categoría. Se usan imágenes lazy y no se añadió virtualización que ocultase contenido indexable. La prueba extensa incluye 16 categorías y una categoría con 25 productos.

Las variables de apariencia histórica permanecen persistidas aunque ya no afecten al micrositio; esto es una regla explícita de precedencia, no una migración silenciosa. El cambio puede alterar visualmente establecimientos con diseños independientes; el selector y las previews explican y muestran el resultado.

El mapa continúa cargándose solo tras una acción explícita. Las animaciones no ocultan contenido SSR. El sitio mantiene el fallback de portada existente para no retirar recursos de cartas antiguas.

## PASOS MANUALES PARA JORDI

- **Migración SQL:** ninguna.
- **Variables de entorno:** ningún cambio de producción. Las variables locales de QA son ficticias y no deben copiarse al despliegue.
- **Supabase:** ninguna configuración ni operación necesaria.
- **Storage:** ningún cambio de buckets, políticas u objetos.
- **Antes del despliegue:** desplegar normalmente el frontend con su build de producción y las variables existentes. No es necesario republicar cartas ni actualizar QR.
- **Recursos visuales:** no es necesario actualizar logos ni portadas. Opcionalmente, configurar una portada del establecimiento si se quiere reemplazar el fallback histórico variable entre cartas.
- **Establecimientos anteriores:** sus micrositios adoptan la plantilla global también en las cartas; los datos y configuraciones históricas permanecen intactos. Los enlaces legacy sin micrositio conservan su diseño anterior.

**No hace falta ninguna intervención manual en base de datos, Supabase, Storage ni variables de entorno para aplicar este rediseño.**
