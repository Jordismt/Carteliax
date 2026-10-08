import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { safeEnv, fixture, ids, response } from './helpers/audit-fixture.js';
import { auditTransport } from './helpers/audit-transport.js';
safeEnv();
const { uploadProductImage } = await import('../src/modules/productImages/productImageController.js');
const image = await sharp({create:{width:4,height:4,channels:3,background:'#ffffff'}}).png().toBuffer();
test('image writes survive ambiguous database replies without deleting committed objects', async t => {
 for (const uncertainRead of [false,true]) await t.test(uncertainRead ? 'unknown read preserves file' : 'confirmed committed upload succeeds', async t => {
  const state=fixture(); let committed=false, deletes=0, uploads=0;
  const transport=auditTransport(state,{onMutation:({table,method})=>{
   if(table==='products'&&method==='PATCH'){committed=true;return new Response(JSON.stringify({code:'QA_LOST_REPLY'}),{status:503});}
  },storage:({method},json)=>{if(method==='POST')uploads++;if(method==='DELETE')deletes++;return json({Key:'fixture'});}});
  t.mock.method(globalThis,'fetch',async (...args)=>{
   if(uncertainRead&&committed&&String(args[0]).includes('/rest/v1/products'))return new Response(JSON.stringify({code:'QA_OFFLINE'}),{status:503});
   return transport.fetch(...args);
  });
  let failure;const res=response();await uploadProductImage({params:{id:ids.pa1},user:{id:ids.a},accessToken:'qa-a',file:{buffer:image}},res,e=>{failure=e;});
  assert.equal(uploads,1);assert.equal(deletes,0);assert.match(state.products[0].image_url,/\.webp$/);
  if(uncertainRead)assert(failure);else{assert.equal(failure,undefined);assert.equal(res.body.success,true);assert.equal(res.body.product.image_url,state.products[0].image_url);}
 });
 await t.test('forged MIME cannot turn arbitrary bytes into an accepted image',async t=>{
  const state=fixture();let storageCalls=0;const transport=auditTransport(state,{storage:(_,json)=>{storageCalls++;return json({});}});t.mock.method(globalThis,'fetch',transport.fetch);
  const res=response();await uploadProductImage({params:{id:ids.pa1},user:{id:ids.a},accessToken:'qa-a',file:{buffer:Buffer.from('<script>not an image</script>'),mimetype:'image/png'}},res,e=>{throw e;});
  assert.equal(res.statusCode,400);assert.equal(storageCalls,0);assert.equal(state.products[0].image_url,null);
 });
});
