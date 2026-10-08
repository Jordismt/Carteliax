-- SOLO LECTURA. No contiene datos de clientes ni credenciales.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
and tablename in ('businesses','business_members','menus','categories','products',
 'category_products','product_allergens','allergens','subscriptions','menu_themes')
order by tablename, policyname;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
 c.relforcerowsecurity as rls_forced, con.conname,
 pg_get_constraintdef(con.oid) as definition
from pg_class c join pg_namespace n on n.oid=c.relnamespace
left join pg_constraint con on con.conrelid=c.oid
where n.nspname='public' and c.relname in ('businesses','business_members','menus',
 'categories','products','category_products','product_allergens','allergens',
 'subscriptions','menu_themes') order by c.relname,con.conname;

select p.proname, p.prosecdef, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('duplicate_menu','set_product_allergens');
