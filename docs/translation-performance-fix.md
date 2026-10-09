# Traducción en cola y seguimiento — 2026-10-09

## Evidencia de producción (solo lectura)

El trabajo `2f9f6976-7b48-4372-8b7e-96e4bc69186d`, inglés, carta `c8d62b59-1f07-4e24-a4b3-98929fa6d4a4`, tenía status=queued, completed_items=0, total_items=11 y lease_expires_at=NULL. created_at y updated_at coincidían: 2026-10-09T14:43:24.540439Z. Ningún worker había reclamado ese trabajo.

El worker se iniciaba únicamente desde src/server.js. Vercel detecta primero src/app.js, que exporta Express y no ejecuta server.js. Además, un temporizador de proceso no mantiene viva la ejecución entre peticiones de una función. Documentación: https://vercel.com/docs/frameworks/backend/express y https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package.

## Cambio

- La petición de traducción activa inmediatamente el worker y registra su promesa con waitUntil. El runtime comparte el mismo worker con el servidor local.
- Una petición POST de recuperación, protegida por autenticación, propietario y suscripción, despierta únicamente trabajos queued y vigentes. No crea otro trabajo y no reproduce trabajos processing o failed.
- Un drenaje limitado consume la cola existente. Los claims SQL y los tokens siguen evitando procesar un trabajo dos veces entre instancias. Se comparte la promesa en curso entre peticiones del mismo proceso.
- Vercel permite 300 segundos para src/app.js. Se deja margen antes de empezar una llamada de proveedor cuando termina la invocación. Los jobs grandes aún pueden fallar por límite de ejecución: no se reintentan llamadas ambiguas ni se guardan borradores parciales.
- GET de progreso consulta solo los contadores del trabajo del menú y propietario. El navegador consulta cada 1,5 segundos y obtiene todos los textos únicamente al terminar. El estado completo y los textos publicados mantienen sus flujos anteriores.

En una consulta de solo lectura con los datos reales de esa carta, el JSON del estado completo medía 6.340 bytes y el JSON reducido de progreso 235 bytes: aproximadamente 96,3 % menos de contenido. Es una comparación del contenido JSON, sin cabeceras ni compresión; no mide la duración de las llamadas de Groq.

## Verificación

- Suite backend: 178 pruebas pasadas, cero fallos. Incluye el flujo de 11 textos con el proveedor simulado y el SDK real waitUntil bajo contexto simulado, respuesta 202 antes de finalizar, concurrencia, recuperación y vencimientos.
- Frontend: typecheck y build completados.
- git diff --check y comprobación de sintaxis del adaptador de integración: correctos.
- El adaptador de integración PostgreSQL se actualizó para usar el runtime automático. No se ejecutó en esta sesión porque su base desechable /tmp/carteliax-languages no existe.
- No se invocó Groq real ni se modificaron datos o SQL de producción.

## Despliegue pendiente

La CLI de Vercel no tiene credenciales válidas. La comprobación de proyecto inició un flujo de login, que se canceló. No se ha desplegado esta corrección ni verificado su ejecución en producción.

Desplegar primero backend, después frontend. Comprobar que un trabajo pasa queued → processing → completed, que existe TRANSLATION_COMPLETED y que los textos permanecen como borradores hasta publicar. Un intento ya expirado requiere que el propietario vuelva a solicitar la traducción desde la interfaz; esta corrección no revive intentos caducados automáticamente.
