// Real TEST Checkout API and application controller; ownership/persistence are
// in-memory fixtures. No Supabase request, card completion or webhook assertion.
const fs = require('node:fs');
const assert = require('node:assert/strict');
require('dotenv').config({ path: __dirname + '/../.env', quiet: true });
(async () => {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || (process.env.STRIPE_MODE ?? 'test') !== 'test') throw Error('TEST_REQUIRED');
  const { fixture, ids, memoryDb, response } = await import('./helpers/audit-fixture.js');
  const { supabaseAdmin } = await import('../src/infrastructure/database/supabase.js');
  const { stripe, PRICE_ID } = await import('../src/modules/subscriptions/stripeService.js');
  const { createCheckout } = await import('../src/modules/subscriptions/subscriptionController.js');
  const state = fixture(); state.subscriptions = [];
  supabaseAdmin.from = memoryDb(state).from;
  let session;
  try {
    const res = response();
    await createCheckout({ body: { businessId: ids.a1 }, user: { id: ids.a, email: 'pricing-checkout@example.test' } }, res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.success, true);
    const sessionId = state.subscriptions[0].checkout_session_id;
    fs.writeFileSync('/tmp/carteliax-price1749-checkout-resource.json', JSON.stringify({ session: sessionId }), { mode: 0o600 });
    session = await stripe.checkout.sessions.retrieve(sessionId);
    const lines = await stripe.checkout.sessions.listLineItems(sessionId);
    assert.equal(session.livemode, false); assert.equal(session.mode, 'subscription');
    assert.equal(session.payment_method_collection, 'always');
    assert.equal(session.automatic_tax.enabled, false);
    assert.equal(session.allow_promotion_codes, true);
    assert.equal(lines.data.length, 1); assert.equal(lines.data[0].quantity, 1);
    assert.equal(lines.data[0].price.id, PRICE_ID);
    assert.equal(lines.data[0].price.unit_amount, 1749);
    assert.equal(lines.data[0].price.currency, 'eur');
    assert.equal(lines.data[0].price.tax_behavior, 'inclusive');
    console.log(JSON.stringify({
      type: 'REAL_STRIPE_TEST_CHECKOUT_API_MOCKED_DB_IDENTITY', pass: true,
      monthlyAmount: 1749, currency: 'eur', taxBehavior: 'inclusive',
      paymentMethodCollection: session.payment_method_collection,
      automaticTax: session.automatic_tax.enabled, promotions: session.allow_promotion_codes,
      cardCompletionVerified: false, supabaseVerified: false, appWebhooksVerified: false,
      existingResourcesModified: false, liveTouched: false,
    }, null, 2));
  } finally {
    // Expire only the open session created by this test; never old sessions.
    if (session?.status === 'open') await stripe.checkout.sessions.expire(session.id);
  }
})().catch(e => { console.error(JSON.stringify({ status: 'BLOCKED', type: e.type ?? e.code ?? e.name })); process.exitCode = 1; });
