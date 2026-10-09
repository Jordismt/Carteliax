# Diagnóstico de Checkout HTTP 503 / BILLING_CONFIGURATION

El código anterior agrupaba todas las comprobaciones bajo el mismo código y mensaje. El log comunicado no permite determinar cuál falló. El nuevo campo `billingReason` registra la primera comprobación fallida, sin claves, IDs, objetos Stripe ni datos personales. Si hay varias configuraciones incorrectas, al corregir la primera puede aparecer otra.

Las comprobaciones se ejecutan en `stripeService.js`, llamadas desde `createCheckout` antes de reservar el intento y crear una sesión. Este código no identifica un fallo SQL, RLS o de webhook. Los errores del proveedor (por ejemplo, un `price_` inexistente en LIVE) conservan su propio código; no se convierten aquí en `BILLING_CONFIGURATION`.

## Variables y valores requeridos por la implementación actual

Comprobar las variables del proyecto **backend**, objetivo **Production**, y la configuración correspondiente al despliegue que recibe la petición. Las variables locales o las actuales del panel no demuestran qué valores utiliza un despliegue anterior.

| Variable | Configuración requerida |
|---|---|
| `STRIPE_MODE` | `live` explícito para producción; el valor por defecto es `test`. |
| `STRIPE_SECRET_KEY` | Clave `sk_live_` o `rk_live_`, misma cuenta que los objetos. No mostrar su valor. La incompatibilidad clave/modo impide arrancar mediante Zod; no genera este error personalizado. Una clave restringida necesita permisos de lectura para Prices, Tax Rates, Customers e Invoice Items para estas verificaciones. |
| `STRIPE_PRICE_ID` | `price_` de LIVE, activo, EUR, `unit_amount=1749`, recurrente mensual, `interval_count=1`, `tax_behavior=inclusive`. |
| `STRIPE_VAT_TAX_RATE_ID` | `txr_` de LIVE, activo, `percentage=21`, `inclusive=true`, `tax_type=vat`, `country=ES`. Ausente o cadena vacía permite arrancar, pero bloquea nuevos Checkout. |
| `STRIPE_WEBHOOK_SECRET` | Se valida su prefijo al arrancar; la firma se verifica en el webhook. Un secreto de otro endpoint/entorno afecta webhooks, pero no es una condición de este error personalizado. |
| `FRONTEND_URL` | URL válida y HTTPS en producción. No produce este error personalizado. |

Estos requisitos reflejan la política fiscal fija del código; no certifican su aplicabilidad legal a cualquier cliente o jurisdicción. Checkout usa impuesto manual y `automatic_tax.enabled=false`; activar Stripe Tax no sustituye `STRIPE_VAT_TAX_RATE_ID` en esta implementación.

## Motivos y corrección a revisar, sin modificar contratos existentes

| `billingReason` | Comprobación fallida / acción |
|---|---|
| `PRICE_INACTIVE` | Price archivado. Seleccionar un Price activo compatible para futuras contrataciones. |
| `PRICE_MODE_MISMATCH` | `price.livemode` difiere del modo del backend. Revisar cuenta y objeto LIVE. |
| `PRICE_CURRENCY` | Moneda distinta de `eur`. |
| `PRICE_AMOUNT` | Importe distinto de 1749 céntimos (17,49 €, total con IVA incluido). |
| `PRICE_INTERVAL` | Price no recurrente o intervalo distinto de `month`. |
| `PRICE_INTERVAL_COUNT` | Frecuencia distinta de un mes. |
| `PRICE_TAX_BEHAVIOR` | IVA exclusivo o `unspecified`; debe ser `inclusive`. |
| `VAT_RATE_MISSING` | Falta `STRIPE_VAT_TAX_RATE_ID` en el entorno efectivo. Configurar un `txr_` compatible. |
| `VAT_INACTIVE` | Tax Rate archivado. Seleccionar uno activo compatible. |
| `VAT_MODE_MISMATCH` | Tax Rate de otro modo. Revisar cuenta y objeto LIVE. |
| `VAT_PERCENTAGE` | Porcentaje distinto de 21. |
| `VAT_NOT_INCLUSIVE` | IVA no incluido. |
| `VAT_TYPE` | `tax_type` distinto de `vat`, incluido `null`. Llamar al impuesto «IVA» o «VAT» no rellena necesariamente este campo. |
| `VAT_COUNTRY` | `country` distinto de `ES`, incluido `null`. La etiqueta `jurisdiction` no sustituye `country`. |
| `CUSTOMER_DELETED` | Cliente reutilizado eliminado. Revisar vínculo sin borrar datos. |
| `CUSTOMER_MODE_MISMATCH` | Cliente reutilizado de otro modo. Reconciliar referencias e historial. |
| `CUSTOMER_TAX_EXEMPT` | Cliente exento/inversión del sujeto pasivo o campo distinto de `none`. Revisar política fiscal antes de cualquier cambio. |
| `CUSTOMER_BALANCE` | Saldo distinto de cero. Reconciliar; no ponerlo a cero automáticamente. |
| `CUSTOMER_CREDIT_BALANCE` | Saldo de crédito de facturas distinto de cero. Reconciliar sin eliminarlo. |
| `CUSTOMER_DISCOUNT` | Descuento aplicado al cliente. Revisar sin eliminarlo automáticamente. |
| `CUSTOMER_PENDING_INVOICE_ITEMS` | Conceptos pendientes de facturación. Revisar sin borrarlos ni facturarlos automáticamente. |

Stripe permite `country` y `tax_type` nulos: https://docs.stripe.com/api/tax_rates/object. La creación permite indicar ambos: https://docs.stripe.com/api/tax_rates/create. No se han relajado las validaciones ni modificado objetos remotos. Para atributos que Stripe no permita cambiar, preparar un objeto nuevo para futuras contrataciones con autorización; preservar los objetos y contratos existentes.

## Verificación de solo lectura

Con Node y las variables **efectivas del backend** cargadas de forma segura, desde `backend/`:

```sh
node scripts/check-billing-config.js live
```

El argumento `live` es obligatorio para evitar validar accidentalmente la configuración TEST local. Una discrepancia devuelve `DIAGNOSTIC_MODE_MISMATCH` antes de consultar Stripe. El script utiliza exclusivamente `prices.retrieve` y `taxRates.retrieve`. No crea Checkout, no accede a Supabase y no modifica Stripe. Para diagnosticar además un cliente existente, puede pasarse su ID como segundo argumento; se consultará con `customers.retrieve` e `invoiceItems.list`, sin registrar el ID.

Una salida PASS solo demuestra que esos objetos cumplen las comprobaciones leídas; no prueba pagos, prueba gratuita, webhooks ni renovaciones. Sin segundo argumento, el cliente figura como `NOT_CHECKED`. Una salida fallida contiene un motivo como:

```text
[BILLING_DIAGNOSTIC] { code: 'BILLING_CONFIGURATION', type: undefined, billingReason: 'VAT_TYPE' }
```

No utilizar POST Checkout como sonda de diagnóstico: si las comprobaciones pasan puede crear una sesión y reservar datos. No compartir claves ni copiar archivos de secretos a informes. No se han cambiado variables de producción, SQL, datos, contratos ni desplegado esta mejora.

## Acceso remoto durante esta investigación

El conector permite listar `carteliax-api`, pero consultar sus variables devuelve HTTP 404 `Project not found`, tanto por nombre como por ID y con el equipo propietario. No hay Vercel CLI instalado. Por ello no se han verificado los valores de producción ni se atribuye el error a una condición concreta sin un diagnóstico adicional.
