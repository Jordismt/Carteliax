# Evidencias de verificación

Todos los logs corresponden a la última ejecución indicada en el informe. Los typechecks exitosos no imprimen salida. Los fixtures no representan producción ni llamadas reales a Groq.

Los tests Node están en `backend/test`; `npm test` ejecuta 28 pruebas unitarias sin servicios externos. Las pruebas SQL/concurrencia/API necesitan PostgreSQL desechable en el puerto 55432 y directorio `/tmp/carteliax-languages`, esquema de fixtures y roles; sus guardas rechazan otras bases. No se deben ejecutar sobre Supabase.

El harness de navegador requiere Playwright disponible mediante `PLAYWRIGHT_MODULE`, Chrome, frontend local 3000 con API de fixtures 5099 y el servidor `public-server.cjs`. Los scripts conservan rutas de salida en `/tmp/carteliax-languages`. No es un test de integración con cuentas reales. `browser.cjs` y `fixtures.cjs` contienen únicamente autenticación y datos de prueba. El frontend normal no utiliza este servidor.
