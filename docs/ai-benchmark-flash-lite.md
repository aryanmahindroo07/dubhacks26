# AI inbox OFF/ON measurement

Actual model requests · 1 repetitions · 5000 ms review interval. Synthetic images and authored journeys.

| Scenario | OFF mean action wait | ON mean action wait | Net extra provider calls | ON consumed prefires | ON unused prefires |
|---|---:|---:|---:|---:|---:|
| receipt-extraction | 786.0 ms | 286.1 ms | 0 | 1 | 0 |
| receipt-unexpected-summary | 677.6 ms | 631.5 ms | 1 | 0 | 1 |
| whiteboard-tasks | 637.7 ms | 272.1 ms | 0 | 1 | 0 |
| ALL | 700.4 ms | 396.5 ms | 1 | 2 | 1 |

P95 action wait: OFF 1000.5 ms; ON 692.2 ms.

Token usage is in results.json provider events. No dollar estimates are made. Task elapsed includes the fixed review interval; action waits do not. Small samples do not establish production accuracy or statistical significance.

## Reliability — all trials, including failures

| Mode | Trials | Completed journeys | Provider failures | Failed actions | Provider calls | Total action wait incl. failures |
|---|---:|---:|---:|---:|---:|---:|
| OFF | 3 | 3 | 0 | 0 | 6 | 4.20 s |
| ON | 3 | 3 | 0 | 0 | 7 | 2.38 s |

Latency comparison above uses 3 pairs with no provider failures in either mode. N/A means no valid paired measurements. All trials and failure events remain in results.json. A failed action ends that journey; there are no automatic retries. Failure-inclusive waiting is time spent on attempted actions, not time to eventual successful completion. Server action waits exclude browser/network/render overhead.

# Flash-Lite validation notes

Model: gemini-3.5-flash-lite; OCR: perceptron-mk1.5. Three authored scenarios, one OFF/ON pair each, five-second review interval in both modes and a fifteen-second gap between trials. Fresh cache and seeded model each trial. This is a small sanity check, not a production performance claim.

All six journeys completed; no provider errors. Receipt extraction: total backend action waiting 1.57 s OFF / 0.57 s ON. Whiteboard tasks: 1.28 s OFF / 0.54 s ON. Across all scenarios, 4.20 s OFF / 2.38 s ON, approximately 43% less measured action waiting. OFF made 6 provider calls, ON made 7. ON used two prefires and left one unused (the unexpected-summary scenario). Its small timing difference is not evidence of a benefit from the unused prediction. Browser transport/rendering and the fixed review interval are not part of action waiting.

Receipt amounts, date and receipt number matched the sample. The OFF extraction omitted the merchant field while ON included it; the unconstrained field list is not identical across requests. Whiteboard names and primary actions were correct; both task outputs omitted the relative deadline “before launch” from Sam’s task. No claim of perfect extraction quality.

Do not combine these timings with the earlier Gemini 3.8 Flash benchmark. Outputs and token usage are retained in flash-lite-benchmark-results.json. Repeated and randomized trials plus real workflow traces remain future evaluation work.
