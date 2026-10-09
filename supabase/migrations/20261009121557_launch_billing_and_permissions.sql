-- No existing subscription is assumed TEST or LIVE. No customer data is deleted.
-- Apply only after QA and explicit approval. Configure the private mode for each environment.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated,service_role;
create table private.cx_billing_environment(singleton boolean primary key default true check(singleton),stripe_livemode boolean not null);
insert into private.cx_billing_environment values(true,true); -- Production default. QA must set false.
revoke all on private.cx_billing_environment from public,anon,authenticated;
grant all on private.cx_billing_environment to service_role;
alter table public.subscriptions add column stripe_livemode boolean,
 add column billing_sync_token uuid,add column billing_sync_expires_at timestamptz,
 add column checkout_request jsonb,add column checkout_requested_at timestamptz;
revoke all on public.subscriptions from public,anon,authenticated;
grant select on public.subscriptions to authenticated;
do $$declare t record;begin for t in select tablename from pg_tables where schemaname='public' loop
 execute format('revoke truncate,references,trigger on public.%I from public,anon,authenticated',t.tablename);end loop;end$$;
create table private.cx_billing_history(id bigint generated always as identity primary key,business_id uuid not null,archived_at timestamptz not null default clock_timestamp(),snapshot jsonb not null);
revoke all on private.cx_billing_history from public,anon,authenticated;
grant select,insert on private.cx_billing_history to service_role;
create function private.cx_archive_billing_link() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (old.stripe_subscription_id is not null or old.stripe_customer_id is not null) and
 (new.stripe_livemode is distinct from old.stripe_livemode or new.stripe_subscription_id is distinct from old.stripe_subscription_id or new.stripe_customer_id is distinct from old.stripe_customer_id) then
 insert into private.cx_billing_history(business_id,snapshot) values(old.business_id,to_jsonb(old)); end if; return new;
end$$;
revoke all on function private.cx_archive_billing_link() from public,anon,authenticated;
create trigger cx_billing_archive before update on public.subscriptions for each row execute function private.cx_archive_billing_link();

create function private.cx_premium_business(p_business uuid,p_actor uuid default auth.uid()) returns boolean
language sql stable security definer set search_path='' as $$
 select p_actor is not null and exists(select 1 from public.businesses b join public.subscriptions s on s.business_id=b.id
 join private.cx_billing_environment e on e.singleton where b.id=p_business and b.owner_id=p_actor
 and s.stripe_livemode=e.stripe_livemode and s.stripe_customer_id is not null and s.stripe_subscription_id is not null
 and s.current_period_end>statement_timestamp() and
 (s.status='active' or (s.status='trialing' and s.trial_ends_at>statement_timestamp())));
$$;
create function private.cx_premium_menu(p_menu uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.menus m where m.id=p_menu and private.cx_premium_business(m.business_id));$$;
create function private.cx_premium_product(p_product uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.products p where p.id=p_product and private.cx_premium_business(p.business_id));$$;
create function private.cx_premium_category(p_category uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.categories c where c.id=p_category and private.cx_premium_menu(c.menu_id));$$;
create function private.cx_premium_relation(p_category uuid,p_product uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.categories c join public.menus m on m.id=c.menu_id join public.products p on p.business_id=m.business_id where c.id=p_category and p.id=p_product and private.cx_premium_business(m.business_id));$$;
create function private.cx_premium_product_file(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.products p where p.business_id::text=(storage.foldername(p_name))[1] and p.id::text=(storage.foldername(p_name))[2] and private.cx_premium_business(p.business_id));$$;
revoke all on function private.cx_premium_relation(uuid,uuid),private.cx_premium_product_file(text) from public,anon;
grant execute on function private.cx_premium_relation(uuid,uuid),private.cx_premium_product_file(text) to authenticated,service_role;
revoke all on function private.cx_premium_business(uuid,uuid),private.cx_premium_menu(uuid),private.cx_premium_product(uuid),private.cx_premium_category(uuid) from public,anon;
grant execute on function private.cx_premium_business(uuid,uuid),private.cx_premium_menu(uuid),private.cx_premium_product(uuid),private.cx_premium_category(uuid) to authenticated,service_role;

-- Restrictive policies AND existing ownership policies. Also applied to reads,
-- matching Express premium endpoints. Business onboarding/billing remain free.
do $$declare t text;predicate text;begin
 for t,predicate in select * from (values
 ('menus','private.cx_premium_business(business_id)'),('products','private.cx_premium_business(business_id)'),
 ('categories','private.cx_premium_menu(menu_id)'),('menu_themes','private.cx_premium_menu(menu_id)'),
 ('category_products','private.cx_premium_relation(category_id,product_id)'),
 ('product_allergens','private.cx_premium_product(product_id)'),
 ('menu_language_settings','private.cx_premium_menu(menu_id)'),('menu_languages','private.cx_premium_menu(menu_id)'),
 ('menu_translations','private.cx_premium_menu(menu_id)'),('category_translations','private.cx_premium_menu(menu_id)'),
 ('product_translations','private.cx_premium_menu(menu_id)'),('menu_translation_jobs','private.cx_premium_menu(menu_id)')) x loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy cx_premium_boundary on public.%I as restrictive for all to authenticated using (%s) with check (%s)',t,predicate,predicate);
 execute format('revoke all on public.%I from anon',t);
 execute format('revoke truncate,references,trigger on public.%I from authenticated',t);
 end loop;
end$$;
-- SECURITY DEFINER mutators retain the JWT context, so triggers enforce the same
-- rule even when the function owner bypasses RLS. Trusted service calls have no UID.
create function private.cx_premium_write_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;allowed boolean;link text;begin
 if auth.uid() is null then return coalesce(new,old);end if;
 if tg_op='UPDATE' then
  foreach link in array array['id','business_id','menu_id','category_id','product_id'] loop
   if to_jsonb(old) ? link and (to_jsonb(old)->link) is distinct from (to_jsonb(new)->link) then raise exception 'CX_RESOURCE_LINK' using errcode='42501';end if;
  end loop;
 end if;
 -- RI cascades run after the authorized parent has disappeared. Only nested
 -- DELETEs with a missing parent qualify; direct DELETEs still run the guard.
 -- Clients cannot create triggers or delete the free business parent.
 if tg_op='DELETE' and pg_trigger_depth()>1 then
  if tg_table_name='category_products' and
   (not exists(select 1 from public.categories where id=(to_jsonb(old)->>'category_id')::uuid) or not exists(select 1 from public.products where id=(to_jsonb(old)->>'product_id')::uuid)) then return old;
  elsif tg_table_name='product_allergens' and not exists(select 1 from public.products where id=(to_jsonb(old)->>'product_id')::uuid) then return old;
  elsif tg_table_name not in ('menus','products','category_products','product_allergens') and not exists(select 1 from public.menus where id=(to_jsonb(old)->>'menu_id')::uuid) then return old;end if;
 end if;
 for r in select to_jsonb(old) where tg_op<>'INSERT' union all select to_jsonb(new) where tg_op<>'DELETE' loop
 if tg_table_name in ('menus','products') then allowed:=private.cx_premium_business((r->>'business_id')::uuid);
 elsif tg_table_name='category_products' then allowed:=private.cx_premium_relation((r->>'category_id')::uuid,(r->>'product_id')::uuid);
 elsif tg_table_name='product_allergens' then allowed:=private.cx_premium_product((r->>'product_id')::uuid);
 else allowed:=private.cx_premium_menu((r->>'menu_id')::uuid);end if;
 if not coalesce(allowed,false) then raise exception 'CX_SUBSCRIPTION' using errcode='42501';end if;
 end loop;return coalesce(new,old);
end$$;
revoke all on function private.cx_premium_write_guard() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['menus','products','categories','category_products','product_allergens','menu_themes','menu_language_settings','menu_languages','menu_translations','category_translations','product_translations','menu_translation_jobs'] loop
 execute format('create trigger cx_premium_write before insert or update or delete on public.%I for each row execute function private.cx_premium_write_guard()',t);
end loop;end$$;
revoke delete on public.businesses from public,anon,authenticated; -- No business deletion endpoint; avoid orphaning billing through direct API.
-- Product images are premium; logos and covers are free onboarding assets.
create policy cx_storage_premium_boundary on storage.objects as restrictive for all to authenticated
using(bucket_id<>'product-images' or private.cx_premium_product_file(name))
with check(bucket_id<>'product-images' or private.cx_premium_product_file(name));
-- Trigger helper RPCs cannot be invoked anonymously. Mutators require authenticated
-- ownership + the write guard above. Preserve required ownership helper functions.
do $$declare f record;begin for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
 execute format('revoke execute on function %s from public,anon',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 if f.proname in ('owns_business','owns_menu','owns_category','category_product_same_business','cx_translation_owner','duplicate_menu','cx_duplicate_menu_with_language','set_product_allergens') then
 execute format('grant execute on function %s to authenticated',f.signature);
 else execute format('revoke execute on function %s from authenticated',f.signature);end if;
end loop;end$$;

create or replace function public.cx_translation_guard(p_menu uuid,p_actor uuid,p_lock boolean default false)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$declare b uuid;begin
 select m.business_id into b from public.menus m join public.businesses x on x.id=m.business_id where m.id=p_menu and x.owner_id=p_actor;
 if b is null then raise exception 'CX_FORBIDDEN';end if;
 if p_lock then perform 1 from public.businesses where id=b for update;end if;
 if not private.cx_premium_business(b,p_actor) then raise exception 'CX_SUBSCRIPTION';end if;return b;
end$$;
do $$declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('set_product_allergens','prevent_owner_change','validate_category_product','validate_category_product_business') loop
 execute format('revoke execute on function %s from public,anon',f.signature);end loop;end$$;
-- Explicit grants for client RPCs; their table writes are trigger-guarded.
grant execute on function public.duplicate_menu(uuid) to authenticated;
do $$declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname='set_product_allergens' loop
 execute format('grant execute on function %s to authenticated',f.signature);end loop;end$$;
-- Event timestamps are an audit watermark, not an ordering lock: a delayed
-- event still reads current Stripe state under its lease. Equal timestamps are
-- accepted safely; old snapshots are fenced by lease ownership instead.
-- Lease spans the remote authoritative Stripe read and the subsequent SQL commit.
-- Expired holders cannot commit: token + expiry checked while holding the row lock.
create function public.cx_acquire_billing_sync(p_business uuid,p_actor uuid) returns uuid language plpgsql security definer set search_path='' as $$declare token uuid:=gen_random_uuid();result uuid;begin
 update public.subscriptions s set billing_sync_token=token,billing_sync_expires_at=clock_timestamp()+interval '90 seconds'
 where s.business_id=p_business and (s.billing_sync_token is null or s.billing_sync_expires_at<=clock_timestamp())
 and exists(select 1 from public.businesses b where b.id=p_business and b.owner_id=p_actor) returning billing_sync_token into result;
 return result;end$$;
create function public.cx_release_billing_sync(p_business uuid,p_token uuid) returns void language sql security definer set search_path='' as $$
 update public.subscriptions set billing_sync_token=null,billing_sync_expires_at=null where business_id=p_business and billing_sync_token=p_token;$$;
revoke all on function public.cx_acquire_billing_sync(uuid,uuid),public.cx_release_billing_sync(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cx_acquire_billing_sync(uuid,uuid),public.cx_release_billing_sync(uuid,uuid) to service_role;
create or replace function public.cx_sync_billing_event(p_event_id text,p_event_type text,p_created bigint,p_payload jsonb)
returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare s public.subscriptions; b uuid; actor uuid; new_sub text; new_customer text; attempt text;
begin
 if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]{1,120}$' or p_created is null or p_created<0
 or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'CX_BILLING_INVALID'; end if;
 b:=(p_payload->>'business_id')::uuid; actor:=(p_payload->>'owner_id')::uuid;
 new_sub:=p_payload->>'stripe_subscription_id';new_customer:=p_payload->>'stripe_customer_id';attempt:=p_payload->>'checkout_attempt_id';
 if b is null or actor is null or new_sub is null or new_customer is null or p_payload->>'status' is null or p_payload->>'status' not in ('trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused') then raise exception 'CX_BILLING_INVALID'; end if;
 insert into public.stripe_webhook_events(id,event_type) values(p_event_id,p_event_type) on conflict(id) do nothing;
 if not found then return 'duplicate'; end if;
 if not exists(select 1 from public.businesses where id=b and owner_id=actor) then raise exception 'CX_BILLING_OWNER'; end if;
 select * into s from public.subscriptions where business_id=b for update;
 if s.business_id is null then raise exception 'CX_BILLING_UNLINKED'; end if;
 if s.billing_sync_token is distinct from (p_payload->>'sync_token')::uuid or s.billing_sync_expires_at <= clock_timestamp() or s.billing_sync_token is null then raise exception 'CX_BILLING_FENCE'; end if;
 if (p_payload->>'stripe_livemode')::boolean is distinct from (select stripe_livemode from private.cx_billing_environment where singleton) then raise exception 'CX_BILLING_MODE'; end if;
 if s.status='checkout_pending' and (attempt is null or s.checkout_attempt_id::text is distinct from attempt) then return 'unrelated'; end if;
 if s.stripe_subscription_id is distinct from new_sub then
  if s.status<>'checkout_pending' or attempt is null or s.checkout_attempt_id::text is distinct from attempt then
   return 'unrelated'; -- An old subscription must never replace the current link.
  end if;
  if s.stripe_customer_id is not null and s.stripe_customer_id<>new_customer then raise exception 'CX_BILLING_CUSTOMER'; end if;
 elsif s.stripe_customer_id is distinct from new_customer then raise exception 'CX_BILLING_CUSTOMER';
 end if;
 if s.stripe_subscription_id=new_sub and (s.status='canceled' and p_payload->>'status'<>'canceled') then return 'stale'; end if;
 update public.subscriptions set stripe_customer_id=new_customer,stripe_subscription_id=new_sub,status=p_payload->>'status',
 trial_ends_at=(p_payload->>'trial_ends_at')::timestamptz,current_period_end=(p_payload->>'current_period_end')::timestamptz,
 cancel_at_period_end=(p_payload->>'cancel_at_period_end')::boolean,
 trial_used_at=coalesce(s.trial_used_at,case when p_payload->>'trial_ends_at' is not null then clock_timestamp() else null end),
 checkout_attempt_id=null,checkout_expires_at=null,checkout_session_id=null,stripe_event_created=greatest(s.stripe_event_created,p_created),stripe_livemode=(p_payload->>'stripe_livemode')::boolean,checkout_request=null,checkout_requested_at=null,billing_sync_token=null,billing_sync_expires_at=null where business_id=b;
 return 'synced';
end $$;
revoke all on function public.cx_sync_billing_event(text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.cx_sync_billing_event(text,text,bigint,jsonb) to service_role;
commit;
