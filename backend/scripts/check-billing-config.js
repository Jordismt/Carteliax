// Read-only diagnostic. Use the deployed backend's environment, never browser keys.
import { env } from '../src/config/env.js';
import { verifyCommercialPrice, verifyReusedCustomer } from '../src/modules/subscriptions/stripeService.js';
import { logSafeError } from '../src/utils/logSafeError.js';

export async function checkBillingConfig(expectedMode, customerId) {
  if (!['test', 'live'].includes(expectedMode) || env.STRIPE_MODE !== expectedMode) {
    throw Object.assign(new Error('Explicit expected Stripe mode required'), { code: 'DIAGNOSTIC_MODE_MISMATCH' });
  }
  await verifyCommercialPrice();
  if (customerId) await verifyReusedCustomer(customerId);
  return { mode: env.STRIPE_MODE, commercialConfiguration: 'PASS', customer: customerId ? 'PASS' : 'NOT_CHECKED' };
}

// No Checkout creation, database access, payments or provider updates.
if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length > 4) throw Object.assign(new Error('Invalid arguments'), { code: 'DIAGNOSTIC_ARGUMENTS' });
    console.log(await checkBillingConfig(process.argv[2], process.argv[3]));
  } catch (error) {
    logSafeError('BILLING_DIAGNOSTIC', error);
    process.exitCode = 1;
  }
}
