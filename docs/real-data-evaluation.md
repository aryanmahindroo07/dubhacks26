# Real-data evaluation protocol

This work separates three questions that synthetic demos cannot answer together:

1. Can the real providers process realistic photographed receipts correctly?
2. Does starting an eligible call early reduce actual user waiting, and what is spent on wrong/abandoned predictions?
3. Can the existing Markov predictor predict unseen human behavior better than simpler baselines?

## Real AI inputs and latency

CORD-v2, NAVER CLOVA, CC BY 4.0. First six test rows (0–5) chosen in order before provider calls. Six paired extraction scenarios use 0, 1500 or 5000 ms between OCR and the next click. Each OFF/ON pair uses the identical image/actions/review interval, fresh session/cache/seeded model and opposite ordering on alternating scenarios. Two unexpected-summary pairs and two stop pairs exercise wrong/abandoned predictions. Trailing speculative work is drained for accounting; no retry is hidden; failures remain in reports. A quota error stops further trials. Fifteen-second gaps reduce request bursts but are not a quota guarantee.

This tests **real images and model latency with scripted behavior**. The receipt policy starts from synthetic journeys. A fixed rule that always prefires extraction after OCR can make identical decisions here; receipt tests alone do not show Markov outperforming that rule. Stop and wrong-action rates are chosen stress cases, not an estimate of user behavior in deployment.

The original extraction prompt occasionally extracted wrapper metadata and omitted document fields. That baseline is preserved. The fix sends raw OCR as the user message, puts category metadata in system context, and asks for canonical total/subtotal/tax fields when explicitly stated. It does not receive annotation answers or infer missing amounts. Prompt identity changes to v2 to avoid cache collisions. Three additional test images (6–8), selected before editing the prompt, are a post-fix check. Different images mean baseline/check percentages are not a causal estimate of improvement. Further independent examples are needed for a quality guarantee.

```sh
node scripts/benchmark_ai.mjs --manifest datasets/cord-test/evaluation.json --repetitions 1 --trial-gap-ms 15000 --out work/cord-evaluation
python3 scripts/score_cord.py --results work/cord-evaluation/results.json --out work/cord-evaluation
node scripts/benchmark_ai.mjs --manifest datasets/cord-check/evaluation.json --repetitions 1 --trial-gap-ms 15000 --out work/cord-postfix-check
python3 scripts/score_cord.py --results work/cord-postfix-check/results.json --manifest datasets/cord-check/manifest.json --out work/cord-postfix-check
```

Running either benchmark makes real provider calls. The first baseline used prompt v1; current code uses v2, so rerunning now produces a new experiment. Keep saved baseline outputs. Per-trial model/prompt IDs and client request/journey times are in raw results where available. Backend action waiting excludes browser/network/rendering and deliberate review time. P95 with a small sample is descriptive only. Quality scoring checks annotated total/subtotal/tax amounts with fixed aliases; it is not full OCR accuracy. Missing and failed outputs count as incorrect. Alias misses can be valid differently named fields, which require manual review.

## Human prediction evaluation (no AI calls)

Wikispeedia contains real human navigation collected through a goal-directed Wikipedia game. Finished and unfinished paths are included. Split approximately 80/20 by a fixed hash of the dataset's hashed IP identifier: no group occurs on both sides. An identifier is not necessarily one person; shared IP and changing IP are limitations. The target article is not a feature. Freeze the trained model for evaluation, with no test-time learning or threshold tuning.

Resolve back clicks to their destination; append STOP to every path end. Evaluate one next-page decision at each prefix using outgoing links minus already visited pages. Stopping and cached/back-page visits stay in the denominator. Cache is idealized as the whole current game history; TTL and request latency are not simulated. Compare global popularity, first-order top-1, existing first/second-order top-1, and both first-order and first/second-order policies with the existing scored 35% floor. Report precision **and** coverage; the gated precision is not overall accuracy. A prediction is credited only for the immediately next page, not some eventual reuse later in the journey.

```sh
python3 scripts/prepare_wikispeedia.py
node scripts/evaluate_navigation.cjs
```

The actual `backend/prediction/markov.js` and `scoring.js` are imported; this is not a new predictor implementation. States are Wikipedia pages, not receipt tools. Results establish behavior only on this domain; they do not validate AI-inbox/customer-user accuracy or transfer latency savings between domains. Real provider prefire latency and human-navigation prediction are **separate experiments**. Do not multiply them together and call that measured end-to-end ROI.

Source: https://snap.stanford.edu/data/wikispeedia.html
Cite Robert West & Jure Leskovec, *Human Wayfinding in Information Networks*, WWW 2012; Robert West, Joelle Pineau & Doina Precup, *Wikispeedia: An Online Game for Inferring Semantic Distances between Concepts*, IJCAI 2009. Raw paths/hashed identifiers remain local; only aggregate reports and short illustrative title transitions are shared.

## What still requires actual app users

The dashboard/customer records can stay synthetic when demonstrating API caching, with artificial delay disclosed. Real company records are not required to test request reuse. Real behavioral accuracy in either app requires traces of people choosing actions naturally. A short convenience sample of teammates helps debug but is not representative user validation. Collect timestamps, item category, actual clicked action and stop events; split by participant/session before training and testing. Compare against fixed workflows and most-frequent-next-action policies. Do not report generated journeys or authored test actions as observed user habits.
