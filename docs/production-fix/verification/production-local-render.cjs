// Corrected local frontend -> real published public API, read-only.
// No accounts, mutation, checkout, database/Stripe credentials or deployment.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
(async()=>{
 const server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const child=spawn(process.execPath,['.output/server/index.mjs'],{cwd:path.resolve(__dirname,'../../../frontend'),env:{...process.env,NODE_ENV:'production',NITRO_PORT:String(port),NUXT_API_BASE_URL:'',NUXT_PUBLIC_API_URL:'https://carteliax-api.vercel.app',NUXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only'},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 try {
  let ready=false;for(let i=0;i<100;i++){if(log.includes('Listening on')){ready=true;break;}if(child.exitCode!==null)throw Error('LOCAL_START_FAILED');await new Promise(r=>setTimeout(r,100));}assert(ready);
  const base='http://127.0.0.1:'+port;const results=[];
  for(const [route,expected]of [['/restaurante-jordi',200],['/qa-no-existe-20261008',404]]){
   const r=await fetch(base+route,{signal:AbortSignal.timeout(20000)});const html=await r.text();assert.equal(r.status,expected);
   if(expected===200){assert(html.includes('application/ld+json'));assert(html.includes('restaurant-site'));assert(!html.includes('Esta web no está disponible.'));}
   results.push({route,status:r.status,hasSSRRestaurant:html.includes('restaurant-site')});
  }
  const artifact={type:'LOCAL_PRODUCTION_BUILD_REAL_PUBLIC_BACKEND_READ_ONLY',pass:true,results,backend:'https://carteliax-api.vercel.app',supabaseAuth:'fixture-only, not exercised',frontendDeployed:false,privateApiConfigured:false};
  fs.writeFileSync(__dirname+'/production-local-render.json',JSON.stringify(artifact,null,2));console.log(JSON.stringify(artifact,null,2));
 } finally {child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
})().catch(e=>{console.error(JSON.stringify({type:'LOCAL_RENDER_FAILED',code:e.code??e.name}));process.exitCode=1});
