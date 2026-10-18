const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { createInboxModel, createPersonalModel, predictBlended, toHistory } = require('../inbox/engine');
const { AIError, SUPPORTED_ACTIONS, hash } = require('./providers');
const { hasReadableTotal, amountToken } = require('./receiptValidation');

const LIVE_TYPES = ['RECEIPT', 'WHITEBOARD'];

const SESSION_TTL = 60 * 60 * 1000;
const CACHE_TTL = 5 * 60 * 1000;
const MAX_SESSIONS = 20;
const MAX_ITEMS = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// What to do about a failed provider call, decided by the kind of error:
//   retry - temporary (timeout, network, server error, garbled reply):
//           Read text retries automatically, up to twice (three attempts)
//   image - the image itself (no readable text, reply cut off): retrying the
//           same image gives the same result; use a better photo or type it
//   wait  - rate limit or quota: no automatic retry; try again later
//   setup - wrong key, no access or wrong model: stop; fix backend/.env
// Typing the text by hand is offered for every kind.
const OCR_RETRY_DELAYS_MS = [1000, 2000];
function recoveryFor(error) {
  switch (error?.code) {
    case 'MISSING_API_KEY': return 'setup';
    case 'EMPTY_PROVIDER_RESPONSE':
    case 'INCOMPLETE_PROVIDER_RESPONSE': return 'image';
    case 'PROVIDER_REJECTED':
      if (error.providerStatus === 429) return 'wait';
      return error.providerStatus >= 500 ? 'retry' : 'setup';
    default: return 'retry';
  }
}

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

function createAIService({ providers, now = Date.now, cacheTtl = CACHE_TTL, env = process.env, ocrRetryDelaysMs = OCR_RETRY_DELAYS_MS } = {}) {
  const sessions = new Map();
  const prefetchLimit = Math.max(0, Math.min(10, Number(env.AI_PREFETCH_LIMIT_PER_ITEM ?? 3) || 0));
  function cleanup() {
    for (const [id, s] of sessions) if (now() - s.touchedAt > SESSION_TTL && s.running === 0) sessions.delete(id);
  }
  function createSession() {
    cleanup();
    if (sessions.size >= MAX_SESSIONS) throw new AIError('Demo session limit reached. Restart the backend to clear sessions.', 429);
    const id = randomUUID();
    sessions.set(id, { id, touchedAt: now(), enabled: false, readAhead: false, order: [], activeItem: null, personal: createPersonalModel(), learned: { RECEIPT: 0, WHITEBOARD: 0 }, docs: new Map(), cache: new Map(), attempts: [], events: [], predictions: [], waits: [], model: createInboxModel(), running: 0, background: new Set(), latencySamples: {},
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
    const item = { id: randomUUID(), name: typeof name === 'string' ? name.slice(0,120) : 'Uploaded image', type, image, imageHash, text: null, textSource: null, history: [], prefires: 0, facts: null, duplicateOf: null, lastError: null, backgroundFailed: new Set() };
    // Duplicate receipts matter for expenses; other images are not flagged.
    const sameImage = type === 'RECEIPT' && [...s.docs.values()].find(doc => doc.type === 'RECEIPT' && doc.imageHash === imageHash);
    if (sameImage) item.duplicateOf = { id: sameImage.id, name: sameImage.name, reason: 'Same image was already uploaded.' };
    s.docs.set(item.id, item);
    s.order.push(item.id);
    // Uploading does not open the item; opening (or running an action) does.
    readAhead(s);
    return summary(s, item);
  }
  function summary(s, doc) {
    const ocr = s.cache.get(keyFor(doc, 'READ_TEXT'));
    return { id: doc.id, name: doc.name, type: doc.type, active: s.activeItem === doc.id, read: Boolean(doc.text),
      textReady: Boolean(doc.text) || ocr?.status === 'ready', textPending: ocr?.status === 'pending', duplicateOf: doc.duplicateOf,
      textSource: doc.textSource, error: doc.lastError };
  }
  // Switching to another item means the user finished the previous one: record
  // DONE in the user's own model so it learns when they stop, not only what
  // they do next.
  function focus(s, doc) {
    if (s.activeItem === doc.id) return;
    const previous = s.docs.get(s.activeItem);
    if (previous) {
      s.personal.recordTransition([...toHistory(previous.type, previous.history), `${previous.type}:DONE`]);
      s.learned[previous.type]++;
    }
    s.activeItem = doc.id;
  }
  function open(id, itemId) {
    const s = getSession(id), doc = docFor(s, itemId);
    focus(s, doc);
    readAhead(s);
    return summary(s, doc);
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
  function start(s, doc, action, speculative, kind) {
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
    kind ||= speculative ? 'prefetch' : 'provider';
    event(s,{ kind, action, itemId: doc.id, result: 'started', model: providers.identity(action).model });
    entry.promise = Promise.resolve().then(() => runWithRetries(s, doc, action, kind)).then(output => {
      entry.status = 'ready'; entry.expiresAt = now()+cacheTtl;
      entry.output = output; entry.providerMs = performance.now()-startTime;
      const sample = s.latencySamples[action] ||= { total: 0, count: 0 };
      sample.total += entry.providerMs; sample.count++;
      event(s,{ kind, action, itemId:doc.id, result:'completed', providerMs: entry.providerMs, model:output.model, usage:output.usage });
      return output;
    }).catch(error => {
      entry.status = 'failed'; s.metrics.failures++;
      s.cache.delete(key);
      // Background calls are never retried automatically; a click retries.
      if (speculative) doc.backgroundFailed.add(action);
      event(s,{kind,action,itemId:doc.id,result:'failed',message:error.message});
      throw error;
    }).finally(()=>{s.running--;});
    return entry;
  }
  async function runWithRetries(s, doc, action, kind) {
    const delays = action === 'READ_TEXT' ? ocrRetryDelaysMs : [];
    for (let attempt = 0; ; attempt++) {
      try { return await providers.run(action, { ...doc }); }
      catch (error) {
        if (attempt >= delays.length || recoveryFor(error) !== 'retry') {
          error.attempts = attempt + 1;
          if (attempt > 0 && error instanceof AIError) error.message = `${error.message} (gave up after ${attempt + 1} attempts)`;
          throw error;
        }
        event(s, { kind, action, itemId: doc.id, result: `retry ${attempt + 1} of ${delays.length}`, message: error.message });
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    }
  }
  function predict(s,doc,history) {
    const latencyByAction = Object.fromEntries(Object.entries(s.latencySamples).map(([action,sample])=>[action,sample.total/sample.count]));
    return predictBlended(doc.type, history, {latencyByAction}, s.model, s.personal)
      .filter(p=>SUPPORTED_ACTIONS.includes(p.action))
      .map(p=>({ action:p.action,label:p.label,probability:p.probability,startingProbability:p.startingProbability,personalObservations:p.personalObservations,contextOrder:p.contextOrder,
        shouldPrefetch:p.shouldPrefetch,expectedValue:p.expectedValue,
        estimatedProviderMs:s.latencySamples[p.action]?.count ? s.latencySamples[p.action].total/s.latencySamples[p.action].count : p.latencyMs,
        latencySource:s.latencySamples[p.action]?.count?'measured':'placeholder',
        eligible: providers.available(p.action) && (p.action === 'READ_TEXT' || Boolean(doc.text)) && !(doc.type==='RECEIPT'&&p.action==='EXTRACT_FIELDS'&&!hasReadableTotal(doc.text)),
        eligibilityNote:doc.type==='RECEIPT'&&p.action==='EXTRACT_FIELDS'&&!hasReadableTotal(doc.text)?'Receipt total is not readable in OCR; check the image before extraction.':undefined,
      }));
  }
  function prefetch(s,doc,predictions) {
    if (!s.enabled || doc.prefires >= prefetchLimit || s.attempts.some(e=>e.status==='pending')) return;
    const prediction = predictions.find(p=>p.shouldPrefetch && p.eligible && !doc.backgroundFailed.has(p.action) && !cached(s,keyFor(doc,p.action)));
    if (!prediction) return;
    // No new operations are invented: only the registered read-only actions.
    track(s, start(s,doc,prediction.action,true));
  }
  function track(s, entry) {
    const task = entry.promise.catch(()=>{}).finally(()=>{ s.background.delete(task); readAhead(s); });
    s.background.add(task);
  }
  // Read-ahead: while the user works on one item, read the text of the next
  // unread item in the inbox, so it opens instantly. Sends that image to the
  // OCR provider before the user opens it, so it needs its own consent
  // (s.readAhead, off by default) and uses the same model gate as prefetch:
  // only if Read text is the likely first action for that kind of item.
  function readAhead(s) {
    if (!s.readAhead || !providers.available('READ_TEXT') || s.running >= 4) return;
    if (s.attempts.some(e=>e.status==='pending')) return;
    const from = s.order.indexOf(s.activeItem);
    const nextId = s.order.slice(from + 1).find(id => {
      const doc = s.docs.get(id);
      return !doc.text && !doc.lastError && !doc.backgroundFailed.has('READ_TEXT') && !cached(s, keyFor(doc, 'READ_TEXT')) && doc.prefires < prefetchLimit;
    });
    if (!nextId) return;
    const doc = s.docs.get(nextId);
    const first = predict(s, doc, []).find(p => p.shouldPrefetch && p.eligible);
    if (first?.action !== 'READ_TEXT') return;
    track(s, start(s, doc, 'READ_TEXT', true, 'read-ahead'));
  }
  async function perform(id,itemId,action) {
    const s = getSession(id), doc=docFor(s,itemId);
    if (!SUPPORTED_ACTIONS.includes(action)) throw new AIError('Unsupported action.');
    if (!providers.available(action)) {
      const error=new AIError(`Configure ${action==='READ_TEXT'?'PERCEPTRON_API_KEY':'GEMINI_API_KEY'} in backend/.env and restart the backend.`,503,'MISSING_API_KEY');
      doc.lastError={action,message:error.message,recovery:'setup',attempts:0};
      throw error;
    }
    if (action !== 'READ_TEXT' && !doc.text) throw new AIError('Run Read text successfully first.',409,'OCR_REQUIRED');
    focus(s, doc);
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
      doc.lastError={action,message:error.message,recovery:recoveryFor(error),attempts:error.attempts||1};
      event(s,{kind:'navigation',action,itemId:doc.id,result:'failed',source,waitMs,message:error.message});
      throw error;
    }
    const usedPrefetch=entry.speculative && !entry.used;
    if (usedPrefetch) entry.used=true;
    doc.lastError=null;
    if (action==='READ_TEXT') { doc.text=output.result.text; doc.textSource='ocr'; }
    const waitMs=performance.now()-startTime;
    s.metrics.navigations++;s.waits.push(waitMs);
    event(s,{kind:'navigation',action,itemId:doc.id,result:source,waitMs,usedPrefetch,providerMs:entry.providerMs});
    // Reopening cached results and retrying failed operations must not train
    // duplicate transitions. Learn each successfully completed action once.
    if(!doc.history.includes(action)) {
      doc.history.push(action);
      s.personal.recordTransition(toHistory(doc.type,doc.history));
    }
    if (action==='EXTRACT_FIELDS' && doc.type==='RECEIPT') checkDuplicate(s, doc, output.result);
    const predictions=predict(s,doc,doc.history);s.predictions=predictions;
    prefetch(s,doc,predictions);
    readAhead(s);
    return { action,result:output.result,provider:output.provider,model:output.model,promptVersion:output.promptVersion,usage:output.usage,
      source,waitMs,providerMs:entry.providerMs,usedPrefetch,predictions,duplicateOf:doc.duplicateOf,simulated:false };
  }
  // When OCR fails, the user can type or paste the text instead. It counts as
  // "text read" for learning and unlocks the Gemini actions; no provider call.
  function setText(id,itemId,text) {
    const s=getSession(id), doc=docFor(s,itemId);
    if (typeof text!=='string' || !text.trim()) throw new AIError('Enter the text from the image.');
    if (text.length>20000) throw new AIError('Text is too long (20,000 characters maximum).');
    focus(s,doc);
    doc.text=text.trim(); doc.textSource='manual'; doc.lastError=null;
    event(s,{kind:'navigation',action:'READ_TEXT',itemId:doc.id,result:'typed by user',waitMs:0});
    if(!doc.history.includes('READ_TEXT')) {
      doc.history.push('READ_TEXT');
      s.personal.recordTransition(toHistory(doc.type,doc.history));
    }
    const predictions=predict(s,doc,doc.history);s.predictions=predictions;
    prefetch(s,doc,predictions);
    readAhead(s);
    return { action:'READ_TEXT', result:{ text:doc.text, manual:true }, provider:'you', model:'typed text', source:'manual', waitMs:0, providerMs:0, usedPrefetch:false, predictions, simulated:false };
  }
  function setEnabled(id,enabled) {
    if (typeof enabled !== 'boolean') throw new AIError('enabled must be true or false.');
    getSession(id).enabled=enabled;return snapshot(id);
  }
  function setReadAhead(id,enabled) {
    if (typeof enabled !== 'boolean') throw new AIError('readAhead must be true or false.');
    const s=getSession(id);s.readAhead=enabled;readAhead(s);return snapshot(id);
  }
  // Same total and same date as an earlier receipt (both supported by OCR
  // evidence) suggests the receipt was submitted twice. A suggestion only.
  function checkDuplicate(s, doc, result) {
    const supported = name => result.fields?.find(f => f.status === 'supported-by-ocr' && f.value != null && (name === 'date' ? /date/i.test(f.name) : f.name === name));
    const total = amountToken(supported('total')?.value ?? null);
    const date = supported('date')?.value?.trim();
    doc.facts = total && date ? { total, date } : null;
    if (!doc.facts || doc.duplicateOf) return;
    const match = [...s.docs.values()].find(other => other !== doc && other.facts?.total === total && other.facts?.date === date);
    if (match) doc.duplicateOf = { id: match.id, name: match.name, reason: `Same total (${total}) and date (${date}) as an earlier receipt.` };
  }
  // What the user's own choices have changed, for the learning panel: the
  // predictions after "Read text" for each kind of item, starting vs now.
  function learning(s) {
    return LIVE_TYPES.map(type => {
      const now = predictBlended(type, ['READ_TEXT'], {}, s.model, s.personal).filter(p => SUPPORTED_ACTIONS.includes(p.action));
      const pick = list => list.find(p => p.shouldPrefetch)?.action ?? null;
      const starting = [...now].sort((a, b) => b.startingProbability - a.startingProbability);
      const startingPick = pick(predictBlended(type, ['READ_TEXT'], {}, s.model, null).filter(p => SUPPORTED_ACTIONS.includes(p.action)));
      return {
        type, after: 'READ_TEXT', finishedItems: s.learned[type], observations: now[0]?.personalObservations ?? 0,
        startingPrefetch: startingPick, nowPrefetch: pick(now),
        rows: starting.map(p => ({ action: p.action, label: p.label, starting: p.startingProbability, now: p.probability })),
      };
    });
  }
  function snapshot(id) {
    const s=getSession(id);
    const sorted=[...s.waits].sort((a,b)=>a-b), n=sorted.length;
    const attempts=s.attempts;
    return { enabled:s.enabled, readAhead:s.readAhead, providers:providers.status(), prefetchLimitPerItem:prefetchLimit,
      items:s.order.map(itemId=>summary(s,s.docs.get(itemId))), learning:learning(s),
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
      modelTraining:'Starts from 500 generated journeys (designed probabilities, not real-user accuracy), then adapts to this session\'s own choices',
      scoring:'35% probability floor and inherited expected-value policy; initial latency and cost assumptions are placeholders, not measured ROI',
    };
  }
  async function idle(id) { const s=getSession(id); while(s.background.size) await Promise.all([...s.background]); }
  function remove(id) {
    const s=getSession(id);
    if(s.running)throw new AIError('Wait for running calls to finish before clearing this run.',409);
    sessions.delete(id);
  }
  return {createSession,upload,open,perform,setText,setEnabled,setReadAhead,snapshot,idle,remove};
}
module.exports={createAIService,validateImage,recoveryFor};
