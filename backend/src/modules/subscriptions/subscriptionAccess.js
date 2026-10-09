import { STRIPE_LIVE_MODE } from './stripeService.js';
export function subscriptionHasAccess(subscription, now = Date.now()) {
  if (!subscription || subscription.stripe_livemode !== STRIPE_LIVE_MODE ||
      !subscription.stripe_subscription_id || !subscription.stripe_customer_id) return false;
  const period = Date.parse(subscription.current_period_end);
  if (!Number.isFinite(period) || period <= now) return false;
  if (subscription.status === 'active') return true;
  return subscription.status === 'trialing' && Date.parse(subscription.trial_ends_at) > now;
}
