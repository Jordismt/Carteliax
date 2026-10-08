import test from 'node:test';import assert from 'node:assert/strict';
import {subscriptionHasAccess} from '../../frontend/app/utils/subscriptionAccess.ts';
test('billing display mirrors backend status/date rules',()=>{
 const now=Date.parse('2026-10-08'),future='2026-10-09',past='2026-10-07';
 for(const status of ['trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused','inactive','checkout_pending']){
  assert.equal(subscriptionHasAccess({status,trial_ends_at:future,current_period_end:future},now),['active','trialing'].includes(status));
  assert.equal(subscriptionHasAccess({status,trial_ends_at:past,current_period_end:past},now),false);
 }
 assert.equal(subscriptionHasAccess({status:'active',trial_ends_at:null,current_period_end:null},now),true);
 assert.equal(subscriptionHasAccess({status:'trialing',trial_ends_at:null,current_period_end:null},now),false);
 assert.equal(subscriptionHasAccess({status:'trialing',trial_ends_at:'invalid',current_period_end:null},now),false);
});
