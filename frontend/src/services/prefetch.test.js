import assert from 'node:assert/strict';
import test from 'node:test';
import { responseCache, ResponseCache } from './cache.js';
import { requestEndpoint, prefetchNext, getPrefetchMetrics, setPrefetchEnabled } from './prefetch.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('prefetch guards, cache isolation, request reuse, and ordered navigation reporting', async () => {
  const calls = [];
  const events = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (options?.method === 'POST') {
      events.push(JSON.parse(options.body));
      return { ok: true, json: async () => ['ORDERS', 'SUPPORT'].map((endpoint, i) => ({endpoint, shouldPrefetch: true, expectedValue: 100 - i})) };
    }
    await tick();
    return { ok: true, json: async () => ({url}) };
  };
  try {
    await prefetchNext();
    assert.deepEqual(calls, ['/api/predict'], 'no customer-specific GET without ID');
    responseCache.set('/api/customers/1/orders', {cached: true});
    await prefetchNext('1');
    assert.ok(calls.includes('/api/customers/1/support'), 'cached top candidate does not consume budget');
    responseCache.clear();
    await requestEndpoint('CUSTOMER', '1');
    for (let i = 0; i < 20 && !responseCache.has('/api/customers/1/orders'); i++) await tick();
    assert.ok(responseCache.has('/api/customers/1/orders'));
    const count = calls.filter(url => url === '/api/customers/1/orders').length;
    await requestEndpoint('ORDERS', '1');
    assert.equal(getPrefetchMetrics().lastRequest.cacheHit, true);
    assert.equal(calls.filter(url => url === '/api/customers/1/orders').length, count);
    await requestEndpoint('CUSTOMER', '4');
    for (let i = 0; i < 20 && !responseCache.has('/api/customers/4/orders'); i++) await tick();
    assert.ok(responseCache.has('/api/customers/4/orders'));
    assert.ok(responseCache.has('/api/customers/1/orders'));
    const before = events.filter(event => event.stateId != null).length;
    await Promise.all([requestEndpoint('SUPPORT', '7'), requestEndpoint('ANALYTICS', '7')]);
    await tick();
    assert.deepEqual(events.filter(event => event.stateId != null).slice(before).map(event => event.stateId), ['SUPPORT', 'ANALYTICS']);
    assert.deepEqual(events.filter(event => event.stateId != null).map(event => event.stateId), ['CUSTOMER', 'ORDERS', 'CUSTOMER', 'SUPPORT', 'ANALYTICS']);
    await tick();
  } finally { globalThis.fetch = originalFetch; }
});

test('cache expiry and concurrent duplicate suppression', async () => {
  const cache = new ResponseCache(-1);
  cache.set('expired', 1);
  assert.equal(cache.get('expired'), undefined);
  let requests = 0;
  const fetcher = async () => { requests++; await tick(); return 42; };
  assert.deepEqual(await Promise.all([cache.fetchOnce('key', fetcher), cache.fetchOnce('key', fetcher)]), [42, 42]);
  assert.equal(requests, 1);
  await assert.rejects(cache.fetchOnce('bad', () => Promise.reject(new Error('failed'))));
  assert.equal(cache.inFlight.has('bad'), false);
});

test('hit-rate metrics count in-flight reuse separately from misses', async () => {
  const cache = new ResponseCache();
  let release;
  const running = cache.fetchOnce('orders', () => new Promise(r => { release = r; }));
  assert.equal(cache.lookup('orders').status, 'reused');
  await tick();
  release({ ok: true });
  await running;
  assert.equal(cache.lookup('orders').status, 'hit');
  assert.equal(cache.lookup('support').status, 'miss');
  const m = cache.getMetrics();
  assert.deepEqual([m.hits, m.reused, m.misses], [1, 1, 1]);
  assert.equal(m.hitRate, 1 / 3);
  assert.equal(m.servedRate, 2 / 3);
});

test('OFF sends no predictions or prefetches; ON counts useful and unused prefetches', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (options?.method === 'POST') {
      return { ok: true, json: async () => [{ endpoint: 'ORDERS', shouldPrefetch: true, expectedValue: 100 }] };
    }
    await tick();
    return { ok: true, json: async () => ({ url }) };
  };
  const settle = async () => { for (let i = 0; i < 20; i++) await tick(); };
  try {
    responseCache.clear();
    const before = getPrefetchMetrics();

    setPrefetchEnabled(false);
    await requestEndpoint('CUSTOMER', '8');
    await settle();
    assert.deepEqual(calls, ['/api/customers/8'], 'OFF: only the demanded GET');
    let m = getPrefetchMetrics();
    assert.equal(m.prefetchEnabled, false);
    assert.equal(m.predictionCalls, before.predictionCalls);
    assert.equal(m.speculativeRequests, before.speculativeRequests);

    setPrefetchEnabled(true);
    await requestEndpoint('CUSTOMER', '9');
    await settle();
    assert.ok(calls.includes('/api/customers/9/orders'), 'ON: Orders prefetched');
    await requestEndpoint('ORDERS', '9');
    m = getPrefetchMetrics();
    assert.equal(m.lastRequest.servedByPrefetch, true);
    assert.equal(m.usefulPrefetches, before.usefulPrefetches + 1);
    assert.equal(m.demandRequests, before.demandRequests + 2, 'two demanded GETs: customers 8 and 9');
    assert.equal(m.navigationWaits.length, before.navigationWaits.length + 3);
    assert.equal(m.requestLog[0].kind, 'navigation');
  } finally {
    globalThis.fetch = originalFetch;
    setPrefetchEnabled(true);
  }
});
