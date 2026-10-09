# Traducciones de Carteliax — 9 de octubre de 2026

Implementado en el repositorio, sin despliegue ni modificaciones de SQL/datos de producción. Se conservan Nuxt/Vue, Express, Groq y Supabase. Los cambios anteriores de publicación, QR y suscripciones permanecen separados en `restoration-regression-2026-10-09.md`.

## Causas comprobadas

| Causa | Evidencia y corrección |
| --- | --- |
| Prompt genérico e idioma de origen tratado como fiable | El código anterior no definía perfiles regionales ni una revisión gastronómica completa. Ahora cada campo se interpreta por su idioma real; el idioma configurado es una pista. Corpus real con descripción deliberadamente mezclada. |
| JSON válido aceptado como traducción válida | Las respuestas reales incluían `al·lígens`, cambios sepia/calamar y limón/lima. Se comprueban estructura, identidad de recursos, números/unidades, negaciones, marca, idioma probable, omisiones y algunos ingredientes confundibles. |
| Calidad insuficiente del modelo/prompts anteriores | Las evaluaciones reales detectaron mezclas regionales en valenciano. Por instrucción expresa del propietario, el sistema utiliza **únicamente GPT-OSS 120B en los cuatro idiomas**, sin selección por idioma ni fallback a otros modelos. Los candidatos que no cumplen calidad se rechazan tras un reintento controlado. |
| Caché basada únicamente en original | Una traducción automática incorrecta con el mismo hash se consideraba actualizada. Se introduce `gastronomy-v2`; los textos automáticos anteriores requieren actualización, sin borrarlos ni retirar las versiones públicas existentes. |
| Regeneración capaz de reemplazar textos manuales | `replaceManual:true` se rechaza en API y SQL. Regenerar fuerza solo recursos automáticos; la comprobación final vuelve a verificar autoría manual, hash y revisión dentro de la transacción. |
| Presentación del restaurante fuera de la generación | Introducción y «Sobre nosotros» solo tenían el mecanismo manual de `public_profile`. Se incorporan a las fuentes, editor, persistencia y publicación. Esas traducciones antiguas se consideran manuales y tienen prioridad sobre borradores automáticos. |
| Títulos de navegación sin localizar | Nueva proyección pública de títulos, limitada a cartas/diseños e idiomas publicados y hashes vigentes. Si todavía falta el RPC durante una transición, se conserva el título original. |
| Fallback parcial del producto | Podía combinar título traducido con descripción original. Ahora, ante una traducción incompleta, el producto vuelve completo al original. La disponibilidad, precios, imágenes y códigos de alérgenos no se modifican. |
| Regeneración fallida sin aviso | El dashboard solo mostraba el fallo si faltaban textos o estaban obsoletos. Ahora informa también cuando falla una regeneración que conserva borradores anteriores válidos. |

No se atribuyen estos errores a RLS: las causas de calidad y presentación son distintas de los permisos. Las descripciones de categorías siguen siendo privadas según el contrato público existente; únicamente se traduce su nombre. No se expone contenido privado a Groq ni a visitantes para ampliar la traducción.

## Comportamiento implementado

- Cuatro idiomas es/val/en/fr, incluido generar una copia corregida en el idioma original sin modificar los originales.
- Nombres y descripciones de cartas/productos, categorías, bienvenida publicada, introducción y «Sobre nosotros». El nombre del restaurante se conserva exactamente.
- Textos fijos de interfaz y 14 etiquetas de alérgenos localizados de forma determinista. Los códigos de alérgenos no se mandan a IA ni se reconstruyen a partir de sus descripciones.
- Prompts gastronómicos con conservación de ingredientes, cantidades, marcas, nombres tradicionales, negaciones y declaraciones sobre trazas; ejemplos de falsos amigos semánticos.
- Lotes acotados y contexto de carta/categorías/restaurante. Terminología aprobada de borradores vigentes o manuales y resultados aceptados de lotes anteriores, siempre dentro del mismo idioma.
- Máximo dos pasadas de traducción por lote. En es/en/fr, la segunda se usa ante salida explícitamente inválida o sospechosa; en val se reserva para revisión editorial incluso si pasan las heurísticas iniciales. Siempre se utiliza el mismo GPT-OSS 120B. El segundo recibe el candidato anterior y los motivos para editarlo. Timeout/red ambigua no provoca otra llamada automática. Los límites 429 tienen espera corta acotada; si continúan, se informa al propietario.
- Se trata el HTTP 400 `json_validate_failed` observado en Groq como salida inválida, sin almacenar ni mostrar `failed_generation`.
- Nada se persiste hasta que todos los lotes pasan las comprobaciones. La publicación es otra acción explícita. Los lectores públicos nunca llaman a IA.
- Caché incremental por fuente, idioma y versión de política. La regeneración explícita ignora la caché de recursos automáticos; nunca la protección manual. Se conservan cuotas, locks, leases, caducidad y controles premium/propiedad existentes.
- Selector público conserva elección por restaurante; la URL explícita prevalece. La proyección de cada idioma es independiente y no muta la respuesta original.

Las comprobaciones lingüísticas son heurísticas conservadoras: detectan errores razonables, pero no certifican cualquier frase ni sustituyen una revisión editorial. No se promete ausencia universal de errores de IA. Las reglas léxicas rechazan errores; no reemplazan palabras ni generan traducciones mediante un diccionario.

## Pruebas ejecutadas

| Nivel | Resultado y límites |
| --- | --- |
| Suite Node | **205/205**. Incluye pruebas nuevas de cuatro idiomas, contenido gastronómico, protección manual, versión de caché, reintentos, cambios de ingredientes, mismo modelo en los cuatro idiomas, pasada editorial acotada, JSON rechazado y proyección del módulo TypeScript real del frontend. Estos casos usan fixtures/mocks donde corresponde. |
| PostgreSQL real local | Todas las migraciones aplicadas a una base desechable. Cuatro idiomas × 13 recursos; publicación separada; caché sin nuevo trabajo; regeneración de 12 recursos preservando una fila manual completa; originales/precio intactos; RPC/tablas restringidos; propietario ajeno rechazado; edición manual concurrente impide commit; calidad antigua no se puede republicar; textos manuales antiguos protegidos incluso si ya existe fila automática. **Supabase alojado no probado con esta migración.** |
| HTTP integrado local | Express real → cliente Supabase real → transporte de prueba → PostgreSQL real. Generación/regeneración, worker, publicación, API pública en cuatro idiomas y títulos de navegación pasan. **Auth alojado y Groq están simulados en este harness.** |
| Chrome local | Build Nuxt → API local → PostgreSQL. Escritorio 1440 px y móvil 390 px: cuatro idiomas, descripciones completas, introducción/«Sobre nosotros», selección persistida, ruta heredada `/c`, atributos de idioma y ausencia de errores JS/desbordamiento. **La generación de sus textos y Auth se simulan.** |
| Groq real, separado | Datos exclusivamente sintéticos. **120B en los cuatro idiomas**: ejemplos revisados es 5,553 s; val 9,819 s; en 3,468 s; fr 4,713 s, 13 recursos por idioma. La evaluación valenciana final pasa las comprobaciones automáticas con el prompt reforzado y dos llamadas al mismo modelo. Incluyen descripción mezclada, marcas, números, alérgenos en prosa y negaciones. No escriben en Supabase. Son medidas de este corpus, no una garantía de latencia en producción ni una certificación lingüística; los ensayos anteriores rechazados no cuentan como aprobados. |
| Evaluaciones fallidas | Ensayos de 120B valenciano rechazados tras dos intentos por deriva regional; ensayo de mayor razonamiento produjo HTTP 400 `json_validate_failed`. Se conservan evidencias de rechazo. Las comprobaciones locales con fixtures de valenciano pasan, pero son distintas de la evaluación real del proveedor. |
| Frontend | `npm run typecheck` y `npm run build`: correctos. `git diff --check`: correcto. |

Los resultados reales revisados están en `translation-quality/verification/real-provider-reviewed.json`; los candidatos valencianos rechazados en `translation-quality/verification/gpt-oss-rejected-val.json`. Son salidas sintéticas reales, no textos inventados para aparentar integración.

Pendiente: integración alojada con nueva migración, credenciales/Auth reales de propietario, operaciones reales de edición/publicación y observación de cuotas/latencia bajo carga. No se han regenerado traducciones de clientes ni efectuado operaciones Stripe.

### Repetir pruebas

```bash
cd /home/jordi/Escritorio/carteliax/backend
npm test
cd /home/jordi/Escritorio/carteliax/frontend
npm run typecheck
npm run build
```

Los harness SQL rechazan cualquier cluster que no sea `/tmp/carteliax-hardening-pg/data`, socket `/tmp/carteliax-hardening-pg/socket`, puerto 55439, usuario local `jordi`. Con ese cluster desechable y fixtures disponibles, ejecutar en orden desde la raíz:

```bash
node backend/test/launch-database.cjs
node backend/test/translation-quality-database.cjs
QA_KEEP_API=1 node backend/test/translation-quality-api.cjs
```

El último mantiene API local 5088. En otra terminal, desde frontend, iniciar el build con `NUXT_API_BASE_URL=http://127.0.0.1:5088`, `NUXT_PUBLIC_API_URL=http://127.0.0.1:5088`, `NUXT_PUBLIC_SUPABASE_URL=https://fixture.invalid`, `NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-public`, `PORT=5078`, `HOST=127.0.0.1` y `node .output/server/index.mjs`. Después ejecutar `node backend/test/translation-quality-browser.cjs`. Requiere Chrome y Playwright en `/tmp/carteliax-regression-tools/node_modules/playwright`. No reconstruir frontend mientras ese servidor está activo. Los fixtures consumen la cuota de trabajos del establecimiento local: crear otra base con el primer script antes de repetir generación.

El harness real `backend/test/groq-quality-real.cjs` usa exclusivamente GPT-OSS 120B y la clave configurada localmente; no la imprime. `QA_GROQ_TARGETS` selecciona idiomas; consume uso del proveedor IA y depende de su cuota. No ejecutarlo como parte de la suite normal ni sobre datos privados de clientes. Consultar el JSON de resultados: un 429 o un rechazo de calidad es un fallo, aunque otros idiomas pasen.

## Migración pendiente

`supabase/migrations/20261009155228_gastronomic_translation_quality.sql`, creada con Supabase CLI y aplicada solamente en PostgreSQL local.

Añade `quality_version` a traducciones/trabajos y una tabla `restaurant_translations` protegida por RLS sin acceso directo de anon/authenticated. Introduce el enqueue seguro v2 y proyección pública de títulos; conserva compatibilidad del antiguo enqueue, pero rechaza reemplazo manual. Actualiza fuentes, escritura, commit, edición/publicación y proyección pública.

No incluye UPDATE masivo de textos antiguos, borrado de contenidos ni regeneración/publicación automática. Las versiones públicas anteriores siguen disponibles. Los borradores automáticos antiguos quedan pendientes de actualizar; los manuales continúan protegidos. La migración **no está aplicada a producción** y requiere autorización explícita.

## Regenerar después del despliegue autorizado

1. Abrir **Carta → Idiomas**, revisar el idioma original configurado.
2. Elegir es, val, en o fr. **Actualizar** genera textos ausentes, originales cambiados y automáticos de política anterior; reutiliza los válidos vigentes. **Regenerar traducciones automáticas** fuerza ese idioma completo excepto todos los textos manuales.
3. Revisar el resultado con el editor existente. Los textos manuales cuyo original cambió se revisan manualmente; no se sustituyen automáticamente.
4. Guardar correcciones y pulsar **Publicar [idioma]**. Hasta ese paso, los clientes mantienen la versión publicada anterior, con fallback al original si su fuente cambió o no hay una traducción completa.
5. Abrir URL/QR anónimamente y cambiar de idioma. Introducción y «Sobre nosotros» pasan a formar parte de la publicación de traducciones de la carta; los antiguos textos manuales del perfil se conservan.

## Despliegue posterior, no ejecutado

Se ha consultado la skill `vercel:deployments-cicd`. Estos comandos son instrucciones para una operación posterior autorizada, no autorización ni una afirmación de que los proyectos estén enlazados. Verificar primero equipo, proyecto, commit y entorno; no desplegar desde la raíz equivocada. No hay enlace local backend confirmado.

1. Validar primero en un entorno de prueba con su propia base/credenciales. Configurar en el backend `GROQ_TRANSLATION_MODEL=openai/gpt-oss-120b` y comprobar su permiso/cuota en Groq. El `.env` local ya se ha cambiado a 120B conservando las demás variables. La configuración nueva rechaza modelos distintos: **actualizar el valor antiguo de 20B en Vercel antes de activar el nuevo backend**, o este no arrancará. Las variables de producción no se han modificado. No poner la clave de Groq o service role en frontend.
2. Preparar y verificar builds. En cada carpeta enlazada al proyecto correcto, `vercel deploy --prod --skip-domain` prepara producción sin asignar sus dominios. No usar credenciales de producción para pruebas que generen o publiquen contenidos reales sin autorización. [Documentación Vercel](https://vercel.com/docs/cli/deploy).
3. Antes del cambio de base, detener temporalmente nuevas generaciones/procesamiento en el perímetro operativo y esperar a que no queden workers antiguos en vuelo. La migración rechaza resultados sin política v2: no debe presentarse un resultado del worker antiguo como validado por el nuevo.
4. Revisar las migraciones pendientes (`supabase migration list --linked`) y obtener autorización para esta migración y el proyecto exacto. No ejecutar `supabase db push` a ciegas: puede aplicar también otras migraciones pendientes. Aplicar únicamente el conjunto revisado y autorizado; verificar RLS/grants/RPC y recarga de esquema.
5. Promover backend nuevo con `vercel promote <URL_BACKEND_VERIFICADA>`. Verificar en entorno autorizado creación de trabajo v2, procesamiento, finalización y no sustitución manual. Promover frontend nuevo con `vercel promote <URL_FRONTEND_VERIFICADA>` y reabrir generación. La lectura pública debe seguir operativa durante la ventana.
6. Verificar propietario autorizado → publicar idioma → visitante anónimo → selector/QR; observar logs de finalización/fallo y 429/timeouts. No hacer regeneración masiva ni permitir al frontend antiguo enviar reemplazo manual.

No volver al worker antiguo tras esta migración sin analizar compatibilidad: sus resultados sin calidad v2 se rechazan deliberadamente. Ante un problema, pausar generación conserva originales y versiones públicas; no borrar filas ni revertir SQL de producción improvisadamente.

## Archivos de esta tarea

- Backend: `config/env.js`, `.env.example`; `translations/translationQuality.js`, `groqTranslationProvider.js`, `translationService.js`, `translationWorker.js`, `translationRuntime.js`, `translationController.js`, `translationRepository.js`, `translationSchemas.js`, `translationErrors.js`; `publicSites/publicSiteController.js`.
- Frontend: `pages/menus/[id]/languages.vue`, `utils/publicMenuLanguages.ts`, `components/public/RestaurantSite.vue`, `pages/[publicSlug].vue`, `types/menuTranslations.ts`, `types/publicSite.ts`. La persistencia del selector se conserva en `composables/usePublicMenuLanguage.ts` del trabajo previo.
- SQL: migración indicada arriba.
- Pruebas: `translations.test.js`, `translation-quality.test.js`, `translation-public-render.test.js`, `translation-quality-database.cjs`, `translation-quality-api.cjs`, `translation-quality-browser.cjs`, `groq-quality-real.cjs`, `fixtures/gastronomic-corpus.js`, `helpers/guarded-postgres.cjs`; harness de migraciones local existente.
- Documentación/evidencias: este informe y `docs/translation-quality/verification/*`.

Referencias verificadas: [Groq Structured Outputs](https://console.groq.com/docs/structured-outputs) confirma soporte estricto de GPT-OSS 120B; [AVL, criterios normativos](https://www.avl.gva.es/wp-content/uploads/2022/04/Acord-normatiu-de-20-de-maig-del-2002.pdf) orienta el perfil valenciano. Esos documentos no certifican las respuestas generadas; la evidencia de traducción es la evaluación real adjunta.
