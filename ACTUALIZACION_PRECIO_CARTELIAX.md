# Actualización del precio oficial de Carteliax

Fecha: 8 de octubre de 2026.

**Nuevas suscripciones: 17,49 €/mes por establecimiento, IVA incluido (21 %). Prueba gratuita de 7 días, con método de pago obligatorio.** Los contratos anteriores conservan sus condiciones. No se ha desplegado nada ni modificado Stripe Live, datos de Supabase o suscripciones de clientes existentes.

## Precio encontrado y resultado

| Configuración | Antes | Después |
|---|---|---|
| Fuentes comerciales del frontend | 15,99 €/mes | 17,49 €/mes; IVA incluido (21 %) |
| Imagen social de la landing | 15,99 €/mes | 17,49 €/mes; IVA incluido (21 %) |
| Validación del backend | 1.599 céntimos | 1.749 céntimos |
| Price Stripe Test configurado | 1.800 céntimos, impuestos `unspecified` | Nuevo Price: 1.749 céntimos, EUR, mensual, intervalo 1, activo, `inclusive` |
| Tasa Test configurada | No había una tasa válida para este requisito | Nueva tasa: IVA ES 21 %, activa e inclusiva |
| Stripe Live | No inspeccionado | No modificado; activación pendiente |

El Price anterior de Test no se ha editado ni archivado. Se han creado únicamente un Price Test y una tasa Test; el `.env` local se actualizó **después de recuperarlos y validarlos contra Stripe**. Los identificadores no se publican en este informe. Hay evidencias sanitizadas en [docs/pricing-1749/verification](docs/pricing-1749/verification).

## Implementación

`frontend/app/utils/commercialPlan.ts` sigue siendo la fuente compartida de copy comercial. Landing, FAQ, SEO, registro, dashboard, creación de establecimientos y contratación usan el importe oficial. Billing conserva la aclaración de que el precio es para nuevas suscripciones y que las condiciones del contrato existente se consultan en su Portal.

No se ha cambiado el diseño de la interfaz ni el precio de platos, cartas o productos. Se corrigió también el texto incrustado en `social.png`. Se usó la habilidad [imagegen](/home/jordi/.codex/skills/.system/imagegen/SKILL.md), herramienta integrada, con el prompt: «Replace only '15,99 €/mes' with '17,49 €/mes' in the same bold font and position. Add the smaller line 'IVA incluido (21 %)' immediately below the existing '7 días gratis al activar tu suscripción' text. Preserve composition, colors, layout, fonts, shapes, logo, phone mockup and other text». Se guardó a 1200 × 630 en su ruta existente y se revisó visualmente.

Antes de reservar o crear Checkout, el backend valida contra Stripe:

- Price activo, modo coincidente con la clave/configuración, `unit_amount = 1749`, `currency = eur`, `recurring.interval = month`, `interval_count = 1`, `tax_behavior = inclusive`.
- `STRIPE_VAT_TAX_RATE_ID` presente; tasa activa, mismo modo, `percentage = 21`, `inclusive = true`, `tax_type = vat`, `country = ES`.
- Si se reutiliza un Customer, que no esté eliminado, sea del modo correcto y no tenga exención/reverse charge, saldos, descuentos o elementos de factura pendientes que alteren el importe. El backend bloquea la nueva contratación y no modifica ese Customer.

Una configuración fiscal incompleta o incompatible devuelve `503 BILLING_CONFIGURATION` y bloquea la nueva contratación antes de crear una reserva. La variable de IVA es opcional al arrancar para no bloquear la web pública ni la gestión de contratos existentes; **es obligatoria para crear Checkout**.

Checkout añade explícitamente `subscription_data.default_tax_rates`, mantiene `payment_method_collection: always`, desactiva impuestos automáticos y códigos promocionales. El frontend solo puede enviar `businessId`; parámetros de precio, trial, Price o impuestos son rechazados. Se mantienen ownership, reservas atómicas, idempotencia, controles de Customer compartido y tratamiento conservador de respuestas de pago ambiguas.

Stripe explica que los impuestos manuales deben aplicarse expresamente y que las exenciones pueden descontar el IVA de un importe inclusivo. Por eso se aplica la tasa a la suscripción y se bloquean Customers incompatibles en lugar de alterar sus datos. Véanse [tasas de impuestos de Stripe](https://docs.stripe.com/tax/tax-rates) y [Checkout con impuestos manuales](https://docs.stripe.com/payments/checkout/use-manual-tax-rates). Esta implementación aplica el requisito autorizado de IVA español del 21 %; no incorpora reglas fiscales internacionales automáticas.

## Compatibilidad de suscripciones anteriores

Cambiar la variable Price sin más habría impedido procesar webhooks de suscripciones con tarifas históricas. Se mantiene la validación de modo, firma, metadata, ownership, Customer, un único item/cantidad e idempotencia. Un Price histórico solamente se admite si el `stripe_subscription_id` y el `stripe_customer_id` ya coinciden exactamente con la fila del establecimiento. No permite vincular una suscripción antigua o desconocida a otro restaurante. Los contratos nuevos requieren el Price configurado.

Hay regresiones específicas para conservar actualizaciones de contratos históricos y rechazar reemplazos con identificadores no vinculados. No se migran contratos, no se modifican fechas de trial y no se cancelan suscripciones existentes. El trial sigue siendo de siete días cuando el establecimiento aún no lo ha usado; una recontractación no concede otra prueba gratuita.

## Pruebas y evidencias

| Prueba | Resultado | Tipo / límite |
|---|---|---|
| Backend, `npm test --prefix backend` | PASS, 107 tests | Mocks/fixtures; incluye seguridad, facturación y webhooks |
| Rechazo de 1.599, 1.799, 1.800 y otros importes | PASS | Regresión del guard y controlador; no crea Checkout ni reserva |
| Moneda, recurrencia, modo, Price inactivo e IVA ausente/incorrecto | PASS | Regresiones con fixtures |
| Trial y recogida del método de pago | PASS | Payload real del controlador verificado con mocks |
| Matriz HTTP, `AUDIT_MATRIX_PATH=docs/pricing-1749/verification/security-matrix.json node backend/test/api-audit.cjs` | PASS, 128 peticiones | Express real; Auth/PostgREST/Stripe simulados; no certifica RLS real |
| `npm run build --prefix frontend` | PASS | Build de producción local |
| `vue-tsc --noEmit` | PASS | Raíz y proyectos `.nuxt/tsconfig.app.json`, `server`, `shared`, `node`; herramienta temporal existente |
| Contratos comerciales de landing | PASS | Dos tests seleccionados; ver comando debajo |
| Chrome/Playwright, `browser.cjs` | PASS, 32 comprobaciones, 0 errores de consola | Servicios ficticios; anchuras 320, 375, 390, 430, 768, 1024, 1280 y 1440 |
| Chrome/Playwright, `journey.cjs` | PASS | Registro → establecimiento → Checkout simulado → carta/publicación → QR → web |
| Escaneo de secretos del build | PASS, 775 archivos, ninguna coincidencia | Valores privados locales no encontrados en `.output` |
| Inspección Price/tasa Test | PASS | Stripe Test real, lectura posterior a configuración |
| Sesión Checkout Test creada por el controlador | PASS | API Stripe real, identidad/DB en memoria; sesión nueva caducada sin completar tarjeta |
| Trial Test Clocks | PASS, 604.800 segundos | Stripe Test real: A1, A2 y B1 |
| Primer cobro después del trial | PASS, 17,49 € | Stripe Test real, facturas `paid`, cobro automático |
| Primera y segunda renovación | PASS, 17,49 € por factura | Stripe Test real, los tres establecimientos ficticios |
| IVA en primera factura y ambas renovaciones | PASS | Base 14,45 € + IVA 3,04 € = total 17,49 €, no IVA adicional |
| Cancelación/impago de fixtures independientes | PASS | A1 cancelado, A2 `past_due`, B1 continúa `active`; solo recursos creados por esta prueba |
| Checkout completado con tarjeta → webhook → Supabase real | NO EJECUTADO | No es lo probado por Test Clocks ni el navegador con mocks |
| Webhook registrado en Stripe Test | PENDIENTE | La inspección devolvió `webhooks: []` |
| Stripe Live: precio, impuestos, primer cobro y renovaciones | NO EJECUTADO | No se ha accedido ni modificado Live |

Comandos adicionales ejecutados:

```sh
node --test --experimental-test-isolation=none --test-name-pattern='Ningún precio|Stripe conserva' docs/landing-qr-pricing/verification/contracts.test.cjs
node /tmp/carteliax-public-qa/node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.json
# Desde frontend: repetir con .nuxt/tsconfig.{app,server,shared,node}.json
PLAYWRIGHT_MODULE=/tmp/carteliax-public-qa/node_modules/playwright QA_SUPABASE_AUTH_STORAGE_KEY=sb-127-auth-token node docs/landing-qr-pricing/verification/browser.cjs
PLAYWRIGHT_MODULE=/tmp/carteliax-public-qa/node_modules/playwright QA_SUPABASE_AUTH_STORAGE_KEY=sb-127-auth-token node docs/landing-qr-pricing/verification/journey.cjs
node backend/test/secrets-build-audit.cjs
node backend/test/pricing-inspect.cjs
node backend/test/pricing-configure-test.cjs
node backend/test/stripe-readonly-audit.cjs
node backend/test/pricing-checkout-test.cjs
node backend/test/stripe-clock-audit.cjs
```

Los scripts que crean recursos Stripe están fuera de `npm test`, exigen Test y deben ejecutarse conscientemente. Los scripts de inspección necesitan red/credenciales; los tests ordinarios no usan Stripe real. Test Clocks deja fixtures Test identificados por el prefijo `carteliax-price1749`; sus IDs privados están en `/tmp/carteliax-price1749-clock-resources.json`. No se han eliminado recursos ni datos preexistentes.

La primera ejecución de navegador falló porque el test de una tarea anterior esperaba un botón de idioma, mientras el micrositio existente ya usa un `<select>`. Se adaptó únicamente el test a `#restaurant-language`; la segunda ejecución pasó. El log inicial se conserva. El test de hashes de la antigua tarea «solo landing» no se ejecutó: su alcance prohíbe cambios de backend que esta tarea sí autoriza y la auditoría anterior ya había realizado. No se rebajaron controles funcionales o de seguridad para hacerlo pasar.

Las evidencias reales de cobro proceden de la API Subscriptions y Test Clocks, con `pm_card_visa` y tasas inclusivas. No se presentan como un pago Live ni como una integración completa de Carteliax con Supabase/webhooks. Esta actualización no certifica por sí sola la aptitud general para lanzamiento indicada en la auditoría anterior.

Capturas: [landing móvil](docs/pricing-1749/verification/screenshots/landing-hero-390.png), [landing desktop](docs/pricing-1749/verification/screenshots/landing-full-1440.png). Precio y aviso de IVA revisados en móvil; la composición de la interfaz se conserva.

## Archivos modificados o creados en esta actualización

- `frontend/app/utils/commercialPlan.ts`
- `frontend/app/pages/index.vue`
- `frontend/app/pages/register.vue`
- `frontend/app/pages/dashboard.vue`
- `frontend/app/pages/businesses/index.vue`
- `frontend/app/pages/billing/[businessId].vue`
- `frontend/public/images/landing/social.png`
- `backend/src/config/env.js`
- `backend/src/modules/subscriptions/stripeService.js`
- `backend/src/modules/subscriptions/subscriptionController.js`
- `backend/src/modules/subscriptions/stripeWebhookController.js`
- `backend/.env.example`
- `backend/.env`: únicamente Price Test y nueva tasa Test; no incluirlo en control de versiones
- `backend/test/helpers/audit-fixture.js`
- `backend/test/preproduction.test.js`
- `backend/test/webhooks-audit.test.js`
- `backend/test/pricing.test.js` (nuevo)
- `backend/test/api-audit.cjs`
- `backend/test/stripe-readonly-audit.cjs`
- `backend/test/stripe-clock-audit.cjs`
- `backend/test/pricing-inspect.cjs` (nuevo)
- `backend/test/pricing-configure-test.cjs` (nuevo)
- `backend/test/pricing-checkout-test.cjs` (nuevo)
- `docs/landing-qr-pricing/verification/contracts.test.cjs`
- `docs/landing-qr-pricing/verification/browser.cjs`
- `docs/landing-qr-pricing/verification/journey.cjs`
- `docs/pricing-1749/verification/*`: logs, JSON sanitizados y dos capturas, enumerados en su manifiesto
- `AUDITORIA_COMPLETA_CARTELIAX.md` y `CARTELIAX_LANDING_QR_PRICING.md`: nota de precio vigente, conservando los hechos históricos
- `ACTUALIZACION_PRECIO_CARTELIAX.md` (este informe)

Los identificadores privados de los recursos creados se guardaron en `/tmp` con permisos `0600`; no se añaden al informe ni se han publicado claves o URLs de Checkout. No se han modificado SQL, RLS, cartas, traducciones, QR ni micrositios.

## PASOS MANUALES PARA JORDI

1. **Local Test:** el `.env` del backend ya contiene el nuevo Price y `STRIPE_VAT_TAX_RATE_ID` verificados. Reinicia el backend para cargar las variables. No reutilices en Test identificadores de Live o viceversa.
2. **Antes de activar Live:** tras tu autorización, crear o seleccionar un Price **nuevo** de 1.749 céntimos, EUR, mensual, intervalo 1, activo, `tax_behavior=inclusive`, y una tasa Live activa de IVA ES 21 % inclusiva. No modificar, cancelar ni migrar contratos anteriores. La configuración de Live sigue sin verificar.
3. **Variables del despliegue:** establecer `STRIPE_PRICE_ID`, `STRIPE_VAT_TAX_RATE_ID`, `STRIPE_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `FRONTEND_URL` de cada entorno con valores del mismo modo. No se han cambiado variables en Vercel. Si falta la tasa o no cumple los requisitos, Checkout debe permanecer bloqueado; no desactivar el guard para desplegar.
4. **Impuestos y Portal:** confirmar en Stripe Price inclusivo y tasa manual inclusiva. Mantener impuestos automáticos/cupones desactivados en este flujo. Revisar Customers con exenciones, saldos o descuentos antes de una recontractación bloqueada. Revisar la configuración del Portal para no ofrecer cambios automáticos de tarifa a contratos antiguos. No activar reglas que sumen IVA sobre 17,49 € ni modifiquen contratos actuales.
5. **Webhooks:** configurar el endpoint del backend `/api/subscriptions/webhook` con su secreto de firma del entorno correcto y los eventos utilizados por el código: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Verificar el prefijo/ruta con el montaje real y la URL del despliegue. Actualmente no se encontró ningún endpoint registrado en Stripe Test.
6. **Prueba integrada pendiente:** usar Supabase aislado y una cuenta ficticia, completar Checkout Test con tarjeta de prueba, verificar que exige tarjeta y muestra siete días gratis, confirmar `trial_end - trial_start = 604800`, y observar webhook → fila del establecimiento → acceso. Confirmar las facturas 17,49 € total, 14,45 € base y 3,04 € IVA. Test Clocks ya verifica esos importes en Stripe, pero falta el recorrido completo de la aplicación y su sincronización persistida.
7. **SQL/Supabase/Storage:** esta actualización no requiere ninguna migración ni configuración nueva en Supabase o Storage y no ejecuta operaciones allí. Las obligaciones pendientes de la auditoría de seguridad anterior siguen vigentes; no se consideran resueltas por el cambio de precio.
8. **Recursos visuales y establecimientos anteriores:** la imagen social ya está actualizada y entra en el build; no necesitas sustituirla manualmente. Las plataformas sociales pueden mantener su caché y requerir volver a inspeccionar la URL. No hay cambios automáticos sobre establecimientos o suscripciones anteriores. No se ha desplegado nada: revisar configuración y pruebas integradas antes de desplegar y aceptar cobros Live.
