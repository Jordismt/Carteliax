import Stripe from "stripe";
import { env } from "../../config/env.js";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 20000, maxNetworkRetries: 1 });
export const PRICE_ID = env.STRIPE_PRICE_ID;
export const VAT_TAX_RATE_ID = env.STRIPE_VAT_TAX_RATE_ID;
export const FRONTEND_URL = env.FRONTEND_URL.replace(/\/$/, "");
export const STRIPE_LIVE_MODE = env.STRIPE_SECRET_KEY.startsWith("sk_live_");

function billingConfigurationError() {
  return Object.assign(new Error("La configuración de precio o IVA no coincide con el plan."), { code: "BILLING_CONFIGURATION", status: 503 });
}

// Gross monthly price and VAT are validated before any payment is reserved/created.
// An unspecified tax behavior is not sufficient to promise a final price.
export async function verifyCommercialPrice() {
  const price = await stripe.prices.retrieve(PRICE_ID);
  if (!price.active || price.livemode !== STRIPE_LIVE_MODE || price.currency !== "eur" ||
      price.unit_amount !== 1749 || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 ||
      price.tax_behavior !== "inclusive" || !VAT_TAX_RATE_ID) {
    throw billingConfigurationError();
  }
  const taxRate = await stripe.taxRates.retrieve(VAT_TAX_RATE_ID);
  if (!taxRate.active || taxRate.livemode !== STRIPE_LIVE_MODE || taxRate.percentage !== 21 ||
      taxRate.inclusive !== true || taxRate.tax_type !== "vat" || taxRate.country !== "ES") {
    throw billingConfigurationError();
  }
  return { price, taxRate };
}

// Exempt/reverse customers can back out inclusive VAT; balances/discounts can
// alter the invoice total. Preserve their data and require reconciliation.
export async function verifyReusedCustomer(customerId) {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || customer.livemode !== STRIPE_LIVE_MODE || customer.tax_exempt !== "none" ||
      customer.balance !== 0 || Object.values(customer.invoice_credit_balance ?? {}).some(value => value !== 0) ||
      customer.discount || (customer.discounts?.length ?? 0) > 0) throw billingConfigurationError();
  const pending = await stripe.invoiceItems.list({ customer: customerId, pending: true, limit: 1 });
  if (pending.data.length) throw billingConfigurationError();
}

export function stripeDate(unix) {
  return typeof unix === "number" ? new Date(unix * 1000).toISOString() : null;
}
