# Auditoría previa al rediseño — 7 octubre 2026

Se revisaron Nuxt/Vue, páginas, layouts, componentes, estilos y tokens, composables, middleware, SSR público, rutas, modelos TypeScript, validadores backend, ownership, suscripciones y el registro de rutas Express. Se contrastó con la auditoría de micrositios y las pruebas existentes. Antes de tocar la aplicación se copiaron 98 archivos a `/tmp/carteliax-ui-redesign/before` y se generó `before-manifest.json` (SHA-256); sin secretos ni node_modules. No se hace un commit en el Git padre del Escritorio, que contiene cambios ajenos a este proyecto.

## Dependencias y zonas críticas

- Auth: plugin Supabase + useAuth + middleware auth. Registro puede requerir confirmación por correo; logout tiene manejo de error. No sustituir esos flujos.
- Navegación: layout dashboard con drawer, focus trap, Escape, inert y navegación inferior móvil. Mantener rutas estáticas y ruta pública dinámica de un segmento.
- Establecimientos: creación sencilla seguida de billing; dirección pública permanente, rollout microsites_enabled; edición general/profile, logo cliente + confirmación backend y limpieza prudente, portada backend. No unificar sus transportes.
- Carta: categorías por menu_id; productos por business_id compartidos; category_products conserva asociación/orden. ProductManager carga alérgenos antes de guardar y protege fallos parciales. Catálogo, vista por categorías y categoría individual son capacidades distintas que deben conservarse.
- Publicación: contenido/precios/disponibilidad/categorías se actualizan al guardar. Diseño usa draft_config/published_config; guardar borrador no cambia el publicado. Idiomas usan revisión/hash/borrador/publicación/fallback y protección de correcciones manuales. No afirmar que toda edición es un borrador.
- Diseño: MenuThemeEditor, MenuLivePreview, cuatro estilos y layouts originales, colores/fuentes/visibilidad/fotos; guards de salida y reset sin destruir publicado. No aplicar tokens administrativos al renderizador público.
- Traducciones: generación privada, job persistente y polling; límites/manual stale/conflictos revisiones/publicación explícita. Público lee datos persistidos, localiza en memoria y conserva idioma/categoría sin Groq.
- QR: qrcode + jsPDF, canvas export separado, tamaño/logo/color, PNG/PDF; URL general o ?menu=#carta, fallback legacy y redirects conservando ?lang=. No cambiar generadores ni builders.
- Micrositios: RestaurantSite comparte cuatro presentaciones con carta integrada primero. PublicMenuContent reutiliza MenuLivePreview. SSR title/description/canonical/OG/JSON-LD, ubicación opt-in, campos vacíos y varias cartas deben conservarse.
- Billing: useSubscription determina Checkout/Portal/trial/pending/cancel/fechas. La UI solo presenta lo recibido; Stripe webhook permanece antes de JSON.
- Seguridad: requireAuth + ownership + requireActiveSubscription + clientes con JWT/RLS; no cambios backend, SQL, buckets, Stripe, claves ni llamadas reales.

## Problemas de experiencia encontrados

1. Contraste de jerarquías inconsistente: botones secundarios, destructivos y primarios compiten, demasiadas cajas y pesos tipográficos.
2. Configuración crece como una página única: URL/QR/preview/portada/logo/form/perfil y sus traducciones muy alejados del botón de guardado.
3. Listado de cartas con nueve acciones siempre visibles; acciones menos habituales se pueden agrupar sin eliminarlas.
4. Editor de productos acumula filtros y acciones; reorganizar filas y agrupar acciones con disposición real de móvil/escritorio.
5. Mensajes de publicación no explican la diferencia entre contenido inmediato y borrador de diseño/idiomas.
6. QR esconde copiar enlace dentro de personalización. Separar compartir de opciones visuales.
7. Autenticación y landing sobrias pero poco reconocibles; comparten poco vocabulario visual con la aplicación.
8. Plantillas de mini web cambian colores pero necesitan mayor identidad visual. Portada móvil retrasa la carta.
9. Errores reutilizan mensajes técnicos arbitrarios; necesitan traducción de estados y ejemplos de validación junto a campos.
10. Componentes repetidos para encabezados, alertas, skeletons y navegación de una carta; extraer únicamente presentación.

## Baseline

Backend: 32/32 tests pasan. Comparación visual/responsive local en 8 anchuras y 13 rutas (104 casos) registrada en `before-responsive.json`, capturas 390/1440. Auth/API/Storage simulados; no demuestra producción. Se conserva copia de fuentes para comparación de handlers y contratos al finalizar.
