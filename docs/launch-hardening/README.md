# Preparación de lanzamiento: seguridad, facturación y recuperación

## Alcance

Cambios locales exclusivamente. No se han aplicado migraciones, cambiado configuración remota, eliminado datos ni realizado operaciones Stripe LIVE. Los datos históricos TEST no demuestran un fallo de Checkout LIVE.

## Migración y orden de aplicación

Archivo: `supabase/migrations/20261009121557_launch_billing_and_permissions.sql`.

Requiere las tres migraciones anteriores y el esquema original de Carteliax. Crea un esquema privado, configuración del modo Stripe, historial de vínculos de facturación, columnas de recuperación de Checkout y leases de sincronización. Impide reasignar identidades y vínculos de recursos desde usuarios finales. Añade restricciones RLS a operaciones premium y triggers que también protegen RPC SECURITY DEFINER. Restringe RPC, permisos extraordinarios y escrituras de imágenes de productos. Conserva onboarding de establecimientos, logos/portadas, facturación y lectura pública mediante el backend.

1. Revisar copia de seguridad y exportación del inventario de funciones/políticas. El esquema original completo no está versionado: el fixture PostgreSQL no sustituye una prueba en Supabase QA.
2. Crear un Supabase QA independiente, con Auth y Storage independientes. Instalar el esquema base y aplicar migraciones en orden **solo en QA**.
3. En QA configurar `private.cx_billing_environment.stripe_livemode=false`. La migración tiene `true` como valor inicial para producción. Este valor debe coincidir con `STRIPE_MODE` del backend; no debe modificarse desde el cliente.
4. Configurar backend QA con claves, precio, IVA, secreto de webhook y URLs TEST. Configurar frontend QA con su propia URL/key publicable y API QA.
5. Ejecutar pruebas reales de Data API/RPC/Storage con dos cuentas QA, ciclo Stripe TEST y correo de recuperación.
6. Preparar mantenimiento de despliegue: aplicar migración y desplegar backend/frontend coordinadamente. El backend antiguo no proporciona tokens de lease y no puede usar la nueva RPC; el nuevo backend necesita las nuevas columnas/RPC. No es una actualización compatible con un despliegue mixto.
7. Solicitar aprobación explícita antes de aplicar a producción. No se proporciona un comando que aplique automáticamente la migración al proyecto conectado.
8. Mantener copia de la función/políticas anteriores para una reversión revisada. No eliminar el historial ni columnas de manera automática. Nunca revertir a una autorización que concede premium sin facturación verificada.

Las filas existentes conservan `stripe_livemode=NULL`: no se adivina su entorno ni se concede acceso por defecto. Si existieran contratos legítimos LIVE, verificarlos en Stripe mediante lectura y aprobar una reconciliación antes del corte. Actualmente el propietario indica que todos los registros son pruebas.

Una contratación iniciada por el propietario puede sustituir un vínculo histórico incompatible: el trigger guarda antes su fila completa en `private.cx_billing_history`. No se modifica ni cancela el contrato antiguo de Stripe. La prueba consumida en otro entorno no consume la prueba del entorno nuevo. Los intentos antiguos ambiguos quedan sujetos a reconciliación manual.

## Contrato de acceso

Express y SQL exigen propietario, modo verificado coincidente, cliente y suscripción Stripe, fecha de período futura y estado `active` o `trialing` con prueba futura. `cancel_at_period_end=true` conserva acceso hasta el final del período. `past_due`, `unpaid`, `paused`, `incomplete`, `incomplete_expired` y `canceled` no conceden acceso. Las cartas públicas conservan la política anterior: publicación, sin bloqueo adicional de facturación.

Las funciones privadas usan búsquedas SECURITY DEFINER con search_path cerrado para evitar recursión RLS. Los borrados directos de establecimientos se revocan porque no existe un endpoint de eliminación y podrían dejar contratos huérfanos. Las cascadas de hijos tras un borrado premium autorizado están cubiertas por una prueba SQL. Los triggers conservan la identidad JWT para comprobar escrituras hechas por RPC. El servicio privilegiado sigue siendo una autoridad de confianza; su clave jamás debe llegar al navegador. No exponer el esquema `private` en la Data API.

## Webhooks

Eventos requeridos por el código:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `invoice.paid`
- `invoice.payment_failed`

Registrar destinos independientes TEST/QA y LIVE. Verificar firma, entorno, URL real del endpoint, versión de eventos compatible, entregas y reintentos. No reenviar eventos TEST al backend LIVE. No se ha modificado ningún destino remoto.

Cada procesamiento resuelve el establecimiento, adquiere un lease de 90 segundos, vuelve a consultar Stripe y confirma mediante RPC transaccional. Los timestamps son un watermark de auditoría, no un desempate de eventos: se usa el estado vigente leído bajo el lease. El token y su vencimiento invalidan procesos antiguos; duplicados se registran una vez. Otro proceso ocupado produce 500 para reintento. Un fallo en SQL revierte la reclamación del evento. Los eventos de una suscripción anterior no sustituyen un nuevo intento.

## Checkout y recuperación

Se persisten parámetros exactos, fecha e idempotency key derivada del intento antes de llamar Stripe. Un rechazo definitivo de validación/autenticación/permisos libera únicamente la reserva que conserva ese intento. Un error de comunicación no prueba ausencia de sesión.

Un reintento reciente reproduce los mismos parámetros y la misma clave; si hay sesión guardada, consulta esa sesión. No se inicia otra sesión cuando Stripe confirma que la anterior está completada. Después de 23 horas, o sin parámetros persistidos, se exige reconciliación manual para evitar reutilizar una clave que Stripe pudiera haber eliminado.

Para reconciliación: consultar en el entorno correcto sesiones/subscripciones, metadata del intento y logs de Stripe. No liberar solo por caducidad local. Aprobar cualquier modificación local necesaria después de demostrar que no hay pago/suscripción pendiente. Los errores usan códigos de recuperación visibles, sin exponer mensajes internos del proveedor.

## Supabase Auth: configuración pendiente de aprobación

Rutas implementadas: `/forgot-password` y `/reset-password`. El enlace se solicita con `resetPasswordForEmail`; la contraseña se cambia con `updateUser` después de comprobar la identidad de la sesión de recuperación. No hay parámetro de ID de usuario. No se aceptan URLs de retorno proporcionadas por query. Los tokens se retiran de la URL y no se registran.

Producción:

- Site URL: `https://www.carteliax.com`.
- Redirect URL exacta: `https://www.carteliax.com/reset-password`.
- Si se sirve el dominio sin www de forma independiente, añadir `https://carteliax.com/reset-password`; preferible redirigirlo de forma canónica preservando el callback.
- Comprobar plantilla **Reset Password**, expiración, SMTP propio, límites y entrega. La plantilla predeterminada con `{{ .ConfirmationURL }}` usa el callback estándar de Supabase, soportado por el SDK.
- Una plantilla alternativa puede enlazar `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`; la página verifica ese hash en Supabase. No añadir esta plantilla sin aprobación.
- Comprobar política de contraseña (mínimo actual: 8 caracteres); la UI permite 8–128 y confirmación. Supabase aplica requisitos adicionales y rechaza contraseñas que no los cumplan. Revisar protección de contraseñas filtradas, desactivada en la lectura de Advisors.

Desarrollo/QA, en su proyecto independiente: `http://localhost:3000/reset-password` y, si se usa, `http://127.0.0.1:3000/reset-password`. Para otro puerto, registrar su URL exacta. No añadir comodines amplios de previews a producción.

**Requiere autorización concreta:** añadir las Redirect URLs necesarias o cambiar Site URL, SMTP, plantilla o política de Auth. No se ha podido inspeccionar la configuración remota de Auth con las herramientas disponibles; no se presupone que la URL falte.

Los enlaces inválidos/expirados/reutilizados muestran un error seguro. Una sesión normal no habilita la pantalla por sí sola. Tras cambiar la contraseña se solicita cierre global de sesiones y se ofrece volver a Login. Los JWT previamente emitidos pueden seguir vigentes hasta su expiración; comprobar esa política en QA.

## Documentos legales

`/terms` y `/privacy` son rutas reales enlazadas desde el registro, con una indicación explícita de documento pendiente. No son documentos legales definitivos ni acreditan cumplimiento. Sustituirlos por documentos revisados y aprobados antes de admitir registros comerciales.

## Dependencias

`source-map-js` se fija a 1.2.2 y `simple-git` a 4.0.2 mediante overrides. El salto mayor de simple-git está justificado por los avisos críticos sin parche en 3.x. DevTools 3 importa un default eliminado por 4.x, por lo que se desactiva el módulo opcional de desarrollo para conservar la versión corregida y la compatibilidad de build. Nuxt permanece en 4.x; no se instala una beta de DevTools.

La consulta npm posterior devuelve cero críticos, pero persisten avisos altos derivados de `braces<=3.0.3` y `node-forge<=1.4.0`, las últimas versiones publicadas en la consulta. Sus cadenas son tooling de globs y servidor HTTPS de desarrollo. No introducir patrones/archivos de terceros sin confianza en build y no exponer servidores de desarrollo. No se afirma que todos los avisos estén resueltos ni que cada paquete señalado sea una vulnerabilidad independiente explotable en el SaaS. Backend runtime: cero avisos en `npm audit --omit=dev`; tooling de backend conserva el aviso de braces.

## Verificación y pendientes

Consultar `verification.md`. Los tests Node usan Stripe/Auth/PostgREST simulados. Los tests SQL ejecutan PostgreSQL real en un clúster desechable, con esquema base aproximado. Los tests de navegador ejecutan Nuxt compilado y el SDK real de Supabase, pero interceptan Auth: no envían correos. Ninguno certifica pagos, renovación ni entrega de webhooks reales.

Pendiente obligatorio: ciclo TEST real en QA (registro, establecimiento, Checkout, prueba, primer pago, dos renovaciones, fallos, cancelación, portal y webhooks), Data API/RPC/Storage hospedados, SMTP real, configuración LIVE de lectura y aplicación autorizada de migración/despliegue. No declarar listo el lanzamiento comercial antes de esas verificaciones y los documentos legales.
