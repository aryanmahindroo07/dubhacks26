// Offline prediction evaluation using the app's actual MarkovPredictor.
const fs=require('node:fs');const path=require('node:path');const {performance}=require('node:perf_hooks');
const {MarkovPredictor}=require('../backend/prediction/markov');
const {scorePredictions}=require('../backend/prediction/scoring');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../work/wikispeedia/prepared.json'),'utf8'));
const model=new MarkovPredictor([...data.articles,'__STOP__']);model.train(data.train);
const globalCounts=new Map();for(const journey of data.train)for(const state of journey.slice(1))globalCounts.set(state,(globalCounts.get(state)||0)+1);
const definitions=['Global popularity','First order, always top-1','First/second order, always top-1','First order, scored 35% floor','First/second order, scored 35% floor'];
const totals=Object.fromEntries(definitions.map(name=>[name,{decisions:0,predictions:0,correct:0,confidenceSum:0}]));
const examples={correct:[],incorrect:[]};
let novelNext=0,stops=0,backOrCached=0;const started=performance.now();
for(const journey of data.test){
 const seen=new Set();
 for(let i=0;i<journey.length-1;i++){
  const current=journey[i],actual=journey[i+1];seen.add(current);
  const candidates=[...new Set(data.links[current]||[])].filter(x=>!seen.has(x));
  if(actual==='__STOP__')stops++;else if(seen.has(actual))backOrCached++;else novelNext++;
  const first=model.predict([current],candidates)[0];
  const mixed=model.predict(journey.slice(Math.max(0,i-1),i+1),candidates)[0];
  let popular;for(const c of candidates)if(popular===undefined||(globalCounts.get(c)||0)>(globalCounts.get(popular)||0))popular=c;
  const scored=mixed&&scorePredictions([mixed])[0];
  const firstScored=first&&scorePredictions([first])[0];
  if(scored?.shouldPrefetch){const category=scored.endpoint===actual?'correct':'incorrect';if(examples[category].length<3)examples[category].push({history:journey.slice(Math.max(0,i-1),i+1).map(decodeURIComponent),predicted:decodeURIComponent(scored.endpoint),actual:decodeURIComponent(actual),probability:scored.probability});}
  const predictions=[popular?{endpoint:popular}:undefined,first,mixed,firstScored?.shouldPrefetch?firstScored:undefined,scored?.shouldPrefetch?scored:undefined];
  definitions.forEach((name,j)=>{const t=totals[name],p=predictions[j];t.decisions++;if(p){t.predictions++;t.correct+=Number(p.endpoint===actual);t.confidenceSum+=p.probability||0;}});
 }
}
const results=Object.entries(totals).map(([policy,t])=>({policy,...t,coverage:t.predictions/t.decisions,precision:t.predictions?t.correct/t.predictions:0,correctPerDecision:t.correct/t.decisions,immediateUnused:t.predictions-t.correct,meanEstimatedProbability:policy.includes('scored')&&t.predictions?t.confidenceSum/t.predictions:null}));
const output={metadata:data.metadata,trainPaths:data.train.length,testPaths:data.test.length,novelNext,stops,backOrCached,examples,results,evaluationMs:performance.now()-started};
const out=path.join(__dirname,'../work/navigation-evaluation');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(output,null,2)+'\n');
const pct=v=>(100*v).toFixed(2)+'%';
const text=['# Held-out human-navigation evaluation','',`Source: ${data.metadata.source}`, '', `${data.train.length} training paths; ${data.test.length} held-out paths. ${data.metadata.split}`, '', data.metadata.processing,'', '| Policy | Decisions | Prefetches | Correct next-page predictions | Precision when predicting | Coverage | Correct per decision |','|---|---:|---:|---:|---:|---:|---:|',...results.map(r=>`| ${r.policy} | ${r.decisions} | ${r.predictions} | ${r.correct} | ${pct(r.precision)} | ${pct(r.coverage)} | ${pct(r.correctPerDecision)} |`),'',`Test outcomes include ${novelNext} next pages not already visited, ${backOrCached} cached/back visits and ${stops} stops. Stops and cached next visits stay in the denominator; speculative requests at those points are not counted as immediately useful.`, '', 'This evaluates the existing first/second-order Markov core on actual human navigation. It does not demonstrate real-user accuracy in the AI inbox/customer dashboard. Wikispeedia is goal-directed game navigation and is a different domain. The model never sees the target as a feature. We did not tune thresholds on the test set. A correct next-page prediction does not imply a measured latency saving: there are no per-click request latencies or review intervals here. No API calls or dollar/runtime savings are claimed.', '', 'Training uses natural repeated/back transitions; evaluation candidates exclude already visited pages. Smoothing is the app default alpha=1 and second-order fallback minimum=3. Scored policy uses the existing 35% floor and default scoring assumptions, not a measured economic optimum. Report both precision and coverage; high precision at low coverage is not overall accuracy.', '', 'Citation: Robert West and Jure Leskovec, Human Wayfinding in Information Networks, WWW 2012; Robert West, Joelle Pineau and Doina Precup, Wikispeedia: An Online Game for Inferring Semantic Distances between Concepts, IJCAI 2009. Raw paths/hashed identifiers are not included in the report or committed.'];
fs.writeFileSync(path.join(out,'summary.md'),text.join('\n')+'\n');console.log(text.join('\n'));
