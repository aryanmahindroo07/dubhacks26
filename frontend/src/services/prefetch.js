
import { resolveEndpoint } from "./resolver.js";
import { responseCache } from "./cache.js";

const API_BASE = "http://localhost:4000";
const REQUEST_BUDGET = 1;

// Tracks what the user actually visits
const history = [];

const sessionId = crypto.randomUUID();
let pendingNavigation = null;

// Tracks prefetching statistics
const prefetchMetrics = {
  started: 0,
  completed: 0,
  failed: 0
};

const BASELINE_MS = 1200;

let lastRequest = null;
let totalEstimatedSavedMs = 0;

// Make an HTTP request and return JSON
async function fetchData(url) {
  const response = await fetch(API_BASE + url);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.json();
}

// Ask the backend to predict what the user will visit next
async function getPredictions() {
  const stateId = pendingNavigation;
    pendingNavigation = null;
  const response = await fetch(API_BASE + "/api/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      history,
      sessionId,
      stateId
})
  });

  if (!response.ok) {
    throw new Error("Failed to get predictions");
  }

  return response.json();
}

// Prefetch the highest-value predicted endpoints
export async function prefetchNext(customerId) {
  const predictions = await getPredictions();

  // Only choose predictions worth prefetching
  const selected = predictions
    .filter(p => p.shouldPrefetch === true && p.expectedValue > 0)
    .sort((a, b) => b.expectedValue - a.expectedValue)
    .slice(0, REQUEST_BUDGET);

  const tasks = selected.map(async prediction => {
    const url = resolveEndpoint(prediction.endpoint, customerId);

    // Skip data already cached or currently being fetched
    if (responseCache.has(url) || responseCache.inFlight.has(url)) {
      return;
    }

    prefetchMetrics.started++;

    try {
      await responseCache.fetchOnce(url, () => fetchData(url));
      prefetchMetrics.completed++;
    } catch (error) {
      prefetchMetrics.failed++;
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
  pendingNavigation = stateId;

  // Check browser cache
  const cachedData = responseCache.get(url);
  const cacheHit = cachedData !== undefined;

  // Check whether a prefetch is already running
  const inFlightReuse =
    !cacheHit && responseCache.inFlight.has(url);

  let data;

  if (cacheHit) {
    data = cachedData;
  } else {
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

  lastRequest = {
    stateId,
    url,
    cacheHit,
    inFlightReuse,
    latencyMs,
    estimatedSavedMs
  };

  // Record navigation on backend and predict the next request
  prefetchNext(customerId).catch(error => {
    console.error("Prediction failed:", error);
  });

  return data;
}


// Return statistics for the dashboard
export function getPrefetchMetrics() {
  return {
    ...responseCache.getMetrics(),
    ...prefetchMetrics,
    lastRequest,
    totalEstimatedSavedMs
  };
}
