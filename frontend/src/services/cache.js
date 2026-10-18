
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
    const total = this.hits + this.misses;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
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
