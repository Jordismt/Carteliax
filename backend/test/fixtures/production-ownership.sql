-- LOCAL ONLY. Ownership predicates read from production on 2026-10-09.
-- No customer data. Apply only after disposable-cluster guard in the runner.
DO $$BEGIN IF current_setting('port') <> '55439' OR current_setting('data_directory') <> '/tmp/carteliax-hardening-pg/data' THEN RAISE EXCEPTION 'Disposable local QA required'; END IF; END$$;
DROP POLICY IF EXISTS "Create own businesses" ON public."businesses";
DROP POLICY IF EXISTS "Delete owned businesses" ON public."businesses";
DROP POLICY IF EXISTS "Read owned businesses" ON public."businesses";
DROP POLICY IF EXISTS "Update owned businesses" ON public."businesses";
DROP POLICY IF EXISTS "Manage owned categories" ON public."categories";
DROP POLICY IF EXISTS "Manage category products" ON public."category_products";
DROP POLICY IF EXISTS "Owners can create menu themes" ON public."menu_themes";
DROP POLICY IF EXISTS "Owners can update menu themes" ON public."menu_themes";
DROP POLICY IF EXISTS "Owners can view menu themes" ON public."menu_themes";
DROP POLICY IF EXISTS "Manage owned menus" ON public."menus";
DROP POLICY IF EXISTS "Manage product allergens" ON public."product_allergens";
DROP POLICY IF EXISTS "Manage owned products" ON public."products";
DROP POLICY IF EXISTS "Read own subscriptions" ON public."subscriptions";
CREATE OR REPLACE FUNCTION public.category_product_same_business(p_category_id uuid, p_product_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.categories c
    JOIN public.menus m
      ON m.id = c.menu_id
    JOIN public.products p
      ON p.id = p_product_id
    WHERE c.id = p_category_id
      AND m.business_id = p.business_id
  );
$function$
;
CREATE OR REPLACE FUNCTION public.owns_business(target_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.businesses b
    where b.id = target_business_id
      and b.owner_id = (select auth.uid())
  );
$function$
;
CREATE OR REPLACE FUNCTION public.owns_category(target_category_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.categories c
    join public.menus m on m.id = c.menu_id
    join public.businesses b on b.id = m.business_id
    where c.id = target_category_id
      and b.owner_id = (select auth.uid())
  );
$function$
;
CREATE OR REPLACE FUNCTION public.owns_menu(target_menu_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.menus m
    join public.businesses b
      on b.id = m.business_id
    where m.id = target_menu_id
      and b.owner_id = (select auth.uid())
  );
$function$
;
CREATE POLICY "Create own businesses" ON public."businesses" FOR INSERT TO authenticated WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Delete owned businesses" ON public."businesses" FOR DELETE TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Read owned businesses" ON public."businesses" FOR SELECT TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Update owned businesses" ON public."businesses" FOR UPDATE TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Manage owned categories" ON public."categories" FOR ALL TO authenticated USING (owns_menu(menu_id)) WITH CHECK (owns_menu(menu_id));
CREATE POLICY "Manage category products" ON public."category_products" FOR ALL TO authenticated USING ((owns_category(category_id) AND (EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = category_products.product_id) AND owns_business(p.business_id)))) AND category_product_same_business(category_id, product_id))) WITH CHECK ((owns_category(category_id) AND (EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = category_products.product_id) AND owns_business(p.business_id)))) AND category_product_same_business(category_id, product_id)));
CREATE POLICY "Owners can create menu themes" ON public."menu_themes" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (menus m
     JOIN businesses b ON ((b.id = m.business_id)))
  WHERE ((m.id = menu_themes.menu_id) AND (b.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Owners can update menu themes" ON public."menu_themes" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (menus m
     JOIN businesses b ON ((b.id = m.business_id)))
  WHERE ((m.id = menu_themes.menu_id) AND (b.owner_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (menus m
     JOIN businesses b ON ((b.id = m.business_id)))
  WHERE ((m.id = menu_themes.menu_id) AND (b.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Owners can view menu themes" ON public."menu_themes" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (menus m
     JOIN businesses b ON ((b.id = m.business_id)))
  WHERE ((m.id = menu_themes.menu_id) AND (b.owner_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Manage owned menus" ON public."menus" FOR ALL TO authenticated USING (owns_business(business_id)) WITH CHECK (owns_business(business_id));
CREATE POLICY "Manage product allergens" ON public."product_allergens" FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_allergens.product_id) AND owns_business(p.business_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_allergens.product_id) AND owns_business(p.business_id)))));
CREATE POLICY "Manage owned products" ON public."products" FOR ALL TO authenticated USING (owns_business(business_id)) WITH CHECK (owns_business(business_id));
CREATE POLICY "Read own subscriptions" ON public."subscriptions" FOR SELECT TO authenticated USING (owns_business(business_id));
