import test from 'node:test';
import assert from 'node:assert/strict';
import {safeEnv,fixture,ids,memoryDb,response} from './helpers/audit-fixture.js';
import {requestRecovery,updateRecoveryPassword,recoveryPasswordError,recoveryRedirect} from '../../frontend/app/utils/passwordRecovery.ts';
safeEnv();
const {subscriptionHasAccess}=await import('../src/modules/subscriptions/subscriptionAccess.js');
const {stripe}=await import('../src/modules/subscriptions/stripeService.js');
const {supabaseAdmin}=await import('../src/infrastructure/database/supabase.js');
const {createCheckout,createPortal}=await import('../src/modules/subscriptions/subscriptionController.js');
const {recoverCheckout}=await import('../src/modules/subscriptions/checkoutRecovery.js');

test('strict access: mode, linkage, date and cancellation boundaries',()=>{
 const current=fixture().subscriptions[0];
 assert(subscriptionHasAccess(current));
 for(const change of [{stripe_livemode:null},{stripe_livemode:true},{stripe_customer_id:null},{stripe_subscription_id:null},{current_period_end:null},{current_period_end:'invalid'},{current_period_end:new Date(0).toISOString()},...['past_due','unpaid','paused','canceled','incomplete','incomplete_expired'].map(status=>({status}))]) assert.equal(subscriptionHasAccess({...current,...change}),false);
 assert(subscriptionHasAccess({...current,cancel_at_period_end:true}));
 const end=Date.parse(current.current_period_end);
 assert(subscriptionHasAccess(current,end-1));assert.equal(subscriptionHasAccess(current,end),false);
});
test('Checkout recovery regressions (remote Stripe and PostgREST mocked)',async t=>{
 t.mock.method(stripe.prices,'retrieve',async()=>({active:true,livemode:false,tax_behavior:'inclusive',unit_amount:1749,currency:'eur',recurring:{interval:'month',interval_count:1}}));
 t.mock.method(stripe.taxRates,'retrieve',async()=>({active:true,livemode:false,percentage:21,inclusive:true,tax_type:'vat',country:'ES'}));
 await t.test('definitive Stripe rejection releases only its own reservation',async t=>{
  const state=fixture();state.subscriptions=[];t.mock.method(supabaseAdmin,'from',memoryDb(state).from);
  t.mock.method(stripe.checkout.sessions,'create',async()=>{throw Object.assign(new Error('rejected'),{type:'StripeInvalidRequestError',statusCode:400});});
  const res=response();await createCheckout({body:{businessId:ids.a1},user:{id:ids.a}},res);
  assert.equal(res.statusCode,422);assert.equal(state.subscriptions[0].status,'inactive');assert.equal(state.subscriptions[0].checkout_attempt_id,null);
 });
 await t.test('lost response replay uses identical payload and idempotency key',async t=>{
  const state=fixture();state.subscriptions=[];t.mock.method(supabaseAdmin,'from',memoryDb(state).from);let first,firstKey,calls=0;
  t.mock.method(stripe.checkout.sessions,'create',async(p,o)=>{calls++;if(calls===1){first=structuredClone(p);firstKey=o.idempotencyKey;throw Object.assign(new Error('timeout'),{type:'StripeConnectionError'});}assert.deepEqual(p,first);assert.equal(o.idempotencyKey,firstKey);return {id:'cs_recovered',status:'open',url:'https://checkout.stripe.com/fixture'};});
  const req={body:{businessId:ids.a1},user:{id:ids.a}};const a=response(),b=response();await createCheckout(req,a);assert.equal(a.statusCode,503);await createCheckout(req,b);assert.equal(b.statusCode,200);assert.equal(state.subscriptions[0].checkout_session_id,'cs_recovered');assert.equal(calls,2);
 });
 await t.test('definitive rejection on a persisted replay is released safely',async t=>{
  const state=fixture();Object.assign(state.subscriptions[0],{status:'checkout_pending',stripe_subscription_id:null,checkout_session_id:null,checkout_attempt_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',checkout_request:{mode:'subscription'},checkout_requested_at:new Date().toISOString()});
  t.mock.method(supabaseAdmin,'from',memoryDb(state).from);
  t.mock.method(stripe.checkout.sessions,'create',async()=>{throw Object.assign(new Error('definitive'),{type:'StripeInvalidRequestError',statusCode:400});});
  const res=response();await createCheckout({body:{businessId:ids.a1},user:{id:ids.a}},res);assert.equal(res.statusCode,422);assert.equal(state.subscriptions[0].status,'inactive');
 });
 await t.test('old unknown attempt cannot be replayed outside retention window',async()=>{
  await assert.rejects(recoverCheckout(stripe,{business_id:ids.a1,checkout_attempt_id:'x',checkout_request:{},checkout_requested_at:'2020-01-01'}),{code:'CHECKOUT_RECONCILIATION_REQUIRED'});
 });
 await t.test('historical other-mode contract starts new billing without old IDs',async t=>{
  const state=fixture();Object.assign(state.subscriptions[0],{stripe_livemode:true});t.mock.method(supabaseAdmin,'from',memoryDb(state).from);
  t.mock.method(stripe.subscriptions,'retrieve',async()=>assert.fail('must not retrieve foreign environment'));
  t.mock.method(stripe.checkout.sessions,'create',async p=>{assert.equal(p.customer,undefined);assert.equal(p.subscription_data.trial_period_days,7);return {id:'cs_new',url:'https://checkout.stripe.com/fixture'};});
  const res=response();await createCheckout({body:{businessId:ids.a1},user:{id:ids.a,email:'qa@example.invalid'}},res);assert.equal(res.statusCode,200);assert.equal(state.subscriptions[0].stripe_livemode,false);assert.equal(state.subscriptions[0].stripe_subscription_id,null);
 });
 await t.test('unverified portal returns actionable conflict before Stripe mutation',async t=>{
  const state=fixture();state.subscriptions[0].stripe_livemode=null;t.mock.method(supabaseAdmin,'from',memoryDb(state).from);
  t.mock.method(stripe.billingPortal.sessions,'create',async()=>assert.fail('no portal mutation'));
  const res=response();await createPortal({body:{businessId:ids.a1},user:{id:ids.a}},res);assert.equal(res.statusCode,409);assert.equal(res.body.code,'BILLING_ENVIRONMENT_MISMATCH');
 });
});
test('password recovery request and update (Auth adapter mocked)',async()=>{
 const sent=[];const auth={resetPasswordForEmail:async(...args)=>{sent.push(args);return {error:null};}};
 const message=await requestRecovery(auth,' QA@Example.invalid ','https://www.carteliax.com');
 assert.equal(sent[0][0],'qa@example.invalid');assert.equal(sent[0][1].redirectTo,'https://www.carteliax.com/reset-password');
 assert.equal(await requestRecovery({resetPasswordForEmail:async()=>({error:{status:400}})},'unknown@example.invalid','https://www.carteliax.com'),message);
 await assert.rejects(requestRecovery(auth,'invalid','https://www.carteliax.com'));
 await assert.rejects(requestRecovery({resetPasswordForEmail:async()=>({error:{status:429}})},'qa@example.invalid','https://www.carteliax.com'));
 assert.throws(()=>recoveryRedirect('javascript:alert(1)'));assert.throws(()=>recoveryRedirect('http://evil.example'));
 assert.equal(recoveryPasswordError('short','short'),'Utiliza entre 8 y 128 caracteres.');
 let updates=0;const updateAuth={getUser:async()=>({data:{user:{id:'a'}},error:null}),updateUser:async p=>{updates++;assert.deepEqual(p,{password:'new-secret-password'});return {error:null};}};
 for(const user of [null,'b'])await assert.rejects(updateRecoveryPassword(updateAuth,user,'new-secret-password','new-secret-password'));
 await assert.rejects(updateRecoveryPassword({...updateAuth,getUser:async()=>({data:{user:null},error:{status:401}})},'a','new-secret-password','new-secret-password'));
 await assert.rejects(updateRecoveryPassword(updateAuth,'a','new-secret-password','different-password'));
 assert.equal(updates,0);await updateRecoveryPassword(updateAuth,'a','new-secret-password','new-secret-password');assert.equal(updates,1);
 await assert.rejects(updateRecoveryPassword({...updateAuth,updateUser:async()=>({error:{status:422}})},'a','new-secret-password','new-secret-password'));
});
