# Held-out human-navigation evaluation

Source: https://snap.stanford.edu/data/wikispeedia.html

62215 training paths; 13978 held-out paths. Fixed SHA256 grouping of hashed IP identifier, seed requestflow-eval-42; approx 80/20. Same identifier never occurs on both sides; identifiers are proxies, not guaranteed unique people. Includes finished and unfinished games. No test-time learning.

Back clicks resolved to their destination via stack; STOP appended at each finished/unfinished path end. Cache starts empty per game and visited pages are excluded from prefetch candidates. Target article is not an input feature. Raw data remains local; report contains aggregates only.

| Policy | Decisions | Prefetches | Correct next-page predictions | Precision when predicting | Coverage | Correct per decision |
|---|---:|---:|---:|---:|---:|---:|
| Global popularity | 86446 | 86388 | 5897 | 6.83% | 99.93% | 6.82% |
| First order, always top-1 | 86446 | 86376 | 12787 | 14.80% | 99.92% | 14.79% |
| First/second order, always top-1 | 86446 | 86376 | 13118 | 15.19% | 99.92% | 15.17% |
| First order, scored 35% floor | 86446 | 2646 | 1308 | 49.43% | 3.06% | 1.51% |
| First/second order, scored 35% floor | 86446 | 3068 | 1609 | 52.44% | 3.55% | 1.86% |

Test outcomes include 65222 next pages not already visited, 7246 cached/back visits and 13978 stops. Stops and cached next visits stay in the denominator; speculative requests at those points are not counted as immediately useful.

This evaluates the existing first/second-order Markov core on actual human navigation. It does not demonstrate real-user accuracy in the AI inbox/customer dashboard. Wikispeedia is goal-directed game navigation and is a different domain. The model never sees the target as a feature. We did not tune thresholds on the test set. A correct next-page prediction does not imply a measured latency saving: there are no per-click request latencies or review intervals here. No API calls or dollar/runtime savings are claimed.

Training uses natural repeated/back transitions; evaluation candidates exclude already visited pages. Smoothing is the app default alpha=1 and second-order fallback minimum=3. Scored policy uses the existing 35% floor and default scoring assumptions, not a measured economic optimum. Report both precision and coverage; high precision at low coverage is not overall accuracy.

Citation: Robert West and Jure Leskovec, Human Wayfinding in Information Networks, WWW 2012; Robert West, Joelle Pineau and Doina Precup, Wikispeedia: An Online Game for Inferring Semantic Distances between Concepts, IJCAI 2009. Raw paths/hashed identifiers are not included in the report or committed.
