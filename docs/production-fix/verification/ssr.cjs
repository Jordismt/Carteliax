// Production Nuxt build + HTTP fixture only. No live backend, Auth or Stripe.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fixture=require('../../microsites/verification/fixtures.cjs');
const root=path.resolve(__dirname,'../../..'),results=[];
const state=fixture.createState();state.micrositesEnabled=true;
state.businesses[0].public_slug='restaurante-jordi';state.menus.forEach(m=>m.is_published=true);
state.themeRecord.published_at=new Date().toISOString();
let requests=0,upstreamFailure=false;
async function unusedPort(){const server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
(async()=>{
 const api=http.createServer((req,res)=>{requests++;if(upstreamFailure){res.writeHead(500,{'Content-Type':'application/json'});res.end('{"private":"QA_PROVIDER_SECRET"}');return;}const r=fixture.response(state,req.url,req.method);res.writeHead(r.status,{'Content-Type':'application/json'});res.end(JSON.stringify(r.data));});
 await new Promise(r=>api.listen(0,'127.0.0.1',r));const apiBase='http://127.0.0.1:'+api.address().port;
 try {
  const inaccessible='http://127.0.0.1:'+await unusedPort();
  for(const [name,privateBase,publicBase,expected]of [
   ['only public URL', '', apiBase,200], ['private URL precedence',apiBase,inaccessible,200],
   ['explicit unreachable private URL',inaccessible,apiBase,502],['missing both URLs','','',503],
  ]) {
   const port=await unusedPort();
   const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:root+'/frontend',env:{...process.env,NODE_ENV:'production',NITRO_PORT:String(port),NUXT_API_BASE_URL:privateBase,NUXT_PUBLIC_API_URL:publicBase,NUXT_PUBLIC_SUPABASE_URL:apiBase,NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only'},stdio:['ignore','pipe','pipe']});
   let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
   const base='http://127.0.0.1:'+port;
   const check=async(route,status)=>{const r=await fetch(base+route,{redirect:'manual'}),body=await r.text();assert.equal(r.status,status,`${name} ${route}`);assert(!body.includes('QA_PROVIDER_SECRET'));results.push({scenario:name,route,status:r.status,pass:true});return {r,body};};
   try {
    let ready=false;for(let i=0;i<100;i++){if(log.includes('Listening on')){ready=true;break;}if(child.exitCode!==null)throw Error('Nuxt exited');await new Promise(r=>setTimeout(r,100));}assert(ready,'Nuxt start timeout');
    await check('/',200);
    const before=requests;await check('/api/public/sites/restaurante-jordi',expected);await check('/restaurante-jordi',expected);
    if(expected!==200)assert.equal(requests,before,'unavailable/missing private configuration must not call the public fixture');
    if(expected===200){
     const html=await check('/restaurante-jordi?menu='+state.menus[0].slug+'&lang=en#carta',200);assert(html.body.includes('application/ld+json'));assert(html.body.includes('rel="canonical"'));assert(html.body.includes(state.businesses[0].name));
     await check('/restaurante-inexistente',404);await check('/api/public/sites/restaurante-inexistente',404);
     const count=requests;await check('/api/public/sites/Invalid_Slug',404);assert.equal(requests,count);
     const legacy=await check('/c/'+state.businesses[0].id+'/'+state.menus[0].slug+'?lang=en',302);assert(legacy.r.headers.get('location').includes('/restaurante-jordi?menu='));
     for(const template of ['modern','elegant','minimal','classic']){state.businesses[0].public_profile={...state.businesses[0].public_profile,template};await check('/restaurante-jordi',200);}
     upstreamFailure=true;await check('/api/public/sites/restaurante-jordi',502);await check('/restaurante-jordi',502);upstreamFailure=false;
    }
    assert(!log.includes('QA_PROVIDER_SECRET'));
   } finally {upstreamFailure=false;child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
  }
 } finally {await new Promise(r=>api.close(r));}
 fs.writeFileSync(__dirname+'/ssr.json',JSON.stringify({type:'PRODUCTION_NUXT_LOCAL_HTTP_FIXTURE',pass:true,requests,results},null,2));console.log('PASS',results.length,'SSR checks');
})().catch(e=>{console.error(e);process.exitCode=1});
