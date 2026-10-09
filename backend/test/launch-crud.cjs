// Real Express HTTP, mocked Supabase Auth/PostgREST. No remote services.
const assert=require('node:assert/strict');
(async()=>{
 const {safeEnv,fixture,ids}=await import('./helpers/audit-fixture.js');safeEnv();
 const {auditTransport}=await import('./helpers/audit-transport.js');const state=fixture();
 const transport=auditTransport(state),nativeFetch=global.fetch;global.fetch=transport.fetch;
 const {default:app}=await import('../src/app.js');const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;let count=0;
 async function req(method,path,body,expected=200,token='qa-a'){const r=await nativeFetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json();assert.equal(r.status,expected,method+' '+path+': '+JSON.stringify(data));count++;return data;}
 try{
 await req('PATCH','/api/businesses/'+ids.a1,{name:'QA Updated'});
 const menu=(await req('POST','/api/businesses/'+ids.a1+'/menus',{name:'QA Menu',slug:'qa-menu'},201)).menu;
 await req('GET','/api/menus/'+menu.id);await req('PATCH','/api/menus/'+menu.id,{name:'Updated menu'});
 const category=(await req('POST','/api/menus/'+menu.id+'/categories',{name:'QA Category'},201)).category;
 await req('PATCH','/api/categories/'+category.id,{name:'Updated category'});
 const product=(await req('POST','/api/businesses/'+ids.a1+'/products',{name:'QA Product',description:'QA',price:17.49},201)).product;
 await req('PATCH','/api/products/'+product.id,{price:0.01});
 await req('PUT','/api/products/'+product.id+'/allergens',{allergenIds:[1]});
 await req('POST','/api/categories/'+category.id+'/products',{productId:product.id},201);
 await req('DELETE','/api/products/'+product.id,undefined,409);
 await req('GET','/api/menus/'+menu.id+'/theme');await req('POST','/api/menus/'+menu.id+'/theme/publish');
 await req('PATCH','/api/menus/'+menu.id,{is_published:true});
 const pub=await req('GET','/api/public/menus/'+ids.a1+'/qa-menu',undefined,200,null);assert(JSON.stringify(pub).includes('QA Product'));
 await req('PATCH','/api/menus/'+menu.id,{is_published:false});await req('GET','/api/public/menus/'+ids.a1+'/qa-menu',undefined,404,null);
 await req('DELETE','/api/categories/'+category.id+'/products/'+product.id);await req('DELETE','/api/products/'+product.id);
 await req('DELETE','/api/categories/'+category.id);await req('DELETE','/api/menus/'+menu.id);
 for(const status of ['active','trialing','past_due','unpaid','paused','canceled','inactive']){
  Object.assign(state.subscriptions[0],{status,trial_ends_at:new Date(Date.now()+86400000).toISOString()});
  await req('GET','/api/businesses/'+ids.a1+'/menus',undefined,['active','trialing'].includes(status)?200:402);
 }
 await req('GET','/api/businesses/'+ids.b1+'/menus',undefined,403);
 console.log('PASS',count,'CRUD/publication/access HTTP checks; Auth and data MOCKED');
 }finally{await new Promise(r=>server.close(r));global.fetch=nativeFetch;}
})().catch(e=>{console.error(e.message);process.exitCode=1});
