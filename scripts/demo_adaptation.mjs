// Controlled live-provider adaptation demo. Synthetic whiteboards, real calls.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const opt=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i<0?d:process.argv[i+1];};
const base=opt('base','http://localhost:4000'),out=resolve(opt('out','work/adaptation-demo'));
const gap=Number(opt('gap-ms',10000));
if(!Number.isFinite(gap)||gap<0)throw Error('Use a nonnegative gap.');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function call(route,method='GET',body,session){const response=await fetch(`${base}/api/ai${route}`,{method,headers:{'Content-Type':'application/json',...(session?{'X-AI-Session':session}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;}
async function settle(session){const end=Date.now()+130000;while(Date.now()<end){const s=await call('/session','GET',null,session);if(!s.metrics.running)return s;await sleep(250);}throw Error('Provider work did not settle.');}
await mkdir(out,{recursive:true});
const run={createdAt:new Date().toISOString(),method:'Four synthetic whiteboards; actual Perceptron/Gemini calls. Authored READ_TEXT → SUMMARIZE choices, fresh session, read-ahead OFF. A controlled adaptation demonstration, not prediction accuracy.',steps:[]};
let session;
try{
 const initial=await call('/sessions','POST',{});session=initial.sessionId;
 run.providers=initial.providers;
 if(!initial.providers.perceptron.configured||!initial.providers.gemini.configured)throw Error('Configure both provider keys.');
 run.before=initial.learning;
 const image='data:image/png;base64,'+(await readFile(new URL('../frontend/public/ai-samples/whiteboard.png',import.meta.url))).toString('base64');
 const items=[];
 for(let i=0;i<4;i++)items.push(await call('/items','POST',{name:`adaptation-whiteboard-${i+1}.png`,type:'WHITEBOARD',image},session));
 await call('/session','PATCH',{enabled:true,readAhead:false},session);
 for(let i=0;i<items.length;i++){
  await call(`/items/${items[i].id}/open`,'POST',{},session);
  const read=await call(`/items/${items[i].id}/actions/READ_TEXT`,'POST',{},session);
  const prepared=await settle(session);
  if(prepared.metrics.failures)throw Error('A provider failed; stop rather than repeat background calls.');
  await sleep(gap);
  const summary=await call(`/items/${items[i].id}/actions/SUMMARIZE`,'POST',{},session);
  const state=await settle(session);
  run.steps.push({image:i+1,predictionsAfterRead:read.predictions,summarySource:summary.source,usedPrefetch:summary.usedPrefetch,waitMs:summary.waitMs,learning:state.learning});
  console.log(`Image ${i+1}: summary ${summary.source}, used prefire ${summary.usedPrefetch}`);
  await writeFile(resolve(out,'results.json'),JSON.stringify(run,null,2));
  if(state.metrics.failures)throw Error('A provider failed; results preserved.');
  if(i<items.length-1)await sleep(gap);
 }
 const final=await settle(session);run.after=final.learning;run.metrics=final.metrics;run.requestLog=final.requestLog;run.completed=true;
 const wb=run.after.find(x=>x.type==='WHITEBOARD');
 run.changed=wb?.startingPrefetch!==wb?.nowPrefetch;
 run.fourthConsumedSummary=Boolean(run.steps[3]?.usedPrefetch);
}catch(error){run.error=error.message;run.completed=false;console.error(error.message);process.exitCode=1;}
finally{if(session){try{const final=await settle(session);run.metrics=final.metrics;run.requestLog=final.requestLog;await call('/session','DELETE',null,session);}catch{}}await writeFile(resolve(out,'results.json'),JSON.stringify(run,null,2));}
