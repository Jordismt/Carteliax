\set ON_ERROR_STOP on
begin;
do $$ begin if current_setting('port')<>'55432' or current_setting('data_directory') not like '/tmp/carteliax-languages/%' then raise exception 'Disposable test database required'; end if; end $$;
create function pg_temp.assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end$$;
update menu_translation_jobs set status='failed' where status in ('queued','processing');
do $$ declare l text; job jsonb; begin
 foreach l in array array['en','fr','val'] loop
 perform cx_translation_enqueue('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',l);
 job:=cx_translation_claim();
 perform cx_translation_finish((job->>'id')::uuid,(job->>'claim_token')::uuid,(select jsonb_agg(i-'draft') from jsonb_array_elements(job->'source_items') i));
 perform cx_translation_mutate('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',l,'publish');
 perform pg_temp.assert(jsonb_array_length(cx_public_translations('33333333-3333-4333-8333-333333333333')->'translations'->l)=3,'ES -> '||l||' persisted publication');
 end loop;
end $$;
-- Repeated public reads cannot enqueue or process a translation.
create temporary table count_before as select count(*) n from menu_translation_jobs;
do $$begin for i in 1..100 loop perform cx_public_translations('33333333-3333-4333-8333-333333333333'); end loop;end$$;
select pg_temp.assert((select n=(select count(*) from menu_translation_jobs) from count_before),'100 public reads create zero jobs');
-- New content is incremental. Availability/price do not affect the source hash.
insert into categories(id,menu_id,name,description,is_visible) values('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','Begudes 🍹',null,true);
insert into products(id,business_id,name,description,price,is_available) values('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111','Café d''Alcoi ☕',null,2.5,true);
insert into category_products(category_id,product_id) values('66666666-6666-4666-8666-666666666666','88888888-8888-4888-8888-888888888888');
select cx_translation_enqueue('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en');
select pg_temp.assert((select total_items=2 from menu_translation_jobs where status='queued'),'Only new category and product are queued');
update menu_translation_jobs set status='failed' where status='queued';
-- Source change leaves all original entities intact and permits VAL -> EN/ES.
select cx_translation_mutate('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','val','source');
select cx_translation_enqueue('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en');
select pg_temp.assert((select source_language='val' and total_items=5 from menu_translation_jobs where status='queued'),'VAL -> EN invalidates only language-dependent hashes');
update menu_translation_jobs set status='failed' where status='queued';
select cx_translation_enqueue('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','es');
select pg_temp.assert((select source_language='val' and language_code='es' from menu_translation_jobs where status='queued'),'VAL -> ES supported');
-- Crash recovery fences previous worker tokens.
select cx_translation_claim();
update menu_translation_jobs set expires_at=now()-interval '1 second' where status='processing';
select cx_translation_claim();
select pg_temp.assert(not exists(select 1 from menu_translation_jobs where status='processing'),'Interrupted jobs become failed, never replayed');
-- Menus without categories and categories without products.
insert into menus(id,business_id,name,description,is_published,slug) values('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','Carta vacía',null,false,'empty');
select pg_temp.assert(jsonb_array_length(cx_translation_sources('99999999-9999-4999-8999-999999999999'))=1,'Empty menu still has a translatable title');
insert into categories(id,menu_id,name,description,is_visible) values(gen_random_uuid(),'99999999-9999-4999-8999-999999999999','Categoría vacía',null,true);
select pg_temp.assert(jsonb_array_length(cx_translation_sources('99999999-9999-4999-8999-999999999999'))=2,'Empty category is translated without fictitious products');
-- Extensibility is a catalog insert, no new columns.
insert into translation_languages values('de','Alemán','Deutsch','de',true);
select cx_translation_enqueue('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','de');
select pg_temp.assert((select total_items=2 from menu_translation_jobs where status='queued'),'Future language accepted without schema change');
update menu_translation_jobs set status='failed' where status='queued';
-- Enforce budget across all menus and languages in a business.
insert into menu_translation_jobs(menu_id,business_id,requested_by,language_code,source_language,status,source_items,total_items,characters)
select '33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','en','es','failed','[]',1,0 from generate_series(1,10);
do $$ begin begin perform cx_translation_enqueue('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fr'); raise exception 'Budget not enforced'; exception when others then if sqlerrm not like '%CX_LIMIT%' then raise; end if; raise notice 'PASS: Hourly business-wide budget enforced';end;end$$;
-- Rows and payload constraints remain intact after every failure.
select pg_temp.assert((select name='Paella para 2 personas' and price=18 from products where id='77777777-7777-4777-8777-777777777777'),'Original name and price unaffected');
rollback;
