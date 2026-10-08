# Rediseño de UI/UX de Carteliax

Trabajo realizado el 6 de octubre de 2026. Se ha mantenido Nuxt, Vue, Tailwind y el verde esmeralda. El cambio afecta a la presentación y navegación de las funciones existentes.

## 1. Problemas de UX encontrados

- En móvil, los contadores y bloques repetidos obligaban a desplazarse mucho antes de llegar a las cartas o productos. En el editor aparecían consecutivamente la cabecera, categorías, categoría seleccionada, introducción, pestañas, contadores, acciones y filtros.
- La navegación principal dependía de abrir un menú. Los términos «Dashboard» y «Panel de control» aportaban poco contexto a un restaurante.
- El listado de cartas daba más protagonismo a ajustes y duplicación que a gestionar la carta. Diseño, QR y vista pública requerían entrar en otras pantallas.
- Se repetían identificadores, nombres y explicaciones. Los formularios de acceso dedicaban gran parte del escritorio a contenido promocional.
- La descarga del QR quedaba detrás de todas sus opciones. La librería asigna dimensiones al canvas; su presentación podía estirarse o desbordar el ancho del móvil.
- El diseño obligaba a desplazarse para alternar entre opciones, vista previa y publicación.
- Un error de carga podía convivir con un estado vacío, dando a entender que no había cartas o productos. Ahora se muestra un estado de reintento; no se ocultan elementos ya cargados.
- El aviso de éxito al restablecer el diseño desaparecía inmediatamente: el watcher que limpia mensajes se ejecutaba después de terminar la petición.

Se encontraron y corrigieron durante la verificación dos desbordamientos del rediseño: el canvas del QR y el tamaño mínimo del bloque de opciones al desplegarlo a 320 px. La pasada final no presenta desbordamientos horizontales.

## 2. Decisiones de diseño y motivos

| Área | Decisión | Motivo |
| --- | --- | --- |
| Patrones comunes | Títulos, superficies blancas, bordes discretos, verde para la acción principal, botones secundarios neutros y eliminación separada en rojo. | Reconocer las mismas acciones en todo el producto. |
| Navegación | Inicio, Establecimientos y Cartas; accesos inferiores en móvil/tablet y sidebar en escritorio. | Llegar a la tarea sin aprender nombres técnicos ni abrir siempre un menú. |
| Inicio | Establecimientos y suscripción real consultada, acceso principal a sus cartas y enlaces a configuración/facturación. | Responder qué tengo y qué puedo hacer, sin estadísticas decorativas. |
| Establecimientos | Gestión de cartas, configuración y facturación visibles; formularios y logotipo más compactos. | Mostrar el negocio y sus acciones, con menos información repetida. |
| Cartas | Se conserva el selector de establecimiento y el listado completo. Gestionar carta es la acción principal; Diseño, QR y Ver carta son accesos directos a rutas existentes. | Encontrar una carta y actuar en pocos pasos. |
| Editor | Productos agrupados por categoría, búsqueda visible, opciones de categorías desplegables, filas compactas y edición/disponibilidad visibles. | Encontrar un producto, cambiar su precio o agotarlo rápidamente. |
| Catálogo | «Por categorías», «Categoría» y «Todo el negocio». Los productos sin asociación se identifican como «Sin categoría en esta carta». | Explicar los resultados sin alterar los filtros ni las asociaciones existentes. |
| Diseño | Acceso por anclas a opciones y preview; guardar borrador y publicar permanecen accesibles en móvil. | Ver qué cambia y publicar sin volver repetidamente al inicio. |
| QR | QR cuadrado, PDF/PNG y Ver carta primero; personalización y enlace en un bloque desplegable. | Priorizar imprimir y consultar la carta sin eliminar ninguna opción. |
| Facturación | Precio y estado legibles, información de prueba/renovación conservada, lenguaje humano y menos bloques promocionales. | Entender la suscripción sin conocer los estados de Stripe. |
| Carta pública | Navegación de categorías fija al desplazarse, con colores del diseño del restaurante. | Facilitar cambiar de categoría en móvil conservando cada plantilla. |
| Landing y acceso | Contenido más directo, formularios centrados, sin imágenes externas decorativas en la landing. | Claridad y menor carga visual. |

Se conservan las confirmaciones nativas existentes para eliminar y duplicar. No se ha añadido ninguna funcionalidad, tabla, endpoint, configuración de negocio ni dependencia del proyecto.

Los productos pertenecen al establecimiento y se vinculan a categorías mediante relaciones. Las categorías pertenecen a una carta. Se ha conservado ese modelo, incluida la reutilización de productos entre cartas. La publicación de la carta y la publicación de su diseño siguen siendo operaciones distintas.

El único ajuste de ejecución en la lógica del diseño es `flush: "sync"` en el watcher que limpia el mensaje de éxito. Mantiene el aviso de restablecimiento; no cambia datos, consultas, borradores, publicación ni protección de cambios pendientes. El resto del script de esa página coincide con la referencia.

## 3. Archivos modificados

| Archivo | Cambio |
| --- | --- |
| [main.css](frontend/app/assets/css/main.css) | Patrones visuales, controles táctiles, formularios, carga de archivos accesible y espacios seguros. |
| [dashboard.vue](frontend/app/layouts/dashboard.vue) | Navegación, lenguaje y cabecera más simples. |
| [index.vue](frontend/app/pages/index.vue) | Landing más directa y ligera. |
| [login.vue](frontend/app/pages/login.vue) | Formulario centrado y jerarquía simple. |
| [register.vue](frontend/app/pages/register.vue) | Registro y confirmación por correo con la misma lógica. |
| [dashboard.vue](frontend/app/pages/dashboard.vue) | Inicio centrado en establecimientos y acciones. |
| [businesses/index.vue](frontend/app/pages/businesses/index.vue) | Lista y accesos a cartas, configuración y facturación. |
| [businesses/[id].vue](frontend/app/pages/businesses/[id].vue) | Configuración, logotipo y preview más compactos. |
| [menus/index.vue](frontend/app/pages/menus/index.vue) | Listado de cartas, publicación y accesos principales. |
| [menus/[id]/index.vue](frontend/app/pages/menus/[id]/index.vue) | Editor y organización de categorías. |
| [ProductManager.vue](frontend/app/components/ProductManager.vue) | Búsqueda, filas, acciones y presentación del formulario. |
| [design.vue](frontend/app/pages/menus/[id]/design.vue) | Controles de diseño, preview y feedback al restablecer. |
| [MenuThemeEditor.vue](frontend/app/components/menuEditor/MenuThemeEditor.vue) | Opciones existentes más compactas. |
| [MenuLivePreview.vue](frontend/app/components/menuEditor/MenuLivePreview.vue) | Categorías fijas únicamente en la carta pública. |
| [qr.vue](frontend/app/pages/menus/[id]/qr.vue) | Cabecera y navegación contextual. |
| [MenuQrGenerator.vue](frontend/app/components/menus/MenuQrGenerator.vue) | Prioridad de descargas, opciones y escala del canvas. |
| [billing/[businessId].vue](frontend/app/pages/billing/[businessId].vue) | Presentación del plan y sus estados. |

También se añaden este informe y las evidencias en `docs/ui-ux/`. La revisión anterior `UI_UX_REVIEW.md` se ha conservado.

La [comparación de conservación](docs/ui-ux/verification/preservation.json) confirma que el backend, los composables, el middleware de autenticación, package.json, package-lock.json y nuxt.config.ts están intactos. Los scripts de carga y operaciones de cartas, establecimientos, productos, autenticación y QR se mantienen; en QR únicamente se importa un icono existente para su enlace. No se han modificado variables de entorno ni el proxy público de Nuxt.

Git detecta esta carpeta como no seguida dentro del repositorio padre. No hay historial propio de Carteliax disponible para comparar commits. Se creó una copia inicial en `/tmp/carteliax-redesign/before` y se compararon los archivos con ella; no se revirtió ni sobrescribió trabajo ajeno del directorio padre.

## 4. Flujos comprobados

Se ejecutó el frontend real en Chrome con autenticación y respuestas de API simuladas, revisando previamente rutas, controladores y validaciones. Los destinos de Checkout y Billing Portal fueron páginas locales simuladas. No se realizaron cobros ni escrituras en Supabase o Stripe reales.

- Registro con sesión → Inicio; registro con confirmación por correo → login; login correcto/incorrecto; logout; acceso sin sesión a una ruta protegida.
- Inicio → Establecimientos → configuración → facturación.
- Establecimiento → Cartas, selección de otro negocio y retorno al original, conservando las dos cartas de referencia.
- Cartas → carta existente → categorías → productos → búsqueda → edición de precio, descripción y alérgenos.
- Producto disponible → agotado → disponible; foto nueva, sustitución y eliminación.
- Crear carta, editar ajustes, mantener el slug protegido, publicar/retirar, duplicar y eliminar con confirmación/cancelación.
- Crear/editar categoría, visibilidad, ordenación y eliminación; añadir producto nuevo o existente y retirarlo de la categoría.
- Rechazo de eliminación de un producto vinculado: se muestra el error existente; después de desvincularlo se puede eliminar.
- Duplicar producto → copia visible en el catálogo, conservando el original.
- Carta → Diseño → preview con productos reales de la respuesta simulada; cambios pendientes, cancelación de salida, guardar borrador, publicar y restablecer sin alterar el diseño publicado.
- Carta → QR → descargas PNG/PDF → carta pública; copia del enlace, colores e inclusión del logotipo.
- Establecimiento → Facturación → portal; todos los estados de suscripción existentes; cancelación del intento pendiente y retornos del pago.
- Crear establecimiento → facturación → Checkout, comprobando el `businessId` enviado.
- Respuesta 402 por falta de suscripción → facturación del establecimiento.
- Ruta `/test-business` existente, estados vacíos, errores recuperables, peticiones lentas y prevención de doble envío.

El PNG descargado conserva 2000 × 2000 px. El PDF se descarga con contenido válido; su generación A4 sigue utilizando el código existente. No se ha verificado la lectura física del QR en una impresora o teléfono real.

| Recurso de referencia simulado | Antes | Después |
| --- | ---: | ---: |
| Establecimientos | 2 | 2 |
| Cartas | 2 | 2 |
| Categorías | 2 | 2 |
| Productos | 2 | 2 |

Las operaciones de creación y eliminación se comprobaron además con cambios de recuento intencionados. La carga, identificadores y asociaciones no se han cambiado para adaptar la UI. **Estos recuentos corresponden a fixtures de prueba, no a una consulta de los datos reales de producción.**

## 5. Resoluciones y accesibilidad

| Ancho | Pantallas principales | Diálogos y opciones QR | Cuatro plantillas × tres formatos públicos | Scroll horizontal accidental |
| --- | --- | --- | --- | --- |
| 320 px | Comprobadas | Comprobados | Comprobados | No detectado |
| 390 px | Comprobadas | Comprobados | Comprobados | No detectado |
| 768 px | Comprobadas | Comprobados | Comprobados | No detectado |
| 1024 px | Comprobadas | Comprobados | Comprobados | No detectado |
| 1440 px | Comprobadas | Comprobados | Comprobados | No detectado |

Se comprobaron foco inicial, Escape, retorno de foco, permanencia del foco dentro de diálogos, controles táctiles de los formularios, acceso por teclado al archivo de foto, tamaño de texto móvil y reduced-motion. El formulario de producto se comprobó también a 390 × 420 y 390 × 360 px para aproximar una ventana reducida por el teclado. Esto no sustituye una prueba en Safari/iOS o Android con teclado físico del sistema.

La carta pública conserva Moderna, Minimalista, Premium y Mediterránea, y los formatos tarjetas/lista/compacto. Se probaron colores y fuentes elegidos, categorías, precios, descripciones, alérgenos, fotos, portada, opciones ocultas y carta no disponible. No se ha auditado el contraste de todas las combinaciones arbitrarias de colores que puede elegir un restaurante.

Comparaciones móviles: [Inicio](docs/ui-ux/screenshots/after-dashboard.png), [Cartas](docs/ui-ux/screenshots/after-menus.png), [Editor](docs/ui-ux/screenshots/after-editor.png), [Diseño](docs/ui-ux/screenshots/after-design.png), [QR](docs/ui-ux/screenshots/after-qr.png). Las capturas `before-*` del mismo directorio permiten comparar. La pequeña barra de Nuxt que aparece en algunas capturas es una herramienta del servidor de desarrollo.

## 6. Build, typecheck y pruebas

- `npm run build`: compilación de producción correcta.
- `vue-tsc --noEmit`: correcto. Se comprobaron también por separado los proyectos generados app, server, shared y node.
- No existe un script de tests o lint configurado en package.json.
- Se ejecutaron **200 comprobaciones de navegador**: 60 pantallas/resoluciones, 7 regresiones principales, 32 flujos extendidos, 32 estados/diálogos, 63 casos de carta pública y 6 comprobaciones adicionales. Todos los casos de la pasada final son correctos.
- Las matrices finales de páginas y carta pública no registraron errores JavaScript sin capturar.
- Playwright, vue-tsc y TypeScript se instalaron en `/tmp`; no se añadieron dependencias ni scripts al proyecto. Para vue-tsc se utilizó TypeScript 5.9.3 compatible con la herramienta.

Resultados: [pantallas](docs/ui-ux/verification/after-responsive.json), [regresiones](docs/ui-ux/verification/flows-core.json), [flujos](docs/ui-ux/verification/flows-extended.json), [estados](docs/ui-ux/verification/states.json), [plantillas públicas](docs/ui-ux/verification/public-matrix.json) y [comprobaciones adicionales](docs/ui-ux/verification/additional.json). Los scripts del mismo directorio documentan los fixtures y las acciones realizadas; se ejecutaron desde `/tmp/carteliax-redesign`, donde están las herramientas temporales.

## 7. Problemas existentes que no se han modificado

1. El controlador de suscripciones señala que la reserva del intento de Checkout no es atómica. Resolver contrataciones concurrentes exige un cambio de backend; se ha conservado.
2. El middleware de autenticación imprime sesión completa y correo en consola. No se ha alterado la autenticación como parte del rediseño.
3. La carta pública comprueba carta y diseño publicados, categorías visibles y productos disponibles, pero no consulta la suscripción. Se ha conservado ese comportamiento; perder la suscripción no bloquea por sí mismo ese endpoint.
4. El frontend considera acceso por el estado de suscripción; el middleware de backend también comprueba las fechas de prueba y período. No se han cambiado esos criterios: una suscripción con estado desactualizado puede conducir al usuario a facturación mediante el 402 existente.
5. No existe una operación de eliminación de establecimiento en las rutas revisadas. No se ha añadido una funcionalidad nueva para cubrirla. Los rechazos de eliminar productos/categorías vinculados también siguen dependiendo del backend existente.

## 8. Pruebas recomendadas con servicios reales

La integración real no se verificó: no se dispuso de una cuenta de pruebas autenticada. Antes de publicar el rediseño, conviene comprobar con una cuenta de test:

- Registro con confirmación de correo, login/logout y recarga con sesión persistida.
- Recuentos reales de establecimientos, cartas, categorías y productos antes/después, incluidas dos cartas del mismo establecimiento y productos reutilizados entre cartas.
- Subida, sustitución y eliminación de logos y fotos con Supabase Storage, RLS y los límites de tamaño/formato reales.
- Creación de establecimiento y Stripe Checkout **en modo test**, tarjeta de prueba, prueba de 7 días, webhook y retorno de contratación.
- Portal real en modo test: facturas, tarjeta, cancelación al final del período, fechas de prueba/renovación y actualización mediante webhook.
- Acceso bloqueado al terminar la prueba o con pago pendiente; permisos entre establecimientos/cuentas distintas.
- Diseño guardado/publicado y QR público con el dominio real; PDF impreso y escaneo con varios móviles.
- Safari/iOS y Android con teclado abierto, orientación, carga lenta y colores/fuentes elegidos por el restaurante.
