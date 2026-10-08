-- Read-only inventory. Run manually in a dedicated QA Supabase first.
-- This inventory is NOT a substitute for authenticated A/B REST/Storage attacks.
BEGIN READ ONLY;
SELECT n.nspname AS schema,c.relname AS resource,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','storage') AND c.relkind='r' ORDER BY 1,2;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY 1,2,3;
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.role_table_grants
WHERE table_schema IN ('public','storage') AND grantee IN ('anon','authenticated','PUBLIC') ORDER BY 1,2,3,4;
SELECT n.nspname,p.proname,p.prosecdef,p.proconfig,pg_get_function_identity_arguments(p.oid) AS arguments,
has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1,2;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id;
-- No customer IDs, card data or private establishment content returned.
SELECT 'duplicate_business_billing' AS check_name,count(*) FROM
(SELECT business_id FROM public.subscriptions GROUP BY business_id HAVING count(*)>1) q;
SELECT 'duplicate_subscription_binding' AS check_name,count(*) FROM
(SELECT stripe_subscription_id FROM public.subscriptions WHERE stripe_subscription_id IS NOT NULL GROUP BY stripe_subscription_id HAVING count(*)>1) q;
SELECT 'shared_customer_binding' AS check_name,count(*) FROM
(SELECT stripe_customer_id FROM public.subscriptions WHERE stripe_customer_id IS NOT NULL GROUP BY stripe_customer_id HAVING count(DISTINCT business_id)>1) q;
SELECT 'legacy_active_without_end' AS check_name,count(*) FROM public.subscriptions WHERE status='active' AND current_period_end IS NULL;
ROLLBACK;
