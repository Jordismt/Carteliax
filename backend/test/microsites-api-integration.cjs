// Real Express -> controllers -> repositories -> PostgreSQL integration.
// Only Supabase auth/PostgREST transport and the AI provider are test adapters.
// Refuses non-fixture PostgreSQL and NEVER forwards a request to Groq/Supabase.
const {execFile}=require('node:child_process');const {promisify}=require('node:util');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');const path=require('node:path');
const execute=promisify(execFile),root=path.resolve(__dirname,'..');
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',menu='33333333-3333-4333-8333-333333333333';
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const guard="DO $$BEGIN IF current_setting('port')<>'55432' OR current_setting('data_directory') NOT LIKE '/tmp/carteliax-languages/%' THEN RAISE EXCEPTION 'Disposable fixture required';END IF;END$$;";
async function sql(query){const r=await execute('psql',['-XAt','-h','/tmp/carteliax-languages','-p','55432','-d','carteliax_delivery','-v','ON_ERROR_STOP=1','-c',guard+query]);return r.stdout.trim().split('\n').filter(l=>l!=='DO').join('\n');}
async function main(){
 await sql("DELETE FROM menu_translation_jobs; DELETE FROM menu_languages WHERE menu_id='33333333-3333-4333-8333-333333333333'; ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url text; ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0; ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text; ALTER TABLE category_products ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0; CREATE TABLE IF NOT EXISTS allergens(id integer PRIMARY KEY,code text,name_es text); CREATE TABLE IF NOT EXISTS product_allergens(product_id uuid,allergen_id integer); INSERT INTO allergens SELECT 1,'gluten','Cereales con gluten' WHERE NOT EXISTS(SELECT 1 FROM allergens WHERE id=1); INSERT INTO product_allergens SELECT '77777777-7777-4777-8777-777777777777',1 WHERE NOT EXISTS(SELECT 1 FROM product_allergens);");
 process.chdir(root);process.env.TRANSLATIONS_ENABLED='true';process.env.MICROSITES_ENABLED='true';process.env.GROQ_API_KEY='test-only-never-sent-to-groq';
 const nativeFetch=globalThis.fetch;let unexpected=0;
 const tables=new Set(['menus','businesses','subscriptions','menu_themes','categories','products','category_products','allergens','product_allergens']);
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url??String(input));
  if(url.hostname==='127.0.0.1'&&url.port==='5065')return nativeFetch(input,options);
  if(url.pathname.endsWith('/auth/v1/user')){const headers=new Headers(options.headers);const token=headers.get('authorization')?.replace('Bearer ','');if(!['qa-owner','qa-foreign'].includes(token))return json({message:'Invalid test token'},401);return json({id:token==='qa-owner'?owner:foreign,aud:'authenticated',role:'authenticated'});}
  try{
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    const name=url.pathname.split('/').at(-1);assert(/^cx_(?:translation_|public_translations)/.test(name));
    const args=JSON.parse(options.body??'{}');const params=Object.entries(args).map(([k,v])=>{assert(/^p_[a-z_]+$/.test(k));return `${k} => ${v===null?'NULL':typeof v==='boolean'||typeof v==='number'?String(v):quote(typeof v==='object'?JSON.stringify(v):v)}`}).join(',');
    return json(JSON.parse(await sql(`SELECT to_jsonb(public.${name}(${params}));`)));
   }
   if(url.pathname.startsWith('/rest/v1/')){
    const table=url.pathname.split('/').at(-1);assert(tables.has(table));
    const requested=url.searchParams.get('select')??'*';
    const nested=requested.includes('menu_themes(');const columns=nested?['id','name','slug','sort_order', '(select to_jsonb(mt) from menu_themes mt where mt.menu_id=menus.id) as menu_themes']:requested.split(',');
    if(!nested)assert(columns.every(c=>c==='*'||/^[a-z_]+$/.test(c)));
    const conditions=[];for(const [k,v]of url.searchParams){if(['select','order','limit'].includes(k))continue;assert(/^[a-z_]+$/.test(k));if(v.startsWith('eq.'))conditions.push(`${k}=${quote(v.slice(3))}`);else if(v.startsWith('in.('))conditions.push(`${k} IN (${v.slice(4,-1).split(',').map(x=>quote(x.replace(/^"|"$/g,''))).join(',')})`);else throw Error('Unexpected test filter');}
    const query=`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT ${columns.join(',')} FROM ${table}${conditions.length?' WHERE '+conditions.join(' AND '):''}) t;`;
    const data=JSON.parse(await sql(query));const accept=new Headers(options.headers).get('accept')??'';return json(accept.includes('vnd.pgrst.object')?(data[0]??null):data);
   }
   unexpected++;throw Error('External request forbidden in integration test');
  }catch(e){return json({message:e.stderr?.match(/ERROR:\s*(.*)/)?.[1]??'Local database adapter error',code:'P0001',details:null,hint:null},400)}
 };
 const {default:app}=await import(pathToFileURL(path.join(root,'src/app.js')));
 const {supabaseAdmin}=await import(pathToFileURL(path.join(root,'src/infrastructure/database/supabase.js')));
 const {TranslationRepository}=await import(pathToFileURL(path.join(root,'src/modules/translations/translationRepository.js')));
 const {createTranslationWorker}=await import(pathToFileURL(path.join(root,'src/modules/translations/translationWorker.js')));
 const server=await new Promise(resolve=>{const s=app.listen(5065,'127.0.0.1',()=>resolve(s))});

 async function request(route,method='GET',body,token='qa-owner') { const r=await fetch('http://127.0.0.1:5065'+route,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}; }
 const business='11111111-1111-4111-8111-111111111111';
 try {
  const site=await request('/api/public/sites/restaurante-jordi');assert.equal(site.status,200);assert.equal(site.data.menus.length,1);assert.equal(site.data.currentMenu.menu.slug,'principal');assert.equal(site.data.business.public_slug,'restaurante-jordi');assert(!site.data.business.owner_id);console.log('PASS Real microsite controller reads existing restaurant and published menu only');
  const legacy=await request(`/api/public/menus/${business}/principal`);assert.equal(legacy.status,200);assert.equal(legacy.data.business.public_slug,'restaurante-jordi');assert.deepEqual(site.data.currentMenu.categories,legacy.data.categories);assert.deepEqual(site.data.currentMenu.languages,legacy.data.languages);console.log('PASS Old and new endpoints share categories, prices, allergens and persisted languages');
  assert.equal((await request('/api/public/sites/login')).status,404);assert.equal((await request('/api/public/sites/unknown-restaurant')).status,404);assert.equal((await request('/api/public/sites/restaurante-jordi?menu=missing')).status,404);assert.equal((await request('/api/public/sites/restaurante-jordi?menu=a&menu=b')).status,404);console.log('PASS Reserved route, unknown restaurant, missing menu and array query safely rejected');
  await sql("INSERT INTO menus(id,business_id,name,slug,is_published,sort_order) VALUES('99999999-9999-4999-8999-999999999999','11111111-1111-4111-8111-111111111111','Bebidas','bebidas',true,1); INSERT INTO menu_themes(menu_id,published_config,published_at) VALUES('99999999-9999-4999-8999-999999999999','{\"branding\":{\"welcomeText\":\"Bebidas\"}}',now());");
  const multi=await request('/api/public/sites/restaurante-jordi?menu=bebidas');assert.equal(multi.status,200);assert.equal(multi.data.menus.length,2);assert.equal(multi.data.currentMenu.menu.slug,'bebidas');console.log('PASS Multiple published menus and clean specific selection');
  await sql("UPDATE menus SET is_published=false WHERE id='99999999-9999-4999-8999-999999999999';");assert.equal((await request('/api/public/sites/restaurante-jordi?menu=bebidas')).status,404);console.log('PASS Withdrawn specific menu never exposes unpublished content');
  const countBefore=await sql('select count(*) from menu_translation_jobs');for(let i=0;i<100;i++)assert.equal((await request('/api/public/sites/restaurante-jordi')).status,200);assert.equal(await sql('select count(*) from menu_translation_jobs'),countBefore);assert.equal(unexpected,0);console.log('PASS 100 full microsite reads create zero jobs and zero external requests');
  assert.equal((await request(`/api/businesses/${business}`,'PATCH',{public_profile:{about:'Foreign'}},'qa-foreign')).status,403);
  assert.equal((await request(`/api/businesses/${business}/cover`,'POST',{},'qa-foreign')).status,403);
  assert.equal((await request(`/api/businesses/${business}/cover`,'POST',{})).status,400);
  assert.equal((await request(`/api/businesses/${business}`,'PATCH',{public_slug:'stolen-address'})).status,400);
  assert.equal((await request(`/api/businesses/${business}`,'PATCH',{public_profile:{about:'<script>unsafe</script>'}})).status,400);
  assert.equal((await request('/api/businesses','POST',{name:'Login',slug:'login',public_slug:'login'})).status,400);console.log('PASS HTTP ownership, immutable address, HTML and reserved creation rejected');
  const {env}=await import(pathToFileURL(path.join(root,'src/config/env.js')));env.MICROSITES_ENABLED=false;
  assert.equal((await request('/api/public/sites/restaurante-jordi')).status,404);
  const disabled=await request(`/api/public/menus/${business}/principal`);assert.equal(disabled.status,200);assert.equal(disabled.data.business.public_slug,undefined);
  const ownerBusiness=await request(`/api/businesses/${business}`);assert.equal(ownerBusiness.status,200);assert.equal(ownerBusiness.data.business.public_slug,undefined);console.log('PASS Disabled rollout preserves old URLs and keeps clean QR links inactive');env.MICROSITES_ENABLED=true;
 } finally { server.close();globalThis.fetch=nativeFetch;await sql("DELETE FROM menu_language_settings WHERE menu_id='99999999-9999-4999-8999-999999999999';DELETE FROM menu_themes WHERE menu_id='99999999-9999-4999-8999-999999999999';DELETE FROM menus WHERE id='99999999-9999-4999-8999-999999999999';"); }
}
main().catch(e=>{console.error(e);process.exitCode=1});
