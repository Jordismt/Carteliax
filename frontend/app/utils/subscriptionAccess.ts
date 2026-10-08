/** Mirrors the backend dates, including the existing legacy active/null-period rule. */
export function subscriptionHasAccess(subscription: {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
} | null, now = Date.now()): boolean {
  if (!subscription) return false;
  if (subscription.status === 'trialing') return !!subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > now;
  if (subscription.status === 'active') return !subscription.current_period_end || new Date(subscription.current_period_end).getTime() > now;
  return false;
}
