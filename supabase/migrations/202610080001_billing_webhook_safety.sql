-- Additive billing hardening. REVIEW and run manually on an isolated Supabase first.
-- Requires the original businesses/subscriptions/stripe_webhook_events schema.
begin;
alter table public.subscriptions add column if not exists stripe_event_created bigint not null default 0;
-- Fail rather than delete/merge any pre-existing duplicate billing links.
create unique index if not exists cx_billing_one_per_business on public.subscriptions(business_id);
create unique index if not exists cx_billing_unique_subscription on public.subscriptions(stripe_subscription_id) where stripe_subscription_id is not null;
create unique index if not exists cx_billing_unique_customer on public.subscriptions(stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists cx_billing_unique_event on public.stripe_webhook_events(id);

-- Authenticated customers can read their billing through ownership, never write it.
alter table public.subscriptions enable row level security;
revoke insert,update,delete on public.subscriptions from public,anon,authenticated;
do $$ declare c record; begin
 for c in select column_name from information_schema.columns where table_schema='public' and table_name='subscriptions' loop
  execute format('revoke insert (%I), update (%I) on public.subscriptions from public,anon,authenticated',c.column_name,c.column_name);
 end loop;
end $$;
create policy cx_billing_owner_boundary on public.subscriptions as restrictive for select to anon,authenticated
using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from public,anon,authenticated;

-- One transaction: unique event claim, locked tenant row, fenced synchronization.
create function public.cx_sync_billing_event(p_event_id text,p_event_type text,p_created bigint,p_payload jsonb)
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
 if s.stripe_subscription_id is distinct from new_sub then
  if s.status<>'checkout_pending' or attempt is null or s.checkout_attempt_id::text is distinct from attempt then
   return 'unrelated'; -- An old subscription must never replace the current link.
  end if;
  if s.stripe_customer_id is not null and s.stripe_customer_id<>new_customer then raise exception 'CX_BILLING_CUSTOMER'; end if;
 elsif s.stripe_customer_id is distinct from new_customer then raise exception 'CX_BILLING_CUSTOMER';
 end if;
 if s.stripe_subscription_id=new_sub and (p_created<s.stripe_event_created or (s.status='canceled' and p_payload->>'status'<>'canceled')) then return 'stale'; end if;
 update public.subscriptions set stripe_customer_id=new_customer,stripe_subscription_id=new_sub,status=p_payload->>'status',
 trial_ends_at=(p_payload->>'trial_ends_at')::timestamptz,current_period_end=(p_payload->>'current_period_end')::timestamptz,
 cancel_at_period_end=(p_payload->>'cancel_at_period_end')::boolean,
 trial_used_at=coalesce(s.trial_used_at,case when p_payload->>'trial_ends_at' is not null then clock_timestamp() else null end),
 checkout_attempt_id=null,checkout_expires_at=null,checkout_session_id=null,stripe_event_created=p_created where business_id=b;
 return 'synced';
end $$;
revoke all on function public.cx_sync_billing_event(text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.cx_sync_billing_event(text,text,bigint,jsonb) to service_role;
commit;
