import { resolveEndpoint } from "./resolver.js";
import { responseCache } from "./cache.js";

const API_BASE = import.meta.env?.VITE_API_BASE ?? "";
const REQUEST_BUDGET = 1;
const LOG_LIMIT = 200;

// Tracks what the user actually visits
const history = [];

const sessionId = crypto.randomUUID();
let navigationQueue = Promise.resolve();

// When false, navigations skip prediction and prefetching entirely, so an
// OFF run measures the plain app: no /api/predict calls, no speculative GETs.
let prefetchEnabled = true;

// Tracks prefetching statistics
const prefetchMetrics = {
  started: 0,
  completed: 0,
  failed: 0
};

// Measured counters for OFF/ON comparisons
const measured = {
  navigations: 0,
  demandRequests: 0, // data GETs started because the user asked for them
  predictionCalls: 0,
  predictionFailures: 0,
  usefulPrefetches: 0 // prefetches the user later opened (ready or in flight)
};

// url -> "pending" | "ready" | "used" | "wasted"
const prefetchedUrls = new Map();
const navigationWaits = [];
const requestLog = [];
let logId = 0;

const BASELINE_MS = 1200;

let lastRequest = null;
let totalEstimatedSavedMs = 0;

function log(entry) {
  requestLog.unshift({ id: ++logId, at: Date.now(), ...entry });
  if (requestLog.length > LOG_LIMIT) requestLog.length = LOG_LIMIT;
}

// Make an HTTP request and return JSON
async function fetchData(url) {
  const response = await fetch(API_BASE + url);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
}

// Ask the backend to predict what the user will visit next
async function getPredictions(navigation) {
  measured.predictionCalls++;
  const response = await fetch(API_BASE + "/api/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      history: navigation.history,
      sessionId,
      stateId: navigation.stateId
    })
  });

  if (!response.ok) {
    throw new Error("Failed to get predictions");
  }

  return response.json();
}

export function setPrefetchEnabled(enabled) {
  prefetchEnabled = Boolean(enabled);
}

export function isPrefetchEnabled() {
  return prefetchEnabled;
}

// Prefetch the highest-value predicted endpoints
export async function prefetchNext(customerId, navigation = { history: [...history], stateId: null }, predictionResult) {
  if (!prefetchEnabled) return;
  const predictions = await (predictionResult ?? getPredictions(navigation));
  // Paused while the prediction was in flight
  if (!prefetchEnabled) return;

  // Only choose predictions worth prefetching
  const hasCustomerId = customerId !== undefined && customerId !== null && customerId !== "";
  const selected = predictions
    .filter(p => p.shouldPrefetch === true && p.expectedValue > 0)
    .sort((a, b) => b.expectedValue - a.expectedValue)
    .filter(p => hasCustomerId || p.endpoint === "CUSTOMERS")
    .map(prediction => ({ ...prediction, url: resolveEndpoint(prediction.endpoint, customerId) }))
    .filter(({ url }) => !responseCache.has(url) && !responseCache.inFlight.has(url))
    .slice(0, REQUEST_BUDGET);

  const tasks = selected.map(async prediction => {
    const url = prediction.url;

    // Skip data already cached or currently being fetched
    if (responseCache.has(url) || responseCache.inFlight.has(url)) {
      return;
    }

    prefetchMetrics.started++;
    prefetchedUrls.set(url, "pending");
    const start = performance.now();

    try {
      await responseCache.fetchOnce(url, () => fetchData(url));
      prefetchMetrics.completed++;
      if (prefetchedUrls.get(url) === "pending") prefetchedUrls.set(url, "ready");
      log({ kind: "prefetch", stateId: prediction.endpoint, url, result: "prefetched", waitMs: performance.now() - start });
    } catch (error) {
      prefetchMetrics.failed++;
      prefetchedUrls.delete(url);
      log({ kind: "prefetch", stateId: prediction.endpoint, url, result: "prefetch failed", waitMs: performance.now() - start });
      console.error("Prefetch failed:", url, error);
    }
  });

  await Promise.all(tasks);
}

// Called when the user actually navigates to a page

export async function requestEndpoint(stateId, customerId) {
  const start = performance.now();
  const url = resolveEndpoint(stateId, customerId);

  // Record actual user navigation
  history.push(stateId);
  const navigation = { history: [...history], stateId };
  const enabled = prefetchEnabled;
  let safePredictions;
  if (enabled) {
    // Report clicks in initiation order, including overlapping data requests.
    const predictions = navigationQueue.then(() => getPredictions(navigation));
    navigationQueue = predictions.catch(error => {
      measured.predictionFailures++;
      console.error("Prediction failed:", error);
      return [];
    });
    safePredictions = navigationQueue;
  }

  // Check the cache, then any request already running (usually a prefetch).
  // lookup() counts each user request once as a hit, reuse or miss.
  const lookup = responseCache.lookup(url);
  const cacheHit = lookup.status === "hit";
  const inFlightReuse = lookup.status === "reused";

  // Credit the prefetch only if this request is served by it
  const prefetchState = prefetchedUrls.get(url);
  const servedByPrefetch =
    (cacheHit && prefetchState === "ready") ||
    (inFlightReuse && prefetchState === "pending");
  if (servedByPrefetch) {
    measured.usefulPrefetches++;
    prefetchedUrls.set(url, "used");
  } else if (!cacheHit && !inFlightReuse && (prefetchState === "ready" || prefetchState === "pending")) {
    // The prefetched copy expired or was evicted before use
    prefetchedUrls.set(url, "wasted");
  }

  let data;

  if (cacheHit) {
    data = lookup.data;
  } else {
    if (!inFlightReuse) measured.demandRequests++;
    data = await responseCache.fetchOnce(
      url,
      () => fetchData(url)
    );
  }

  // Measure how long the user waited for data
  const latencyMs = performance.now() - start;

  // Estimate time saved relative to the 1200ms baseline
  const estimatedSavedMs =
    cacheHit || inFlightReuse
      ? Math.max(0, BASELINE_MS - latencyMs)
      : 0;

  totalEstimatedSavedMs += estimatedSavedMs;

  measured.navigations++;
  const result = cacheHit ? "cache hit" : inFlightReuse ? "reused running request" : "network";
  navigationWaits.push(latencyMs);
  log({ kind: "navigation", stateId, url, result, waitMs: latencyMs, servedByPrefetch });

  lastRequest = {
    stateId,
    url,
    cacheHit,
    inFlightReuse,
    servedByPrefetch,
    latencyMs,
    estimatedSavedMs
  };

  // Execute the prediction already requested for this navigation
  if (enabled) {
    prefetchNext(customerId, navigation, safePredictions).catch(error => {
      console.error("Prediction failed:", error);
    });
  }

  return data;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Return statistics for the dashboard
export function getPrefetchMetrics() {
  const states = [...prefetchedUrls.values()];
  return {
    ...responseCache.getMetrics(),
    ...prefetchMetrics,
    ...measured,
    prefetchEnabled,
    speculativeRequests: prefetchMetrics.started,
    dataRequests: measured.demandRequests + prefetchMetrics.started,
    unusedPrefetches: states.filter(s => s === "ready" || s === "wasted").length,
    totalWaitMs: navigationWaits.reduce((sum, ms) => sum + ms, 0),
    medianWaitMs: median(navigationWaits),
    navigationWaits: [...navigationWaits],
    requestLog: requestLog.map(entry => ({ ...entry })),
    lastRequest,
    totalEstimatedSavedMs
  };
}

// Debug and benchmark hook (read-only metrics and the on/off switch)
if (typeof window !== "undefined") {
  window.__mise = window.__requestflow = { getPrefetchMetrics, setPrefetchEnabled, isPrefetchEnabled };
}
