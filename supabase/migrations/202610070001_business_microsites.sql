-- ADITIVA. Ejecutar manualmente DESPUÉS de 202610060001_menu_translations.sql.
-- No modifica slugs/IDs históricos, cartas, traducciones, suscripciones ni políticas existentes.
begin;

create function public.cx_public_slug_valid(value text) returns boolean
language sql immutable set search_path=pg_catalog as $$
 select value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(value) between 3 and 60
 and value !~ '[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}'
 and value <> all(array['login','register','dashboard','businesses','menus','billing','api','c','test-business','_nuxt','_ipx','nuxt','ipx','assets','public','admin','auth','logout','settings','account','subscriptions','robots','sitemap','favicon','health','preview']);
$$;
create function public.cx_normalize_public_slug(value text) returns text
language sql immutable set search_path=pg_catalog as $$
 select trim(both '-' from left(regexp_replace(lower(translate(coalesce(value,''),'áàäâãåéèëêíìïîóòöôõúùüûñç','aaaaaaeeeeiiiiooooouuuunc')),'[^a-z0-9]+','-','g'),60));
$$;

-- Validate the entire bounded profile at the database boundary too. No HTML,
-- unknown keys, arbitrary embed markup, credentials in URLs or unsafe schemes.
create function public.cx_public_profile_valid(p jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare k text; v jsonb; x jsonb; y jsonb; days int[]:='{}'; langs text[]:='{}';
 a int; b int; c int; d int; n int; host text; maxlen int;
begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>120000 then return false; end if;
 for k,v in select * from jsonb_each(p) loop
  if k not in ('template','about','phone','whatsapp','email','address','city','postal_code','maps_url','instagram','facebook','tiktok','website','hours','translations') then return false; end if;
  if k in ('hours','translations') then continue; end if;
  if jsonb_typeof(v)<>'string' then return false; end if;
  maxlen:=case k when 'about' then 3000 when 'address' then 240 when 'city' then 100 when 'postal_code' then 20 when 'phone' then 30 when 'whatsapp' then 16 when 'email' then 254 else 2048 end;
  if length(v#>>'{}')>maxlen or (v#>>'{}') ~ '[<>[:cntrl:]]' and k<>'about' or k='about' and (v#>>'{}') ~ '[<>]' then return false; end if;
 end loop;
 if p ? 'template' and p->>'template' not in ('modern','elegant','minimal','classic') then return false; end if;
 if p ? 'phone' and p->>'phone'<>'' and p->>'phone' !~ '^\+?[0-9 ()-]{6,30}$' then return false; end if;
 if p ? 'whatsapp' and p->>'whatsapp'<>'' and p->>'whatsapp' !~ '^\+?[0-9]{7,15}$' then return false; end if;
 if p ? 'email' and p->>'email'<>'' and p->>'email' !~ '^[^ @]+@[^ @]+\.[^ @]+$' then return false; end if;
 foreach k in array array['maps_url','instagram','facebook','tiktok','website'] loop
  if coalesce(p->>k,'')='' then continue; end if;
  if p->>k !~ '^https://[a-zA-Z0-9.-]+([/?#][^[:space:]\\]*)?$' then return false; end if;
  host:=lower(substring(p->>k from '^https://([^/?#]+)'));
  if k='maps_url' and host not in ('www.google.com','google.com','maps.google.com','maps.app.goo.gl','goo.gl') or
   k='instagram' and host not in ('instagram.com','www.instagram.com') or
   k='facebook' and host not in ('facebook.com','www.facebook.com') or
   k='tiktok' and host not in ('tiktok.com','www.tiktok.com') then return false; end if;
 end loop;
 if p ? 'hours' then
  if jsonb_typeof(p->'hours')<>'array' or jsonb_array_length(p->'hours')>7 then return false; end if;
  for x in select * from jsonb_array_elements(p->'hours') loop
   if jsonb_typeof(x)<>'object' or not(x ?& array['day','intervals']) or (select count(*) from jsonb_object_keys(x))<>2 or jsonb_typeof(x->'day')<>'number' or x->>'day' !~ '^[0-6]$' or jsonb_typeof(x->'intervals')<>'array' or jsonb_array_length(x->'intervals')>2 then return false; end if;
   n:=(x->>'day')::int;
   if n=any(days) then return false; end if; days:=array_append(days,n);
   a:=null;b:=null;
   for y in select * from jsonb_array_elements(x->'intervals') order by value->>'open' loop
    if jsonb_typeof(y)<>'object' or not(y ?& array['open','close']) or (select count(*) from jsonb_object_keys(y))<>2 or jsonb_typeof(y->'open')<>'string' or jsonb_typeof(y->'close')<>'string' or y->>'open' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or y->>'close' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or y->>'open'=y->>'close' then return false; end if;
    c:=split_part(y->>'open',':',1)::int*60+split_part(y->>'open',':',2)::int;
    d:=split_part(y->>'close',':',1)::int*60+split_part(y->>'close',':',2)::int;
    if d<c then d:=d+1440; end if;
    if a is not null and (b>c or d>a+1440) then return false; end if;
    a:=c;b:=d;
   end loop;
  end loop;
 end if;
 if p ? 'translations' then
  if jsonb_typeof(p->'translations')<>'array' or jsonb_array_length(p->'translations')>4 then return false; end if;
  for x in select * from jsonb_array_elements(p->'translations') loop
   if jsonb_typeof(x)<>'object' or not(x ?& array['language','description','about','source']) or (select count(*) from jsonb_object_keys(x))<>4 then return false; end if;
   if x->>'language' not in ('es','en','fr','val') or x->>'language'=any(langs) then return false; end if;
   langs:=array_append(langs,x->>'language');
   foreach k in array array['language','description','about','source'] loop
    if jsonb_typeof(x->k)<>'string' then return false; end if;
   end loop;
   if length(x->>'description')>500 or length(x->>'about')>3000 or length(x->>'source')>22000 or ((x->>'description')||(x->>'about')) ~ '[<>]' then return false; end if;
  end loop;
 end if;
 return true;
exception when others then return false;
end;
$$;

alter table public.businesses add column public_slug text;
alter table public.businesses add column public_profile jsonb not null default '{}'::jsonb;
alter table public.businesses add column cover_url text;
create unique index businesses_public_slug_unique on public.businesses(public_slug);

-- Stable deterministic backfill, resolving duplicates and reserved routes with
-- readable numeric suffixes. No UUID appears in the new URL.
do $$ declare rec record; base text; candidate text; suffix int; begin
 for rec in select id,slug,name from public.businesses order by created_at,id loop
  base:=public.cx_normalize_public_slug(coalesce(nullif(rec.slug,''),rec.name));
  if length(base)<3 or base ~ '[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}' then base:='restaurante'; end if;
  candidate:=base;suffix:=1;
  while not public.cx_public_slug_valid(candidate) or exists(select 1 from public.businesses where public_slug=candidate) loop
   suffix:=suffix+1;candidate:=left(base,60-length(suffix::text)-1)||'-'||suffix;
  end loop;
  update public.businesses set public_slug=candidate where id=rec.id;
 end loop;
end $$;
alter table public.businesses alter column public_slug set not null;
alter table public.businesses add constraint businesses_public_slug_safe check(public.cx_public_slug_valid(public_slug));
alter table public.businesses add constraint businesses_public_profile_safe check(public.cx_public_profile_valid(public_profile));
alter table public.businesses add constraint businesses_cover_safe check(cover_url is null or cover_url ~ ('^https://[a-zA-Z0-9.-]+/storage/v1/object/public/business-covers/'||id::text||'/[0-9a-f-]{36}\.webp$'));

create function public.cx_business_public_address() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare base text; candidate text; suffix int:=1;
begin
 if tg_op='UPDATE' then
  if new.public_slug is distinct from old.public_slug then raise exception 'La dirección de tu web es permanente para proteger los QR impresos' using errcode='23514'; end if;
 elsif new.public_slug is null then
  -- Serialize automatic allocation; explicit slugs are guarded by unique index.
  perform pg_advisory_xact_lock(71007001);
  base:=public.cx_normalize_public_slug(coalesce(nullif(new.slug,''),new.name));
  if length(base)<3 or base ~ '[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}' then base:='restaurante'; end if;
  candidate:=base;
  while not public.cx_public_slug_valid(candidate) or exists(select 1 from public.businesses where public_slug=candidate) loop
   suffix:=suffix+1;candidate:=left(base,60-length(suffix::text)-1)||'-'||suffix;
  end loop;
  new.public_slug:=candidate;
 end if;
 return new;
end $$;
revoke all on function public.cx_business_public_address() from public,anon,authenticated;
create trigger cx_business_public_address before insert or update of public_slug on public.businesses
 for each row execute function public.cx_business_public_address();
-- New columns inherit existing businesses RLS. Do not grant public table reads.
-- Constraint functions need execute when authenticated writes are checked.
revoke all on function public.cx_public_slug_valid(text),public.cx_normalize_public_slug(text),public.cx_public_profile_valid(jsonb) from public,anon;
grant execute on function public.cx_public_slug_valid(text),public.cx_normalize_public_slug(text),public.cx_public_profile_valid(jsonb) to authenticated,service_role;

-- A separate bucket prevents cover operations from touching logos/products.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('business-covers','business-covers',true,5242880,array['image/webp']) on conflict(id) do nothing;
create policy cx_cover_owner_insert on storage.objects for insert to authenticated with check(
 bucket_id='business-covers' and exists(select 1 from public.businesses b where b.id::text=(storage.foldername(storage.objects.name))[1] and b.owner_id=auth.uid())
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
create policy cx_cover_owner_select on storage.objects for select to authenticated using(
 bucket_id='business-covers' and exists(select 1 from public.businesses b where b.id::text=(storage.foldername(storage.objects.name))[1] and b.owner_id=auth.uid()));
create policy cx_cover_owner_delete on storage.objects for delete to authenticated using(
 bucket_id='business-covers' and exists(select 1 from public.businesses b where b.id::text=(storage.foldername(storage.objects.name))[1] and b.owner_id=auth.uid()));
-- No overwrite policy: every upload receives a new filename, then CAS updates reference.
commit;
