import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTrials} from './comparison.mjs';
const trial=(mode,repetition,wait,extra={})=>({mode,repetition,scenario:'receipt',clean:true,completed:true,dwellMs:1500,providers:{gemini:{model:'same'}},actions:[{action:'READ_TEXT'},{action:'EXTRACT_FIELDS'}],metrics:{totalWaitMs:wait,demandCalls:2,speculativeCalls:0,usedPrefetches:0,unusedPrefetches:0,failures:0},...extra});
const artifact=trials=>({metadata:{inputDescription:'Real receipts; scripted choices.'},trials});
test('paired reduction uses median differences and preserves negative savings',()=>{
 const r=compareTrials(artifact([trial('OFF',1,1000),trial('ON',1,2000),trial('OFF',2,4000),trial('ON',2,2000)]));
 assert.equal(r.scenarios[0].pairs,2);assert.equal(r.scenarios[0].savedMs,500);assert.equal(r.pairs,2);assert.equal(r.savedMs,500);assert.equal(r.off.wait,2500);
 assert.equal(compareTrials(artifact([trial('OFF',1,1000),trial('ON',1,2000)])).savedMs,-1000);
});
test('failed pairs stay in reliability counts, never in latency comparison',()=>{
 const bad=trial('ON',1,500,{clean:false,completed:false});bad.metrics.failures=1;
 const r=compareTrials(artifact([trial('OFF',1,1000),bad]));
 assert.equal(r.pairs,0);assert.equal(r.failures,1);assert.equal(r.excludedGroups,1);
});
test('rejects mismatched sequences, dwell, providers, read-ahead, and missing pairs',()=>{
 for(const patch of [{actions:[{action:'SUMMARIZE'}]},{dwellMs:0},{providers:{}},{readAhead:true},{requestLog:[{kind:'read-ahead'}]},{manualText:true},{inputSha256:'different'}])assert.equal(compareTrials(artifact([trial('OFF',1,1000),trial('ON',1,100,patch)])).pairs,0);
 assert.equal(compareTrials(artifact([trial('ON',1,100)])).pairs,0);
});
test('does not treat a single UI export or duplicate modes as evidence',()=>{
 assert.throws(()=>compareTrials({enabled:true,metrics:{}}),/results.json/);
 assert.throws(()=>compareTrials(artifact([trial('ON',1,100),trial('ON',1,200)])),/Duplicate/);
});
