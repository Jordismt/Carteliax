import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createCorsOptions } from '../src/config/cors.js';

test('CORS permits both exact production domains and configured development origin only', () => {
  const options = createCorsOptions('http://localhost:3000');
  for (const origin of [undefined, 'https://www.carteliax.com', 'https://carteliax.com', 'http://localhost:3000']) {
    options.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
  }
  for (const origin of ['https://evil.example', 'https://www.carteliax.com.evil.example', 'http://carteliax.com', 'https://preview.vercel.app']) {
    options.origin(origin, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, false); });
  }
});

test('standard and restricted Stripe keys preserve mode, price guards and signed webhooks', async t => {
  for (const kind of ['sk', 'rk']) for (const mode of ['test', 'live']) await t.test(`${kind}_${mode}`, () => {
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import {safeEnv,response} from './test/helpers/audit-fixture.js';
      safeEnv(); process.env.DOTENV_CONFIG_PATH='/dev/null';
      process.env.STRIPE_SECRET_KEY='${kind}_${mode}_fixture'; process.env.STRIPE_MODE='${mode}';
      const {stripe,STRIPE_LIVE_MODE,verifyCommercialPrice}=await import('./src/modules/subscriptions/stripeService.js');
      assert.equal(STRIPE_LIVE_MODE,${mode === 'live'});
      stripe.prices.retrieve=async()=>({active:true,livemode:${mode === 'live'},unit_amount:1749,currency:'eur',tax_behavior:'inclusive',recurring:{interval:'month',interval_count:1}});
      stripe.taxRates.retrieve=async()=>({active:true,livemode:${mode === 'live'},percentage:21,inclusive:true,tax_type:'vat',country:'ES'});
      await verifyCommercialPrice();
      const {stripeWebhook}=await import('./src/modules/subscriptions/stripeWebhookController.js');
      for(const matching of [true,false]) {
        const payload=JSON.stringify({id:'evt_fixture',type:'qa.unsupported',livemode:matching ? ${mode === 'live'} : ${mode !== 'live'},data:{object:{}}});
        const header=stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_fixture'});
        const res=response();await stripeWebhook({body:Buffer.from(payload),headers:{'stripe-signature':header}},res);
        assert.equal(res.statusCode,matching ? 200 : 400);
      }
    `], { cwd: new URL('../', import.meta.url), stdio: 'pipe' });
  });
});

test('Stripe startup rejects mismatched key/mode including restricted keys', () => {
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {safeEnv} from './test/helpers/audit-fixture.js';safeEnv();process.env.DOTENV_CONFIG_PATH='/dev/null';
    process.env.STRIPE_SECRET_KEY='rk_live_fixture';process.env.STRIPE_MODE='test';
    await assert.rejects(import('./src/config/env.js'),error=>error.name==='ZodError');
  `], { cwd: new URL('../', import.meta.url), stdio: 'pipe' });
});
