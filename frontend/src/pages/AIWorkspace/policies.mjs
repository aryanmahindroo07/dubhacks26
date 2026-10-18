const median=xs=>{const s=[...xs].sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2:null;};
const sum=(xs,f)=>xs.reduce((n,x)=>n+f(x),0);
export function comparePolicies(data){
 if(!data?.metadata||!Array.isArray(data.trials))throw Error('Expected a policy benchmark artifact.');
 const modes=['OFF','FIXED','MARKOV'];const groups=new Map();
 for(const t of data.trials){
  if(!modes.includes(t.mode)||!Number.isFinite(t.metrics?.totalWaitMs)||!Array.isArray(t.actions))throw Error('Invalid policy trial.');
  const key=JSON.stringify([t.scenario,t.repetition]);const group=groups.get(key)||{};
  if(group[t.mode])throw Error('Duplicate policy trial.');group[t.mode]=t;groups.set(key,group);
 }
 const triples=[...groups.values()].filter(g=>{
  if(!modes.every(mode=>g[mode]?.clean&&g[mode]?.completed&&!g[mode].metrics.running))return false;
  const signature=t=>JSON.stringify([t.inputSha256,t.dwellMs,t.providers,t.actions.map(a=>[a.action,a.model,a.promptVersion])]);
  return signature(g.OFF)===signature(g.FIXED)&&signature(g.OFF)===signature(g.MARKOV)&&g.OFF.metrics.speculativeCalls===0&&modes.every(m=>!g[m].requestLog.some(e=>e.kind==='read-ahead'));
 });
 const rows=modes.map(mode=>{const valid=triples.map(g=>g[mode]),all=data.trials.filter(t=>t.mode===mode);return {mode,validTrials:valid.length,totalTrials:all.length,medianWaitMs:median(valid.map(t=>t.metrics.totalWaitMs)),calls:sum(valid,t=>t.metrics.demandCalls+t.metrics.speculativeCalls),allCalls:sum(all,t=>t.metrics.demandCalls+t.metrics.speculativeCalls),used:sum(valid,t=>t.metrics.usedPrefetches),unused:sum(valid,t=>t.metrics.unusedPrefetches),failures:sum(all,t=>t.metrics.failures),failedActions:sum(all,t=>t.metrics.failedActions)};});
 const sequence=t=>t.requestLog.filter(e=>e.kind==='prefetch'&&e.result==='started').reverse().map(e=>e.action);
 const identical=triples.filter(g=>JSON.stringify(sequence(g.FIXED))===JSON.stringify(sequence(g.MARKOV))).length;
 const scenarios=[...new Set(triples.map(g=>g.OFF.scenario))].map(name=>{const selected=triples.filter(g=>g.OFF.scenario===name);return {name,triples:selected.length,offMs:median(selected.map(g=>g.OFF.metrics.totalWaitMs)),fixedMs:median(selected.map(g=>g.FIXED.metrics.totalWaitMs)),markovMs:median(selected.map(g=>g.MARKOV.metrics.totalWaitMs))};});
 return {triples:triples.length,excluded:groups.size-triples.length,rows,scenarios,identicalPolicyChoices:identical,offToMarkovMs:median(triples.map(g=>g.OFF.metrics.totalWaitMs-g.MARKOV.metrics.totalWaitMs)),fixedToMarkovMs:median(triples.map(g=>g.FIXED.metrics.totalWaitMs-g.MARKOV.metrics.totalWaitMs)),createdAt:data.metadata.createdAt,stopReason:data.metadata.stopReason};
}
