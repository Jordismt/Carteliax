// Real Express/HTTP and JWT rejection; no remote services or real credentials.
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {safeEnv}=await import('../../../backend/test/helpers/audit-fixture.js');safeEnv();
 const {default:app}=await import('../../../backend/src/app.js');
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base='http://127.0.0.1:'+server.address().port,results=[];
 try {
  for(const origin of ['https://www.carteliax.com','https://carteliax.com','https://evil.example']) {
   const allowed=origin!=='https://evil.example';
   const r=await fetch(base+'/api/businesses',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,content-type'}});
   assert.equal(r.headers.get('access-control-allow-origin'),allowed?origin:null);
   if(allowed){assert.equal(r.status,204);assert(r.headers.get('access-control-allow-headers').includes('authorization'));}
   results.push({operation:'OPTIONS /api/businesses',origin,status:r.status,allowed,pass:true});
   const get=await fetch(base+'/api/businesses',{headers:{Origin:origin}});
   assert.equal(get.status,401);assert.equal(get.headers.get('access-control-allow-origin'),allowed?origin:null);
   results.push({operation:'GET /api/businesses without JWT',origin,status:get.status,allowed,pass:true});
  }
  const health=await fetch(base+'/api/health');assert.equal(health.status,200);assert.equal((await health.json()).status,'online');
  const unsigned=await fetch(base+'/api/subscriptions/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(unsigned.status,400);
  results.push({operation:'GET health without Origin',status:200,pass:true},{operation:'unsigned webhook rejected',status:400,pass:true});
  fs.writeFileSync(__dirname+'/cors-http.json',JSON.stringify({type:'REAL_LOCAL_HTTP_NO_REMOTE_SERVICES',results},null,2));
  console.log('PASS',results.length,'HTTP/CORS checks');
 } finally {await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
