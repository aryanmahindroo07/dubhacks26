const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { createInboxModel, predictNextAction, toHistory } = require('../inbox/engine');
const { AIError, SUPPORTED_ACTIONS, hash } = require('./providers');

const SESSION_TTL = 60 * 60 * 1000;
const CACHE_TTL = 5 * 60 * 1000;
const MAX_SESSIONS = 20;
const MAX_ITEMS = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function validateImage(image) {
  if (typeof image !== 'string') throw new AIError('Choose a PNG, JPEG, or WebP image.');
  const match = image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length % 4 !== 0) throw new AIError('Image must be PNG, JPEG, or WebP encoded as a data URL.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_IMAGE_BYTES || bytes.length < 12) throw new AIError('Image must be smaller than 5 MB and contain image data.');
  const valid = match[1] === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (!valid) throw new AIError('Image content does not match its file type.');
  return hash(bytes);
}

function createAIService({ providers, now = Date.now, cacheTtl = CACHE_TTL, env = process.env } = {}) {
  const sessions = new Map();
  const prefetchLimit = Math.max(0, Math.min(10, Number(env.AI_PREFETCH_LIMIT_PER_ITEM ?? 3) || 0));
  function cleanup() {
    for (const [id, s] of sessions) if (now() - s.touchedAt > SESSION_TTL && s.running === 0) sessions.delete(id);
  }
  function createSession() {
    cleanup();
    if (sessions.size >= MAX_SESSIONS) throw new AIError('Demo session limit reached. Restart the backend to clear sessions.', 429);
    const id = randomUUID();
    sessions.set(id, { id, touchedAt: now(), enabled: false, docs: new Map(), cache: new Map(), attempts: [], events: [], predictions: [], waits: [], model: createInboxModel(), running: 0, background: new Set(), latencySamples: {},
      metrics: { navigations: 0, hits: 0, reused: 0, misses: 0, demandCalls: 0, speculativeCalls: 0, failures: 0, failedActions: 0 } });
    return { sessionId: id, ...snapshot(id) };
  }
  function getSession(id) {
    cleanup(); const s = sessions.get(id);
    if (!s) throw new AIError('Session expired or backend restarted. Start a fresh run.', 404, 'SESSION_EXPIRED');
    s.touchedAt = now(); return s;
  }
  function upload(id, { name, type, image } = {}) {
    const s = getSession(id);
    if (!['RECEIPT','WHITEBOARD'].includes(type)) throw new AIError('Choose Receipt or Whiteboard.');
    if (s.docs.size >= MAX_ITEMS) throw new AIError('Ten-image limit reached. Start a fresh run.');
    const imageHash = validateImage(image);
    const storedBytes = [...s.docs.values()].reduce((sum, doc) => sum + doc.image.length, 0);
    if (storedBytes + image.length > 12 * 1024 * 1024) throw new AIError("Image memory limit reached. Start a fresh run.");
    const item = { id: randomUUID(), name: typeof name === 'string' ? name.slice(0,120) : 'Uploaded image', type, image, imageHash, text: null, history: [], prefires: 0 };
    const previous=s.docs.get(s.activeItem);
    if(previous) s.model.recordTransition([...toHistory(previous.type,previous.history),`${previous.type}:DONE`]);
    s.activeItem=item.id;
    s.docs.set(item.id, item);
    return { id: item.id, name: item.name, type: item.type };
  }
  function docFor(s, id) { const doc = s.docs.get(id); if (!doc) throw new AIError('Image not found in this session.', 404); return doc; }
  function event(s, entry) {
    s.events.unshift({ id: randomUUID(), at: now(), ...entry });
    if (s.events.length > 200) s.events.length = 200;
  }
  function keyFor(doc, action) {
    return hash(JSON.stringify({ itemId: doc.id, image: doc.imageHash, type: doc.type, source: action === 'READ_TEXT' ? null : hash(doc.text || ''), action, ...providers.identity(action) }));
  }
  function cached(s, key) {
    const entry = s.cache.get(key);
    if (entry?.status === 'ready' && entry.expiresAt <= now()) { s.cache.delete(key); return undefined; }
    return entry;
  }
  function start(s, doc, action, speculative) {
    const key = keyFor(doc,action);
    const existing = cached(s,key);
    if (existing) return existing;
    if (s.running >= 4) throw new AIError('Too many AI calls are running. Wait and try again.', 429);
    const entry = { key, action, itemId: doc.id, speculative, status: 'pending', used: false, startedAt: now() };
    s.cache.set(key,entry);
    if (speculative) { s.attempts.push(entry); s.metrics.speculativeCalls++; doc.prefires++; }
    else s.metrics.demandCalls++;
    s.running++;
    const startTime = performance.now();
    event(s,{ kind: speculative ? 'prefetch' : 'provider', action, itemId: doc.id, result: 'started', model: providers.identity(action).model });
    entry.promise = Promise.resolve().then(() => providers.run(action,{...doc})).then(output => {
      entry.status = 'ready'; entry.expiresAt = now()+cacheTtl;
      entry.output = output; entry.providerMs = performance.now()-startTime;
      const sample = s.latencySamples[action] ||= { total: 0, count: 0 };
      sample.total += entry.providerMs; sample.count++;
      event(s,{ kind: speculative ? 'prefetch' : 'provider', action, itemId:doc.id, result:'completed', providerMs: entry.providerMs, model:output.model, usage:output.usage });
      return output;
    }).catch(error => {
      entry.status = 'failed'; s.metrics.failures++;
      s.cache.delete(key);
      event(s,{kind:speculative?'prefetch':'provider',action,itemId:doc.id,result:'failed',message:error.message});
      throw error;
    }).finally(()=>{s.running--;});
    return entry;
  }
  function predict(s,doc,history) {
    const latencyByAction = Object.fromEntries(Object.entries(s.latencySamples).map(([action,sample])=>[action,sample.total/sample.count]));
    return predictNextAction(doc.type, history, {latencyByAction}, s.model)
      .filter(p=>SUPPORTED_ACTIONS.includes(p.action))
      .map(p=>({ action:p.action,label:p.label,probability:p.probability,contextOrder:p.contextOrder,
        shouldPrefetch:p.shouldPrefetch,expectedValue:p.expectedValue,
        estimatedProviderMs:s.latencySamples[p.action]?.count ? s.latencySamples[p.action].total/s.latencySamples[p.action].count : p.latencyMs,
        latencySource:s.latencySamples[p.action]?.count?'measured':'placeholder',
        eligible: providers.available(p.action) && (p.action === 'READ_TEXT' || Boolean(doc.text)),
      }));
  }
  function prefetch(s,doc,predictions) {
    if (!s.enabled || doc.prefires >= prefetchLimit || s.attempts.some(e=>e.status==='pending')) return;
    const prediction = predictions.find(p=>p.shouldPrefetch && p.eligible && !cached(s,keyFor(doc,p.action)));
    if (!prediction) return;
    // No new operations are invented: only the registered read-only actions.
    const entry = start(s,doc,prediction.action,true);
    const task = entry.promise.catch(()=>{});
    s.background.add(task);
    task.finally(()=>s.background.delete(task));
  }
  async function perform(id,itemId,action) {
    const s = getSession(id), doc=docFor(s,itemId);
    if (!SUPPORTED_ACTIONS.includes(action)) throw new AIError('Unsupported action.');
    if (!providers.available(action)) throw new AIError(`Configure ${action==='READ_TEXT'?'PERCEPTRON_API_KEY':'GEMINI_API_KEY'} in backend/.env and restart the backend.`,503,'MISSING_API_KEY');
    if (action !== 'READ_TEXT' && !doc.text) throw new AIError('Run Read text successfully first.',409,'OCR_REQUIRED');
    const startTime=performance.now();
    const existing=cached(s,keyFor(doc,action));
    const source=existing?.status==='ready'?'cache':existing?'in-flight':'network';
    s.metrics[source==='cache'?'hits':source==='in-flight'?'reused':'misses']++;
    const entry=existing || start(s,doc,action,false);
    let output;
    try { output=await entry.promise; }
    catch (error) {
      const waitMs=performance.now()-startTime;
      s.waits.push(waitMs);s.metrics.failedActions++;
      event(s,{kind:'navigation',action,itemId:doc.id,result:'failed',source,waitMs,message:error.message});
      throw error;
    }
    const usedPrefetch=entry.speculative && !entry.used;
    if (usedPrefetch) entry.used=true;
    if (action==='READ_TEXT') doc.text=output.result.text;
    const waitMs=performance.now()-startTime;
    s.metrics.navigations++;s.waits.push(waitMs);
    event(s,{kind:'navigation',action,itemId:doc.id,result:source,waitMs,usedPrefetch,providerMs:entry.providerMs});
    // Reopening cached results and retrying failed operations must not train
    // duplicate transitions. Learn each successfully completed action once.
    if(!doc.history.includes(action)) {
      doc.history.push(action);
      s.model.recordTransition(toHistory(doc.type,doc.history));
    }
    const predictions=predict(s,doc,doc.history);s.predictions=predictions;
    prefetch(s,doc,predictions);
    return { action,result:output.result,provider:output.provider,model:output.model,promptVersion:output.promptVersion,usage:output.usage,
      source,waitMs,providerMs:entry.providerMs,usedPrefetch,predictions,simulated:false };
  }
  function setEnabled(id,enabled) {
    if (typeof enabled !== 'boolean') throw new AIError('enabled must be true or false.');
    getSession(id).enabled=enabled;return snapshot(id);
  }
  function snapshot(id) {
    const s=getSession(id);
    const sorted=[...s.waits].sort((a,b)=>a-b), n=sorted.length;
    const attempts=s.attempts;
    return { enabled:s.enabled, providers:providers.status(), prefetchLimitPerItem:prefetchLimit,
      metrics:{...s.metrics, running:s.running,
        usedPrefetches:attempts.filter(e=>e.used&&e.status==='ready').length,
        unusedPrefetches:attempts.filter(e=>!e.used&&e.status==='ready').length,
        pendingPrefetches:attempts.filter(e=>e.status==='pending').length,
        failedPrefetches:attempts.filter(e=>e.status==='failed').length,
        totalWaitMs:s.waits.reduce((a,b)=>a+b,0),
        medianWaitMs:n?(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2:0,
        p95WaitMs:n?sorted[Math.ceil(n*.95)-1]:0,
      },
      predictions:s.predictions.map(p=>({...p})),
      requestLog:s.events.map(e=>({...e})),
      modelTraining:'500 generated journeys; designed behavior probabilities, not real-user accuracy',
      scoring:'35% probability floor and inherited expected-value policy; initial latency and cost assumptions are placeholders, not measured ROI',
    };
  }
  async function idle(id) { const s=getSession(id); while(s.background.size) await Promise.all([...s.background]); }
  function remove(id) {
    const s=getSession(id);
    if(s.running)throw new AIError('Wait for running calls to finish before clearing this run.',409);
    sessions.delete(id);
  }
  return {createSession,upload,perform,setEnabled,snapshot,idle,remove};
}
module.exports={createAIService,validateImage};
