// Only creates/reuses TEST Price/Tax Rate. Does not update products, old Prices,
// customers or subscriptions. Local env changes only after remote verification.
const fs=require('node:fs'),path=require('node:path');const envPath=path.join(__dirname,'../.env');require('dotenv').config({path:envPath,quiet:true});const Stripe=require('stripe');
const validPrice=p=>p.active&&!p.livemode&&p.unit_amount===1749&&p.currency==='eur'&&p.recurring?.interval==='month'&&p.recurring.interval_count===1&&p.tax_behavior==='inclusive';
const validRate=r=>r.active&&!r.livemode&&r.percentage===21&&r.inclusive===true&&r.tax_type==='vat'&&r.country==='ES';
(async()=>{
 if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')||(process.env.STRIPE_MODE??'test')!=='test')throw Error('TEST_REQUIRED');
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:20000,maxNetworkRetries:1});const old=await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);if(old.livemode)throw Error('TEST_REQUIRED');
 const product=typeof old.product==='string'?old.product:old.product.id;let price,rate,createdPrice=false,createdRate=false;
 for await(const p of stripe.prices.list({active:true,product,limit:100})){if(validPrice(p)){price=p;break;}}
 for await(const r of stripe.taxRates.list({active:true,limit:100})){if(validRate(r)){rate=r;break;}}
 if(!rate){rate=await stripe.taxRates.create({display_name:'IVA',description:'IVA España 21 % incluido — Carteliax',percentage:21,inclusive:true,country:'ES',jurisdiction:'ES',tax_type:'vat',metadata:{carteliax_plan:'monthly_1749_iva21'}},{idempotencyKey:'carteliax-test-vat21-inclusive-v1'});createdRate=true;}
 if(!price){price=await stripe.prices.create({product,unit_amount:1749,currency:'eur',recurring:{interval:'month',interval_count:1},tax_behavior:'inclusive',nickname:'Carteliax 17,49 EUR/mes IVA 21 % incluido',metadata:{carteliax_plan:'monthly_1749_iva21'}},{idempotencyKey:'carteliax-test-price1749-inclusive-v1'});createdPrice=true;}
 price=await stripe.prices.retrieve(price.id);rate=await stripe.taxRates.retrieve(rate.id);if(!validPrice(price)||!validRate(rate))throw Error('REMOTE_VERIFICATION_FAILED');
 const original=fs.readFileSync(envPath,'utf8');fs.writeFileSync('/tmp/carteliax-pricing-env-before.env',original,{mode:0o600});let next=original;
 for(const [key,value]of [['STRIPE_PRICE_ID',price.id],['STRIPE_VAT_TAX_RATE_ID',rate.id]]){const pattern=new RegExp('^'+key+'\\s*=.*$','m');next=pattern.test(next)?next.replace(pattern,key+'='+value):next.replace(/\n?$/,'\n')+key+'='+value+'\n';}
 fs.writeFileSync(envPath,next);fs.writeFileSync('/tmp/carteliax-pricing-resources.json',JSON.stringify({oldPrice:old.id,price:price.id,taxRate:rate.id}),{mode:0o600});
 console.log(JSON.stringify({type:'REAL_STRIPE_TEST_CONFIGURE',oldAmount:old.unit_amount,newAmount:price.unit_amount,currency:price.currency,interval:price.recurring.interval,interval_count:price.recurring.interval_count,tax_behavior:price.tax_behavior,vatPercentage:rate.percentage,vatInclusive:rate.inclusive,createdPrice,createdRate,localEnvUpdated:true,existingResourcesModified:false,liveTouched:false},null,2));
})().catch(e=>{console.error(JSON.stringify({status:'BLOCKED',errorType:e.type??e.code??e.name}));process.exitCode=1});
