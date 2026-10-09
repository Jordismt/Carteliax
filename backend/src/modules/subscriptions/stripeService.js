import Stripe from "stripe";
import { env } from "../../config/env.js";
import { billingConfigurationError } from "../../utils/billingDiagnostics.js";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 20000, maxNetworkRetries: 1 });
export const PRICE_ID = env.STRIPE_PRICE_ID;
export const VAT_TAX_RATE_ID = env.STRIPE_VAT_TAX_RATE_ID;
export const FRONTEND_URL = env.FRONTEND_URL.replace(/\/$/, "");
// env validation guarantees the standard/restricted key matches this mode.
export const STRIPE_LIVE_MODE = env.STRIPE_MODE === "live";

// Gross monthly price and VAT are validated before any payment is reserved/created.
// An unspecified tax behavior is not sufficient to promise a final price.
export async function verifyCommercialPrice() {
  const price = await stripe.prices.retrieve(PRICE_ID);
  if (!price.active) throw billingConfigurationError('PRICE_INACTIVE');
  if (price.livemode !== STRIPE_LIVE_MODE) throw billingConfigurationError('PRICE_MODE_MISMATCH');
  if (price.currency !== 'eur') throw billingConfigurationError('PRICE_CURRENCY');
  if (price.unit_amount !== 1749) throw billingConfigurationError('PRICE_AMOUNT');
  if (price.recurring?.interval !== 'month') throw billingConfigurationError('PRICE_INTERVAL');
  if (price.recurring.interval_count !== 1) throw billingConfigurationError('PRICE_INTERVAL_COUNT');
  if (price.tax_behavior !== 'inclusive') throw billingConfigurationError('PRICE_TAX_BEHAVIOR');
  if (!VAT_TAX_RATE_ID) throw billingConfigurationError('VAT_RATE_MISSING');
  const taxRate = await stripe.taxRates.retrieve(VAT_TAX_RATE_ID);
  if (!taxRate.active) throw billingConfigurationError('VAT_INACTIVE');
  if (taxRate.livemode !== STRIPE_LIVE_MODE) throw billingConfigurationError('VAT_MODE_MISMATCH');
  if (taxRate.percentage !== 21) throw billingConfigurationError('VAT_PERCENTAGE');
  if (taxRate.inclusive !== true) throw billingConfigurationError('VAT_NOT_INCLUSIVE');
  if (taxRate.tax_type !== 'vat') throw billingConfigurationError('VAT_TYPE');
  if (taxRate.country !== 'ES') throw billingConfigurationError('VAT_COUNTRY');
  return { price, taxRate };
}

// Exempt/reverse customers can back out inclusive VAT; balances/discounts can
// alter the invoice total. Preserve their data and require reconciliation.
export async function verifyReusedCustomer(customerId) {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) throw billingConfigurationError('CUSTOMER_DELETED');
  if (customer.livemode !== STRIPE_LIVE_MODE) throw billingConfigurationError('CUSTOMER_MODE_MISMATCH');
  if (customer.tax_exempt !== 'none') throw billingConfigurationError('CUSTOMER_TAX_EXEMPT');
  if (customer.balance !== 0) throw billingConfigurationError('CUSTOMER_BALANCE');
  if (Object.values(customer.invoice_credit_balance ?? {}).some(value => value !== 0)) throw billingConfigurationError('CUSTOMER_CREDIT_BALANCE');
  if (customer.discount || (customer.discounts?.length ?? 0) > 0) throw billingConfigurationError('CUSTOMER_DISCOUNT');
  const pending = await stripe.invoiceItems.list({ customer: customerId, pending: true, limit: 1 });
  if (pending.data.length) throw billingConfigurationError('CUSTOMER_PENDING_INVOICE_ITEMS');
}

export function stripeDate(unix) {
  return typeof unix === "number" ? new Date(unix * 1000).toISOString() : null;
}
