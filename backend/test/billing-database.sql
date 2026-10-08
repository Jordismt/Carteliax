-- Executed only through the guarded database-audit.cjs runner.
begin;
create function pg_temp.check(value boolean,label text) returns void language plpgsql as $$begin if not coalesce(value,false) then raise exception 'FAIL %',label;end if;raise notice 'PASS %',label;end$$;
select pg_temp.check(not has_table_privilege('authenticated','public.subscriptions','UPDATE'),'users cannot forge billing');
select pg_temp.check(not has_table_privilege('anon','public.subscriptions','INSERT'),'anonymous cannot forge billing');
select pg_temp.check(not has_function_privilege('authenticated','public.cx_sync_billing_event(text,text,bigint,jsonb)','EXECUTE'),'webhook RPC internal only');
select pg_temp.check(has_function_privilege('service_role','public.cx_sync_billing_event(text,text,bigint,jsonb)','EXECUTE'),'service can sync verified events');
update subscriptions set stripe_subscription_id='sub_current',stripe_customer_id='cus_a',status='active',stripe_event_created=100 where business_id='11111111-1111-4111-8111-111111111111';
select pg_temp.check(cx_sync_billing_event('evt_old','customer.subscription.deleted',90,'{"business_id":"11111111-1111-4111-8111-111111111111","owner_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","stripe_subscription_id":"sub_old","stripe_customer_id":"cus_a","status":"canceled","cancel_at_period_end":false}')='unrelated','old subscription never replaces current');
select pg_temp.check((select stripe_subscription_id='sub_current' and status='active' from subscriptions where business_id='11111111-1111-4111-8111-111111111111'),'current billing untouched');
select pg_temp.check(cx_sync_billing_event('evt_current','customer.subscription.updated',110,'{"business_id":"11111111-1111-4111-8111-111111111111","owner_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","stripe_subscription_id":"sub_current","stripe_customer_id":"cus_a","status":"past_due","cancel_at_period_end":false}')='synced','current status applied');
select pg_temp.check(cx_sync_billing_event('evt_stale','customer.subscription.updated',105,'{"business_id":"11111111-1111-4111-8111-111111111111","owner_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","stripe_subscription_id":"sub_current","stripe_customer_id":"cus_a","status":"active","cancel_at_period_end":false}')='stale','older event cannot restore access');
select pg_temp.check(cx_sync_billing_event('evt_current','customer.subscription.updated',110,'{"business_id":"11111111-1111-4111-8111-111111111111","owner_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","stripe_subscription_id":"sub_current","stripe_customer_id":"cus_a","status":"active","cancel_at_period_end":false}')='duplicate','duplicate event applied once');
do $$ begin
 begin perform cx_sync_billing_event('evt_foreign','customer.subscription.updated',120,'{"business_id":"11111111-1111-4111-8111-111111111111","owner_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","stripe_subscription_id":"sub_current","stripe_customer_id":"cus_a","status":"active","cancel_at_period_end":false}');raise exception 'Expected owner rejection';exception when others then if sqlerrm<>'CX_BILLING_OWNER' then raise;end if;end;
end$$;
select pg_temp.check(not exists(select 1 from stripe_webhook_events where id='evt_foreign'),'failed transaction never acknowledges event');
update subscriptions set status='checkout_pending',checkout_attempt_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' where business_id='11111111-1111-4111-8111-111111111111';
select pg_temp.check(cx_sync_billing_event('evt_new','checkout.session.completed',130,'{"business_id":"11111111-1111-4111-8111-111111111111","owner_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","stripe_subscription_id":"sub_new","stripe_customer_id":"cus_a","status":"trialing","trial_ends_at":"2027-01-01T00:00:00Z","current_period_end":"2027-01-01T00:00:00Z","cancel_at_period_end":false,"checkout_attempt_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}')='synced','new subscription needs matching reservation');
select pg_temp.check((select trial_used_at is not null and checkout_attempt_id is null from subscriptions where business_id='11111111-1111-4111-8111-111111111111'),'trial usage persisted and reservation released atomically');
select pg_temp.check((select status='active' from subscriptions where business_id='22222222-2222-4222-8222-222222222222'),'other tenant untouched');
rollback;
