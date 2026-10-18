import test from 'node:test';
import assert from 'node:assert/strict';
import {actionBadge, predictionReason} from './prefetchState.mjs';

test('only a completed unused prefetch gets a Ready badge', () => {
  assert.equal(actionBadge(null), null);
  assert.equal(actionBadge({status:'pending',prefetched:true}).label, 'Preparing…');
  assert.deepEqual(actionBadge({status:'ready',prefetched:true}), {label:'✓ Ready',ready:true});
  assert.deepEqual(actionBadge({status:'ready',prefetched:false}), {label:'Cached',ready:false});
});

test('predictions distinguish cost, probability, prerequisites and scheduling gates', () => {
  const session={enabled:true,prefetchLimitPerItem:3,metrics:{pendingPrefetches:0}};
  const current={prefires:0,actionStates:{}};
  const p={action:'SUMMARIZE',probability:.11,expectedValue:50,eligible:true,shouldPrefetch:false};
  assert.match(predictionReason(p,session,current), /only 11% likely/);
  assert.match(predictionReason({...p,probability:.8,expectedValue:-1},session,current), /cost outweighs/);
  assert.match(predictionReason({...p,eligible:false,eligibilityNote:'Check the image.'},session,current), /Check the image/);
  const eligible={...p,shouldPrefetch:true};
  assert.match(predictionReason(eligible,{...session,enabled:false},current), /Paused/);
  assert.match(predictionReason(eligible,session,{...current,prefires:3}), /budget/);
  assert.match(predictionReason(eligible,{...session,metrics:{pendingPrefetches:1}},current), /another background call/);
  assert.match(predictionReason(eligible,session,current), /not selected/);
  assert.match(predictionReason(p,session,{...current,actionStates:{SUMMARIZE:{status:'ready',prefetched:true}}}), /^Ready/);
});

test('background failures stay visible without overriding a ready retry or another image', () => {
  const p={action:'SUMMARIZE',probability:.8,expectedValue:100,eligible:true,shouldPrefetch:true};
  const session={enabled:true,metrics:{pendingPrefetches:0},requestLog:[{itemId:'one',kind:'prefetch',action:'SUMMARIZE',result:'failed'}]};
  const current={id:'one',actionStates:{}};
  assert.match(predictionReason(p,session,current), /failed.*retry/);
  assert.doesNotMatch(predictionReason(p,session,{...current,id:'two'}), /failed/);
  assert.match(predictionReason(p,session,{...current,actionStates:{SUMMARIZE:{status:'ready',prefetched:true}}}), /^Ready/);
  session.requestLog.unshift({itemId:'one',kind:'provider',action:'SUMMARIZE',result:'completed'});
  assert.doesNotMatch(predictionReason(p,session,current), /failed/);
});
