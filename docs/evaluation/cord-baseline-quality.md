# Real-receipt evaluation

First six test rows, indices 0–5; selected before provider calls; not selected by outcome.

Real CORD test photographs and annotated amounts; action sequences are scripted. The Markov model still starts from synthetic journeys. CORD was not supplied to this app’s predictor or prompts as training data; external provider pretraining overlap is unknown.

| Mode | Matched amount fields / reference fields | Completed extraction requests |
|---|---:|---:|
| OFF | 9 / 13 | 6 / 6 |
| ON | 9 / 13 | 6 / 6 |

Scoring covers total, subtotal and tax when annotated, using exact normalized amount matches and predefined field-name aliases. Missing/failed fields count as incorrect. It does not measure complete OCR accuracy or arbitrary field correctness. See score details for misses.

| Receipt | Review interval | OFF total action wait | ON total action wait | Saved |
|---|---:|---:|---:|---:|
| cord-test-000 | 0 ms | 1500.1 ms | 1433.3 ms | 66.9 ms |
| cord-test-001 | 1500 ms | 1411.1 ms | 641.5 ms | 769.7 ms |
| cord-test-002 | 5000 ms | 1897.8 ms | 529.5 ms | 1368.3 ms |
| cord-test-003 | 0 ms | 1890.2 ms | 1589.7 ms | 300.5 ms |
| cord-test-004 | 1500 ms | 1521.2 ms | 593.1 ms | 928.1 ms |
| cord-test-005 | 5000 ms | 1957.6 ms | 1690.6 ms | 267.0 ms |

Mean paired waiting difference: 616.7 ms; exploratory image-pair bootstrap 95% interval [282.7, 990.8] ms. One pair per image and a small sample: this does not characterize production variance or establish general significance. Review intervals differ across images, but are matched within each pair.

Observed speculative starts: 10; actions: ['EXTRACT_FIELDS'].

## What is and is not established

Real images and real model latency are tested here. Predictive accuracy on real users is not tested: these actions were authored. A fixed policy that always prefires extraction after receipt OCR may choose the same requests as the seeded Markov policy. If it does, these trials cannot establish an advantage over that baseline. Wrong-action and stop cases quantify wasted calls, not naturally observed prediction error rates. The correct-policy benefit cannot be extrapolated without real workflow traces.

Failed trials, all provider calls and unused prefires remain in the benchmark report. No retries were used. Backend action waiting excludes transport/rendering and the deliberate review interval; client journey time is retained in raw results.
