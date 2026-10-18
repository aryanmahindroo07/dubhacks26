
import { resolveEndpoint } from "./resolver.js";
import { responseCache } from "./cache.js";

const API_BASE = "http://localhost:4000";
const REQUEST_BUDGET = 1;

// Tracks what the user actually visits
const history = [];

// Tracks prefetching statistics
const prefetchMetrics = {
  started: 0,
  completed: 0,
  failed: 0
};

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
  const response = await fetch(API_BASE + "/api/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ history })
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
  const url = resolveEndpoint(stateId, customerId);

  // Record actual navigation, not predicted navigation
  history.push(stateId);

  // Check whether the response was prefetched
  const cachedData = responseCache.get(url);

  let data;

  if (cachedData !== undefined) {
    data = cachedData;
  } else {
    // Reuse an in-flight prefetch if one exists
    data = await responseCache.fetchOnce(
      url,
      () => fetchData(url)
    );
  }

  // Start predicting the next request in the background
  prefetchNext(customerId).catch(error => {
    console.error("Prediction failed:", error);
  });

  return data;
}

// Return statistics for the dashboard
export function getPrefetchMetrics() {
  return {
    ...responseCache.getMetrics(),
    ...prefetchMetrics
  };
}
