// Makes BILLABLE provider calls through the running local backend. No mock mode.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';

const opt=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1];};
const base=opt('base','http://localhost:4000');
const dwell=Number(opt('dwell-ms',1500));
const repeats=Number(opt('repetitions',2));
const trialGap=Number(opt('trial-gap-ms',15000));
const out=resolve(opt('out','work/ai-benchmark'));
if(!Number.isFinite(trialGap)||trialGap<0)throw new Error('Use a nonnegative trial gap.');
if(!Number.isFinite(dwell)||dwell<0||!Number.isInteger(repeats)||repeats<1||repeats>10)throw new Error('Use nonnegative dwell and 1–10 repetitions.');
const manifestPath=opt('manifest','');
const manifest=manifestPath?JSON.parse(await readFile(resolve(manifestPath),'utf8')):null;
let inputDescription=manifest?.description||'Synthetic images and authored journeys.';
let scenarios=manifest?.scenarios||[
  {name:'receipt-extraction',type:'RECEIPT',image:'receipt',actions:['READ_TEXT','EXTRACT_FIELDS']},
  {name:'receipt-unexpected-summary',type:'RECEIPT',image:'receipt',actions:['READ_TEXT','SUMMARIZE']},
  {name:'whiteboard-tasks',type:'WHITEBOARD',image:'whiteboard',actions:['READ_TEXT','MAKE_TASKS']},
];
if(!Array.isArray(scenarios)||!scenarios.length)throw new Error('Manifest needs scenarios.');
for(const s of scenarios)if(!s.name||!['RECEIPT','WHITEBOARD'].includes(s.type)||!Array.isArray(s.actions)||!s.actions.length||s.actions.some(a=>!['READ_TEXT','EXTRACT_FIELDS','SUMMARIZE','MAKE_TASKS'].includes(a))||!Number.isFinite(s.dwellMs??dwell)||(s.dwellMs??dwell)<0)throw new Error('Invalid scenario.');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function call(route,method='GET',body,session){
  const response=await fetch(`${base}/api/ai${route}`,{method,headers:{'Content-Type':'application/json',...(session?{'X-AI-Session':session}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await response.json();if(!response.ok)throw new Error(payload.error||`HTTP ${response.status}`);return payload;
}
let trials=[];
await mkdir(out,{recursive:true});
let metadata={createdAt:new Date().toISOString(),dwellMs:dwell,repetitions:repeats,trialGapMs:trialGap,
  inputDescription,manifestSource:manifest?.source,
  method:'Actual provider-backed API. Fresh backend AI session/cache/seed model for each trial. OFF and ON use identical image inputs and scripts; ordinary caching enabled in both. Alternating paired order. Final background work drained for usage accounting. No artificial latency. Authored scenarios, not real-user prediction accuracy. Input provenance is specified separately in inputDescription.',scenarios};
async function settle(session){
  const deadline=Date.now()+130000;
  while(Date.now()<deadline){const state=await call('/session','GET',undefined,session);if(!state.metrics.running)return state;await sleep(100);}
  throw new Error('Provider work did not settle within 130 seconds.');
}
const reportOnly=process.argv.includes('--report-only');
if(reportOnly){const saved=JSON.parse(await readFile(resolve(out,'results.json'),'utf8'));metadata=saved.metadata;trials=saved.trials;scenarios=metadata.scenarios||scenarios;inputDescription=metadata.inputDescription||inputDescription;}
if(!reportOnly)try{
  trialsLoop: for(let repetition=1;repetition<=repeats;repetition++)for(const scenario of scenarios)for(const enabled of (repetition+scenarios.indexOf(scenario))%2?[false,true]:[true,false]){
    if(trials.length&&trialGap)await sleep(trialGap);
    const initial=await call('/sessions','POST',{});const session=initial.sessionId;
    try{
      if(!initial.providers.perceptron.configured||!initial.providers.gemini.configured)throw new Error('Configure BOTH backend API keys and restart before benchmarking. No calls were simulated.');
      const imagePath=scenario.imagePath?resolve(dirname(resolve(manifestPath)),scenario.imagePath):fileURLToPath(new URL(`../frontend/public/ai-samples/${scenario.image}.png`,import.meta.url));
      const image=`data:${scenario.mime||'image/png'};base64,`+(await readFile(imagePath)).toString('base64');
      const item=await call('/items','POST',{type:scenario.type,name:scenario.name,image},session);
      await call('/session','PATCH',{enabled},session);
      const actions=[];const started=performance.now();let actionError;
      try {
      for(let i=0;i<scenario.actions.length;i++){
        const action=scenario.actions[i];const requestStarted=performance.now();const result=await call(`/items/${item.id}/actions/${action}`,'POST',{},session);
        actions.push({action,clientWaitMs:performance.now()-requestStarted,result:result.result,source:result.source,usedPrefetch:result.usedPrefetch,waitMs:result.waitMs,providerMs:result.providerMs,model:result.model,promptVersion:result.promptVersion,usage:result.usage});
        if(i<scenario.actions.length-1)await sleep(scenario.dwellMs??dwell);
      }
      } catch(error) { actionError=error.message; }
      if(!actionError&&scenario.stopAfterMs)await sleep(scenario.stopAfterMs);
      const journeyMs=performance.now()-started;
      const snapshot=await settle(session);
      const trial={scenario:scenario.name,repetition,mode:enabled?'ON':'OFF',dwellMs:scenario.dwellMs??dwell,journeyMs,actions,providers:initial.providers,completed:!actionError,clean:!actionError&&!snapshot.metrics.failures,error:actionError,metrics:snapshot.metrics,requestLog:snapshot.requestLog};
      if(!enabled&&snapshot.metrics.speculativeCalls!==0)throw new Error('OFF unexpectedly made speculative calls.');
      trials.push(trial);
      await writeFile(resolve(out,'results.json'),JSON.stringify({metadata,trials},null,2));
      console.log(`${trials.length}/${repeats*scenarios.length*2} ${scenario.name} ${trial.mode} ${trial.clean?'clean':'WITH FAILURE'}: ${(snapshot.metrics.totalWaitMs/1000).toFixed(2)} s waiting, ${snapshot.metrics.demandCalls+snapshot.metrics.speculativeCalls} provider calls`);
      if(snapshot.requestLog.some(e=>e.result==='failed'&&/rate limit|quota reached/i.test(e.message||''))){metadata.stopReason='Stopped after provider rate-limit/quota error; remaining trials were not run.';break trialsLoop;}
    }finally{await settle(session).then(()=>call('/session','DELETE',undefined,session)).catch(()=>{});}
  }
}catch(error){await writeFile(resolve(out,'results.json'),JSON.stringify({metadata,trials,incomplete:true,error:error.message},null,2));throw error;}
if(!reportOnly)await writeFile(resolve(out,'results.json'),JSON.stringify({metadata,trials},null,2));
const percentile=(values,p)=>{const a=[...values].sort((x,y)=>x-y);return a.length?a[Math.ceil(p*a.length)-1]:NaN;};
const sum=(xs,fn)=>xs.reduce((a,x)=>a+fn(x),0);
const cleanPairs=trials.filter(t=>t.clean&&trials.some(other=>other.scenario===t.scenario&&other.repetition===t.repetition&&other.mode!==t.mode&&other.clean));
const formatMs=value=>Number.isFinite(value)?`${value.toFixed(1)} ms`:'N/A';
const summary=['# AI inbox OFF/ON measurement','',`Actual model requests · ${metadata.repetitions} repetitions · ${metadata.dwellMs} ms default review interval (per-scenario overrides are retained). ${inputDescription}`, '', '| Scenario | OFF mean action wait | ON mean action wait | Net extra provider calls | ON consumed prefires | ON unused prefires |','|---|---:|---:|---:|---:|---:|'];
for(const scenario of [...scenarios,{name:'ALL'}]){
  const selected=cleanPairs.filter(t=>scenario.name==='ALL'||t.scenario===scenario.name);
  const off=selected.filter(t=>t.mode==='OFF'),on=selected.filter(t=>t.mode==='ON');
  const waits=xs=>xs.flatMap(t=>t.actions.map(a=>a.waitMs));
  const mean=xs=>sum(waits(xs),x=>x)/waits(xs).length;
  const calls=xs=>sum(xs,t=>t.metrics.demandCalls+t.metrics.speculativeCalls);
  summary.push(`| ${scenario.name} | ${formatMs(mean(off))} | ${formatMs(mean(on))} | ${calls(on)-calls(off)} | ${sum(on,t=>t.metrics.usedPrefetches)} | ${sum(on,t=>t.metrics.unusedPrefetches)} |`);
  if(scenario.name==='ALL')summary.push('',`P95 action wait: OFF ${formatMs(percentile(waits(off),.95))}; ON ${formatMs(percentile(waits(on),.95))}.`, '', 'Token usage is in results.json provider events. No dollar estimates are made. Task elapsed includes the fixed review interval; action waits do not. Small samples do not establish production accuracy or statistical significance.');
}
summary.push('', '## Reliability — all trials, including failures', '', '| Mode | Trials | Completed journeys | Provider failures | Failed actions | Provider calls | Total action wait incl. failures |', '|---|---:|---:|---:|---:|---:|---:|');
for(const mode of ['OFF','ON']){
  const rows=trials.filter(t=>t.mode===mode);
  summary.push(`| ${mode} | ${rows.length} | ${rows.filter(t=>t.completed).length} | ${sum(rows,t=>t.metrics.failures)} | ${sum(rows,t=>t.metrics.failedActions)} | ${sum(rows,t=>t.metrics.demandCalls+t.metrics.speculativeCalls)} | ${(sum(rows,t=>t.metrics.totalWaitMs)/1000).toFixed(2)} s |`);
}
if(metadata.stopReason)summary.push('',metadata.stopReason);
summary.push('', `Latency comparison above uses ${cleanPairs.length/2} pairs with no provider failures in either mode. N/A means no valid paired measurements. All trials and failure events remain in results.json. A failed action ends that journey; there are no automatic retries. Failure-inclusive waiting is time spent on attempted actions, not time to eventual successful completion. Server action waits exclude browser/network/render overhead.`);
await writeFile(resolve(out,'summary.md'),summary.join('\n')+'\n');
console.log(`Saved ${out}`);
