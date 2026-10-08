# Verificación local de micrositios

Los scripts de esta carpeta usan únicamente fixtures. No ejecutarlos contra Supabase. Los SQL de tests y el fixture rechazan cualquier PostgreSQL que no use puerto 55432 y directorio `/tmp/carteliax-languages/`.

1. Instalar herramientas QA en `/tmp/carteliax-microsites/qa`: `npm install --prefix /tmp/carteliax-microsites/qa playwright vue-tsc typescript@5.9.3`. No modifica dependencias de producción.
2. Inicializar PostgreSQL 14 local desechable en `/tmp/carteliax-languages/pgdata`, socket `/tmp/carteliax-languages`, puerto 55432; crear base `carteliax_delivery`. Aplicar `schema-fixture.sql`, migración original de traducciones y nueva migración de micrositios exclusivamente en esa base.
3. `node docs/microsites/verification/run-database.cjs`: cinco suites SQL, concurrencia y ambas integraciones Express/PostgreSQL. El adaptador bloquea servicios externos. Los datos de la base local se reinician; NO son datos reales. `fresh-migration.cjs` valida ambas migraciones desde cero en otra base desechable (nombre nuevo en cada ejecución).
4. `node docs/microsites/verification/public-server.cjs`: API SSR de fixtures, 5099. Reiniciar si se cambia fixtures.cjs.
5. Desde frontend, iniciar Nuxt en **3001** con `NUXT_API_BASE_URL=http://127.0.0.1:5099 NUXT_PUBLIC_API_URL=http://127.0.0.1:5099 npm run dev -- --host 127.0.0.1 --port 3001`. Las suites interceptan autenticación y Storage, y nunca usan cuentas reales.
6. `node docs/microsites/verification/run-browser.cjs`: suites de regresión heredadas y micrositios. Chrome `/usr/bin/google-chrome`. Ejecutar secuencialmente: comparten estado de fixtures. El harness usa los datos públicos de configuración de frontend/.env únicamente para configurar la sesión simulada.
7. `node docs/microsites/verification/typecheck.cjs`; build desde frontend con `npm run build`; tests backend con `npm test`.

Logs finales y capturas en esta carpeta. Las pruebas de Stripe Checkout/Portal, auth y Storage en navegador usan mocks; no certifican credenciales, permisos originales del proyecto remoto ni transacciones Stripe reales. No se prueban cámaras de móviles ni Safari físico. Ninguna prueba consume Groq real.
