# Auditoría previa — landing, QR y precio

Fecha: 7 octubre 2026. Antes de modificar código de aplicación se revisaron la landing completa, CSS/tokens y AuthFrame del rediseño, registro/dashboard/creación/facturación, MenuQrGenerator y sus consumidores, publicUrls, rutas SSR/legacy, controlador público, Checkout/Portal y fixtures/pruebas existentes.

## Estado previo y seguridad

106 fuentes copiadas a `verification/before-source.tar.gz`, con SHA-256 en `before-manifest.json`. Sin .env, claves ni datos de usuarios. El Git pertenece al directorio padre y tiene cambios ajenos; se usa copia verificable sin tocar ese repositorio. Las capturas del rediseño anterior también conservan landing y QR a 390/1440.

## Dependencias y decisiones

- Landing: una página Vue con hero de texto + carta genérica, seis tarjetas, tres pasos, un precio, cuatro FAQ. Infrarepresenta web, multimenú e idiomas. Los CTA llevan a registro/login reales. No existen páginas legales ni logo definitivo; sí favicon.ico. No se crearán enlaces inventados.
- Sistema visual: tokens `--ui-*`, botones ui-primary/secondary, marfil y verde bosque, Lucide. Se conservarán sin cambiar dashboard/shell/auth.
- QR: qrcode genera canvas; PNG y PDF vuelven a generar la misma URL, con logo/opciones. La página de carta carga carta+establecimiento; configuración también ofrece QR general. Selector permite carta/web. Se sustituirá la elección por una página de QR del establecimiento. No se condiciona a cartas publicadas.
- Dirección: publicSitePath sin argumentos extra devuelve /public_slug. publicMenuPath conserva ?menu=#carta y fallback /c/uuid/slug. Mantener ambos helpers y todas las rutas públicas. No fabricar un QR nuevo legacy si faltase public_slug; mostrar indisponibilidad sin invalidar QRs existentes.
- Micrositio: SSR lee datos persistidos y selecciona la primera carta publicada con diseño publicado; varias cartas muestran navegación. Sin cartas existe estado próximo. Idioma utiliza persistidos/fallback; sin Groq público. Legacy usa 302 con menu/lang/#carta. Ninguna modificación a esta arquitectura.
- Precio: diez expresiones comerciales en cinco páginas (landing 3, register 1, dashboard 1, businesses/index 1, billing 4). Inventario exacto previo en price-audit-before.json. No hay constante comercial backend: Stripe cobra el Price asociado a STRIPE_PRICE_ID.
- Stripe: ID configurado en .env local, sin exponerlo ni consultar Stripe. Checkout usa line_items [{price:PRICE_ID,quantity:1}], trial_period_days:7 si no trial_used_at, tarjeta obligatoria. Checkout/Portal/webhooks/guards intocables. El importe remoto es desconocido; cambiar copy no cambia Stripe ni suscripciones existentes. Requiere comprobación/configuración manual antes de publicar.
- Precios de platos a 18 en SQL y número/versiones/dimensiones sin significado comercial no se reemplazan. Evidencias históricas del rediseño quedan como comparación.

## Alcance autorizado

Landing y demos ligeras propias, precio comercial centralizado y copy, único QR nuevo, accesos QR y enlaces directos secundarios, pruebas/documentación. Sin nuevas dependencias de aplicación, backend, migraciones, SQL, RLS, Storage ni operaciones sobre servicios reales.
