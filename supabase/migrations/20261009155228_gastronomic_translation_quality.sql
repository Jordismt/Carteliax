-- Pending approval: additive translation quality/coverage migration.
-- No existing text is deleted, overwritten or republished by this migration.
-- Drain workers and deploy the matching backend before enabling generation.
begin;
alter table public.menu_translations add column quality_version text;
alter table public.category_translations add column quality_version text;
alter table public.product_translations add column quality_version text;
alter table public.menu_translation_jobs add column quality_version text;
create table public.restaurant_translations (
 menu_id uuid not null references public.menus(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 language_code text not null references public.translation_languages(code),
 name text not null check(length(btrim(name)) between 1 and 240),
 description text not null default '' check(length(description)<=500),
 welcome_text text not null default '' check(length(welcome_text)<=3000),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 is_manual boolean not null default false, quality_version text,
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 primary key(menu_id,language_code),
 foreign key(menu_id,language_code) references public.menu_languages(menu_id,language_code) on delete cascade
);
alter table public.restaurant_translations enable row level security;
revoke all on public.restaurant_translations from public,anon,authenticated;
grant all on public.restaurant_translations to service_role;
create index restaurant_translation_reuse on public.restaurant_translations(business_id,language_code,source_hash) where not is_manual;

create function private.cx_restaurant_translation_guard() returns trigger
language plpgsql set search_path=pg_catalog,public as $$begin
 if not exists(select 1 from public.menus m join public.businesses b on b.id=m.business_id
 where m.id=new.menu_id and b.id=new.business_id and b.name=new.name)
 then raise exception 'CX_FORBIDDEN';end if;return new;end$$;
revoke all on function private.cx_restaurant_translation_guard() from public,anon,authenticated;
create trigger cx_restaurant_translation_guard before insert or update on public.restaurant_translations
for each row execute function private.cx_restaurant_translation_guard();

-- Old public_profile translations were authored manually. Preserve them as
-- protected drafts; a hash of their content also fences concurrent profile edits.
create function private.cx_restaurant_legacy_draft(p_business uuid,p_language text,p_hash text) returns jsonb
language plpgsql stable set search_path=pg_catalog,public as $$
declare b public.businesses; x jsonb; matches boolean:=false;begin
 select * into b from public.businesses where id=p_business;
 select value into x from jsonb_array_elements(coalesce(b.public_profile->'translations','[]')) where value->>'language'=p_language;
 if x is null or (coalesce(x->>'description','')='' and coalesce(x->>'about','')='') then return null;end if;
 begin matches:=(x->>'source')::jsonb=jsonb_build_array(coalesce(b.description,''),coalesce(b.public_profile->>'about',''),b.default_language);exception when others then matches:=false;end;
 matches:=matches and (coalesce(b.description,'')='' or btrim(coalesce(x->>'description',''))<>'') and (coalesce(b.public_profile->>'about','')='' or btrim(coalesce(x->>'about',''))<>'');
 return jsonb_build_object('name',b.name,'description',coalesce(x->>'description',''),'welcome_text',coalesce(x->>'about',''),
 'is_manual',true,'revision',('x'||substr(md5(x::text),1,8))::bit(32)::bigint+1,
 'source_hash',case when matches then p_hash else repeat('0',64) end);
end$$;
revoke all on function private.cx_restaurant_legacy_draft(uuid,text,text) from public,anon,authenticated;
grant execute on function private.cx_restaurant_legacy_draft(uuid,text,text) to service_role;
create or replace function public.cx_translation_sources(p_menu uuid,p_language text default null)
returns jsonb language sql stable set search_path=pg_catalog,public as $$
 with source as (
 select 'menu'::text as type,m.id,m.name,coalesce(m.description,'') as description,
 coalesce(mt.published_config->'branding'->>'welcomeText','') as welcome_text,
 to_jsonb(tr) as draft
 from public.menus m left join public.menu_themes mt on mt.menu_id=m.id
 left join public.menu_translations tr on tr.menu_id=m.id and tr.language_code=p_language where m.id=p_menu
 union all
 -- Category descriptions are private in the existing public API. Only names
 -- are translated; those descriptions must never reach Groq/public snapshots.
 select 'category',c.id,c.name,'','',case when tr.category_id is null then null else to_jsonb(tr)||jsonb_build_object('description','') end
 from public.categories c left join public.category_translations tr on tr.category_id=c.id and tr.menu_id=p_menu and tr.language_code=p_language where c.menu_id=p_menu
 union all
 select 'restaurant',b.id,b.name,coalesce(b.description,''),coalesce(b.public_profile->>'about',''),
 case when tr.is_manual then to_jsonb(tr) else coalesce(private.cx_restaurant_legacy_draft(b.id,p_language,
 public.cx_translation_hash(public.cx_translation_source_language(p_menu)||':'||b.default_language,'restaurant',b.name,coalesce(b.description,''),coalesce(b.public_profile->>'about',''))),to_jsonb(tr)) end
 from public.businesses b join public.menus m on m.business_id=b.id
 left join public.restaurant_translations tr on tr.menu_id=m.id and tr.language_code=p_language
 where m.id=p_menu and (coalesce(b.description,'')<>'' or coalesce(b.public_profile->>'about','')<>'')
 union all
 select 'product',p.id,p.name,coalesce(p.description,''),'',to_jsonb(tr)
 from public.products p left join public.product_translations tr on tr.product_id=p.id and tr.menu_id=p_menu and tr.language_code=p_language
 where p.business_id=(select business_id from public.menus where id=p_menu)
 and exists(select 1 from public.category_products cp join public.categories c on c.id=cp.category_id where c.menu_id=p_menu and cp.product_id=p.id)
 ) select coalesce(jsonb_agg(jsonb_build_object('type',type,'id',id,'name',name,'description',description,'welcome_text',welcome_text,
 'source_hash',public.cx_translation_hash(public.cx_translation_source_language(p_menu)||case when type='restaurant' then ':'||(select b.default_language from public.businesses b join public.menus m on m.business_id=b.id where m.id=p_menu) else '' end,type,name,description,welcome_text),
 'draft',draft) order by type,id),'[]'::jsonb) from source;
$$;

create or replace function public.cx_translation_reusable(p_business uuid,p_language text,p_hash text,p_type text)
returns jsonb language sql stable set search_path=pg_catalog,public as $$
 select draft from (
 select to_jsonb(t) as draft,t.updated_at from public.menu_translations t join public.menus m on m.id=t.menu_id
 where p_type='menu' and m.business_id=p_business and t.language_code=p_language and t.source_hash=p_hash and not t.is_manual and t.quality_version='gastronomy-v2'
 union all
 select to_jsonb(t),t.updated_at from public.category_translations t join public.menus m on m.id=t.menu_id
 where p_type='category' and m.business_id=p_business and t.language_code=p_language and t.source_hash=p_hash and not t.is_manual and t.quality_version='gastronomy-v2'
 union all
 select to_jsonb(t),t.updated_at from public.product_translations t join public.menus m on m.id=t.menu_id
 where p_type='product' and m.business_id=p_business and t.language_code=p_language and t.source_hash=p_hash and not t.is_manual and t.quality_version='gastronomy-v2'
 union all
 select to_jsonb(t),t.updated_at from public.restaurant_translations t
 where p_type='restaurant' and t.business_id=p_business and t.language_code=p_language and t.source_hash=p_hash and not t.is_manual and t.quality_version='gastronomy-v2'
 ) candidates order by updated_at desc limit 1;
$$;

create or replace function public.cx_translation_enqueue_v2(p_menu uuid,p_actor uuid,p_language text,p_force boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare b uuid; src jsonb; eligible jsonb; chars integer; item jsonb; cached jsonb; job public.menu_translation_jobs; begin
 b:=public.cx_translation_guard(p_menu,p_actor,true);
 if not exists(select 1 from public.translation_languages where code=p_language and enabled)
 then raise exception 'CX_LANGUAGE'; end if;
 -- Crash recovery never repeats a provider call automatically.
 update public.menu_translation_jobs set status='failed',error_code='WORKER_INTERRUPTED',updated_at=clock_timestamp()
 where business_id=b and status in ('queued','processing') and
 (expires_at<clock_timestamp() or (status='processing' and lease_expires_at<clock_timestamp()));
 if exists(select 1 from public.menu_translation_jobs where business_id=b and status in ('queued','processing')) then raise exception 'CX_BUSY'; end if;
 src:=public.cx_translation_sources(p_menu,p_language);
 insert into public.menu_languages(menu_id,language_code) values(p_menu,p_language) on conflict do nothing;
 for item in select i from jsonb_array_elements(src) i
 where (p_force or (i->'draft'->>'source_hash') is distinct from (i->>'source_hash') or (i->'draft'->>'quality_version') is distinct from 'gastronomy-v2')
 and not coalesce((i->'draft'->>'is_manual')::boolean,false) loop
 cached:=public.cx_translation_reusable(b,p_language,item->>'source_hash',item->>'type');
 if cached is not null and not p_force then
 perform public.cx_translation_write(p_menu,p_language,cached||jsonb_build_object('type',item->>'type','id',item->>'id'),false);
 end if;
 end loop;
 src:=public.cx_translation_sources(p_menu,p_language);
 select coalesce(jsonb_agg(i),'[]'::jsonb) into eligible from jsonb_array_elements(src) i
 where (p_force or (i->'draft'->>'source_hash') is distinct from (i->>'source_hash') or (i->'draft'->>'quality_version') is distinct from 'gastronomy-v2')
 and not coalesce((i->'draft'->>'is_manual')::boolean,false);
 if jsonb_array_length(eligible)=0 then return jsonb_build_object('unchanged',true); end if;
 select coalesce(sum(length((i-'draft')::text)),0) into chars from jsonb_array_elements(eligible) i;
 if jsonb_array_length(eligible)>600 or chars>250000 then raise exception 'CX_SIZE'; end if;
 if (select count(*) from public.menu_translation_jobs where business_id=b and created_at>clock_timestamp()-interval '1 hour')>=10
 or (select count(*) from public.menu_translation_jobs where business_id=b and created_at>clock_timestamp()-interval '30 days')>=250
 or (select coalesce(sum(characters),0) from public.menu_translation_jobs where business_id=b and created_at>clock_timestamp()-interval '1 day')+chars>1000000
 or (select coalesce(sum(characters),0) from public.menu_translation_jobs where business_id=b and created_at>clock_timestamp()-interval '30 days')+chars>2000000
 then raise exception 'CX_LIMIT'; end if;
 insert into public.menu_languages(menu_id,language_code) values(p_menu,p_language) on conflict do nothing;
 insert into public.menu_translation_jobs(menu_id,business_id,requested_by,language_code,source_language,source_items,total_items,characters,quality_version)
 values(p_menu,b,p_actor,p_language,public.cx_translation_source_language(p_menu),eligible,jsonb_array_length(eligible),chars,'gastronomy-v2') returning * into job;
 return to_jsonb(job)-'source_items'-'claim_token'-'requested_by';
end $$;

create or replace function public.cx_translation_write(p_menu uuid,p_language text,p_item jsonb,p_manual boolean)
returns void language plpgsql set search_path=pg_catalog,public as $$ begin
 if p_item->>'type'='menu' then
 insert into public.menu_translations(menu_id,language_code,name,description,welcome_text,source_hash,is_manual,quality_version)
 values(p_menu,p_language,p_item->>'name',p_item->>'description',coalesce(p_item->>'welcome_text',''),p_item->>'source_hash',p_manual,case when p_manual then null else 'gastronomy-v2' end)
 on conflict(menu_id,language_code) do update set name=excluded.name,description=excluded.description,welcome_text=excluded.welcome_text,
 source_hash=excluded.source_hash,is_manual=excluded.is_manual,quality_version=excluded.quality_version,revision=menu_translations.revision+1,updated_at=clock_timestamp();
 elsif p_item->>'type'='category' then
 insert into public.category_translations(menu_id,category_id,language_code,name,source_hash,is_manual,quality_version)
 values(p_menu,(p_item->>'id')::uuid,p_language,p_item->>'name',p_item->>'source_hash',p_manual,case when p_manual then null else 'gastronomy-v2' end)
 on conflict(menu_id,category_id,language_code) do update set name=excluded.name,
 source_hash=excluded.source_hash,is_manual=excluded.is_manual,quality_version=excluded.quality_version,revision=category_translations.revision+1,updated_at=clock_timestamp();
 elsif p_item->>'type'='product' then
 insert into public.product_translations(menu_id,product_id,language_code,name,description,source_hash,is_manual,quality_version)
 values(p_menu,(p_item->>'id')::uuid,p_language,p_item->>'name',p_item->>'description',p_item->>'source_hash',p_manual,case when p_manual then null else 'gastronomy-v2' end)
 on conflict(menu_id,product_id,language_code) do update set name=excluded.name,description=excluded.description,
 source_hash=excluded.source_hash,is_manual=excluded.is_manual,quality_version=excluded.quality_version,revision=product_translations.revision+1,updated_at=clock_timestamp();
 elsif p_item->>'type'='restaurant' then
 insert into public.restaurant_translations(menu_id,business_id,language_code,name,description,welcome_text,source_hash,is_manual,quality_version)
 select p_menu,m.business_id,p_language,p_item->>'name',p_item->>'description',coalesce(p_item->>'welcome_text',''),p_item->>'source_hash',p_manual,
 case when p_manual then null else 'gastronomy-v2' end from public.menus m where m.id=p_menu
 on conflict(menu_id,language_code) do update set name=excluded.name,description=excluded.description,welcome_text=excluded.welcome_text,
 source_hash=excluded.source_hash,is_manual=excluded.is_manual,quality_version=excluded.quality_version,revision=restaurant_translations.revision+1,updated_at=clock_timestamp();
 else raise exception 'CX_CHANGED'; end if;
end $$;

create or replace function public.cx_translation_finish(p_job uuid,p_token uuid,p_items jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare job public.menu_translation_jobs; src jsonb; item jsonb; original jsonb; current_item jsonb; begin
 select * into job from public.menu_translation_jobs where id=p_job;
 if job.id is null then raise exception 'CX_EXPIRED'; end if;
 perform public.cx_translation_guard(job.menu_id,job.requested_by,true);
 select * into job from public.menu_translation_jobs where id=p_job for update;
 if job.quality_version is distinct from 'gastronomy-v2' then raise exception 'CX_POLICY';end if;
 if job.status<>'processing' or job.claim_token is distinct from p_token or job.expires_at<clock_timestamp() or job.lease_expires_at<clock_timestamp() then raise exception 'CX_EXPIRED'; end if;
 perform public.cx_translation_lock_sources(job.menu_id);
 src:=public.cx_translation_sources(job.menu_id,job.language_code);
 if public.cx_translation_source_language(job.menu_id)<>job.source_language or jsonb_typeof(p_items)<>'array'
 or jsonb_array_length(p_items)<>job.total_items then raise exception 'CX_CHANGED'; end if;
 if (select count(distinct i->>'type'||':'||(i->>'id')) from jsonb_array_elements(p_items) i)<>job.total_items then raise exception 'CX_CHANGED'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
 select i into original from jsonb_array_elements(job.source_items) i where i->>'id'=item->>'id' and i->>'type'=item->>'type';
 select i into current_item from jsonb_array_elements(src) i where i->>'id'=item->>'id' and i->>'type'=item->>'type';
 if item->>'quality_version' is distinct from 'gastronomy-v2' or coalesce((original->'draft'->>'is_manual')::boolean,false) or coalesce((current_item->'draft'->>'is_manual')::boolean,false) or original is null or current_item is null or current_item->>'source_hash'<>original->>'source_hash'
 or coalesce(current_item->'draft'->>'revision','0')<>coalesce(original->'draft'->>'revision','0') then raise exception 'CX_CHANGED'; end if;
 perform public.cx_translation_write(job.menu_id,job.language_code,item||jsonb_build_object('source_hash',original->>'source_hash'),false);
 end loop;
 update public.menu_translation_jobs set status='completed',completed_items=total_items,updated_at=clock_timestamp() where id=job.id;
 return true;
end $$;

create or replace function public.cx_translation_mutate(p_menu uuid,p_actor uuid,p_language text,p_action text,p_payload jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare src jsonb; item jsonb; draft jsonb; b uuid; begin
 b:=public.cx_translation_guard(p_menu,p_actor,true);
 if exists(select 1 from public.menu_translation_jobs where business_id=b and expires_at>clock_timestamp()
 and (status='queued' or (status='processing' and lease_expires_at>clock_timestamp()))) then raise exception 'CX_BUSY'; end if;
 if not exists(select 1 from public.translation_languages where code=p_language and enabled) then raise exception 'CX_LANGUAGE'; end if;
 if p_action='source' then
 insert into public.menu_language_settings(menu_id,source_language) values(p_menu,p_language)
 on conflict(menu_id) do update set source_language=excluded.source_language,updated_at=clock_timestamp();
 update public.menu_languages set enabled=false where menu_id=p_menu and language_code=p_language;
 return true;
 end if;
 insert into public.menu_languages(menu_id,language_code) values(p_menu,p_language) on conflict do nothing;
 perform public.cx_translation_lock_sources(p_menu);
 src:=public.cx_translation_sources(p_menu,p_language);
 if p_action='visibility' then
 if coalesce((p_payload->>'enabled')::boolean,false) and not exists(select 1 from public.menu_languages where menu_id=p_menu and language_code=p_language and published_at is not null)
 then raise exception 'CX_INCOMPLETE'; end if;
 update public.menu_languages set enabled=coalesce((p_payload->>'enabled')::boolean,false),updated_at=clock_timestamp() where menu_id=p_menu and language_code=p_language;
 elsif p_action='publish' then
 if exists(select 1 from jsonb_array_elements(src) i where (i->'draft'->>'source_hash') is distinct from (i->>'source_hash')
 or (not coalesce((i->'draft'->>'is_manual')::boolean,false) and (i->'draft'->>'quality_version') is distinct from 'gastronomy-v2')) then raise exception 'CX_INCOMPLETE'; end if;
 update public.menu_languages set published_items=(select jsonb_agg(jsonb_build_object('id',i->>'id','type',i->>'type',
 'name',i->'draft'->>'name','description',i->'draft'->>'description','welcome_text',coalesce(i->'draft'->>'welcome_text',''),'source_hash',i->>'source_hash')) from jsonb_array_elements(src) i),
 published_at=clock_timestamp(),enabled=true,updated_at=clock_timestamp() where menu_id=p_menu and language_code=p_language;
 elsif p_action in ('manual','delete') then
 select i into item from jsonb_array_elements(src) i where i->>'id'=p_payload->>'id' and i->>'type'=p_payload->>'type';
 if item is null or coalesce(item->'draft'->>'revision','0')<>p_payload->>'revision' then raise exception 'CX_CHANGED'; end if;
 if p_action='manual' then
 if item->>'source_hash'<>p_payload->>'sourceHash' then raise exception 'CX_CHANGED'; end if;
 if (btrim(coalesce(item->>'description',''))<>'' and btrim(coalesce(p_payload->>'description',''))='')
 or (btrim(coalesce(item->>'welcome_text',''))<>'' and btrim(coalesce(p_payload->>'welcome_text',''))='') then raise exception 'CX_INCOMPLETE';end if;
 perform public.cx_translation_write(p_menu,p_language,p_payload||jsonb_build_object('source_hash',item->>'source_hash'),true);
 else
 if p_payload->>'type'='menu' then delete from public.menu_translations where menu_id=p_menu and language_code=p_language;
 elsif p_payload->>'type'='category' then delete from public.category_translations where menu_id=p_menu and category_id=(p_payload->>'id')::uuid and language_code=p_language;
 elsif p_payload->>'type'='restaurant' then raise exception 'CX_MANUAL_PROTECTED';
 elsif p_payload->>'type'='product' then delete from public.product_translations where menu_id=p_menu and product_id=(p_payload->>'id')::uuid and language_code=p_language;
 end if;
 -- Removing a translation also removes that item from the published version.
 update public.menu_languages set published_items=(select coalesce(jsonb_agg(i),'[]'::jsonb) from jsonb_array_elements(published_items) i where not(i->>'type'=p_payload->>'type' and i->>'id'=p_payload->>'id')),updated_at=clock_timestamp()
 where menu_id=p_menu and language_code=p_language;
 end if;
 else raise exception 'CX_CHANGED'; end if;
 return true;
end $$;

create or replace function public.cx_public_translations(p_menu uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 with published_menu as (
 select m.id from public.menus m join public.menu_themes mt on mt.menu_id=m.id
 where m.id=p_menu and m.is_published and mt.published_at is not null and mt.published_config<>'{}'::jsonb
 ), sources as (select i from published_menu m,jsonb_array_elements(public.cx_translation_sources(m.id)) i),
 visible as (select i from sources where i->>'type' in ('menu','restaurant')
 or (i->>'type'='category' and exists(select 1 from public.categories c where c.id=(i->>'id')::uuid and c.menu_id=p_menu and c.is_visible))
 or (i->>'type'='product' and exists(select 1 from public.products p join public.category_products cp on cp.product_id=p.id join public.categories c on c.id=cp.category_id
 join public.menus m on m.id=c.menu_id and m.business_id=p.business_id where c.menu_id=p_menu and c.is_visible and p.is_available and p.id=(i->>'id')::uuid)))
 select case when exists(select 1 from published_menu) then jsonb_build_object('source_language',public.cx_translation_source_language(p_menu),
 'available',(select coalesce(jsonb_agg(jsonb_build_object('code',r.code,'native_name',r.native_name,'html_lang',r.html_lang) order by r.code),'[]'::jsonb)
 from public.translation_languages r where r.enabled and (r.code=public.cx_translation_source_language(p_menu) or exists(select 1 from public.menu_languages l where l.menu_id=p_menu and l.language_code=r.code and l.enabled and l.published_at is not null))),
 'translations',(select coalesce(jsonb_object_agg(l.language_code,(select coalesce(jsonb_agg(jsonb_build_object('type',t->>'type','id',t->>'id','name',t->>'name','description',coalesce(t->>'description',''),'welcome_text',coalesce(t->>'welcome_text',''))),'[]'::jsonb)
 from jsonb_array_elements(l.published_items) t join visible s on s.i->>'type'=t->>'type' and s.i->>'id'=t->>'id' and s.i->>'source_hash'=t->>'source_hash')),'{}'::jsonb)
 from public.menu_languages l where l.menu_id=p_menu and l.enabled and l.published_at is not null)) else null end;
$$;
-- Old callers cannot opt into destructive replacement of manual translations.
create or replace function public.cx_translation_enqueue(p_menu uuid,p_actor uuid,p_language text,p_replace_manual boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$begin
 if p_replace_manual then raise exception 'CX_MANUAL_PROTECTED';end if;
 return public.cx_translation_enqueue_v2(p_menu,p_actor,p_language,false);end$$;
revoke all on function public.cx_translation_enqueue_v2(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.cx_translation_enqueue_v2(uuid,uuid,text,boolean) to service_role;

-- Compact title-only projection avoids loading every menu/product snapshot.
create function public.cx_public_menu_titles(p_business uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(jsonb_object_agg(slug,titles),'{}') from (
 select m.slug,jsonb_object_agg(l.language_code,t.value->>'name') as titles
 from public.menus m join public.menu_themes mt on mt.menu_id=m.id
 join public.menu_languages l on l.menu_id=m.id,
 lateral jsonb_array_elements(l.published_items) t(value)
 where m.business_id=p_business and m.is_published and mt.published_at is not null and mt.published_config<>'{}'
 and l.enabled and l.published_at is not null
 and t.value->>'type'='menu' and t.value->>'id'=m.id::text
 and t.value->>'source_hash'=public.cx_translation_hash(public.cx_translation_source_language(m.id),'menu',m.name,coalesce(m.description,''),coalesce(mt.published_config->'branding'->>'welcomeText',''))
 group by m.slug) source;
$$;
revoke all on function public.cx_public_menu_titles(uuid) from public,anon,authenticated;
grant execute on function public.cx_public_menu_titles(uuid) to service_role;
notify pgrst,'reload schema';
commit;
