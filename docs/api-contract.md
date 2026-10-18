# Backend Contract: Prediction Engine ↔ Caching Module

Status: DRAFT — verified against the local source on October 17, 2026; pending Backend 2 review.

This document describes the current implementation and identifies integration work that remains unfinished. TypeScript signatures below document a JavaScript (CommonJS) implementation; the source does not enforce these types at runtime.

## Ownership

| Module | Owner | Location / status |
|---|---|---|
| Prediction engine | Backend 1 | `backend/prediction/` |
| Endpoint registry, cache, prefetch execution | Backend 2 | Planned `backend/cache/`; not present in the inspected checkout |

## State IDs and endpoint mapping

```ts
type StateId =
  | "CUSTOMERS"
  | "CUSTOMER"
  | "ORDERS"
  | "SUPPORT"
  | "ANALYTICS";
```

The engine returns normalized state IDs, not URLs. These states are shared across customers. Backend 2 must resolve a state to a route and substitute the current customer ID before fetching customer-specific data.

| State ID | Existing API route |
|---|---|
| `CUSTOMERS` | `/api/customers` |
| `CUSTOMER` | `/api/customers/:id` |
| `ORDERS` | `/api/customers/:id/orders` |
| `SUPPORT` | `/api/customers/:id/support` |
| `ANALYTICS` | `/api/customers/:id/analytics` |

All five states appear in the training data. However, `engine.js` currently predicts only `ORDERS`, `SUPPORT`, and `ANALYTICS`; callers cannot override that candidate list through its public interface.

## Public engine API — implemented

Import these functions from `backend/prediction/engine.js`:

```ts
type Prediction = {
  endpoint: StateId; // In the current engine: ORDERS, SUPPORT, or ANALYTICS
  probability: number;
  contextOrder: 1 | 2;
  observations: number;
};

type ScoringConfig = {
  latencyMs?: number;            // Default: 1200
  requestCost?: number;          // Default: 0.001
  readinessProbability?: number; // Default: 1
  lambda?: number;               // Default: 100000
};

type ScoredPrediction = Prediction & {
  expectedBenefit: number;
  expectedExtraCost: number;
  expectedValue: number;
  shouldPrefetch: boolean;
};

// Returns scored predictions, highest expectedValue first.
// history contains this session's user navigation states, oldest first.
function predictNext(
  history: StateId[],
  config?: ScoringConfig
): ScoredPrediction[];

// Appends one navigation state to the session history and updates model counts.
// Returns the session history array.
function recordTransition(sessionId: string, stateId: StateId): StateId[];

// Returns the existing history, or [] for an unknown session.
function getHistory(sessionId: string): StateId[];
```

`recordTransition` is already implemented. A first navigation creates a history but cannot add a transition until a second state arrives. Each subsequent call adds the latest first-order transition and, when possible, the latest second-order transition.

Session histories are stored in an in-memory `Map`. Model counts are shared across sessions. The module trains its model from `trainingJourneys` when loaded. There is no implemented session expiration, history limit, persistence, or reset API. Existing histories are returned by reference; consumers must not mutate them.

`getState()` is not implemented or exported. HUD snapshot contents and an implementation remain to be agreed.

## Lower-level APIs — implemented, not the cache integration entry point

```ts
// backend/prediction/markov.js
class MarkovPredictor {
  constructor(states: StateId[], alpha?: number, minObservations?: number);
  train(journeys: StateId[][]): void;
  recordTransition(history: StateId[]): void;
  predict(history: StateId[], candidates?: StateId[]): Prediction[];
}

// backend/prediction/scoring.js
function scorePredictions(
  predictions: Prediction[],
  config?: ScoringConfig
): ScoredPrediction[];
```

`train` clears and rebuilds the model's first- and second-order counts. The predictor defaults to additive smoothing `alpha = 1` and a second-order minimum of three observations. It uses the latest two states when that context has enough observations; otherwise it falls back to the latest single state. It returns `[]` if the selected context has no observations.

`observations` counts all outgoing transitions in the selected context. `contextOrder` identifies whether first- or second-order counts were used. Raw predictions are sorted by probability; scoring reorders them by expected value.

### Probability limitation

The implementation uses:

```text
probability(candidate) = (count(candidate) + alpha)
                       / (all outgoing counts + alpha × candidate count)
```

Because the denominator includes outgoing transitions outside the candidate list, returned probabilities can sum to less than 1. Do not document them as always summing to approximately 1. The teams should decide whether candidate-only normalization is desired before changing this behavior.

## Scoring — current implementation

```text
expectedBenefit   = probability × readinessProbability × latencyMs
expectedExtraCost = (1 − probability) × requestCost
expectedValue     = expectedBenefit − lambda × expectedExtraCost
shouldPrefetch    = expectedValue > 0
```

`expectedBenefit` is a time benefit in milliseconds when `latencyMs` is in milliseconds. `expectedExtraCost` is in the units used by `requestCost`; `lambda` converts or weights that cost against the time benefit. It is not accurate to label all raw quantities as milliseconds without defining the cost units.

With the defaults:

```text
expectedValue = probability × 1200 − (1 − probability) × 100
```

One scoring configuration applies to every prediction in a call. The current engine does not read an endpoint registry and does not return `estimatedLatencyMs` or `estimatedCost`. Per-endpoint cost and latency scoring would require additional implementation.

## Endpoint registry — planned Backend 2 work

The route mapping above matches `backend/server.js`, but no shared endpoint registry is implemented in this checkout. All five data endpoints currently default to a simulated 1200 ms delay. Development routes `GET /api/config/delays` and `POST /api/config/delays` expose and update those delays; changes do not automatically update the prediction engine's scoring configuration.

Backend 2 must finalize the registry format and endpoint cost estimates. The previous proposed `estimatedCost: 300` is not the current scoring default and should not be treated as an implemented value.

## Cache integration rules — required behavior, not yet wired

1. Record each user-initiated navigation exactly once with `recordTransition(sessionId, stateId)`. Never record speculative prefetches as navigation events.
2. After recording a navigation, call `predictNext(getHistory(sessionId), config)`. The engine already owns session history; avoid appending to the returned array or recording the same event twice.
3. A user navigation served from browser memory still counts as a navigation. Report that event through the eventual SDK/server integration even when no HTTP data request occurs.
4. Resolve prediction state IDs to routes using the current customer context. Cache keys must distinguish customer-specific URLs. Do not prefetch a customer-specific endpoint without a customer ID.
5. Use `expectedValue` / `shouldPrefetch` together with the agreed request budget to choose work. The engine ranks and recommends; Backend 2 controls execution, duplicate suppression, cancellation, cache lifetime, and invalidation.
6. The planned SDK metrics interface should report cache hits, misses, prefetch status, and measured latency to the HUD, including browser-memory hits. This interface is not implemented in the inspected code.

Illustrative integration after a user navigation:

```js
const { recordTransition, getHistory, predictNext } = require("./prediction/engine");

recordTransition(sessionId, stateId);
const predictions = predictNext(getHistory(sessionId), {
  latencyMs: 1200,
  requestCost: 0.001,
  readinessProbability: 1,
  lambda: 100000,
});

// Backend 2 must implement route resolution, budgeting, cache checks,
// prefetch execution, and metrics reporting.
```

`backend/server.js` currently logs requests but does not import the engine, identify sessions, record navigation, or execute prefetches.

## Decisions pending Backend 2 review

- Maximum prefetches per navigation (proposal: two; not enforced).
- How a session ID is obtained and passed to the engine.
- How user navigation is distinguished from prefetches, including memory-cache navigation.
- Cost units and the meaning/calibration of `requestCost` and `lambda`.
- Whether to implement per-endpoint scoring and a shared registry.
- Cache lifetime, invalidation, duplicate suppression, cancellation, and error handling.
- Session expiration and history retention.
- SDK metrics interface and whether a separate `getState()` snapshot is needed.
- Whether to expand predicted candidates or change probability normalization.

## Sources checked

- `backend/prediction/engine.js`
- `backend/prediction/markov.js`
- `backend/prediction/scoring.js`
- `backend/prediction/trainingData.js`
- `backend/server.js`

