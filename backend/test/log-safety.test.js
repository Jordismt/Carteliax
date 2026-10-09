import test from 'node:test';import assert from 'node:assert/strict';import {logSafeError} from '../src/utils/logSafeError.js';
import { BILLING_REASONS, billingConfigurationError } from '../src/utils/billingDiagnostics.js';
test('billing diagnostics log only allowlisted reasons, never arbitrary provider details', t => {
 const output=[];t.mock.method(console,'error',(...args)=>output.push(JSON.stringify(args)));
 for(const reason of BILLING_REASONS) {
  logSafeError('SUBSCRIPTIONS',Object.assign(billingConfigurationError(reason),{raw:{secret:'PRIVATE_SENTINEL'},message:'PRIVATE_SENTINEL'}));
  assert(output.at(-1).includes(reason));
 }
 logSafeError('SUBSCRIPTIONS',{code:'BILLING_CONFIGURATION',billingReason:'PRIVATE_SENTINEL'});
 logSafeError('SUBSCRIPTIONS',{code:'StripeAPIError',billingReason:'VAT_TYPE'});
 assert(!output.join('').includes('PRIVATE_SENTINEL'));
 assert(!output.at(-1).includes('billingReason'));
 assert.throws(()=>billingConfigurationError('PRIVATE_SENTINEL'));
});
test('payment errors never serialize SDK details, request tokens or card metadata',t=>{let output;t.mock.method(console,'error',(...args)=>{output=JSON.stringify(args)});logSafeError('STRIPE',{code:'StripeConnectionError',type:'StripeAPIError',raw:{secret:'PRIVATE_SENTINEL'},message:'PRIVATE_SENTINEL',request:{Authorization:'PRIVATE_SENTINEL'}},{eventType:'invoice.paid'});assert(!output.includes('PRIVATE_SENTINEL'));assert(output.includes('StripeConnectionError'));});
