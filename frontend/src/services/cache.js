
const DEFAULT_TTL = 30000; // 30 seconds
const DEFAULT_MAX_SIZE = 50;

export class ResponseCache {
  constructor(ttl = DEFAULT_TTL, maxSize = DEFAULT_MAX_SIZE) {
    this.ttl = ttl;
    this.maxSize = maxSize;

    // Stores completed API responses
    this.cache = new Map();

    // Stores requests that are still running
    this.inFlight = new Map();

    // Performance metrics
    this.hits = 0;
    this.misses = 0;
    // Requests that joined a fetch already running (usually a prefetch)
    this.reused = 0;
  }

  // Classify a user request and update metrics exactly once:
  // "hit" (ready in cache), "reused" (joins a running request) or "miss".
  lookup(key) {
    if (this.has(key)) {
      return { status: "hit", data: this.get(key) };
    }
    if (this.inFlight.has(key)) {
      this.reused++;
      return { status: "reused" };
    }
    this.misses++;
    return { status: "miss" };
  }

  // Get a cached response if it is still valid
  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }

    const entry = this.cache.get(key);

    // Check whether the entry has expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;

    // Move this entry to the end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  // Store a successful API response
  set(key, data) {
    if (this.maxSize <= 0) {
      return;
    }

    // Remove an existing entry so it becomes most recent
    this.cache.delete(key);

    this.cache.set(key, {
      data: data,
      expiresAt: Date.now() + this.ttl
    });

    // Remove the least recently used entry if full
    while (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  // Check whether a valid entry exists without changing metrics
  has(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // Reuse an existing request instead of making a duplicate
  async fetchOnce(key, fetchFunction) {
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const request = Promise.resolve()
      .then(() => fetchFunction())
      .then(data => {
        this.set(key, data);
        return data;
      });

    this.inFlight.set(key, request);

    try {
      return await request;
    } finally {
      // Remove request whether it succeeds or fails
      this.inFlight.delete(key);
    }
  }

  // Return cache performance metrics
  getMetrics() {
    const total = this.hits + this.reused + this.misses;

    return {
      hits: this.hits,
      reused: this.reused,
      misses: this.misses,
      // Share of requests answered instantly from the cache
      hitRate: total === 0 ? 0 : this.hits / total,
      // Share of requests that avoided starting a new network request
      servedRate: total === 0 ? 0 : (this.hits + this.reused) / total,
      cacheSize: this.cache.size,
      inFlightRequests: this.inFlight.size
    };
  }

  // Clear cached responses
  clear() {
    this.cache.clear();
  }
}

export const responseCache = new ResponseCache();
