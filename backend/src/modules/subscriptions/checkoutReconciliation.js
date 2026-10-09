import { billingError } from './checkoutRecovery.js';

// Recover only a persisted, completed Checkout by replaying its REAL Stripe
// event through the same distributed lease and idempotent database transaction.
// No create/expire/cancel/update call to Stripe is permitted in this path.
export async function reconcileCompletedCheckout({ stripe, existing, businessId, ownerId, liveMode, synchronize }) {
  if (!existing || existing.status !== 'checkout_pending') return false;
  if (existing.stripe_livemode !== liveMode || !existing.checkout_session_id || !existing.checkout_attempt_id) {
    throw billingError('CHECKOUT_RECONCILIATION_REQUIRED', 'No hay una sesión verificable para recuperar. Contacta con soporte.');
  }
  const session = await stripe.checkout.sessions.retrieve(existing.checkout_session_id);
  if (session.livemode !== liveMode || session.mode !== 'subscription' || session.metadata?.business_id !== businessId || session.metadata?.owner_id !== ownerId || session.metadata?.checkout_attempt_id !== existing.checkout_attempt_id) {
    throw billingError('CHECKOUT_RECONCILIATION_REQUIRED', 'La sesión no corresponde a esta contratación. Contacta con soporte.');
  }
  if (session.status !== 'complete' || !session.subscription) return false;
  // Stripe retains Events for 30 days. Bound the scan and fail closed if the
  // historical event cannot be located; never synthesize a billing event.
  let after;
  for (let page = 0; page < 5; page++) {
    const events = await stripe.events.list({ type: 'checkout.session.completed', created: { gte: session.created - 60 }, limit: 100, ...(after ? { starting_after: after } : {}) });
    const event = events.data.find(item => item.data?.object?.id === session.id);
    if (event) {
      if (event.livemode !== liveMode || event.account) throw billingError('BILLING_ENVIRONMENT_MISMATCH', 'El evento pertenece a otro entorno.');
      await synchronize(event);
      return true;
    }
    if (!events.has_more || !events.data.length) break;
    after = events.data.at(-1).id;
  }
  throw billingError('CHECKOUT_RECONCILIATION_REQUIRED', 'Stripe ha completado Checkout, pero no se ha localizado su evento. Contacta con soporte.');
}
