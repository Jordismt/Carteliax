-- Additive migration. Existing tables, rows, policies and functions are untouched.
-- Ownership deliberately matches requireActiveSubscription: business.owner_id.
begin;

create table public.translation_languages (
 code text primary key check (code ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' and length(code)<=12),
 name text not null, native_name text not null, html_lang text not null,
 enabled boolean not null default true
);
insert into public.translation_languages(code,name,native_name,html_lang) values
 ('es','Español','Español','es'), ('val','Valenciano','Valencià','ca-valencia'),
 ('en','Inglés','English','en'), ('fr','Francés','Français','fr');

create table public.menu_language_settings (
 menu_id uuid primary key references public.menus(id) on delete cascade,
 source_language text not null references public.translation_languages(code),
 updated_at timestamptz not null default now()
);
-- Safe backfill: Catalan business setting maps to Valencian; unknown -> Spanish.
insert into public.menu_language_settings(menu_id,source_language)
select m.id, case when b.default_language='ca' then 'val'
 when b.default_language in ('es','val','en','fr') then b.default_language else 'es' end
from public.menus m join public.businesses b on b.id=m.business_id;

-- Freeze the inherited source language for every newly created menu as well.
create function public.cx_initialize_menu_language() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$ begin
 insert into public.menu_language_settings(menu_id,source_language)
 select new.id,case when b.default_language='ca' then 'val'
 when b.default_language in ('es','val','en','fr') then b.default_language else 'es' end
 from public.businesses b where b.id=new.business_id;
 return new;
end $$;
revoke all on function public.cx_initialize_menu_language() from public,anon,authenticated;
create trigger cx_menu_language_after_insert after insert on public.menus
for each row execute function public.cx_initialize_menu_language();

create table public.menu_languages (
 menu_id uuid not null references public.menus(id) on delete cascade,
 language_code text not null references public.translation_languages(code),
 enabled boolean not null default false,
 published_items jsonb not null default '[]'::jsonb check (jsonb_typeof(published_items)='array'),
 published_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(menu_id,language_code),
 check (not enabled or published_at is not null)
);

create table public.menu_translations (
 menu_id uuid not null, language_code text not null,
 name text not null check(length(btrim(name)) between 1 and 240),
 description text not null default '' check(length(description)<=2000),
 welcome_text text not null default '' check(length(welcome_text)<=1000),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 is_manual boolean not null default false,
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(menu_id,language_code),
 foreign key(menu_id,language_code) references public.menu_languages(menu_id,language_code) on delete cascade
);
create table public.category_translations (
 menu_id uuid not null, category_id uuid not null references public.categories(id) on delete cascade,
 language_code text not null,
 name text not null check(length(btrim(name)) between 1 and 240),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 is_manual boolean not null default false,
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(menu_id,category_id,language_code),
 foreign key(menu_id,language_code) references public.menu_languages(menu_id,language_code) on delete cascade
);
create table public.product_translations (
 menu_id uuid not null, product_id uuid not null references public.products(id) on delete cascade,
 language_code text not null,
 name text not null check(length(btrim(name)) between 1 and 240),
 description text not null default '' check(length(description)<=2000),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 is_manual boolean not null default false,
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(menu_id,product_id,language_code),
 foreign key(menu_id,language_code) references public.menu_languages(menu_id,language_code) on delete cascade
);
-- Scope includes menu because products can occur in menus with different source
-- languages, manual wording and independently published translations.
create index category_translations_resource_language on public.category_translations(category_id,language_code);
create index product_translations_resource_language on public.product_translations(product_id,language_code);
create index menu_translation_reuse on public.menu_translations(language_code,source_hash) where not is_manual;
create index category_translation_reuse on public.category_translations(language_code,source_hash) where not is_manual;
create index product_translation_reuse on public.product_translations(language_code,source_hash) where not is_manual;

create table public.menu_translation_jobs (
 id uuid primary key default gen_random_uuid(),
 menu_id uuid not null references public.menus(id) on delete cascade,
 business_id uuid not null references public.businesses(id) on delete cascade,
 requested_by uuid not null references public.profiles(id),
 language_code text not null references public.translation_languages(code),
 source_language text not null references public.translation_languages(code),
 status text not null default 'queued' check(status in ('queued','processing','completed','failed')),
 source_items jsonb not null check(jsonb_typeof(source_items)='array' and jsonb_array_length(source_items)<=600),
 completed_items integer not null default 0 check(completed_items>=0),
 total_items integer not null check(total_items between 1 and 600),
 characters integer not null check(characters between 0 and 250000),
 error_code text,
 claim_token uuid,
 lease_expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '40 minutes'),
 check(completed_items<=total_items),
 check(status<>'processing' or (claim_token is not null and lease_expires_at is not null))
);
create unique index menu_translation_jobs_one_business on public.menu_translation_jobs(business_id)
 where status in ('queued','processing');
create index menu_translation_jobs_queue on public.menu_translation_jobs(created_at) where status='queued';
create index menu_translation_jobs_budget on public.menu_translation_jobs(business_id,created_at);
create index menu_translation_jobs_menu on public.menu_translation_jobs(menu_id,created_at desc);

create function public.cx_translation_owner(p_menu uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.menus m join public.businesses b on b.id=m.business_id
 where m.id=p_menu and b.owner_id=auth.uid());
$$;

-- Reads are private. Mutations go through service-only transactional functions,
-- which verify actor ownership + subscription again. No direct client writes.
do $$ declare t text; begin
 foreach t in array array['menu_language_settings','menu_languages','menu_translations',
 'category_translations','product_translations','menu_translation_jobs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy translation_owner_select on public.%I for select to authenticated using (public.cx_translation_owner(menu_id))',t);
 execute format('create policy translation_owner_insert on public.%I for insert to authenticated with check (public.cx_translation_owner(menu_id))',t);
 execute format('create policy translation_owner_update on public.%I for update to authenticated using (public.cx_translation_owner(menu_id)) with check (public.cx_translation_owner(menu_id))',t);
 execute format('create policy translation_owner_delete on public.%I for delete to authenticated using (public.cx_translation_owner(menu_id))',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
alter table public.translation_languages enable row level security;
create policy language_catalog_read on public.translation_languages for select to anon,authenticated using(enabled);
revoke all on public.translation_languages from anon,authenticated;
grant select on public.translation_languages to anon,authenticated;
grant all on public.translation_languages to service_role;

create function public.cx_translation_hash(p_language text,p_type text,p_name text,p_description text,p_welcome text default '')
returns text language sql immutable set search_path=pg_catalog,public as $$
 select encode(sha256(convert_to(jsonb_build_array(1,p_language,p_type,coalesce(p_name,''),coalesce(p_description,''),coalesce(p_welcome,''))::text,'UTF8')),'hex');
$$;

create function public.cx_translation_source_language(p_menu uuid) returns text
language sql stable set search_path=pg_catalog,public as $$
 select coalesce(s.source_language,case when b.default_language='ca' then 'val'
 when b.default_language in ('es','val','en','fr') then b.default_language else 'es' end)
 from public.menus m join public.businesses b on b.id=m.business_id
 left join public.menu_language_settings s on s.menu_id=m.id where m.id=p_menu;
$$;

create function public.cx_translation_sources(p_menu uuid,p_language text default null)
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
 select 'product',p.id,p.name,coalesce(p.description,''),'',to_jsonb(tr)
 from public.products p left join public.product_translations tr on tr.product_id=p.id and tr.menu_id=p_menu and tr.language_code=p_language
 where p.business_id=(select business_id from public.menus where id=p_menu)
 and exists(select 1 from public.category_products cp join public.categories c on c.id=cp.category_id where c.menu_id=p_menu and cp.product_id=p.id)
 ) select coalesce(jsonb_agg(jsonb_build_object('type',type,'id',id,'name',name,'description',description,'welcome_text',welcome_text,
 'source_hash',public.cx_translation_hash(public.cx_translation_source_language(p_menu),type,name,description,welcome_text),
 'draft',draft) order by type,id),'[]'::jsonb) from source;
$$;

create function public.cx_translation_guard(p_menu uuid,p_actor uuid,p_lock boolean default false)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare b uuid; begin
 select m.business_id into b from public.menus m join public.businesses x on x.id=m.business_id
 where m.id=p_menu and x.owner_id=p_actor;
 if b is null then raise exception 'CX_FORBIDDEN'; end if;
 if p_lock then perform 1 from public.businesses where id=b for update; end if;
 if not exists(select 1 from public.subscriptions s where s.business_id=b and
 ((s.status='trialing' and s.trial_ends_at>clock_timestamp()) or
 (s.status='active' and (s.current_period_end is null or s.current_period_end>clock_timestamp()))))
 then raise exception 'CX_SUBSCRIPTION'; end if;
 return b;
end $$;

-- Resource integrity at DB level even for direct service-role table writes.
create function public.cx_translation_resource_guard() returns trigger
language plpgsql set search_path=pg_catalog,public as $$ begin
 if tg_table_name='category_translations' then
 if not exists(select 1 from public.categories where id=new.category_id and menu_id=new.menu_id)
 then raise exception 'CX_FORBIDDEN'; end if;
 elsif tg_table_name='product_translations' then
 if not exists(select 1 from public.products p join public.menus m on m.business_id=p.business_id where p.id=new.product_id and m.id=new.menu_id)
 then raise exception 'CX_FORBIDDEN'; end if;
 end if;
 return new;
end $$;
create trigger category_translation_resource before insert or update on public.category_translations for each row execute function public.cx_translation_resource_guard();
create trigger product_translation_resource before insert or update on public.product_translations for each row execute function public.cx_translation_resource_guard();

create function public.cx_translation_job_guard() returns trigger
language plpgsql set search_path=pg_catalog,public as $$ begin
 if not exists(select 1 from public.menus m join public.businesses b on b.id=m.business_id
 where m.id=new.menu_id and b.id=new.business_id and b.owner_id=new.requested_by)
 then raise exception 'CX_FORBIDDEN'; end if;
 return new;
end $$;
create trigger translation_job_resource before insert or update of menu_id,business_id,requested_by
on public.menu_translation_jobs for each row execute function public.cx_translation_job_guard();

create function public.cx_translation_status(p_menu uuid,p_actor uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$ begin
 perform public.cx_translation_guard(p_menu,p_actor);
 return jsonb_build_object('source_language',public.cx_translation_source_language(p_menu),
 'public_ready',(select m.is_published and exists(select 1 from public.menu_themes mt where mt.menu_id=m.id and mt.published_at is not null and mt.published_config<>'{}'::jsonb) from public.menus m where m.id=p_menu),
 'languages',(select coalesce(jsonb_agg(to_jsonb(l) order by l.code),'[]'::jsonb) from public.translation_languages l where l.enabled),
 'menu_languages',(select coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb) from public.menu_languages l where l.menu_id=p_menu),
 'items',public.cx_translation_sources(p_menu),
 'translations',(select coalesce(jsonb_agg(jsonb_build_object('language',l.language_code,'items',public.cx_translation_sources(p_menu,l.language_code))),'[]'::jsonb) from public.menu_languages l where l.menu_id=p_menu),
 'job',(select to_jsonb(j)-'source_items'-'claim_token'-'requested_by' from public.menu_translation_jobs j where j.menu_id=p_menu order by j.created_at desc limit 1));
end $$;

-- Reuse generated (never manually corrected) text within the same business.
-- Exact source hashes include source language, type and all translatable fields.
create function public.cx_translation_reusable(p_business uuid,p_language text,p_hash text,p_type text)
returns jsonb language sql stable set search_path=pg_catalog,public as $$
 select draft from (
 select to_jsonb(t) as draft,t.updated_at from public.menu_translations t join public.menus m on m.id=t.menu_id
 where p_type='menu' and m.business_id=p_business and t.language_code=p_language and t.source_hash=p_hash and not t.is_manual
 union all
 select to_jsonb(t),t.updated_at from public.category_translations t join public.menus m on m.id=t.menu_id
 where p_type='category' and m.business_id=p_business and t.language_code=p_language and t.source_hash=p_hash and not t.is_manual
 union all
 select to_jsonb(t),t.updated_at from public.product_translations t join public.menus m on m.id=t.menu_id
 where p_type='product' and m.business_id=p_business and t.language_code=p_language and t.source_hash=p_hash and not t.is_manual
 ) candidates order by updated_at desc limit 1;
$$;

create function public.cx_translation_enqueue(p_menu uuid,p_actor uuid,p_language text,p_replace_manual boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare b uuid; src jsonb; eligible jsonb; chars integer; item jsonb; cached jsonb; job public.menu_translation_jobs; begin
 b:=public.cx_translation_guard(p_menu,p_actor,true);
 if p_language=public.cx_translation_source_language(p_menu) or not exists(select 1 from public.translation_languages where code=p_language and enabled)
 then raise exception 'CX_LANGUAGE'; end if;
 -- Crash recovery never repeats a provider call automatically.
 update public.menu_translation_jobs set status='failed',error_code='WORKER_INTERRUPTED',updated_at=clock_timestamp()
 where business_id=b and status in ('queued','processing') and
 (expires_at<clock_timestamp() or (status='processing' and lease_expires_at<clock_timestamp()));
 if exists(select 1 from public.menu_translation_jobs where business_id=b and status in ('queued','processing')) then raise exception 'CX_BUSY'; end if;
 src:=public.cx_translation_sources(p_menu,p_language);
 insert into public.menu_languages(menu_id,language_code) values(p_menu,p_language) on conflict do nothing;
 for item in select i from jsonb_array_elements(src) i
 where (i->'draft'->>'source_hash') is distinct from (i->>'source_hash')
 and (p_replace_manual or not coalesce((i->'draft'->>'is_manual')::boolean,false)) loop
 cached:=public.cx_translation_reusable(b,p_language,item->>'source_hash',item->>'type');
 if cached is not null then
 perform public.cx_translation_write(p_menu,p_language,cached||jsonb_build_object('type',item->>'type','id',item->>'id'),false);
 end if;
 end loop;
 src:=public.cx_translation_sources(p_menu,p_language);
 select coalesce(jsonb_agg(i),'[]'::jsonb) into eligible from jsonb_array_elements(src) i
 where (i->'draft'->>'source_hash') is distinct from (i->>'source_hash')
 and (p_replace_manual or not coalesce((i->'draft'->>'is_manual')::boolean,false));
 if jsonb_array_length(eligible)=0 then return jsonb_build_object('unchanged',true); end if;
 select coalesce(sum(length((i-'draft')::text)),0) into chars from jsonb_array_elements(eligible) i;
 if jsonb_array_length(eligible)>600 or chars>250000 then raise exception 'CX_SIZE'; end if;
 if (select count(*) from public.menu_translation_jobs where business_id=b and created_at>clock_timestamp()-interval '1 hour')>=10
 or (select count(*) from public.menu_translation_jobs where business_id=b and created_at>clock_timestamp()-interval '30 days')>=250
 or (select coalesce(sum(characters),0) from public.menu_translation_jobs where business_id=b and created_at>clock_timestamp()-interval '1 day')+chars>1000000
 or (select coalesce(sum(characters),0) from public.menu_translation_jobs where business_id=b and created_at>clock_timestamp()-interval '30 days')+chars>2000000
 then raise exception 'CX_LIMIT'; end if;
 insert into public.menu_languages(menu_id,language_code) values(p_menu,p_language) on conflict do nothing;
 insert into public.menu_translation_jobs(menu_id,business_id,requested_by,language_code,source_language,source_items,total_items,characters)
 values(p_menu,b,p_actor,p_language,public.cx_translation_source_language(p_menu),eligible,jsonb_array_length(eligible),chars) returning * into job;
 return to_jsonb(job)-'source_items'-'claim_token'-'requested_by';
end $$;

create function public.cx_translation_claim() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare job public.menu_translation_jobs; begin
 update public.menu_translation_jobs set status='failed',error_code='WORKER_INTERRUPTED',updated_at=clock_timestamp()
 where status in ('queued','processing') and
 (expires_at<clock_timestamp() or (status='processing' and lease_expires_at<clock_timestamp()));
 select * into job from public.menu_translation_jobs where status='queued' and expires_at>clock_timestamp()
 order by created_at for update skip locked limit 1;
 if job.id is null then return null; end if;
 update public.menu_translation_jobs set status='processing',claim_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '2 minutes',updated_at=clock_timestamp()
 where id=job.id returning * into job;
 return to_jsonb(job);
end $$;

create function public.cx_translation_progress(p_job uuid,p_token uuid,p_completed integer,p_error text default null)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$ begin
 update public.menu_translation_jobs set completed_items=p_completed,updated_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '2 minutes',
 status=case when p_error is null then status else 'failed' end,error_code=p_error
 where id=p_job and claim_token=p_token and status='processing' and expires_at>clock_timestamp() and lease_expires_at>clock_timestamp()
 and p_completed between completed_items and total_items;
 if not found then raise exception 'CX_EXPIRED'; end if;
 return true;
end $$;

-- Internal writer. All callers validate scope, source hash and revision first.
create function public.cx_translation_write(p_menu uuid,p_language text,p_item jsonb,p_manual boolean)
returns void language plpgsql set search_path=pg_catalog,public as $$ begin
 if p_item->>'type'='menu' then
 insert into public.menu_translations(menu_id,language_code,name,description,welcome_text,source_hash,is_manual)
 values(p_menu,p_language,p_item->>'name',p_item->>'description',coalesce(p_item->>'welcome_text',''),p_item->>'source_hash',p_manual)
 on conflict(menu_id,language_code) do update set name=excluded.name,description=excluded.description,welcome_text=excluded.welcome_text,
 source_hash=excluded.source_hash,is_manual=excluded.is_manual,revision=menu_translations.revision+1,updated_at=clock_timestamp();
 elsif p_item->>'type'='category' then
 insert into public.category_translations(menu_id,category_id,language_code,name,source_hash,is_manual)
 values(p_menu,(p_item->>'id')::uuid,p_language,p_item->>'name',p_item->>'source_hash',p_manual)
 on conflict(menu_id,category_id,language_code) do update set name=excluded.name,
 source_hash=excluded.source_hash,is_manual=excluded.is_manual,revision=category_translations.revision+1,updated_at=clock_timestamp();
 elsif p_item->>'type'='product' then
 insert into public.product_translations(menu_id,product_id,language_code,name,description,source_hash,is_manual)
 values(p_menu,(p_item->>'id')::uuid,p_language,p_item->>'name',p_item->>'description',p_item->>'source_hash',p_manual)
 on conflict(menu_id,product_id,language_code) do update set name=excluded.name,description=excluded.description,
 source_hash=excluded.source_hash,is_manual=excluded.is_manual,revision=product_translations.revision+1,updated_at=clock_timestamp();
 else raise exception 'CX_CHANGED'; end if;
end $$;

create function public.cx_translation_lock_sources(p_menu uuid) returns void
language plpgsql set search_path=pg_catalog,public as $$ begin
 perform 1 from public.menus where id=p_menu for share;
 perform 1 from public.menu_themes where menu_id=p_menu for share;
 perform 1 from public.categories where menu_id=p_menu order by id for share;
 perform 1 from public.category_products cp join public.categories c on c.id=cp.category_id where c.menu_id=p_menu order by cp.product_id for share of cp;
 perform 1 from public.products p where p.business_id=(select business_id from public.menus where id=p_menu)
 and exists(select 1 from public.category_products cp join public.categories c on c.id=cp.category_id where c.menu_id=p_menu and cp.product_id=p.id) order by p.id for share;
end $$;

create function public.cx_translation_finish(p_job uuid,p_token uuid,p_items jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare job public.menu_translation_jobs; src jsonb; item jsonb; original jsonb; current_item jsonb; begin
 select * into job from public.menu_translation_jobs where id=p_job;
 if job.id is null then raise exception 'CX_EXPIRED'; end if;
 perform public.cx_translation_guard(job.menu_id,job.requested_by,true);
 select * into job from public.menu_translation_jobs where id=p_job for update;
 if job.status<>'processing' or job.claim_token is distinct from p_token or job.expires_at<clock_timestamp() or job.lease_expires_at<clock_timestamp() then raise exception 'CX_EXPIRED'; end if;
 perform public.cx_translation_lock_sources(job.menu_id);
 src:=public.cx_translation_sources(job.menu_id,job.language_code);
 if public.cx_translation_source_language(job.menu_id)<>job.source_language or jsonb_typeof(p_items)<>'array'
 or jsonb_array_length(p_items)<>job.total_items then raise exception 'CX_CHANGED'; end if;
 if (select count(distinct i->>'type'||':'||(i->>'id')) from jsonb_array_elements(p_items) i)<>job.total_items then raise exception 'CX_CHANGED'; end if;
 for item in select * from jsonb_array_elements(p_items) loop
 select i into original from jsonb_array_elements(job.source_items) i where i->>'id'=item->>'id' and i->>'type'=item->>'type';
 select i into current_item from jsonb_array_elements(src) i where i->>'id'=item->>'id' and i->>'type'=item->>'type';
 if original is null or current_item is null or current_item->>'source_hash'<>original->>'source_hash'
 or coalesce(current_item->'draft'->>'revision','0')<>coalesce(original->'draft'->>'revision','0') then raise exception 'CX_CHANGED'; end if;
 perform public.cx_translation_write(job.menu_id,job.language_code,item||jsonb_build_object('source_hash',original->>'source_hash'),false);
 end loop;
 update public.menu_translation_jobs set status='completed',completed_items=total_items,updated_at=clock_timestamp() where id=job.id;
 return true;
end $$;

create function public.cx_translation_mutate(p_menu uuid,p_actor uuid,p_language text,p_action text,p_payload jsonb default '{}'::jsonb)
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
 if p_language=public.cx_translation_source_language(p_menu) then raise exception 'CX_LANGUAGE'; end if;
 insert into public.menu_languages(menu_id,language_code) values(p_menu,p_language) on conflict do nothing;
 perform public.cx_translation_lock_sources(p_menu);
 src:=public.cx_translation_sources(p_menu,p_language);
 if p_action='visibility' then
 if coalesce((p_payload->>'enabled')::boolean,false) and not exists(select 1 from public.menu_languages where menu_id=p_menu and language_code=p_language and published_at is not null)
 then raise exception 'CX_INCOMPLETE'; end if;
 update public.menu_languages set enabled=coalesce((p_payload->>'enabled')::boolean,false),updated_at=clock_timestamp() where menu_id=p_menu and language_code=p_language;
 elsif p_action='publish' then
 if exists(select 1 from jsonb_array_elements(src) i where (i->'draft'->>'source_hash') is distinct from (i->>'source_hash')) then raise exception 'CX_INCOMPLETE'; end if;
 update public.menu_languages set published_items=(select jsonb_agg(jsonb_build_object('id',i->>'id','type',i->>'type',
 'name',i->'draft'->>'name','description',i->'draft'->>'description','welcome_text',coalesce(i->'draft'->>'welcome_text',''),'source_hash',i->>'source_hash')) from jsonb_array_elements(src) i),
 published_at=clock_timestamp(),enabled=true,updated_at=clock_timestamp() where menu_id=p_menu and language_code=p_language;
 elsif p_action in ('manual','delete') then
 select i into item from jsonb_array_elements(src) i where i->>'id'=p_payload->>'id' and i->>'type'=p_payload->>'type';
 if item is null or coalesce(item->'draft'->>'revision','0')<>p_payload->>'revision' then raise exception 'CX_CHANGED'; end if;
 if p_action='manual' then
 if item->>'source_hash'<>p_payload->>'sourceHash' then raise exception 'CX_CHANGED'; end if;
 perform public.cx_translation_write(p_menu,p_language,p_payload||jsonb_build_object('source_hash',item->>'source_hash'),true);
 else
 if p_payload->>'type'='menu' then delete from public.menu_translations where menu_id=p_menu and language_code=p_language;
 elsif p_payload->>'type'='category' then delete from public.category_translations where menu_id=p_menu and category_id=(p_payload->>'id')::uuid and language_code=p_language;
 elsif p_payload->>'type'='product' then delete from public.product_translations where menu_id=p_menu and product_id=(p_payload->>'id')::uuid and language_code=p_language;
 end if;
 -- Removing a translation also removes that item from the published version.
 update public.menu_languages set published_items=(select coalesce(jsonb_agg(i),'[]'::jsonb) from jsonb_array_elements(published_items) i where not(i->>'type'=p_payload->>'type' and i->>'id'=p_payload->>'id')),updated_at=clock_timestamp()
 where menu_id=p_menu and language_code=p_language;
 end if;
 else raise exception 'CX_CHANGED'; end if;
 return true;
end $$;

-- Read-only and service-only: never loads drafts or jobs into a public response.
create function public.cx_public_translations(p_menu uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 with published_menu as (
 select m.id from public.menus m join public.menu_themes mt on mt.menu_id=m.id
 where m.id=p_menu and m.is_published and mt.published_at is not null and mt.published_config<>'{}'::jsonb
 ), sources as (select i from published_menu m,jsonb_array_elements(public.cx_translation_sources(m.id)) i),
 visible as (select i from sources where i->>'type'='menu'
 or (i->>'type'='category' and exists(select 1 from public.categories c where c.id=(i->>'id')::uuid and c.menu_id=p_menu and c.is_visible))
 or (i->>'type'='product' and exists(select 1 from public.products p join public.category_products cp on cp.product_id=p.id join public.categories c on c.id=cp.category_id
 join public.menus m on m.id=c.menu_id and m.business_id=p.business_id where c.menu_id=p_menu and c.is_visible and p.is_available and p.id=(i->>'id')::uuid)))
 select case when exists(select 1 from published_menu) then jsonb_build_object('source_language',public.cx_translation_source_language(p_menu),
 'available',(select coalesce(jsonb_agg(jsonb_build_object('code',r.code,'native_name',r.native_name,'html_lang',r.html_lang) order by r.code),'[]'::jsonb)
 from public.translation_languages r where r.enabled and (r.code=public.cx_translation_source_language(p_menu) or exists(select 1 from public.menu_languages l where l.menu_id=p_menu and l.language_code=r.code and l.enabled and l.published_at is not null))),
 'translations',(select coalesce(jsonb_object_agg(l.language_code,(select coalesce(jsonb_agg(jsonb_build_object('type',t->>'type','id',t->>'id','name',t->>'name','description',coalesce(t->>'description',''),'welcome_text',coalesce(t->>'welcome_text',''))),'[]'::jsonb)
 from jsonb_array_elements(l.published_items) t join visible s on s.i->>'type'=t->>'type' and s.i->>'id'=t->>'id' and s.i->>'source_hash'=t->>'source_hash')),'{}'::jsonb)
 from public.menu_languages l where l.menu_id=p_menu and l.enabled and l.published_at is not null and l.language_code<>public.cx_translation_source_language(p_menu))) else null end;
$$;

-- No SECURITY DEFINER function may be invoked with a forged actor by a client.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'cx_translation_%' or p.proname='cx_public_translations') loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 if f.proname='cx_translation_owner' then execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end $$;

-- Preserve the configured source language when an existing menu is duplicated.
-- The existing duplicate_menu function remains unchanged; both operations share
-- its PostgreSQL transaction. No translations are automatically published/copied.
create function public.cx_duplicate_menu_with_language(p_menu_id uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare new_id uuid; original_language text; begin
 perform public.cx_translation_guard(p_menu_id,auth.uid());
 original_language:=public.cx_translation_source_language(p_menu_id);
 new_id:=(to_jsonb(public.duplicate_menu(p_menu_id)) #>> '{}')::uuid;
 insert into public.menu_language_settings(menu_id,source_language) values(new_id,original_language)
 on conflict(menu_id) do update set source_language=excluded.source_language;
 return new_id;
end $$;
revoke all on function public.cx_duplicate_menu_with_language(uuid) from public,anon;
grant execute on function public.cx_duplicate_menu_with_language(uuid) to authenticated;

commit;
