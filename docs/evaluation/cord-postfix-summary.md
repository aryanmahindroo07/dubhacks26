# AI inbox OFF/ON measurement

Actual model requests · 1 repetitions · 1500 ms default review interval (per-scenario overrides are retained). Post-fix check on three additional real CORD test receipts (indices 6–8), selected before changing the extraction prompt. One pair per image; scripted actions, not user behavior. Review intervals vary by image but match within each pair.

| Scenario | OFF mean action wait | ON mean action wait | Net extra provider calls | ON consumed prefires | ON unused prefires |
|---|---:|---:|---:|---:|---:|
| cord-test-006-extract | 820.4 ms | 613.1 ms | 0 | 1 | 0 |
| cord-test-007-extract | 655.7 ms | 279.7 ms | 0 | 1 | 0 |
| cord-test-008-extract | 1490.4 ms | 280.5 ms | 0 | 1 | 0 |
| ALL | 988.9 ms | 391.1 ms | 0 | 3 | 0 |

P95 action wait: OFF 2332.4 ms; ON 665.1 ms.

Token usage is in results.json provider events. No dollar estimates are made. Task elapsed includes the fixed review interval; action waits do not. Small samples do not establish production accuracy or statistical significance.

## Reliability — all trials, including failures

| Mode | Trials | Completed journeys | Provider failures | Failed actions | Provider calls | Total action wait incl. failures |
|---|---:|---:|---:|---:|---:|---:|
| OFF | 3 | 3 | 0 | 0 | 6 | 5.93 s |
| ON | 3 | 3 | 0 | 0 | 6 | 2.35 s |

Latency comparison above uses 3 pairs with no provider failures in either mode. N/A means no valid paired measurements. All trials and failure events remain in results.json. A failed action ends that journey; there are no automatic retries. Failure-inclusive waiting is time spent on attempted actions, not time to eventual successful completion. Server action waits exclude browser/network/render overhead.
