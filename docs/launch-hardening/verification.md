# Resultados de verificación — 9 de octubre de 2026

| Prueba | Resultado | Alcance real |
|---|---|---|
| `cd backend && npm test` | 131 PASS, 0 FAIL | Stripe/Auth/PostgREST simulados donde corresponde; SDK Stripe real para firmas |
| `node backend/test/api-audit.cjs` | 128 PASS | HTTP Express real, transportes remotos simulados; no certifica RLS |
| `node backend/test/launch-crud.cjs` | 29 PASS | CRUD de establecimiento, carta, categoría, producto, relación/alérgenos, publicación pública y estados de acceso; datos/Auth simulados |
| `node backend/test/launch-database.cjs` | PASS | PostgreSQL 14 real desechable: migraciones, roles, RLS, RPC, Storage y concurrencia; esquema base aproximado |
| `cd frontend && npm run typecheck` | PASS | Aplicación y servidor Nuxt con vue-tsc/TypeScript |
| `cd frontend && npm run build` | PASS | Compilación local completa; no despliegue Vercel |
| `node backend/test/recovery-browser.cjs` | PASS | Chrome, Nuxt compilado y SDK Supabase real; todas las llamadas Auth/API interceptadas |
| `git diff --check` | PASS | Formato del diff |
| npm audit frontend | 0 críticos, 11 altos | Avisos restantes derivados de braces y node-forge sin parche publicado en la consulta |
| npm audit backend runtime | 0 avisos | `--omit=dev` |
| npm audit backend completo | 0 críticos, 3 altos | Tooling de nodemon/braces |

Evidencias completas en `verification/`. Los errores `CX_BILLING_FENCE` del log PostgreSQL son rechazos esperados que el runner verifica como PASS; no son fallos de la suite.

## Casos de navegador

- Landing, Login, Registro, condiciones, privacidad y recuperación en 390 y 1440 px, sin desbordamiento horizontal observado.
- Solicitud de recuperación con confirmación genérica.
- URL directa sin recuperación no habilita el cambio.
- Verificación de enlace inválido/caducado rechazada por el adaptador Auth.
- Confirmación distinta impide actualizar.
- Token de recuperación verificado permite actualizar únicamente la sesión actual.
- Cierre global de sesión solicitado después del cambio.
- Enlace reutilizado rechazado por el adaptador Auth.
- Callback implícito estándar de Supabase procesado por el SDK.
- Sesión invalidada impide actualizar.
- Registro conserva confirmación de correo cuando no hay sesión.
- Login navega a Dashboard.
- Prueba vencida muestra «Prueba gratuita finalizada».
- QR dibujado y URL del restaurante correctos con datos simulados. No se realizó lectura física del QR.

Esto no acredita envío/recepción de correos, configuración SMTP, seguridad del servidor Auth hospedado, PKCE real ni persistencia en Supabase real.

## PostgreSQL local

El runner exige el clúster `/tmp/carteliax-hardening-pg/data`, socket `/tmp/carteliax-hardening-pg/socket` y puerto 55439; rechaza otros destinos. No carga `.env`. Para repetirlo, inicializar allí un clúster PostgreSQL local desechable con usuario `jordi`, escuchar solo en localhost y ejecutar el runner. Crea bases independientes y aplica todas las migraciones locales sobre el fixture documentado.

Comprobaciones: acceso del propietario con contrato válido, rechazo entre usuarios, reasignación e identidad rechazadas, borrado premium con cascada legítima, borrado directo de establecimiento denegado, bloqueo premium sin contrato válido, duplicación SECURITY DEFINER bloqueada, Storage de producto bloqueado, onboarding conservado, estados negativos, período nulo/vencido, prueba válida, entorno distinto e historial preservado. Concurrencia: un único lease ganador, holder caducado rechazado, igualdad de timestamps sin pérdida del estado leído bajo lease, evento retrasado con snapshot vigente, watermark monotónico, duplicados y rollback sin evento registrado.

## Límites y autorización pendiente

NO EJECUTADO: Supabase QA hospedado, correos reales, Checkout real TEST, pagos/3DS, Test Clocks, renovaciones, cancelación/portal reales, entrega y reintentos reales de Stripe, aplicación/despliegue en producción.

No hay un entorno QA aislado autorizado identificado. El proyecto conectado y el backend LIVE no se utilizaron para mutaciones. Solo se consultó el catálogo de funciones/vistas del Supabase actual para contrastar permisos; no se alteraron datos ni contratos.

El artefacto local `.output/server` no contiene archivos ni declara dependencias externas de braces, node-forge o simple-git. Esto limita la exposición observada al tooling, y no certifica el artefacto actualmente desplegado en Vercel ni elimina la necesidad de revisar avisos pendientes.

Para repetir el navegador, iniciar previamente el build con valores ficticios:

```bash
PORT=3008 HOST=127.0.0.1 NUXT_PUBLIC_SUPABASE_URL=https://qa-auth.invalid NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=qa-publishable NUXT_PUBLIC_API_URL=http://127.0.0.1:3010 NUXT_API_BASE_URL=http://127.0.0.1:3010 node frontend/.output/server/index.mjs
```

En otra terminal, ejecutar `node backend/test/recovery-browser.cjs`. El script requiere Google Chrome y Node con WebSocket global. Intercepta servicios externos; no utilizar configuración real para estas pruebas.
