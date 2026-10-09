import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileCompletedCheckout } from '../src/modules/subscriptions/checkoutReconciliation.js';
function fixture() {
  const existing = { status: 'checkout_pending', stripe_livemode: true, checkout_session_id: 'cs_live_bound', checkout_attempt_id: 'attempt' };
  const session = { id: existing.checkout_session_id, created: 1000, livemode: true, mode: 'subscription', status: 'complete', subscription: 'sub_bound', metadata: { business_id: 'business', owner_id: 'owner', checkout_attempt_id: 'attempt' } };
  const event = { id: 'evt_real', livemode: true, type: 'checkout.session.completed', data: { object: session } };
  const replayed = [];
  const stripe = { checkout: { sessions: { retrieve: async id => { assert.equal(id, session.id); return session; } } }, events: { list: async () => ({ data: [event], has_more: false }) } };
  const input = { stripe, existing, businessId: 'business', ownerId: 'owner', liveMode: true, synchronize: async event => replayed.push(event) };
  return { input, session, existing, event, replayed };
}
test('reconciliation replays a real completed event without Stripe writes', async () => {
  const f = fixture();
  assert.equal(await reconcileCompletedCheckout(f.input), true);
  assert.deepEqual(f.replayed, [f.event]);
  // Every mutation method is absent: any create/expire/update call would fail.
  f.existing.status = 'trialing';
  assert.equal(await reconcileCompletedCheckout(f.input), false);
  assert.equal(f.replayed.length, 1);
});
test('reconciliation denies forged binding, historical mode and missing persisted session', async () => {
  for (const mutate of [f => { f.session.metadata.owner_id = 'foreign'; }, f => { f.session.metadata.checkout_attempt_id = 'obsolete'; }, f => { f.existing.stripe_livemode = false; }, f => { f.existing.checkout_session_id = null; }, f => { f.event.account = 'acct_other'; }]) {
    const f = fixture(); mutate(f);
    await assert.rejects(reconcileCompletedCheckout(f.input));
    assert.equal(f.replayed.length, 0);
  }
});
test('open Checkout is never completed or expired by reconciliation', async () => {
  const f = fixture(); f.session.status = 'open';
  assert.equal(await reconcileCompletedCheckout(f.input), false);
  assert.equal(f.replayed.length, 0);
});
test('unavailable real event and synchronization failures are surfaced without inventing records', async () => {
  const f = fixture(); f.input.stripe.events.list = async () => ({ data: [], has_more: false });
  await assert.rejects(reconcileCompletedCheckout(f.input), error => error.code === 'CHECKOUT_RECONCILIATION_REQUIRED');
  const outage = fixture(); outage.input.synchronize = async () => { throw Error('database unavailable'); };
  await assert.rejects(reconcileCompletedCheckout(outage.input), /database unavailable/);
});
