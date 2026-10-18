// Real provider calls. OFF vs fixed type rule vs Markov, same service/cache/budget.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {createAIService}=require('../backend/ai/service');const {createProviders}=require('../backend/ai/providers');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};
const out=path.resolve(arg('out','work/us-policy-benchmark'));const repetitions=Number(arg('repetitions',2));const gap=Number(arg('gap-ms',12000));
if(!Number.isInteger(repetitions)||repetitions<1||repetitions>5||!Number.isFinite(gap)||gap<0)throw Error('Invalid repetitions or gap.');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const manifestPath=path.join(root,'datasets/us-receipts/evaluation.json');const scenarios=JSON.parse(fs.readFileSync(manifestPath)).scenarios;
const modes=['OFF','FIXED','MARKOV'];
const metadata={serviceSourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'backend/ai/service.js'))).digest('hex'),createdAt:new Date().toISOString(),repetitions,reviewMs:1500,gapMs:gap,method:'Live providers through the same createAIService executor. Fresh session/cache/model for every trial; ordinary caching in all policies; read-ahead OFF. Fixed rule: extract after receipt OCR, once per item, subject to the same unreadable-total gate and budget. Rotating three-policy order. Provider calls are not delayed internally. Authored sequences, not real-user behavior or prediction accuracy.',scenarios};
const trials=[];fs.mkdirSync(out,{recursive:true});
const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({metadata,trials},null,2));
(async()=>{const providers=createProviders();if(!providers.status().gemini.configured||!providers.status().perceptron.configured)throw Error('Configure both API keys.');
 let stop=false;
 for(let r=1;r<=repetitions&&!stop;r++)for(let index=0;index<scenarios.length&&!stop;index++){
  const scenario=scenarios[index];const offset=(r-1+index)%3;const order=[...modes.slice(offset),...modes.slice(0,offset)];
  for(const mode of order){
   if(trials.length)await sleep(gap);
   const service=createAIService({providers,speculationPolicy:mode==='FIXED'?'fixed':'markov'});const session=service.createSession().sessionId;
   const bytes=fs.readFileSync(path.resolve(path.dirname(manifestPath),scenario.imagePath));
   const item=service.upload(session,{name:scenario.name,type:scenario.type,image:'data:image/jpeg;base64,'+bytes.toString('base64')});
   service.setEnabled(session,mode!=='OFF');const actions=[];let error;
   try{for(let i=0;i<scenario.actions.length;i++){const action=scenario.actions[i];const result=await service.perform(session,item.id,action);actions.push({...result});if(i<scenario.actions.length-1)await sleep(metadata.reviewMs);}}catch(e){error=e.message;}
   await service.idle(session);const state=service.snapshot(session);
   const trial={scenario:scenario.name,repetition:r,mode,inputSha256:crypto.createHash('sha256').update(bytes).digest('hex'),dwellMs:metadata.reviewMs,providers:providers.status(),completed:!error,clean:!error&&!state.metrics.failures,error,actions,metrics:state.metrics,requestLog:state.requestLog};
   trials.push(trial);save();console.log(`${trials.length}/${repetitions*scenarios.length*3} ${scenario.name} ${mode}: ${(trial.metrics.totalWaitMs/1000).toFixed(2)}s, ${trial.metrics.demandCalls+trial.metrics.speculativeCalls} calls, ${trial.metrics.failures} failures`);
   service.remove(session);
   if(state.requestLog.some(e=>/rate limit|quota/i.test(e.message||''))){metadata.stopReason='Stopped on quota/rate-limit error; partial evidence retained.';save();stop=true;break;}
  }
 }
})().catch(e=>{metadata.error=e.message;save();console.error(e.message);process.exitCode=1;});
