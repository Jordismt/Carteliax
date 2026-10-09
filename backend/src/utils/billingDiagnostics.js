// Only these application-owned reasons may reach logs. No Stripe objects or IDs.
export const BILLING_REASONS = Object.freeze([
  'PRICE_INACTIVE', 'PRICE_MODE_MISMATCH', 'PRICE_CURRENCY', 'PRICE_AMOUNT',
  'PRICE_INTERVAL', 'PRICE_INTERVAL_COUNT', 'PRICE_TAX_BEHAVIOR', 'VAT_RATE_MISSING',
  'VAT_INACTIVE', 'VAT_MODE_MISMATCH', 'VAT_PERCENTAGE', 'VAT_NOT_INCLUSIVE',
  'VAT_TYPE', 'VAT_COUNTRY', 'CUSTOMER_DELETED', 'CUSTOMER_MODE_MISMATCH',
  'CUSTOMER_TAX_EXEMPT', 'CUSTOMER_BALANCE', 'CUSTOMER_CREDIT_BALANCE',
  'CUSTOMER_DISCOUNT', 'CUSTOMER_PENDING_INVOICE_ITEMS',
]);

export function billingConfigurationError(reason) {
  if (!BILLING_REASONS.includes(reason)) throw new Error('Unknown billing diagnostic');
  return Object.assign(new Error('La configuración de precio o IVA no coincide con el plan.'), {
    code: 'BILLING_CONFIGURATION', status: 503, billingReason: reason,
  });
}
