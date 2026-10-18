const median=xs=>{const s=[...xs].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2:null;};
const sum=(xs,fn)=>xs.reduce((n,x)=>n+fn(x),0);
// Only compare fresh scripted trials from one benchmark artifact. Ordinary UI
// exports do not establish matching inputs, dwell, or an unchanged policy.
export function compareTrials(data){
  if(!data?.metadata||!Array.isArray(data.trials))throw Error('Choose results.json from scripts/benchmark_ai.mjs. Single-run exports cannot establish a matched comparison.');
  const groups=new Map();
  for(const t of data.trials){
    if(!['ON','OFF'].includes(t.mode)||!Number.isFinite(t.metrics?.totalWaitMs)||t.metrics.totalWaitMs<0||!Array.isArray(t.actions)||!Number.isFinite(t.metrics.demandCalls)||!Number.isFinite(t.metrics.speculativeCalls))throw Error('Invalid trial measurements.');
    const key=JSON.stringify([t.scenario,t.repetition]);
    const g=groups.get(key)||{};
    if(g[t.mode])throw Error('Duplicate trial in pair.');
    g[t.mode]=t;groups.set(key,g);
  }
  const pairs=[];
  for(const g of groups.values()){
    const {ON:on,OFF:off}=g;
    if(!on||!off||!on.clean||!off.clean||!on.completed||!off.completed)continue;
    if(on.metrics.running||off.metrics.running||off.metrics.speculativeCalls!==0)continue;
    if(on.dwellMs!==off.dwellMs||JSON.stringify(on.actions.map(a=>a.action))!==JSON.stringify(off.actions.map(a=>a.action)))continue;
    if((on.inputSha256||off.inputSha256)&&on.inputSha256!==off.inputSha256)continue;
    if(JSON.stringify(on.providers)!==JSON.stringify(off.providers))continue;
    // Read-ahead and manually supplied text are separate experiments.
    if([on,off].some(t=>t.readAhead||t.manualText||t.requestLog?.some(e=>e.kind==='read-ahead'||e.kind==='manual-text')))continue;
    pairs.push({off,on,savedMs:off.metrics.totalWaitMs-on.metrics.totalWaitMs});
  }
  const totals=mode=>({totalCalls:sum(pairs,p=>p[mode].metrics.demandCalls+p[mode].metrics.speculativeCalls),wait:median(pairs.map(p=>p[mode].metrics.totalWaitMs)),calls:median(pairs.map(p=>p[mode].metrics.demandCalls+p[mode].metrics.speculativeCalls)),used:sum(pairs,p=>p[mode].metrics.usedPrefetches||0),unused:sum(pairs,p=>p[mode].metrics.unusedPrefetches||0)});
  const scenarios=[...new Set(pairs.map(p=>p.off.scenario))].map(name=>{const selected=pairs.filter(p=>p.off.scenario===name);return {name,pairs:selected.length,offMs:median(selected.map(p=>p.off.metrics.totalWaitMs)),onMs:median(selected.map(p=>p.on.metrics.totalWaitMs)),savedMs:median(selected.map(p=>p.savedMs)),extraCalls:sum(selected,p=>p.on.metrics.demandCalls+p.on.metrics.speculativeCalls-p.off.metrics.demandCalls-p.off.metrics.speculativeCalls),unused:sum(selected,p=>p.on.metrics.unusedPrefetches||0)};});
  return {scenarios,pairs:pairs.length,excludedGroups:groups.size-pairs.length,off:totals('off'),on:totals('on'),savedMs:median(pairs.map(p=>p.savedMs)),allTrials:data.trials.length,failures:sum(data.trials,t=>t.metrics.failures||0),failedActions:sum(data.trials,t=>t.metrics.failedActions||0),description:data.metadata.inputDescription||'',dwellMs:data.metadata.dwellMs,createdAt:data.metadata.createdAt,stopReason:data.metadata.stopReason};
}
