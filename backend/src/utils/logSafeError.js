import { BILLING_REASONS } from './billingDiagnostics.js';

// Do not serialize SDK error objects, request bodies, JWTs or provider responses.
export function logSafeError(label,error,context={}) {
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/i.test(error.code) ? error.code : 'UNEXPECTED_ERROR';
  const type = typeof error?.type === 'string' && /^[A-Z0-9_]{1,64}$/i.test(error.type) ? error.type : undefined;
  const billingDiagnostic = code === 'BILLING_CONFIGURATION' && BILLING_REASONS.includes(error?.billingReason)
    ? { billingReason: error.billingReason } : {};
  console.error(`[${label}]`,{...context,code,type,...billingDiagnostic});
}
