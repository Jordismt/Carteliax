\set ON_ERROR_STOP on
begin;
do $$begin if current_setting('port')<>'55432' or current_setting('data_directory') not like '/tmp/carteliax-languages/%' then raise exception 'Disposable test database required';end if;end$$;
create function pg_temp.assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;raise notice 'PASS: %',label;end$$;
update menu_translation_jobs set status='failed' where status in ('queued','processing');
select cx_translation_enqueue('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en');
select cx_translation_claim();
select cx_translation_finish(j.id,j.claim_token,(select jsonb_agg(i-'draft') from jsonb_array_elements(j.source_items) i)) from menu_translation_jobs j where status='processing';
insert into menus(id,business_id,name,description,is_published,slug) values('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','Segunda carta',null,false,'second');
insert into categories(id,menu_id,name,description,is_visible) values('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','Arroces',null,true);
insert into category_products(category_id,product_id) values('66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777');
select cx_translation_enqueue('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en');
select pg_temp.assert((select total_items=1 from menu_translation_jobs where status='queued'),'Shared product and identical category reuse persisted text; only new menu title costs AI');
select pg_temp.assert((select count(*)=2 from product_translations),'Menu-specific translations stay independently editable');
select pg_temp.assert((select count(*)=1 from products),'Translation reuse never duplicates original products');
select pg_temp.assert((select count(*)=2 from category_translations),'Identical category source is reused safely');
rollback;
