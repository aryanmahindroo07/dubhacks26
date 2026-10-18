# AI inbox OFF/ON measurement

Actual model requests · 1 repetitions · 1500 ms default review interval (per-scenario overrides are retained). Real CORD-v2 test receipt photographs; scripted actions, not observed user behavior. Six extraction pairs with 0/1500/5000 ms review intervals, two unexpected-summary pairs and two stop pairs.

| Scenario | OFF mean action wait | ON mean action wait | Net extra provider calls | ON consumed prefires | ON unused prefires |
|---|---:|---:|---:|---:|---:|
| cord-test-000-extract | 750.1 ms | 716.6 ms | 0 | 1 | 0 |
| cord-test-001-extract | 705.6 ms | 320.7 ms | 0 | 1 | 0 |
| cord-test-002-extract | 948.9 ms | 264.8 ms | 0 | 1 | 0 |
| cord-test-003-extract | 945.1 ms | 794.9 ms | 0 | 1 | 0 |
| cord-test-004-extract | 760.6 ms | 296.5 ms | 0 | 1 | 0 |
| cord-test-005-extract | 978.8 ms | 845.3 ms | 0 | 1 | 0 |
| cord-test-000-unexpected-summary | 646.5 ms | 667.9 ms | 1 | 0 | 1 |
| cord-test-001-unexpected-summary | 631.2 ms | 683.1 ms | 1 | 0 | 1 |
| cord-test-002-stop | 925.9 ms | 574.3 ms | 1 | 0 | 1 |
| cord-test-003-stop | 526.2 ms | 511.0 ms | 1 | 0 | 1 |
| ALL | 788.1 ms | 570.3 ms | 4 | 6 | 4 |

P95 action wait: OFF 1246.9 ms; ON 1690.5 ms.

Token usage is in results.json provider events. No dollar estimates are made. Task elapsed includes the fixed review interval; action waits do not. Small samples do not establish production accuracy or statistical significance.

## Reliability — all trials, including failures

| Mode | Trials | Completed journeys | Provider failures | Failed actions | Provider calls | Total action wait incl. failures |
|---|---:|---:|---:|---:|---:|---:|
| OFF | 10 | 10 | 0 | 0 | 18 | 14.19 s |
| ON | 10 | 10 | 0 | 0 | 22 | 10.27 s |

Latency comparison above uses 10 pairs with no provider failures in either mode. N/A means no valid paired measurements. All trials and failure events remain in results.json. A failed action ends that journey; there are no automatic retries. Failure-inclusive waiting is time spent on attempted actions, not time to eventual successful completion. Server action waits exclude browser/network/render overhead.
