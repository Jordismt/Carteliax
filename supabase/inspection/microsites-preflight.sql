-- Solo lectura. Ejecutar antes/después para contrastar el esquema real.
select column_name,data_type,is_nullable from information_schema.columns
 where table_schema='public' and table_name='businesses' order by ordinal_position;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
 where (schemaname='public' and tablename='businesses') or (schemaname='storage' and tablename='objects') order by schemaname,tablename,policyname;
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='businesses';
select 'businesses' entity,count(*) total from public.businesses union all
select 'menus',count(*) from public.menus union all select 'categories',count(*) from public.categories union all
select 'products',count(*) from public.products union all select 'subscriptions',count(*) from public.subscriptions;
select id,name,slug from public.businesses order by created_at;
-- Después de la migración: select id,name,slug,public_slug from public.businesses;
