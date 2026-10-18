# Real-receipt evaluation

Consecutive test rows 6–8; selected before provider calls; not selected by outcome.

Real CORD test photographs and annotated amounts; action sequences are scripted. The Markov model still starts from synthetic journeys. CORD was not supplied to this app’s predictor or prompts as training data; external provider pretraining overlap is unknown.

| Mode | Matched amount fields / reference fields | Completed extraction requests |
|---|---:|---:|
| OFF | 4 / 7 | 3 / 3 |
| ON | 4 / 7 | 3 / 3 |

Scoring covers total, subtotal and tax when annotated, using exact normalized amount matches and predefined field-name aliases. Missing/failed fields count as incorrect. It does not measure complete OCR accuracy or arbitrary field correctness. See score details for misses.

| Receipt | Review interval | OFF total action wait | ON total action wait | Saved |
|---|---:|---:|---:|---:|
| cord-test-006 | 0 ms | 1640.9 ms | 1226.3 ms | 414.6 ms |
| cord-test-007 | 1500 ms | 1311.5 ms | 559.5 ms | 752.0 ms |
| cord-test-008 | 5000 ms | 2980.8 ms | 561.0 ms | 2419.8 ms |

Mean paired waiting difference: 1195.5 ms; exploratory image-pair bootstrap 95% interval [414.6, 2419.8] ms. One pair per image and a small sample: this does not characterize production variance or establish general significance. Review intervals differ across images, but are matched within each pair.

Observed speculative starts: 3; actions: ['EXTRACT_FIELDS'].

## What is and is not established

Real images and real model latency are tested here. Predictive accuracy on real users is not tested: these actions were authored. A fixed policy that always prefires extraction after receipt OCR may choose the same requests as the seeded Markov policy. If it does, these trials cannot establish an advantage over that baseline. Wrong-action and stop cases quantify wasted calls, not naturally observed prediction error rates. The correct-policy benefit cannot be extrapolated without real workflow traces.

Failed trials, all provider calls and unused prefires remain in the benchmark report. No retries were used. Backend action waiting excludes transport/rendering and the deliberate review interval; client journey time is retained in raw results.
