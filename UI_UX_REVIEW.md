# Revisión de UI/UX de Carteliax

Revisión realizada el 3 de octubre de 2026. Se ha conservado Nuxt/Vue/Tailwind y la identidad verde/esmeralda.

## Arquitectura y límites del cambio

El frontend usa páginas Nuxt, un layout de administración y composables para autenticación, peticiones autenticadas, suscripciones y diseño de cartas. La API Express aplica autenticación y acceso por establecimiento. El acceso a la carta pública pasa por un endpoint servidor de Nuxt hacia la API pública.

Antes de editar se revisaron las páginas, componentes, rutas de API, validaciones, almacenamiento de imágenes, contratos de suscripción y retornos de Stripe. Se compiló también la versión inicial.

No se han modificado el backend, los contratos de API, Supabase/RLS, variables de entorno, middleware de autenticación, composables de autenticación/peticiones/suscripciones, webhooks, rutas públicas ni almacenamiento. Tampoco se han añadido dependencias al proyecto. Las nuevas consultas de suscripción utilizan el endpoint existente y solo informan a la interfaz; no sustituyen el control de acceso del backend.

## Pantallas revisadas y mejoras

| Pantalla o componente | Mejora |
| --- | --- |
| Landing `/` | Precio por establecimiento y activación explicados; navegación táctil y tipografía móvil; eliminada la animación flotante continua. |
| Login `/login` | Prevención de envíos duplicados, estado ocupado y control accesible para mostrar contraseña. |
| Registro `/register` | Registro gratuito diferenciado de activación; precio, prueba y tarjeta explicados; confirmación por correo conservada. |
| Layout de administración | Sidebar más limpia, títulos según la pantalla, navegación móvil con Escape y gestión de foco, enlace para saltar al contenido y error al cerrar sesión. Se retiraron únicamente las entradas deshabilitadas sin páginas funcionales. |
| Dashboard `/dashboard` | Jerarquía nueva, resumen de suscripciones reales consultadas, tarjetas compactas, acceso a facturación, CTA contextual, skeletons y onboarding en tres pasos. |
| Establecimientos `/businesses` | Distinción entre estado del negocio y estado de suscripción; formulario en dos pasos con coste explicado, ayuda sobre el identificador y bloqueo de doble envío/cierre mientras se crea. |
| Configuración `/businesses/:id` | Estado de suscripción visible, facturación accesible y formulario con estado ocupado; operaciones de logotipo conservadas. |
| Facturación `/billing/:businessId` | Precio, elegibilidad de prueba, tarjeta, fin de prueba, renovación y cancelación explicados; estados diferenciados y acceso a cartas cuando corresponde. |
| Cartas `/menus` | Contenido como acción principal; ajustes como acción secundaria; estados al publicar/eliminar, bloqueo de operaciones duplicadas y ayuda sobre publicación del diseño. |
| Editor `/menus/:id` | Categorías y productos conservados; diálogo de categoría accesible; patrones visuales y táctiles compartidos. |
| ProductManager | Panel adaptable a la altura disponible, búsquedas accesibles, controles de estado seleccionados, confirmación destructiva más explícita y límites del formulario alineados con las validaciones existentes. |
| Diseño `/menus/:id/design` | Vista previa por debajo del header, diálogos accesibles y controles desplegables; guardado/publicación y protección de cambios sin guardar conservados. |
| MenuThemeEditor | Texto de ayuda para portada sin promesas de funciones futuras; confirmación al restaurar apariencia; controles más legibles. |
| QR `/menus/:id/qr` | Labels asociados, feedback al copiar/generar, prevención de doble descarga y mejor aprovechamiento del espacio móvil. URL pública y generación PNG/PDF conservadas. |
| Carta pública `/c/:businessId/:slug` | Nombres, precios, descripciones y alérgenos más legibles; categorías táctiles; foreground legible para el color seleccionado; sin bloques de imagen vacíos para productos sin foto; contenido acotado en escritorio. |
| `/test-business` | Página existente conservada; layout, labels y tipos mejorados. Sigue siendo una ruta de prueba, no el onboarding comercial. |

Los patrones compartidos de interfaz incluyen foco visible, controles táctiles, inputs móviles de 16 px para evitar zoom automático, texto secundario legible, límites de altura en diálogos y reducción de movimiento según la preferencia del usuario. Las reglas del panel se limitan a `.workspace`; los colores y las fuentes de la carta siguen dependiendo del diseño publicado por el restaurante.

## Flujo de suscripción preservado

Registro → dashboard → creación de establecimiento → `/billing/:businessId` → Checkout → prueba de 7 días si el establecimiento es elegible → suscripción `trialing`/`active` → funciones protegidas.

- Registrarse y entrar al dashboard siguen sin exigir pago.
- La suscripción sigue siendo por establecimiento.
- La tarjeta sigue solicitándose en Stripe.
- La prueba utilizada no se vuelve a conceder desde la interfaz.
- Los estados y botones de facturación siguen utilizando `hasAccess`, `canStartCheckout` y `canManageBilling` existentes.
- El retorno de Checkout conserva `?checkout=success` y `?checkout=cancelled`.
- El portal de facturación conserva el retorno a `/billing/:businessId`.
- Los 402 con `SUBSCRIPTION_REQUIRED` siguen redirigiendo a la facturación del establecimiento indicado.

## Validación

- `npm run build`: compilación de producción de Nuxt completada.
- `vue-tsc --noEmit`: comprobados los proyectos generados `tsconfig.app.json`, `tsconfig.server.json`, `tsconfig.shared.json` y `tsconfig.node.json`.
- El repositorio no tiene scripts de lint ni de tests configurados. No se han añadido ni cambiado scripts de package.json.
- Navegador Chrome: 82 comprobaciones de páginas, estados y diálogos a 320, 390, 768, 1024 y 1440 px. Sin overflow horizontal, diálogos fuera de la ventana, inputs sin nombre accesible ni errores JavaScript en esa revisión.
- Estados de facturación comprobados: sin suscripción, pendiente, prueba, activa, pago pendiente, cancelada, incompleta, caducada, impagada y pausada.
- Probados con respuestas simuladas: login, creación de establecimiento y redirección a facturación, Checkout, portal, cancelación de intento, creación de carta/categoría/producto, asociación a categoría, payload de alérgenos, guardado y publicación del diseño y descargas QR en PNG/PDF.
- Doce combinaciones de carta pública comprobadas: cuatro plantillas × tarjetas/lista/compacto, conservando variables de personalización.
- Comparación con la copia inicial: backend, middleware y composables críticos de autenticación, API y suscripción sin cambios.

Las herramientas de comprobación se instalaron en `/tmp`, fuera de las dependencias del proyecto. Los informes y capturas del navegador están en `/tmp/carteliax-ui-audit`; los registros de build y tipos tienen el prefijo `/tmp/carteliax-ui-`.

Las pruebas de navegador utilizaron autenticación, API y destinos de Stripe simulados. No se realizaron cobros ni modificaciones en servicios reales. Estas comprobaciones verifican la interfaz y los contratos enviados, pero no sustituyen una prueba integrada con Supabase y Stripe en modo test. No se ha auditado el contraste de todas las combinaciones arbitrarias de colores que puede elegir un restaurante ni el comportamiento en dispositivos físicos.

## Observaciones previas fuera del alcance de UI/UX

1. **Reserva de Checkout no transaccional.** `backend/src/modules/subscriptions/subscriptionController.js` señala que la reserva del intento no es atómica. La protección completa frente a contrataciones concurrentes requiere revisar el backend; no se ha alterado.
2. **Sesión en consola.** `frontend/app/middleware/auth.ts` registra la sesión completa y datos de usuario. Conviene revisar esos logs antes de usar cuentas reales; no se ha modificado el middleware.
3. **Suscripción y carta pública.** `backend/src/modules/publicMenus/publicMenuController.js` comprueba publicación, diseño publicado, categorías visibles y productos disponibles, pero no consulta la suscripción. Una cancelación por sí sola no bloquea ese endpoint. Se ha conservado su comportamiento; debe decidirse explícitamente si la carta publicada tiene que dejar de estar disponible al perder acceso.

Además, la ruta `/test-business` y la aceptación de condiciones sin enlaces a documentos legales ya existían. No se han eliminado rutas ni inventado textos legales como parte de esta revisión.
