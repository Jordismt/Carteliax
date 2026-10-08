\set ON_ERROR_STOP on
begin;
do $$begin if current_setting('port')<>'55432' or current_setting('data_directory') not like '/tmp/carteliax-languages/%' then raise exception 'Disposable test database required';end if;end$$;
create function pg_temp.assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end$$;
create function pg_temp.error_expected(query text,expected text) returns void language plpgsql as $$begin begin execute query; exception when others then if sqlerrm like '%'||expected||'%' then raise notice 'PASS: error %',expected;return;end if;raise;end;raise exception 'Expected error %',expected;end$$;
update menu_translation_jobs set status='failed' where status in ('queued','processing');
select pg_temp.error_expected($q$select cx_translation_mutate('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en','visibility','{"enabled":true}')$q$,'CX_INCOMPLETE');
select cx_translation_mutate('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','val','source');
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select cx_duplicate_menu_with_language('33333333-3333-4333-8333-333333333333') as duplicate_id \gset
select pg_temp.assert((select source_language='val' from menu_language_settings where menu_id=:'duplicate_id'::uuid),'Duplicate preserves configured source language atomically');
reset role;
select pg_temp.assert((select not is_published from menus where id=:'duplicate_id'::uuid),'Duplicate never publishes original or translations');
-- New menus inherit once; later business settings must not reinterpret originals.
insert into menus(id,business_id,name,description,is_published,slug) values('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','Nueva',null,false,'new');
update businesses set default_language='en' where id='11111111-1111-4111-8111-111111111111';
select pg_temp.assert(cx_translation_source_language('99999999-9999-4999-8999-999999999999')='es','New menu source is independent of later business language changes');
-- Rolling monthly cost bound, independent of hourly allowance.
insert into menu_translation_jobs(menu_id,business_id,requested_by,language_code,source_language,status,source_items,total_items,characters,created_at)
select '33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en','val','failed','[]',1,250000,now()-interval '10 days' from generate_series(1,8);
select pg_temp.error_expected($q$select cx_translation_enqueue('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en')$q$,'CX_LIMIT');
-- Reject cross-business jobs even from table-writing service code.
select pg_temp.error_expected($q$insert into menu_translation_jobs(menu_id,business_id,requested_by,language_code,source_language,status,source_items,total_items,characters) values('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en','es','failed','[]',1,0)$q$,'CX_FORBIDDEN');
-- A large menu is rejected before any job or provider call.
insert into categories(id,menu_id,name,description,is_visible) values('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','Grande',null,true);
with added as (insert into products(id,business_id,name,description,price,is_available) select gen_random_uuid(),'11111111-1111-4111-8111-111111111111','Big '||n,'Descripción',1,true from generate_series(1,600) n returning id)
insert into category_products(category_id,product_id) select '66666666-6666-4666-8666-666666666666',id from added;
select pg_temp.error_expected($q$select cx_translation_enqueue('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en')$q$,'CX_SIZE');
rollback;

-- Private category descriptions must never enter translation inputs.
begin;
update categories set description='staff-only-not-public';
do $$begin if cx_translation_sources('33333333-3333-4333-8333-333333333333')::text like '%staff-only-not-public%' then raise exception 'Private category description leaked';end if;raise notice 'PASS: Private category descriptions excluded from translation inputs';end$$;
rollback;
