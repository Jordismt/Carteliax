// Read-only public requests. Never logs response content or credentials.
const fs=require('node:fs');
(async()=>{
 const results=[];
 for(const url of ['https://www.carteliax.com/','https://www.carteliax.com/restaurante-jordi','https://www.carteliax.com/api/public/sites/restaurante-jordi','https://carteliax-api.vercel.app/api/health','https://carteliax-api.vercel.app/api/public/sites/restaurante-jordi']) {
  const start=Date.now();const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{}
  results.push({url,status:response.status,durationMs:Date.now()-start,...(data?{success:data.success,hasBusiness:!!data.business,statusCode:data.statusCode}:{}),...(url.endsWith('/restaurante-jordi')&&!url.includes('/api/')?{applicationUnavailableMessage:text.includes('Esta web no está disponible.')}:{} )});
 }
 for(const origin of ['https://www.carteliax.com','https://carteliax.com','https://evil.example']) {
  const response=await fetch('https://carteliax-api.vercel.app/api/businesses',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,content-type'},signal:AbortSignal.timeout(20000)});
  results.push({operation:'OPTIONS /api/businesses',origin,status:response.status,allowOrigin:response.headers.get('access-control-allow-origin'),allowHeaders:response.headers.get('access-control-allow-headers')});
 }
 fs.writeFileSync(__dirname+'/production-readonly.json',JSON.stringify({type:'REAL_PRODUCTION_PUBLIC_READ_ONLY',checkedAt:new Date().toISOString(),deployedChanges:false,results},null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(JSON.stringify({type:'READ_ONLY_REQUEST_FAILED',code:e.cause?.code??e.name}));process.exitCode=1});
