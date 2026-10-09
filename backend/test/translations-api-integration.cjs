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
 process.chdir(root);process.env.TRANSLATIONS_ENABLED='true';process.env.GROQ_API_KEY='test-only-never-sent-to-groq';
 const nativeFetch=globalThis.fetch;let unexpected=0,ai=0,releaseProvider;
 const providerGate=new Promise(resolve=>{releaseProvider=resolve});
 const tables=new Set(['menus','businesses','subscriptions','menu_themes','categories','products','category_products','allergens','product_allergens']);
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url??String(input));
  if(url.hostname==='127.0.0.1'&&url.port==='5065')return nativeFetch(input,options);
  if(url.pathname.endsWith('/auth/v1/user')){const headers=new Headers(options.headers);const token=headers.get('authorization')?.replace('Bearer ','');if(!['qa-owner','qa-foreign'].includes(token))return json({message:'Invalid test token'},401);return json({id:token==='qa-owner'?owner:foreign,aud:'authenticated',role:'authenticated'});}
  if(url.hostname==='api.groq.com'&&url.pathname==='/openai/v1/chat/completions'){
   ai++;await providerGate;const payload=JSON.parse(options.body),items=JSON.parse(payload.messages[1].content).items;
   return json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({language:payload.response_format.json_schema.schema.properties.language.enum[0],items:items.map(i=>({...i,name:'EN '+i.name}))})}}]});
  }
  try{
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    const name=url.pathname.split('/').at(-1);assert(/^cx_(?:translation_|public_translations)/.test(name));
    const args=JSON.parse(options.body??'{}');const params=Object.entries(args).map(([k,v])=>{assert(/^p_[a-z_]+$/.test(k));return `${k} => ${v===null?'NULL':typeof v==='boolean'||typeof v==='number'?String(v):quote(typeof v==='object'?JSON.stringify(v):v)}`}).join(',');
    return json(JSON.parse(await sql(`SELECT to_jsonb(public.${name}(${params}));`)));
   }
   if(url.pathname.startsWith('/rest/v1/')){
    const table=url.pathname.split('/').at(-1);assert(tables.has(table));
    const columns=(url.searchParams.get('select')??'*').split(',');assert(columns.every(c=>c==='*'||/^[a-z_]+$/.test(c)));
    const conditions=[];for(const [k,v]of url.searchParams){if(['select','order','limit'].includes(k))continue;assert(/^[a-z_]+$/.test(k));if(v.startsWith('eq.'))conditions.push(`${k}=${quote(v.slice(3))}`);else if(v.startsWith('in.('))conditions.push(`${k} IN (${v.slice(4,-1).split(',').map(x=>quote(x.replace(/^"|"$/g,''))).join(',')})`);else throw Error('Unexpected test filter');}
    const query=`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT ${columns.join(',')} FROM ${table}${conditions.length?' WHERE '+conditions.join(' AND '):''}) t;`;
    const data=JSON.parse(await sql(query));const accept=new Headers(options.headers).get('accept')??'';return json(accept.includes('vnd.pgrst.object')?(data[0]??null):data);
   }
   unexpected++;throw Error('External request forbidden in integration test');
  }catch(e){return json({message:e.stderr?.match(/ERROR:\s*(.*)/)?.[1]??'Local database adapter error',code:'P0001',details:null,hint:null},400)}
 };
 const {default:app}=await import(pathToFileURL(path.join(root,'src/app.js')));
 const {supabaseAdmin}=await import(pathToFileURL(path.join(root,'src/infrastructure/database/supabase.js')));
 const {translationWorker:worker}=await import(pathToFileURL(path.join(root,'src/modules/translations/translationRuntime.js')));
 const server=await new Promise(resolve=>{const s=app.listen(5065,'127.0.0.1',()=>resolve(s))});
 async function request(route,method='GET',body,token='qa-owner'){const response=await fetch('http://127.0.0.1:5065'+route,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:response.status,data:await response.json()}}
 const base=`/api/menus/${menu}/languages`;
 try{
  assert.equal((await request(base,'GET',undefined,'qa-foreign')).status,403);console.log('PASS Real Express rejects foreign owner');
  const current=await request(base);assert.equal(current.status,200);assert.equal(current.data.items.length,3);console.log('PASS Real private status reads PostgreSQL');
  assert.equal((await request(base+'/en/translate','POST',{prompt:'arbitrary'})).status,400);
  assert.equal((await request(base+'/zz/translate','POST',{})).status,400);console.log('PASS Strict HTTP payload and registry validation');
  assert.equal((await request(base+'/en/translate','POST',{})).status,202);
  assert.equal((await request(base+'/fr/translate','POST',{})).status,409);releaseProvider();await worker.tick();assert.equal(ai,1);console.log('PASS HTTP enqueue starts runtime worker -> atomic PostgreSQL persistence');
  const saved=await request(base);assert.equal(saved.data.job.status,'completed');const product=saved.data.translations.find(t=>t.language==='en').items.find(i=>i.type==='product');assert(product.draft);
  assert.equal((await request(base+'/en/publish','POST',{})).status,200);
  const route='/api/public/menus/11111111-1111-4111-8111-111111111111/principal';
  const first=await request(route);assert.equal(first.status,200);assert(first.data.languages.translations.en.length===3);console.log('PASS Real public controller reads only persisted published texts');
  for(let i=0;i<20;i++){const r=await request(route);assert.equal(r.status,200)}assert.equal(ai,1);console.log('PASS 20 complete public API reads trigger zero provider calls');
  const manual={type:'product',id:product.id,name:'Hand corrected paella for 2',description:'Reviewed ingredients',welcome_text:'',sourceHash:product.source_hash,revision:product.draft.revision};
  assert.equal((await request(base+'/en/text','PUT',manual)).status,200);assert.equal(ai,1);
  assert.equal((await request(base+'/en/text','PUT',manual)).status,409);console.log('PASS Manual HTTP save uses no AI; stale revision rejected');
  await sql("UPDATE products SET name='Paella doble para 2 personas' WHERE id='77777777-7777-4777-8777-777777777777';");
  const stale=await request(base);assert.equal(stale.data.languages.find(l=>l.code==='en').manualStale,1);
  const publicStale=await request(route);assert.equal(publicStale.data.languages.translations.en.filter(i=>i.type==='product').length,0);console.log('PASS Original modification -> stale -> safe public fallback');
  await sql("UPDATE subscriptions SET status='past_due';");const blocked=await request(base);assert.equal(blocked.status,402);assert.equal(blocked.data.code,'SUBSCRIPTION_REQUIRED');console.log('PASS Existing subscription middleware blocks translation access');
  assert.equal(unexpected,0);console.log('PASS No request reached external Supabase or Groq');
 }finally{server.close();globalThis.fetch=nativeFetch;await sql("UPDATE subscriptions SET status='active'; UPDATE products SET name='Paella para 2 personas' WHERE id='77777777-7777-4777-8777-777777777777';");}
}
main().catch(e=>{console.error(e);process.exitCode=1});
