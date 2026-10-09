/** Access is asserted by the backend in its configured Stripe environment. */
export function subscriptionHasAccess(subscription: {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  billing_access?: boolean;
} | null, now = Date.now()): boolean {
  if (!subscription?.billing_access || !subscription.current_period_end || Date.parse(subscription.current_period_end) <= now || !Number.isFinite(Date.parse(subscription.current_period_end))) return false;
  if (subscription.status === 'active') return true;
  return subscription.status === 'trialing' && !!subscription.trial_ends_at && Date.parse(subscription.trial_ends_at) > now;
}
