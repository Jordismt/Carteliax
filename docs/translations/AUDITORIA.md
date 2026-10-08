# Auditoría previa al multiidioma

6 de octubre de 2026. Se inspeccionaron páginas, componentes, composables, autenticación, SSR público, módulos Express, validaciones, relaciones, almacenamiento, suscripciones y contratos antes de modificar código.

Supabase se consultó exclusivamente por REST en lectura: 2 establecimientos, 2 cartas, 2 categorías, 1 producto, 14 alérgenos, 2 suscripciones, 0 miembros y 0 diseños. OpenAPI confirma UUIDs, claves foráneas y campos. No existe idioma por carta; `businesses.default_language` admite actualmente es/ca/en en el backend. Los productos pertenecen al negocio y se reutilizan mediante `category_products`. Los alérgenos tienen ID numérico, código y `name_es`.

Los endpoints privados y `requireActiveSubscription` exigen `businesses.owner_id`; no usan business_members. El multiidioma debe conservar ese criterio, sin conceder acceso nuevo a miembros. Las suscripciones verifican estado y fechas. El público usa un cliente administrativo, pero filtra explícitamente publicación de carta/diseño, categorías visibles, productos disponibles y negocio correspondiente. Nuxt conserva SSR mediante su proxy existente y useFetch.

No hay esquema SQL, migraciones ni historial de commits del frontend en el repositorio. PostgREST no expone las políticas RLS ni acciones de las claves foráneas. Se solicitó una fuente del esquema: **las políticas existentes no se han podido auditar por SQL**. La nueva migración no altera políticas, permisos ni funciones existentes; sus permisos siguen el ownership observado en los controladores. Se entrega una consulta de introspección para contrastar ese punto antes del despliegue.

Se creó una copia previa en `/tmp/carteliax-languages/before`. No se deben modificar queries, filtros, watchers ni contratos de operaciones existentes. Los idiomas se integran con endpoints propios y una extensión aditiva de la respuesta pública. No se modifican Stripe ni Storage ni los flujos de autenticación. Durante la implementación se eliminó un log del middleware frontend que imprimía información de sesión, manteniendo intacta su lógica.
