// Retry only the exact persisted request/key. Never infer absence from a timeout.
export function definitiveCheckoutFailure(error) {
  return ['StripeInvalidRequestError', 'StripeAuthenticationError', 'StripePermissionError'].includes(error?.type)
    && [400, 401, 403, 404].includes(error?.statusCode);
}
export function historicalReference(error) {
  return error?.code === 'resource_missing' && error?.statusCode === 404;
}
export function billingError(code, message, status = 409) {
  return Object.assign(new Error(message), { code, status });
}
export async function recoverCheckout(stripe, existing, now = Date.now(), beforeReplay = () => {}) {
  if (existing.checkout_session_id) return stripe.checkout.sessions.retrieve(existing.checkout_session_id);
  // Stripe retains idempotency keys for at least 24 hours. Outside this window a
  // replay can create another session, so fail closed and require reconciliation.
  const requestedAt = Date.parse(existing.checkout_requested_at);
  if (!Number.isFinite(requestedAt) || requestedAt > now + 300000 || !existing.checkout_request || !existing.checkout_attempt_id || !existing.checkout_requested_at ||
      now - requestedAt >= 23 * 3600 * 1000) {
    throw billingError('CHECKOUT_RECONCILIATION_REQUIRED', 'No se puede confirmar el intento anterior. Contacta con soporte para reconciliarlo.');
  }
  beforeReplay();
  return stripe.checkout.sessions.create(existing.checkout_request, {
    idempotencyKey: `checkout_${existing.business_id}_${existing.checkout_attempt_id}`,
  });
}
