# Prefetch benchmark results

Measured with `scripts/benchmark_prefetch.py` on October 17, 2026.

**What these numbers are:** the same 10 customer journeys run in headless
Chromium, first with prefetch paused, then on, against a fresh backend each
time. Customer records are generated mock data, and the backend adds an
artificial 1,200 ms delay to every data request. The journeys follow the same
patterns as the synthetic training data, so they show how the system behaves on
familiar journeys, not real-world savings.

**How they were run:** in a cloud sandbox without npm access, using the real
`server.js` on a minimal Express stand-in and the real frontend bundled with
esbuild instead of Vite. Rerun on the normal dev servers before quoting them.

## Users who pause 1.5 s on each page

### Prefetch OFF vs ON (10 journeys, 1500 ms think time)

| Measure | OFF | ON |
|---|---:|---:|
| Navigations | 34 | 34 |
| Total waiting, all pages | 30.31 s | 20.65 s |
| Median wait, all pages | 1209.6 ms | 604.9 ms |
| Total waiting, Orders/Support/Analytics | 14.55 s | 6.07 s |
| Median wait, Orders/Support/Analytics | 1210.7 ms | 0.1 ms |
| Orders/Support/Analytics under 100 ms | 0 of 12 | 7 of 12 |
| Data GETs sent | 25 | 29 |
| · demanded by the user | 25 | 17 |
| · speculative (prefetch) | 0 | 12 |
| Useful prefetches | 0 | 7 |
| Unused or failed prefetches | 0 | 5 |
| Prediction calls (POST) | 0 | 34 |

Waiting saved: 9.66 s (32% of OFF). Cost: +4 data GETs and 34 prediction calls.

## Users who click every 0.3 s

### Prefetch OFF vs ON (10 journeys, 300 ms think time)

| Measure | OFF | ON |
|---|---:|---:|
| Navigations | 34 | 34 |
| Total waiting, all pages | 29.11 s | 26.68 s |
| Median wait, all pages | 1209.7 ms | 1049.2 ms |
| Total waiting, Orders/Support/Analytics | 14.58 s | 12.12 s |
| Median wait, Orders/Support/Analytics | 1210.9 ms | 882.2 ms |
| Orders/Support/Analytics under 100 ms | 0 of 12 | 0 of 12 |
| Data GETs sent | 24 | 29 |
| · demanded by the user | 24 | 17 |
| · speculative (prefetch) | 0 | 12 |
| Useful prefetches | 0 | 7 |
| Unused or failed prefetches | 0 | 5 |
| Prediction calls (POST) | 0 | 34 |

Waiting saved: 2.43 s (8% of OFF). Cost: +5 data GETs and 34 prediction calls.

## Takeaways

- When users pause long enough for the prefetch to finish, the median wait on
  Orders, Support and Analytics drops from about 1.2 s to under 1 ms, and
  total waiting falls by about a third.
- When users click quickly, savings shrink to about 8%. A prefetch starts only
  after the current page's data arrives, so a fast click joins a request that
  is still loading.
- The cost is 4 or 5 extra data GETs per 34 navigations (prefetches the user
  did not open) plus one small prediction call per navigation.
