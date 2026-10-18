# AI inbox OFF/ON measurement

Actual model requests · 2 repetitions · 1500 ms default review interval (per-scenario overrides are retained). Three public photographed CORD receipts, plus a deliberately unexpected summary action. Authored workflows, not observed user behavior. Fixed 1500 ms review interval in both modes. Read-ahead OFF.

| Scenario | OFF mean action wait | ON mean action wait | Net extra provider calls | ON consumed prefires | ON unused prefires |
|---|---:|---:|---:|---:|---:|
| cord-test-006-extract | 762.7 ms | 417.8 ms | 0 | 2 | 0 |
| cord-test-007-extract | 977.3 ms | 656.0 ms | 1 | 1 | 1 |
| cord-test-008-extract | 918.2 ms | 340.4 ms | 0 | 2 | 0 |
| cord-test-006-unexpected-summary | 696.5 ms | 698.0 ms | 2 | 0 | 2 |
| ALL | 838.7 ms | 528.0 ms | 3 | 5 | 3 |

P95 action wait: OFF 1364.7 ms; ON 1240.4 ms.

Token usage is in results.json provider events. No dollar estimates are made. Task elapsed includes the fixed review interval; action waits do not. Small samples do not establish production accuracy or statistical significance.

## Paired total user waiting

Valid pairs: 8. Median OFF total action wait: 1559.2 ms; median ON: 864.6 ms. Median paired reduction: 562.7 ms (negative means ON was slower).

Read-ahead is OFF by default in each fresh session. These authored journeys are a controlled latency experiment, not a real-user prediction-accuracy estimate.

## Reliability — all trials, including failures

| Mode | Trials | Completed journeys | Provider failures | Failed actions | Provider calls | Total action wait incl. failures |
|---|---:|---:|---:|---:|---:|---:|
| OFF | 8 | 8 | 0 | 0 | 16 | 13.42 s |
| ON | 8 | 8 | 0 | 0 | 19 | 8.45 s |

Latency comparison above uses 8 pairs with no provider failures in either mode. N/A means no valid paired measurements. All trials and failure events remain in results.json. A failed action ends that journey; there are no automatic retries. Failure-inclusive waiting is time spent on attempted actions, not time to eventual successful completion. Server action waits exclude browser/network/render overhead.

Provider response times and shared quota/load vary. The live adaptation and browser checks also ran during this measurement window. This was not a controlled-load performance study; repeat before making a production claim.
