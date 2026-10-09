# Incidencia de activación LIVE — 2026-10-09

Investigación de solo lectura. No se ha modificado código de aplicación, SQL de producción ni datos. No se han creado Checkout, suscripciones o cargos.

## Evidencia real

Supabase: proyecto `cyknlbxcadjuyvypqtbn` (carteliax). Negocio afectado: `27da34ba-0183-4662-9268-cee6b9f99a81`.

La fila consultada presenta:

| Campo | Valor |
| --- | --- |
| status | checkout_pending |
| stripe_livemode | true |
| stripe_customer_id | NULL |
| stripe_subscription_id | NULL |
| trial_ends_at | NULL |
| current_period_end | NULL |
| checkout_attempt_id | 163407d4-e7f7-4095-84d9-1bc4a5a55fef |
| checkout_session_id | cs_live_b1td4aSZCyabINB7aVfV8xyahw8zi6ONZkqFQZ4vS0pNrNSXO67lEyrEQj |
| checkout_requested_at | 2026-10-09T14:14:36.154Z |
| checkout_expires_at | 2026-10-09T14:44:36Z |
| billing_sync_token / billing_sync_expires_at | NULL / NULL |
| stripe_event_created | 0 |

La solicitud guardada incluye `trial_period_days: 7`. Los metadata de sesión y suscripción coinciden en business_id, owner_id y checkout_attempt_id.

`stripe_webhook_events` contiene únicamente dos eventos del 1 de octubre; no hay eventos del intento LIVE registrados como procesados. Esto no prueba que Stripe no haya intentado entregarlos: los errores transaccionales no dejan registro en esa tabla.

El entorno privado de facturación exige LIVE. Las tres funciones cx_acquire_billing_sync, cx_release_billing_sync y cx_sync_billing_event existen en producción; service_role dispone de EXECUTE. También dispone de UPDATE sobre subscriptions e INSERT sobre stripe_webhook_events. No se ha ejecutado ninguna RPC mutadora para probarlas.

La consulta de logs postgres entre 14:05 y 14:23 UTC, filtrada por billing/permission/error, devuelve cero resultados. No descarta errores de HTTP, firma o aplicación.

## Lectura del código local

- El webhook usa express.raw antes de express.json, y verifica la firma con STRIPE_WEBHOOK_SECRET. Falta comprobar el código desplegado y el secreto efectivo.
- La sincronización vuelve a consultar Stripe bajo una concesión de 90 segundos y pasa el token a la RPC. La RPC valida propietario, modo, intento y vínculo de cliente/suscripción.
- GET de suscripción solo consulta Supabase; no reconcilia Stripe.
- La página de facturación carga al montar o cambiar negocio. No hace polling tras checkout=success. Actualizar estado vuelve a consultar Supabase.
- El logger omite los mensajes de errores Error('CX_BILLING_*') y normalmente los transforma en UNEXPECTED_ERROR, lo que limita el diagnóstico. No se ha cambiado sin evidencia del fallo real.

## Acceso pendiente y límites del diagnóstico

La clave de backend/.env es TEST. No sirve para verificar la sesión LIVE. El perfil LIVE encontrado en la CLI de Stripe corresponde a otra aplicación y no se ha utilizado.

Vercel MCP identifica carteliax-api como prj_EELoINen50BirdtGFqGWje5TDP2f, equipo team_MLRUusSLbJ2iB5lh5sPCRPn2. Consultar logs y despliegues devuelve 403; consultar proyecto/despliegue devuelve 404. La CLI local confirma loggedIn=false y rechaza el acceso al equipo.

Conclusión comprobada: Supabase no ha activado la suscripción; el problema no es únicamente un estado visual obsoleto. No se ha confirmado todavía el estado trialing en Stripe ni la causa exacta de la ausencia de sincronización.

Para continuar se necesita lectura de la sesión LIVE guardada y su suscripción, eventos checkout.session.completed / customer.subscription.created / customer.subscription.updated con sus entregas HTTP, logs del endpoint y configuración efectiva del despliegue. No compartir claves secretas en el chat.

## Reconciliación condicionada a la verificación LIVE

Recuperar exclusivamente la sesión guardada mediante GET; comprobar complete, modo subscription, livemode, cliente, propietario, negocio e intento. Recuperar la suscripción existente, adquirir la concesión y volver a leer su estado autoritativo. Validar contrato, fechas y vínculo, y sincronizar mediante la RPC existente con un evento real de Stripe que no figure procesado; comprobar el resultado de la RPC y releer la fila. Un resultado duplicate/unrelated/stale no debe interpretarse automáticamente como recuperación exitosa. Liberar la concesión en finally.

No crear o reproducir solicitudes Checkout durante esta recuperación. No alterar SQL ni forzar el estado trialing sin comprobar Stripe. La implementación queda pendiente de la evidencia requerida por el usuario.
