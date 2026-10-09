// Real Express/Supabase SDK/RPC/PostgreSQL. Hosted Auth and Groq are simulated.
const assert=require('node:assert/strict');
const {sql,quote}=require('./helpers/guarded-postgres.cjs');
(async()=>{
 const {safeEnv}=await import('./helpers/audit-fixture.js');safeEnv();process.env.TRANSLATIONS_ENABLED='true';
 const {gastronomicCorpus}=await import('./fixtures/gastronomic-corpus.js');
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',business='11111111-1111-4111-8111-111111111111',menu=gastronomicCorpus('es')[0].id;
 const nativeFetch=global.fetch;let aiCalls=0,external=0;
 const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
 global.fetch=async(input,options={})=>{
  const url=new URL(typeof input==='string'?input:input.url),headers=new Headers(options.headers??input.headers),method=options.method??input.method??'GET';
  const token=headers.get('authorization')?.replace(/^Bearer /,'');
  if(url.hostname==='api.groq.com') {
   aiCalls++;const body=JSON.parse(options.body),target=body.response_format.json_schema.schema.properties.language.enum[0],items=JSON.parse(body.messages[1].content).items;
   const known=gastronomicCorpus(target).map(item=>({...item,id:item.type==='restaurant'?business:item.id}));
   const translated=items.map(item=>{const t=known.find(candidate=>candidate.type===item.type&&candidate.id===item.id);assert(t);const {type,id,name,description,welcome_text}=t;return{type,id,name,description,welcome_text}});
   return response({choices:[{finish_reason:'stop',message:{content:JSON.stringify({language:target,items:translated})}}]});
  }
  if(url.hostname!=='fixture.invalid'){external++;throw Error('External services forbidden in fixture integration');}
  if(url.pathname==='/auth/v1/user')return ['qa-owner','qa-foreign'].includes(token)?response({id:token==='qa-owner'?owner:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',aud:'authenticated',role:'authenticated'}):response({message:'Invalid fixture token'},401);
  const role=token==='fixture-service'?'service_role':'authenticated',actor=token==='qa-owner'?owner:token==='qa-foreign'?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'';
  try {
   if(url.pathname.startsWith('/rest/v1/rpc/')) {
    const name=url.pathname.split('/').at(-1);assert(/^cx_(translation_|public_)/.test(name));
    const body=JSON.parse(options.body??'{}');
    const args=Object.entries(body).map(([key,value])=>{assert(/^p_[a-z_]+$/.test(key));return `${key}=>${quote(value)}`}).join(',');
    return response(JSON.parse(sql(`SELECT coalesce(to_jsonb(public.${name}(${args})),'null'::jsonb)`,role,actor)));
   }
   assert.equal(method,'GET');const table=url.pathname.split('/').at(-1);assert(['businesses','menus','menu_themes','categories','products','subscriptions','category_products','allergens','product_allergens','menu_translation_jobs'].includes(table));
   let columns=(url.searchParams.get('select')??'*').replace(/\s/g,'');
   const nested=columns.includes('menu_themes(');
   if(nested)columns=columns.replace(',menu_themes(published_at,published_config)',', (select to_jsonb(mt) from menu_themes mt where mt.menu_id=menus.id) as menu_themes');
   else assert(/^[a-z_,*]+$/.test(columns));
   const conditions=[];
   for(const [key,value]of url.searchParams) {
    if(['select','order','limit'].includes(key))continue;assert(/^[a-z_]+$/.test(key));
    if(value.startsWith('eq.'))conditions.push(`${key}=${quote(value.slice(3))}`);
    else if(value.startsWith('in.('))conditions.push(`${key} IN (${value.slice(4,-1).split(',').map(value=>quote(value.replace(/^"|"$/g,''))).join(',')})`);
    else throw Error('Unexpected fixture filter');
   }
   let order=url.searchParams.get('order');if(order){assert(/^[a-z_.:,]+$/.test(order));order=order.split(',').map(value=>value.split('.')[0]+(value.includes('.desc')?' DESC':' ASC')).join(',')}
   const limit=url.searchParams.get('limit');if(limit)assert(/^\d+$/.test(limit));
   const rows=JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT ${columns} FROM ${table}${conditions.length?' WHERE '+conditions.join(' AND '):''}${order?' ORDER BY '+order:''}${limit?' LIMIT '+limit:''}) t`,role,actor));
   return response(headers.get('accept')?.includes('vnd.pgrst.object')?(rows[0]??null):rows);
  }catch(error){return response({code:'P0001',message:error.stderr?.toString().match(/ERROR:\s*(.*)/)?.[1]??'Fixture SQL error'},400)}
 };
 const {default:app}=await import('../src/app.js');
 const {translationWorker}=await import('../src/modules/translations/translationRuntime.js');
 const server=app.listen(5088,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 async function request(path,method='GET',body,token='qa-owner') {
  const r=await nativeFetch('http://127.0.0.1:5088'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return{status:r.status,data:await r.json()};
 }
 try {
  const base=`/api/menus/${menu}/languages`;
  assert.equal((await request(base,'GET',undefined,'qa-foreign')).status,403);
  assert.equal((await request(base+'/en/translate','POST',{replaceManual:true})).status,400);
  const started=await request(base+'/en/translate','POST',{regenerate:true});assert.equal(started.status,202,JSON.stringify(started.data));
  await translationWorker.tick();
  const status=await request(base);assert.equal(status.status,200);assert.equal(status.data.job.status,'completed',JSON.stringify(status.data));assert.equal(aiCalls,1);
  assert.equal((await request(base+'/en/publish','POST',{})).status,200);
  for(const language of ['es','val','en','fr']) {
   const pub=await request(`/api/public/menus/${business}/quality`,'GET',undefined,null);assert.equal(pub.status,200);
   assert.equal(pub.data.languages.translations[language].length,13);
  }
  const site=await request('/api/public/sites/restaurante-jordi?menu=quality','GET',undefined,null);assert.equal(site.status,200,JSON.stringify(site.data));
  assert.equal(site.data.menus.find(menu=>menu.slug==='quality').translated_names.fr,'Carte de saison');
  assert.equal(aiCalls,1);assert.equal(external,0);
  console.log('PASS real Express -> SDK -> PostgreSQL: protected regeneration, completed worker, publish, four public languages, translated navigation; Auth/Groq SIMULATED');
  if(process.env.QA_KEEP_API==='1')console.log('READY readonly fixture API http://127.0.0.1:5088');
 }finally{if(process.env.QA_KEEP_API!=='1'){await new Promise(resolve=>server.close(resolve));global.fetch=nativeFetch;}}
})().catch(error=>{console.error(error.stack);process.exitCode=1;setTimeout(()=>process.exit(1),100)});
