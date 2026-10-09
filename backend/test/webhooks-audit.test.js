import test from 'node:test';import assert from 'node:assert/strict';import {safeEnv,ids,response,fixture,memoryDb} from './helpers/audit-fixture.js';safeEnv();
const {stripe}=await import('../src/modules/subscriptions/stripeService.js');const {supabaseAdmin}=await import('../src/infrastructure/database/supabase.js');const {stripeWebhook}=await import('../src/modules/subscriptions/stripeWebhookController.js');
const sub={id:'sub_fixture',livemode:false,customer:'cus_fixture',status:'active',metadata:{business_id:ids.a1,owner_id:ids.a,checkout_attempt_id:'attempt'},items:{data:[{price:{id:'price_fixture'},quantity:1,current_period_end:2000000000}]},trial_end:1900000000};
const rpc = fn => async (name,args) => name === 'cx_acquire_billing_sync' ? {data:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',error:null} : name === 'cx_release_billing_sync' ? {error:null} : fn(name,args);
const signed=(type,object)=>{const body=Buffer.from(JSON.stringify({id:'evt_fixture',type,created:1800000000,livemode:false,data:{object}}));return {body,headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload:body.toString(),secret:'whsec_fixture'})}};};
test('signed webhook HTTP controller validation and failure semantics (SDK real, remote calls mocked)',async t=>{
t.mock.method(supabaseAdmin,'from',memoryDb(fixture()).from);
 await t.test('uses authoritative current Stripe state, dates and service transaction',async t=>{t.mock.method(stripe.subscriptions,'retrieve',async()=>sub);let args;t.mock.method(supabaseAdmin,'rpc',rpc(async(name,data)=>{assert.equal(name,'cx_sync_billing_event');args=data;return {error:null};}));const res=response();await stripeWebhook(signed('customer.subscription.updated',{...sub,status:'trialing',trial_end:1}),res);assert.equal(res.statusCode,200);assert.equal(args.p_payload.status,'active');assert.equal(args.p_payload.trial_ends_at,new Date(1900000000000).toISOString());});
 await t.test('database outage returns 500 so Stripe can retry',async t=>{t.mock.method(stripe.subscriptions,'retrieve',async()=>sub);t.mock.method(supabaseAdmin,'rpc',rpc(async()=>({error:{code:'QA_OFFLINE'}})));const res=response();await stripeWebhook(signed('invoice.paid',{subscription:sub.id}),res);assert.equal(res.statusCode,500);});
 await t.test('mismatched Checkout customer or business never reaches database',async t=>{t.mock.method(stripe.subscriptions,'retrieve',async()=>sub);let calls=0;t.mock.method(supabaseAdmin,'rpc',rpc(async()=>{calls++;return {error:null};}));for(const object of [{mode:'subscription',subscription:sub.id,customer:'cus_other',metadata:{business_id:ids.a1}},{mode:'subscription',subscription:sub.id,customer:sub.customer,metadata:{business_id:ids.b1}}]){const res=response();await stripeWebhook(signed('checkout.session.completed',object),res);assert.equal(res.statusCode,500);}assert.equal(calls,0);});
 await t.test('bound historical Price still synchronizes after commercial price change',async t=>{const state=fixture();Object.assign(state.subscriptions[0],{stripe_subscription_id:sub.id,stripe_customer_id:sub.customer});t.mock.method(supabaseAdmin,'from',memoryDb(state).from);t.mock.method(stripe.subscriptions,'retrieve',async()=>({...sub,status:'past_due',items:{data:[{...sub.items.data[0],price:{id:'price_historical_1800'}}]}}));let calls=0;t.mock.method(supabaseAdmin,'rpc',rpc(async(name,args)=>{calls++;assert.equal(args.p_payload.status,'past_due');return {error:null};}));const res=response();await stripeWebhook(signed('customer.subscription.updated',sub),res);assert.equal(res.statusCode,200);assert.equal(calls,1);});
 await t.test('historical Price never replaces current subscription/customer binding',async t=>{const state=fixture();Object.assign(state.subscriptions[0],{stripe_subscription_id:'sub_current',stripe_customer_id:sub.customer});t.mock.method(supabaseAdmin,'from',memoryDb(state).from);t.mock.method(stripe.subscriptions,'retrieve',async()=>({...sub,items:{data:[{...sub.items.data[0],price:{id:'price_historical_1800'}}]}}));let calls=0;t.mock.method(supabaseAdmin,'rpc',rpc(async()=>{calls++;return {error:null};}));const res=response();await stripeWebhook(signed('customer.subscription.deleted',sub),res);assert.equal(res.statusCode,500);assert.equal(calls,0);});
 await t.test('wrong price and quantity reject before synchronization',async t=>{let calls=0;t.mock.method(supabaseAdmin,'rpc',rpc(async()=>{calls++;return {error:null};}));for(const item of [{price:{id:'price_other'},quantity:1},{price:{id:'price_fixture'},quantity:2}]){t.mock.method(stripe.subscriptions,'retrieve',async()=>({...sub,items:{data:[item]}}));const res=response();await stripeWebhook(signed('customer.subscription.updated',sub),res);assert.equal(res.statusCode,500);}assert.equal(calls,0);});
});

test('webhook re-reads current Stripe after acquiring the fence, including paused/resumed',async t=>{
 t.mock.method(supabaseAdmin,'from',memoryDb(fixture()).from);
 for(const type of ['customer.subscription.updated','customer.subscription.paused','customer.subscription.resumed'])await t.test(type,async t=>{
  let reads=0,locked=false,synced=false;
  t.mock.method(stripe.subscriptions,'retrieve',async()=>{reads++;return {...sub,status:locked?'past_due':'active'};});
  t.mock.method(supabaseAdmin,'rpc',async(name,args)=>{
   if(name==='cx_acquire_billing_sync'){locked=true;return {data:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',error:null};}
   if(name==='cx_release_billing_sync'){locked=false;return {error:null};}
   assert.equal(args.p_payload.status,'past_due');assert.equal(args.p_payload.sync_token,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');assert.equal(args.p_payload.stripe_livemode,false);synced=true;return {error:null};
  });
  const res=response();await stripeWebhook(signed(type,sub),res);assert.equal(res.statusCode,200);assert.equal(reads,2);assert(synced);assert.equal(locked,false);
 });
 await t.test('occupied lease returns retryable error without committing',async t=>{
  t.mock.method(stripe.subscriptions,'retrieve',async()=>sub);
  t.mock.method(supabaseAdmin,'rpc',async name=>{assert.equal(name,'cx_acquire_billing_sync');return {data:null,error:null};});
  const res=response();await stripeWebhook(signed('customer.subscription.updated',sub),res);assert.equal(res.statusCode,500);
 });
});
