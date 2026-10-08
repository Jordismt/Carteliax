// Exercises the actual Nitro Vercel handler on local Node HTTP, with fixtures.
// Does not reproduce Vercel infrastructure or deploy the generated output.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const fixture=require('../../microsites/verification/fixtures.cjs');
(async()=>{
 const state=fixture.createState();state.micrositesEnabled=true;state.businesses[0].public_slug='restaurante-jordi';state.menus.forEach(m=>m.is_published=true);state.themeRecord.published_at=new Date().toISOString();
 const api=http.createServer((req,res)=>{const r=fixture.response(state,req.url);res.writeHead(r.status,{'Content-Type':'application/json'});res.end(JSON.stringify(r.data));});await new Promise(r=>api.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+api.address().port;
 Object.assign(process.env,{NUXT_API_BASE_URL:'',NUXT_PUBLIC_API_URL:base,NUXT_PUBLIC_SUPABASE_URL:base,NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-only'});
 let server;
 try {
  const {default:handler}=await import(pathToFileURL(path.resolve(__dirname,'../../../frontend/.vercel/output/functions/__fallback.func/index.mjs')));
  assert.equal(typeof handler,'function');server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port;const results=[];
  for(const [route,expected]of [['/restaurante-jordi',200],['/restaurante-inexistente',404],['/api/public/sites/restaurante-jordi',200],['/c/'+state.businesses[0].id+'/'+state.menus[0].slug,302]]){
   const r=await fetch(url+route,{redirect:'manual',headers:{Accept:'text/html'}});const body=await r.text();assert.equal(r.status,expected,route);if(route==='/restaurante-jordi')assert(body.includes('restaurant-site'));results.push({route,status:r.status,pass:true});
  }
  fs.writeFileSync(__dirname+'/vercel-handler.json',JSON.stringify({type:'LOCAL_GENERATED_VERCEL_HANDLER_FIXTURE',pass:true,node:process.version,deployed:false,results},null,2));console.log('PASS',results.length,'generated Vercel handler checks');
 } finally {if(server)await new Promise(r=>server.close(r));await new Promise(r=>api.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
