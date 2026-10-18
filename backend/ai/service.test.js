const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createAIService,validateImage}=require('./service');
const {createProviders,AIError}=require('./providers');
const IMAGE='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../../frontend/public/ai-samples/receipt.png')).toString('base64');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({hold=false,fail=false,available=true,...options}={}) {
  const calls=[];let release;let failOnce=fail;
  const providers={
    available:()=>available,
    identity:action=>({provider:action==='READ_TEXT'?'perceptron':'gemini',model:'test-model',promptVersion:'test-v1'}),
    status:()=>({perceptron:{configured:available,model:'test-model'},gemini:{configured:available,model:'test-model'}}),
    run:async(action,doc)=>{
      calls.push({action,text:doc.text});
      if(action==='EXTRACT_FIELDS'&&hold)await new Promise(resolve=>release=resolve);
      if(action==='EXTRACT_FIELDS'&&failOnce){failOnce=false;throw new AIError('test failure',502);}
      return {result:action==='READ_TEXT'?{text:'Vendor: Demo Shop\nTotal: $13.20'}:action==='EXTRACT_FIELDS'?{fields:[{name:'total',value:'13.20'}]}:{summary:'Demo summary'},provider:action==='READ_TEXT'?'perceptron':'gemini',model:'test-model',usage:{input:10,output:5}};
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
