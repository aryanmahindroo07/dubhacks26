# Backend Contract: Prediction Engine ↔ Caching Module

Status: DRAFT — written by Backend 1, waiting for Backend 2 review.

## Ownership

| Module | Owner | Location |
|---|---|---|
| Prediction engine | Backend 1 | `backend/prediction/` |
| Endpoint registry, cache, prefetch execution | Backend 2 | `backend/cache/` |

## Endpoint keys

The engine predicts normalized state IDs (`CUSTOMER`, `ORDERS`, `SUPPORT`, `ANALYTICS`) across all customers.
The caching module maps state IDs to route templates and replaces `:id` with the actual customer ID before prefetching.

```
/api/customers/:id
/api/customers/:id/orders
/api/customers/:id/support
/api/customers/:id/analytics
```

## Engine API (Backend 1 provides)

```ts
type Prediction = {
  endpoint: string;            // route template, e.g. "/api/customers/:id/orders"
  probability: number;         // 0–1; all predictions sum to ~1
  estimatedLatencyMs: number;  // copied from the registry
  estimatedCost: number;       // copied from the registry, in ms-equivalent
  expectedValue: number;       // see formula below
};

// Ranked predictions for the next request, highest expectedValue first.
// history = this session's user-initiated requests, oldest first.
function predict(history: string[]): Prediction[];

// Teach the engine about a real navigation.
function recordTransition(from: string, to: string): void;

predictNext(
history: StateId[],
config?: object
): Prediction[];

// Snapshot for the HUD (probabilities, counts, hit rate).
function getState(): object;
```

### Expected value formula

```
expectedValue = probability × estimatedLatencyMs − (1 − probability) × estimatedCost
```

All quantities are in milliseconds. A positive value means prefetching is
expected to save more time than it wastes.

## Endpoint registry (Backend 2 provides)

Placeholder values until Backend 2 finalizes them:

```js
const registry = {
CUSTOMER: { route: "/api/customers/:id", estimatedLatencyMs: 1200, estimatedCost: 300 },
ORDERS: { route: "/api/customers/:id/orders", estimatedLatencyMs: 1200, estimatedCost: 300 },
SUPPORT: { route: "/api/customers/:id/support", estimatedLatencyMs: 1200, estimatedCost: 300 },
ANALYTICS:{ route: "/api/customers/:id/analytics", estimatedLatencyMs: 1200, estimatedCost: 300 }
};


```

## Rules for the caching module

1. Call `recordTransition` only for **user-initiated** requests. Prefetch
   requests must never be recorded, or the model trains on its own guesses.
2. Track `history` per session and pass it to `predict` after each request.
3. Decide which predictions to execute using `expectedValue` and the request
   budget. The engine ranks; the cache module decides.
4. Report cache hits, misses, prefetch status, and measured latency directly through the SDK's metrics interface to the frontend HUD. Browser-     memory cache hits do not require an HTTP response.

## Open questions for Backend 2

- Request budget: max prefetches per navigation (proposed: 2)?
- Real values for `estimatedCost` per endpoint?
- How is a session identified (header, cookie, query param)?
