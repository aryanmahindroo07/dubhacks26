const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createAIService,validateImage}=require('./service');
const {createProviders,AIError}=require('./providers');
const IMAGE='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../../frontend/public/ai-samples/receipt.png')).toString('base64');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({hold=false,fail=false,available=true,ocrText='Vendor: Demo Shop\nTotal: $13.20',delayMs=0,...options}={}) {
  const calls=[];let release;let failOnce=fail;
  const providers={
    available:()=>available,
    identity:action=>({provider:action==='READ_TEXT'?'perceptron':'gemini',model:'test-model',promptVersion:'test-v1'}),
    status:()=>({perceptron:{configured:available,model:'test-model'},gemini:{configured:available,model:'test-model'}}),
    run:async(action,doc)=>{
      calls.push({action,text:doc.text});
      if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
      if(action==='EXTRACT_FIELDS'&&hold)await new Promise(resolve=>release=resolve);
      if(action==='EXTRACT_FIELDS'&&failOnce){failOnce=false;throw new AIError('test failure',502);}
      return {result:action==='READ_TEXT'?{text:ocrText}:action==='EXTRACT_FIELDS'?{fields:[{name:'total',value:'13.20'}]}:{summary:'Demo summary'},provider:action==='READ_TEXT'?'perceptron':'gemini',model:'test-model',usage:{input:10,output:5}};
    },
  };
  const service=createAIService({providers,...options});
  const session=service.createSession().sessionId;
  const item=service.upload(session,{type:'RECEIPT',name:'receipt.png',image:IMAGE});
  return {service,session,item,calls,release:()=>release()};
}

test('OFF uses real executor cache without any speculative calls',async()=>{
  const f=fixture();
  await f.service.perform(f.session,f.item.id,'READ_TEXT');
  const first=await f.service.perform(f.session,f.item.id,'EXTRACT_FIELDS');
  const second=await f.service.perform(f.session,f.item.id,'EXTRACT_FIELDS');
  assert.equal(first.source,'network');assert.equal(second.source,'cache');
  assert.equal(f.calls.length,2);assert.equal(f.service.snapshot(f.session).metrics.speculativeCalls,0);
});

test('completed prefire is consumed once and never issues a duplicate provider call',async()=>{
  const f=fixture();f.service.setEnabled(f.session,true);
  await f.service.perform(f.session,f.item.id,'READ_TEXT');await f.service.idle(f.session);
  assert.deepEqual(f.calls.map(c=>c.action),['READ_TEXT','EXTRACT_FIELDS']);
  const result=await f.service.perform(f.session,f.item.id,'EXTRACT_FIELDS');
  assert.equal(result.source,'cache');assert.equal(result.usedPrefetch,true);assert.equal(result.simulated,false);
  await f.service.perform(f.session,f.item.id,'EXTRACT_FIELDS');await f.service.idle(f.session);
  const m=f.service.snapshot(f.session).metrics;
  assert.equal(m.usedPrefetches,1);assert.equal(f.calls.filter(c=>c.action==='EXTRACT_FIELDS').length,1);
});

test('early demand joins pending prefire, and pause allows it to finish',async()=>{
  const f=fixture({hold:true});f.service.setEnabled(f.session,true);
  await f.service.perform(f.session,f.item.id,'READ_TEXT');await tick();
  const pending=f.service.perform(f.session,f.item.id,'EXTRACT_FIELDS');
  f.service.setEnabled(f.session,false);f.release();
  const result=await pending;await f.service.idle(f.session);
  assert.equal(result.source,'in-flight');assert.equal(result.usedPrefetch,true);
  assert.equal(f.calls.filter(c=>c.action==='EXTRACT_FIELDS').length,1);
  assert.equal(f.service.snapshot(f.session).metrics.reused,1);
});

test('expired prefires are unused; a demand refetch is not credited as a prefire hit',async()=>{
  let clock=100;
  const f=fixture({now:()=>clock,cacheTtl:10});f.service.setEnabled(f.session,true);
  await f.service.perform(f.session,f.item.id,'READ_TEXT');await f.service.idle(f.session);
  clock+=11;
  const output=await f.service.perform(f.session,f.item.id,'EXTRACT_FIELDS');await f.service.idle(f.session);
  assert.equal(output.source,'network');assert.equal(output.usedPrefetch,false);
  const m=f.service.snapshot(f.session).metrics;assert.equal(m.usedPrefetches,0);assert.equal(m.unusedPrefetches,1);
});

test('failed speculative call is cleaned up and demand can retry',async()=>{
  const f=fixture({fail:true});f.service.setEnabled(f.session,true);
  await f.service.perform(f.session,f.item.id,'READ_TEXT');await f.service.idle(f.session);
  assert.equal(f.service.snapshot(f.session).metrics.failedPrefetches,1);
  const output=await f.service.perform(f.session,f.item.id,'EXTRACT_FIELDS');await f.service.idle(f.session);
  assert.equal(output.source,'network');assert.equal(output.usedPrefetch,false);
});

test('session and item boundaries isolate cache and data; Gemini needs OCR first',async()=>{
  const f=fixture();
  await assert.rejects(f.service.perform(f.session,f.item.id,'SUMMARIZE'),e=>e.code==='OCR_REQUIRED');
  const other=f.service.createSession().sessionId;
  await assert.rejects(f.service.perform(other,f.item.id,'READ_TEXT'),e=>e.status===404);
  await f.service.perform(f.session,f.item.id,'READ_TEXT');
  const otherItem=f.service.upload(other,{type:'RECEIPT',image:IMAGE});
  const output=await f.service.perform(other,otherItem.id,'READ_TEXT');assert.equal(output.source,'network');
  assert.equal(f.calls.filter(c=>c.action==='READ_TEXT').length,2);
  assert.equal(f.service.snapshot(other).metrics.navigations,1);
});

test('prefetch budget zero, missing credentials, invalid actions, and image checks',async()=>{
  const f=fixture({env:{AI_PREFETCH_LIMIT_PER_ITEM:'0'}});f.service.setEnabled(f.session,true);
  await f.service.perform(f.session,f.item.id,'READ_TEXT');await f.service.idle(f.session);
  assert.equal(f.service.snapshot(f.session).metrics.speculativeCalls,0);
  await assert.rejects(f.service.perform(f.session,f.item.id,'SEND_EMAIL'),/Unsupported/);
  const unavailable=fixture({available:false});
  await assert.rejects(unavailable.service.perform(unavailable.session,unavailable.item.id,'READ_TEXT'),e=>e.code==='MISSING_API_KEY');
  assert.throws(()=>validateImage('data:image/png;base64,SGVsbG8='));
  assert.throws(()=>f.service.upload(f.session,{type:'UNKNOWN',image:IMAGE}));
});

test('fresh runs clear cache/model state; running calls cannot be cleared',async()=>{
  const f=fixture({hold:true});f.service.setEnabled(f.session,true);
  await f.service.perform(f.session,f.item.id,'READ_TEXT');await tick();
  assert.throws(()=>f.service.remove(f.session),e=>e.status===409);
  f.release();await f.service.idle(f.session);f.service.remove(f.session);
  assert.throws(()=>f.service.snapshot(f.session),e=>e.code==='SESSION_EXPIRED');
  const fresh=f.service.createSession();assert.equal(fresh.enabled,false);assert.equal(fresh.metrics.navigations,0);
});

test('HTTP provider adapters use the documented payloads and validate output',async()=>{
  const requests=[];
  const providers=createProviders({env:{PERCEPTRON_API_KEY:'fake-test-only',GEMINI_API_KEY:'fake-test-only'},fetchImpl:async(url,opts)=>{
    requests.push({url,...opts});
    return {ok:true,json:async()=>url.includes('perceptron')?{choices:[{message:{content:'OCR output'}}],usage:{prompt_tokens:12}}:{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({summary:'Result'})}]}}],usageMetadata:{promptTokenCount:10}}};
  }});
  const ocr=await providers.run('READ_TEXT',{image:IMAGE});assert.equal(ocr.result.text,'OCR output');
  const summary=await providers.run('SUMMARIZE',{text:ocr.result.text,type:'RECEIPT'});assert.equal(summary.result.summary,'Result');
  assert.equal(requests[0].url,'https://api.perceptron.inc/v1/chat/completions');
  assert.ok(requests[1].url.includes(':generateContent'));
  const body=JSON.parse(requests[1].body);assert.equal(body.generationConfig.responseMimeType,'application/json');
  assert.ok(!requests[1].body.includes(IMAGE),'Gemini receives OCR text, not the image');
  assert.equal(body.contents[0].parts[0].text,'OCR output','OCR is document data, not a wrapper object that can be extracted instead');
  const failed=createProviders({env:{GEMINI_API_KEY:'fake-test-only'},fetchImpl:async()=>({ok:false,status:403,json:async()=>({secret:'never return this'})})});
  await assert.rejects(failed.run('SUMMARIZE',{text:'source'}),e=>e.code==='PROVIDER_REJECTED'&&!e.message.includes('secret'));
});

test('live HTTP routes enforce sessions and return missing-key errors without simulated output',async()=>{
  const express=require('express');
  const {registerAIRoutes}=require('./routes');
  const app=express();app.use(express.json({limit:'8mb'}));
  registerAIRoutes(app,{service:createAIService({providers:createProviders({env:{}})})});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}/api/ai`;
  const call=(route,method='GET',body,session)=>fetch(base+route,{method,headers:{'Content-Type':'application/json',...(session?{'X-AI-Session':session}:{})},...(body?{body:JSON.stringify(body)}:{})});
  try{
    const created=await(await call('/sessions','POST',{})).json();
    assert.equal(created.providers.gemini.configured,false);
    const uploaded=await(await call('/items','POST',{type:'RECEIPT',image:IMAGE},created.sessionId)).json();
    const response=await call(`/items/${uploaded.id}/actions/READ_TEXT`,'POST',{},created.sessionId);
    assert.equal(response.status,503);
    const payload=await response.json();assert.equal(payload.code,'MISSING_API_KEY');assert.equal(payload.simulated,undefined);
    assert.equal((await call('/session')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});


test('failed demand and failed in-flight joins count waiting without counting a background-only failure twice',async()=>{
  const f=fixture({fail:true,hold:true});f.service.setEnabled(f.session,true);
  await f.service.perform(f.session,f.item.id,'READ_TEXT');await tick();
  const demand=f.service.perform(f.session,f.item.id,'EXTRACT_FIELDS');
  const rejected=assert.rejects(demand,/test failure/);
  f.release();await rejected;await f.service.idle(f.session);
  const state=f.service.snapshot(f.session);
  assert.equal(state.metrics.failedActions,1);
  assert.equal(state.metrics.failedPrefetches,1);
  assert.equal(state.metrics.navigations,1);
  const events=state.requestLog.filter(e=>e.kind==='navigation');
  assert.equal(events.length,2);
  assert.equal(events.find(e=>e.result==='failed').source,'in-flight');
  assert.ok(Math.abs(state.metrics.totalWaitMs-events.reduce((sum,e)=>sum+e.waitMs,0))<0.001);
  const g=fixture({fail:true});
  await g.service.perform(g.session,g.item.id,'READ_TEXT');
  await assert.rejects(g.service.perform(g.session,g.item.id,'EXTRACT_FIELDS'),/test failure/);
  assert.equal(g.service.snapshot(g.session).metrics.failedActions,1);
});


test('reopening a completed action does not retrain its transition',async()=>{
  const f=fixture();
  const first=await f.service.perform(f.session,f.item.id,'READ_TEXT');
  const again=await f.service.perform(f.session,f.item.id,'READ_TEXT');
  assert.deepEqual(first.predictions,again.predictions);
  assert.ok(again.predictions.every(p=>p.action!=='READ_TEXT'));
});


test('unreadable receipt amounts do not spend a speculative extraction call',async()=>{
  const f=fixture({ocrText:'Kupon 15\nSubtotal\nTax (10%)\nTotal'});
  f.service.setEnabled(f.session,true);
  await f.service.perform(f.session,f.item.id,'READ_TEXT');await f.service.idle(f.session);
  const state=f.service.snapshot(f.session);
  assert.equal(state.metrics.speculativeCalls,0);
  const prediction=state.predictions.find(p=>p.action==='EXTRACT_FIELDS');
  assert.equal(prediction.eligible,false);assert.match(prediction.eligibilityNote,/not readable/);
});

test('the model adapts to one user: three whiteboards summarized change the prefetch from tasks to summary',async()=>{
  // Realistic provider time: an instant action is (correctly) never worth prefetching.
  const f=fixture({delayMs:150});f.service.setEnabled(f.session,true);
  const before=f.service.snapshot(f.session).learning.find(l=>l.type==='WHITEBOARD');
  assert.equal(before.startingPrefetch,'MAKE_TASKS');assert.equal(before.nowPrefetch,'MAKE_TASKS');
  for(let i=0;i<3;i++){
    const board=f.service.upload(f.session,{type:'WHITEBOARD',name:`board-${i}.png`,image:IMAGE});
    await f.service.perform(f.session,board.id,'READ_TEXT');await f.service.idle(f.session);
    await f.service.perform(f.session,board.id,'SUMMARIZE');await f.service.idle(f.session);
  }
  const after=f.service.snapshot(f.session).learning.find(l=>l.type==='WHITEBOARD');
  assert.equal(after.startingPrefetch,'MAKE_TASKS');assert.equal(after.nowPrefetch,'SUMMARIZE');
  assert.equal(after.finishedItems,2);
  // The next whiteboard's prefetch follows the learned habit.
  const board=f.service.upload(f.session,{type:'WHITEBOARD',name:'board-3.png',image:IMAGE});
  f.calls.length=0;
  await f.service.perform(f.session,board.id,'READ_TEXT');await f.service.idle(f.session);
  assert.deepEqual(f.calls.map(c=>c.action),['READ_TEXT','SUMMARIZE']);
});

test('read-ahead reads the next receipt in the background only with consent',async()=>{
  const off=fixture();
  const second=off.service.upload(off.session,{type:'RECEIPT',name:'second.png',image:IMAGE});
  off.service.open(off.session,off.item.id);await off.service.idle(off.session);
  assert.equal(off.calls.length,0,'nothing is sent before the user opts in');

  const f=fixture();
  const next=f.service.upload(f.session,{type:'RECEIPT',name:'second.png',image:IMAGE});
  f.service.open(f.session,f.item.id);
  f.service.setReadAhead(f.session,true);await f.service.idle(f.session);
  assert.deepEqual(f.calls.map(c=>c.action),['READ_TEXT']);
  const state=f.service.snapshot(f.session);
  assert.equal(state.items.find(i=>i.id===next.id).textReady,true);
  assert.ok(state.requestLog.some(e=>e.kind==='read-ahead'&&e.result==='completed'));
  const opened=await f.service.perform(f.session,next.id,'READ_TEXT');
  assert.equal(opened.source,'cache');assert.equal(opened.usedPrefetch,true);
  assert.equal(f.calls.length,1,'the read-ahead result is reused, not fetched again');
  assert.ok(second);
});

test('duplicate receipts are flagged: same image, or same total and date',async()=>{
  const f=fixture();
  const again=f.service.upload(f.session,{type:'RECEIPT',name:'again.png',image:IMAGE});
  assert.equal(again.duplicateOf.id,f.item.id);

  const providers={available:()=>true,identity:a=>({provider:'p',model:'m',promptVersion:'t'}),status:()=>({perceptron:{configured:true},gemini:{configured:true}}),
    run:async(action)=>action==='READ_TEXT'?{result:{text:'TOTAL 13.20\nDATE 2026-10-17'}}:{result:{fields:[
      {name:'total',value:'13.20',evidence:'TOTAL 13.20',status:'supported-by-ocr'},{name:'date',value:'2026-10-17',evidence:'DATE 2026-10-17',status:'supported-by-ocr'}]}}};
  const service=createAIService({providers});const session=service.createSession().sessionId;
  const png=(n)=>'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(8,n)]).toString('base64');
  const a=service.upload(session,{type:'RECEIPT',name:'a.png',image:png(1)});
  const b=service.upload(session,{type:'RECEIPT',name:'b.png',image:png(2)});
  assert.equal(b.duplicateOf,null);
  for(const item of [a,b]){await service.perform(session,item.id,'READ_TEXT');await service.perform(session,item.id,'EXTRACT_FIELDS');}
  const flagged=service.snapshot(session).items.find(i=>i.id===b.id).duplicateOf;
  assert.equal(flagged.id,a.id);assert.match(flagged.reason,/13\.20.*2026-10-17/);
});

test('a failing background OCR gets one round of attempts, never repeated; a click starts a new round',async()=>{
  let calls=0;
  const providers={available:()=>true,identity:a=>({provider:'p',model:'m',promptVersion:'t'}),status:()=>({perceptron:{configured:true},gemini:{configured:true}}),
    run:async()=>{calls++;await tick();throw new AIError('Perceptron request failed or timed out.',502,'PROVIDER_UNAVAILABLE');}};
  const service=createAIService({providers,ocrRetryDelaysMs:[1,1]});const session=service.createSession().sessionId;
  const a=service.upload(session,{type:'RECEIPT',name:'a.png',image:IMAGE});
  service.upload(session,{type:'RECEIPT',name:'b.png',image:IMAGE});
  service.open(session,a.id);service.setReadAhead(session,true);await service.idle(session);
  assert.equal(calls,3,'one round of three attempts in the background');
  service.open(session,a.id);await service.idle(session);assert.equal(calls,3,'not repeated');
  await assert.rejects(service.perform(session,a.id,'READ_TEXT'),/gave up after 3 attempts/);
  assert.equal(calls,6,'an explicit click starts a new round');
  assert.equal(service.snapshot(session).items.find(i=>i.id===a.id).error.action,'READ_TEXT');
});

test('typed text replaces failed OCR and unlocks Gemini actions',async()=>{
  const f=fixture();
  assert.throws(()=>f.service.setText(f.session,f.item.id,'   '),/Enter the text/);
  const typed=f.service.setText(f.session,f.item.id,'Total $13.20');
  assert.equal(typed.source,'manual');assert.equal(f.calls.length,0,'no provider call for typed text');
  const extract=await f.service.perform(f.session,f.item.id,'EXTRACT_FIELDS');
  assert.equal(f.calls.at(-1).text,'Total $13.20');assert.equal(extract.source,'network');
  const item=f.service.snapshot(f.session).items.find(i=>i.id===f.item.id);
  assert.equal(item.textSource,'manual');assert.equal(item.read,true);
});

function flakyOcr(failures, error=()=>new AIError('Perceptron request failed or timed out.',502,'PROVIDER_UNAVAILABLE')) {
  let calls=0;
  const providers={available:()=>true,identity:a=>({provider:'p',model:'m',promptVersion:'t'}),status:()=>({perceptron:{configured:true},gemini:{configured:true}}),
    run:async(action)=>{calls++;await tick();if(action==='READ_TEXT'&&calls<=failures)throw error();return {result:{text:'Total 13.20'}};}};
  const service=createAIService({providers,ocrRetryDelaysMs:[1,1]});
  const session=service.createSession().sessionId;
  return {service,session,calls:()=>calls};
}

test('Read text retries a temporary failure up to twice, then succeeds',async()=>{
  const f=flakyOcr(2);const item=f.service.upload(f.session,{type:'RECEIPT',name:'r.png',image:IMAGE});
  const result=await f.service.perform(f.session,item.id,'READ_TEXT');
  assert.equal(result.result.text,'Total 13.20');assert.equal(f.calls(),3);
  assert.equal(f.service.snapshot(f.session).requestLog.filter(e=>/^retry/.test(e.result)).length,2);
});

test('Read text stops after three attempts and offers typed text',async()=>{
  const f=flakyOcr(99);const item=f.service.upload(f.session,{type:'RECEIPT',name:'r.png',image:IMAGE});
  await assert.rejects(f.service.perform(f.session,item.id,'READ_TEXT'),/gave up after 3 attempts/);
  assert.equal(f.calls(),3);
  assert.equal(f.service.snapshot(f.session).items[0].error.action,'READ_TEXT');
  f.service.setText(f.session,item.id,'Total 13.20');
  assert.equal(f.service.snapshot(f.session).items[0].textSource,'manual');
});

test('a wrong key, model or quota is not retried',async()=>{
  for(const status of [401,404,429]){
    const f=flakyOcr(99,()=>Object.assign(new AIError('Perceptron: rejected.',502,'PROVIDER_REJECTED'),{providerStatus:status}));
    const item=f.service.upload(f.session,{type:'RECEIPT',name:'r.png',image:IMAGE});
    await assert.rejects(f.service.perform(f.session,item.id,'READ_TEXT'));
    assert.equal(f.calls(),1,`status ${status}`);
  }
  const server=flakyOcr(99,()=>Object.assign(new AIError('Perceptron: HTTP 503.',502,'PROVIDER_REJECTED'),{providerStatus:503}));
  const item=server.service.upload(server.session,{type:'RECEIPT',name:'r.png',image:IMAGE});
  await assert.rejects(server.service.perform(server.session,item.id,'READ_TEXT'));
  assert.equal(server.calls(),3,'server errors are retried');
});

test('a timeout is not retried automatically but still offers Retry',async()=>{
  const f=flakyOcr(99,()=>new AIError('Perceptron did not answer within 15 s.',502,'PROVIDER_TIMEOUT'));
  const item=f.service.upload(f.session,{type:'RECEIPT',name:'r.png',image:IMAGE});
  await assert.rejects(f.service.perform(f.session,item.id,'READ_TEXT'),/did not answer/);
  assert.equal(f.calls(),1,'one wait of AI_TIMEOUT_MS, not three');
  const error=f.service.snapshot(f.session).items[0].error;
  assert.equal(error.recovery,'retry');assert.equal(error.attempts,1);
  const providers=createProviders({env:{PERCEPTRON_API_KEY:'fake-test-only',AI_TIMEOUT_MS:'1000'},fetchImpl:async()=>{throw new DOMException('timed out','TimeoutError');}});
  await assert.rejects(providers.run('READ_TEXT',{image:IMAGE}),e=>e.code==='PROVIDER_TIMEOUT'&&/within 1 s/.test(e.message));
  const offline=createProviders({env:{PERCEPTRON_API_KEY:'fake-test-only'},fetchImpl:async()=>{throw new TypeError('fetch failed');}});
  await assert.rejects(offline.run('READ_TEXT',{image:IMAGE}),e=>e.code==='PROVIDER_UNAVAILABLE');
});

test('read-ahead also stops after three attempts on a failing image',async()=>{
  const f=flakyOcr(99);
  const a=f.service.upload(f.session,{type:'RECEIPT',name:'a.png',image:IMAGE});
  f.service.upload(f.session,{type:'RECEIPT',name:'b.png',image:IMAGE});
  f.service.open(f.session,a.id);f.service.setReadAhead(f.session,true);await f.service.idle(f.session);
  f.service.open(f.session,a.id);await f.service.idle(f.session);
  assert.equal(f.calls(),3);
});

test('each kind of failure gets its own recovery',async()=>{
  const {recoveryFor}=require('./service');
  const rejected=status=>Object.assign(new AIError('x',502,'PROVIDER_REJECTED'),{providerStatus:status});
  assert.equal(recoveryFor(new AIError('network',502,'PROVIDER_UNAVAILABLE')),'retry');
  assert.equal(recoveryFor(new AIError('timeout',502,'PROVIDER_TIMEOUT')),'retry');
  assert.equal(recoveryFor(new AIError('garbled',502,'INVALID_PROVIDER_RESPONSE')),'retry');
  assert.equal(recoveryFor(rejected(503)),'retry');
  assert.equal(recoveryFor(new AIError('no text',502,'EMPTY_PROVIDER_RESPONSE')),'image');
  assert.equal(recoveryFor(new AIError('cut off',502,'INCOMPLETE_PROVIDER_RESPONSE')),'image');
  assert.equal(recoveryFor(rejected(429)),'wait');
  for(const status of [401,403,404])assert.equal(recoveryFor(rejected(status)),'setup');
  assert.equal(recoveryFor(new AIError('key',503,'MISSING_API_KEY')),'setup');
});

test('image problems are not retried; the item records why it failed',async()=>{
  const f=flakyOcr(99,()=>new AIError('Perceptron returned no readable text.',502,'EMPTY_PROVIDER_RESPONSE'));
  const item=f.service.upload(f.session,{type:'RECEIPT',name:'r.png',image:IMAGE});
  await assert.rejects(f.service.perform(f.session,item.id,'READ_TEXT'),/no readable text/);
  assert.equal(f.calls(),1);
  const error=f.service.snapshot(f.session).items[0].error;
  assert.equal(error.recovery,'image');assert.equal(error.attempts,1);
  const t=flakyOcr(99);const other=t.service.upload(t.session,{type:'RECEIPT',name:'r.png',image:IMAGE});
  await assert.rejects(t.service.perform(t.session,other.id,'READ_TEXT'));
  assert.deepEqual([t.service.snapshot(t.session).items[0].error.recovery,t.service.snapshot(t.session).items[0].error.attempts],['retry',3]);
});

test('the learning panel names the same action the next prefetch will run',async()=>{
  const f=fixture({delayMs:150});f.service.setEnabled(f.session,true);
  for(let i=0;i<2;i++){
    const board=f.service.upload(f.session,{type:'WHITEBOARD',name:`board-${i}.png`,image:IMAGE});
    await f.service.perform(f.session,board.id,'READ_TEXT');await f.service.idle(f.session);
    await f.service.perform(f.session,board.id,'SUMMARIZE');await f.service.idle(f.session);
  }
  const board=f.service.upload(f.session,{type:'WHITEBOARD',name:'board-2.png',image:IMAGE});
  f.service.open(f.session,board.id);
  const panel=f.service.snapshot(f.session).learning.find(l=>l.type==='WHITEBOARD').nowPrefetch;
  f.calls.length=0;
  await f.service.perform(f.session,board.id,'READ_TEXT');await f.service.idle(f.session);
  assert.equal(f.calls[1]?.action,panel,'panel and real prefetch agree');
});
