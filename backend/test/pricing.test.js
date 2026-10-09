import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { safeEnv, fixture, ids, response, memoryDb } from './helpers/audit-fixture.js';
import { COMMERCIAL_PLAN } from '../../frontend/app/utils/commercialPlan.ts';
safeEnv();
const { stripe, verifyCommercialPrice, verifyReusedCustomer } = await import('../src/modules/subscriptions/stripeService.js');
const { createCheckout } = await import('../src/modules/subscriptions/subscriptionController.js');
const { supabaseAdmin } = await import('../src/infrastructure/database/supabase.js');
const price={active:true,livemode:false,tax_behavior:'inclusive',unit_amount:1749,currency:'eur',recurring:{interval:'month',interval_count:1}};
const rate={active:true,livemode:false,percentage:21,inclusive:true,tax_type:'vat',country:'ES'};
test('Dashboard Spanish VAT with null type requires a VAT label and every fiscal guard',async t=>{
 for(const label of ['IVA','VAT',' iva ']) await t.test('accepts '+label,async t=>{
  t.mock.method(stripe.prices,'retrieve',async()=>price);
  const manual={...rate,tax_type:null,display_name:label};
  t.mock.method(stripe.taxRates,'retrieve',async()=>manual);
  assert.deepEqual(await verifyCommercialPrice(),{price,taxRate:manual});
 });
 const invalid=[['VAT_INACTIVE',{active:false}],['VAT_MODE_MISMATCH',{livemode:true}],['VAT_PERCENTAGE',{percentage:20}],['VAT_NOT_INCLUSIVE',{inclusive:false}],['VAT_COUNTRY',{country:'FR'}],['VAT_COUNTRY',{country:null}],['VAT_TYPE',{display_name:'Sales Tax'}],['VAT_TYPE',{display_name:undefined}],['VAT_TYPE',{display_name:''}],['VAT_TYPE',{tax_type:undefined}],['VAT_TYPE',{tax_type:'sales_tax'}],['VAT_TYPE',{tax_type:'gst'}],['VAT_TYPE',{tax_type:''}]];
 for(const [reason,patch] of invalid) await t.test(reason+' '+JSON.stringify(patch),async t=>{
  t.mock.method(stripe.prices,'retrieve',async()=>price);
  t.mock.method(stripe.taxRates,'retrieve',async()=>({...rate,tax_type:null,display_name:'IVA',...patch}));
  await assert.rejects(verifyCommercialPrice(),{code:'BILLING_CONFIGURATION',status:503,billingReason:reason});
 });
});
test('every configuration rejection identifies the exact failed check', async t => {
 const prices=[['PRICE_INACTIVE',{active:false}],['PRICE_MODE_MISMATCH',{livemode:true}],['PRICE_CURRENCY',{currency:'usd'}],['PRICE_AMOUNT',{unit_amount:1800}],['PRICE_INTERVAL',{recurring:null}],['PRICE_INTERVAL_COUNT',{recurring:{interval:'month',interval_count:2}}],['PRICE_TAX_BEHAVIOR',{tax_behavior:'unspecified'}]];
 const rates=[['VAT_INACTIVE',{active:false}],['VAT_MODE_MISMATCH',{livemode:true}],['VAT_PERCENTAGE',{percentage:20}],['VAT_NOT_INCLUSIVE',{inclusive:false}],['VAT_TYPE',{tax_type:'sales_tax'}],['VAT_COUNTRY',{country:null}]];
 for(const [reason,patch] of prices) await t.test(reason,async t=>{
  t.mock.method(stripe.prices,'retrieve',async()=>({...price,...patch}));
  t.mock.method(stripe.taxRates,'retrieve',async()=>{throw Error('Must reject before tax lookup')});
  await assert.rejects(verifyCommercialPrice(),{code:'BILLING_CONFIGURATION',status:503,billingReason:reason});
 });
 for(const [reason,patch] of rates) await t.test(reason,async t=>{
  t.mock.method(stripe.prices,'retrieve',async()=>price);t.mock.method(stripe.taxRates,'retrieve',async()=>({...rate,...patch}));
  await assert.rejects(verifyCommercialPrice(),{code:'BILLING_CONFIGURATION',status:503,billingReason:reason});
 });
 const customers=[['CUSTOMER_DELETED',{deleted:true}],['CUSTOMER_MODE_MISMATCH',{livemode:true}],['CUSTOMER_TAX_EXEMPT',{tax_exempt:'exempt'}],['CUSTOMER_BALANCE',{balance:1}],['CUSTOMER_CREDIT_BALANCE',{invoice_credit_balance:{eur:1}}],['CUSTOMER_DISCOUNT',{discounts:['discount']}]];
 for(const [reason,patch] of customers) await t.test(reason,async t=>{
  t.mock.method(stripe.customers,'retrieve',async()=>({livemode:false,tax_exempt:'none',balance:0,...patch}));
  t.mock.method(stripe.invoiceItems,'list',async()=>{throw Error('Must reject before invoice lookup')});
  await assert.rejects(verifyReusedCustomer('cus_fixture'),{code:'BILLING_CONFIGURATION',status:503,billingReason:reason});
 });
 await t.test('CUSTOMER_PENDING_INVOICE_ITEMS',async t=>{
  t.mock.method(stripe.customers,'retrieve',async()=>({livemode:false,tax_exempt:'none',balance:0}));t.mock.method(stripe.invoiceItems,'list',async()=>({data:[{}]}));
  await assert.rejects(verifyReusedCustomer('cus_fixture'),{billingReason:'CUSTOMER_PENDING_INVOICE_ITEMS'});
 });
});
test('read-only diagnostic checks expected mode before contacting Stripe', async t=>{
 const {checkBillingConfig}=await import('../scripts/check-billing-config.js');
 let calls=0;t.mock.method(stripe.prices,'retrieve',async()=>{calls++;return price});t.mock.method(stripe.taxRates,'retrieve',async()=>rate);
 t.mock.method(stripe.checkout.sessions,'create',async()=>{throw Error('Diagnostic must never create Checkout')});
 t.mock.method(supabaseAdmin,'from',()=>{throw Error('Diagnostic must never access database')});
 await assert.rejects(checkBillingConfig('live'),{code:'DIAGNOSTIC_MODE_MISMATCH'});assert.equal(calls,0);
 assert.deepEqual(await checkBillingConfig('test'),{mode:'test',commercialConfiguration:'PASS',customer:'NOT_CHECKED'});
});
test('commercial plan is exactly EUR 17.49 per month, IVA inclusive and seven-day trial',()=>{
 assert.equal(COMMERCIAL_PLAN.monthlyAmount,17.49);assert.equal(COMMERCIAL_PLAN.monthlyPrice,'17,49 €');assert.equal(COMMERCIAL_PLAN.monthlyLabel,'17,49 €/mes');assert.equal(COMMERCIAL_PLAN.taxLabel,'IVA incluido (21 %)');assert.equal(COMMERCIAL_PLAN.trialDays,7);
});
test('missing VAT configuration blocks Checkout without reserving or calling Stripe Checkout',()=>{
 // A separate process exercises startup with the optional VAT variable absent.
 execFileSync(process.execPath,['--input-type=module','-e',`
  import assert from 'node:assert/strict';
  import {safeEnv,fixture,ids,memoryDb,response} from './test/helpers/audit-fixture.js';
  safeEnv(); process.env.DOTENV_CONFIG_PATH='/dev/null'; delete process.env.STRIPE_VAT_TAX_RATE_ID;
  const {stripe,verifyCommercialPrice}=await import('./src/modules/subscriptions/stripeService.js');
  const {supabaseAdmin}=await import('./src/infrastructure/database/supabase.js');
  const {createCheckout}=await import('./src/modules/subscriptions/subscriptionController.js');
  stripe.prices.retrieve=async()=>({active:true,livemode:false,unit_amount:1749,currency:'eur',tax_behavior:'inclusive',recurring:{interval:'month',interval_count:1}});
  let calls=0;stripe.taxRates.retrieve=async()=>{calls++;throw Error('unexpected tax request')};stripe.checkout.sessions.create=async()=>{calls++;throw Error('unexpected Checkout')};
  const state=fixture();state.subscriptions=[];supabaseAdmin.from=memoryDb(state).from;
  await assert.rejects(verifyCommercialPrice(),{code:'BILLING_CONFIGURATION',billingReason:'VAT_RATE_MISSING'});
  const res=response();await createCheckout({body:{businessId:ids.a1},user:{id:ids.a}},res);
  assert.equal(res.statusCode,503);assert.equal(calls,0);assert.equal(state.subscriptions.length,0);
 `],{cwd:new URL('../',import.meta.url),stdio:'pipe'});
});
test('billing rejects incorrect gross price, recurrence, mode and VAT before Checkout',async t=>{
 const invalidPrices=[...[-1,0,1599,1748,1750,1799,1800,2116].map(unit_amount=>({...price,unit_amount})),{...price,active:false},{...price,livemode:true},{...price,currency:'usd'},{...price,recurring:{interval:'year',interval_count:1}},{...price,recurring:{interval:'month',interval_count:2}},{...price,recurring:null},{...price,tax_behavior:'exclusive'},{...price,tax_behavior:'unspecified'}];
 const invalidRates=[{...rate,active:false},{...rate,livemode:true},{...rate,percentage:20},{...rate,inclusive:false},{...rate,tax_type:'sales_tax'},{...rate,country:'FR'}];
 for (const [index,p,r]of [...invalidPrices.map((p,i)=>['price '+i,p,rate]),...invalidRates.map((r,i)=>['VAT '+i,price,r])]) await t.test(index,async t=>{
  const state=fixture();state.subscriptions=[];t.mock.method(supabaseAdmin,'from',memoryDb(state).from);t.mock.method(stripe.prices,'retrieve',async()=>p);t.mock.method(stripe.taxRates,'retrieve',async()=>r);let calls=0;t.mock.method(stripe.checkout.sessions,'create',async()=>{calls++;throw Error('should not be called');});
  await assert.rejects(verifyCommercialPrice(),{code:'BILLING_CONFIGURATION'});const res=response();await createCheckout({body:{businessId:ids.a1},user:{id:ids.a}},res);assert.equal(res.statusCode,503);assert.equal(calls,0);assert.equal(state.subscriptions.length,0);
 });
 await t.test('valid inclusive Price and 21% VAT accepted',async t=>{t.mock.method(stripe.prices,'retrieve',async()=>price);t.mock.method(stripe.taxRates,'retrieve',async()=>rate);assert.deepEqual(await verifyCommercialPrice(),{price,taxRate:rate});});
 await t.test('provider failure fails closed without reservation',async t=>{const state=fixture();state.subscriptions=[];t.mock.method(supabaseAdmin,'from',memoryDb(state).from);t.mock.method(stripe.prices,'retrieve',async()=>price);t.mock.method(stripe.taxRates,'retrieve',async()=>{throw Error('QA_OFFLINE')});const res=response();await createCheckout({body:{businessId:ids.a1},user:{id:ids.a}},res);assert.equal(res.statusCode,500);assert.equal(state.subscriptions.length,0);});
});
test('reuse never modifies a customer whose tax exemption, balance or discount changes total',async t=>{
 const valid={livemode:false,tax_exempt:'none',balance:0};
 for(const p of [{deleted:true},{livemode:true},{tax_exempt:'exempt'},{tax_exempt:'reverse'},{balance:1},{balance:-1},{invoice_credit_balance:{eur:1}},{discount:{id:'discount'}},{discounts:['discount']}])await t.test(JSON.stringify(p),async t=>{t.mock.method(stripe.customers,'retrieve',async()=>({...valid,...p}));await assert.rejects(verifyReusedCustomer('cus_fixture'),{code:'BILLING_CONFIGURATION'});});
 await t.test('pending invoice item blocks reuse',async t=>{t.mock.method(stripe.customers,'retrieve',async()=>valid);t.mock.method(stripe.invoiceItems,'list',async()=>({data:[{id:'ii_fixture'}]}));await assert.rejects(verifyReusedCustomer('cus_fixture'),{code:'BILLING_CONFIGURATION'});});
 await t.test('unmodified ordinary customer accepted',async t=>{t.mock.method(stripe.customers,'retrieve',async()=>valid);t.mock.method(stripe.invoiceItems,'list',async()=>({data:[]}));await verifyReusedCustomer('cus_fixture');});
});
