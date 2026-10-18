# RequestFlow demo and evidence protocol

## 1. Show actual input and actual provider output

Open `/ai`, start a Fresh run and choose **Add 3 real US receipts**.
These are publicly licensed photographs from Family Dollar in Oklahoma, Walmart
in Missouri, and Cameron Market in Missouri, with USD amounts. Credits and
individual CC BY-SA licenses are in `frontend/public/real-receipts/ATTRIBUTION.md`.
Source URLs, hashes and manually transcribed reference amounts are recorded in
`datasets/us-receipts/manifest.json`. Only images go to providers. The Walmart
photo is rotated upright and cropped to remove background; the full receipt
and its original printed amounts remain intact. References are not an independent dataset ground truth.

The recorded benchmark in the comparison panel still uses the previous
Indonesian CORD receipts. It is explicitly labelled CORD and must not be
presented as a US-receipt result. To measure the new inputs, substitute
`--manifest datasets/us-receipts/evaluation.json` in the benchmark command below.
No US provider accuracy or latency claim is established merely by adding images.

Click Read text and compare its text with the visible image. Then Extract fields;
show the supporting OCR quote and any values requiring review. OCR-supported does
not mean image-verified. A provider failure, unreadable total or unknown amount
must remain visible. Never silently replace a result with the reference answer.
For accuracy scoring, use `scripts/check_receipt_quality.cjs` and existing reports
in `docs/evaluation/`; those results are distinct from latency measurements.

## 2. Make the hidden work visible

Enable prefetch, leave read-ahead OFF. Read text, then watch the status strip:
Preparing → Ready → Used with the actual observed wait. Clicking earlier can
join a running request, which saves only the overlap, not the whole latency.
Model percentages are estimates from generated journeys plus this session's
choices, not measured accuracy. A different next action demonstrates wasted work.
Read-ahead is a separate batch optimization: do not attribute it to next-action
prediction. Keep it off in the primary OFF/ON experiment.

## 3. Run matched OFF/ON measurements

Start the backend with BOTH provider keys configured in its ignored `.env`.
From the repository root (Node 22.12+):

```sh
node scripts/benchmark_ai.mjs --manifest datasets/cord-check/demo-evaluation.json --repetitions 2 --dwell-ms 1500 --trial-gap-ms 20000 --out work/demo-evidence
```

This makes real, potentially billable calls. The full experiment has 16 trials
(4 scenarios × 2 repetitions × 2 modes), normally at least 32 demanded/used
provider operations plus any unused speculation. Check provider quotas first.
For a smaller smoke test use `--repetitions 1`; label it a small sample.
The deliberate summary branch exposes a wrong guess; it is not user behavior.

The runner alternates OFF/ON order, gives each trial a fresh session/cache/model,
uses identical inputs and scripted actions, waits 1500 ms between actions in
BOTH modes, and drains background work. Do not wait for Ready only in ON.
It stops on recognized quota errors and preserves partial results and failures.
Read `work/demo-evidence/summary.md`; load `results.json` in the UI comparison
panel. Report median paired total-wait reduction, all-trial failures and call
counts. A negative reduction means ON was slower. A small sample supports a
controlled demonstration, not production accuracy or a statistically proven win.
The UI excludes unmatched/failed pairs, mismatched models/actions/dwell,
read-ahead and manual-text trials from the prediction latency comparison.
Keep the full export so excluded trials remain visible.

Individual **Export measurements** files remain useful for diagnostics; they
cannot alone prove a matched experiment and are not accepted by this panel.
To regenerate a report without provider calls:

```sh
node scripts/benchmark_ai.mjs --report-only --out work/demo-evidence
```

## 4. Demonstrate adaptation

Fresh run → prefetch ON, read-ahead OFF. Add four synthetic demo whiteboards.
On the first three, run Read text → Summarize, then open the next image.
The existing learning panel shows starting and current probabilities.
On the fourth, inspect the selected prefire; if ready, consume Summarize.
This controlled example demonstrates a policy changing with repeated choices;
it does not establish generalization to unseen users. Repeat with a fresh run
before recording so cached results and earlier learning cannot bias it.

## Recording order

Show a normal wait, then a predicted cache reuse, then an unexpected choice and
its extra call cost. Show the matched measurements and the adaptation panel.
Record the actual run, including failures. Keep public-data accuracy, scripted
latency results and personal-learning demonstrations labelled separately.
Latency saved across steps adds up; do not claim exponential speedup.

To reproduce the adaptation demonstration with live providers and save its
starting/current predictions and fourth-image cache source:

```sh
node scripts/demo_adaptation.mjs --gap-ms 10000 --out work/adaptation-demo
```

This uses four synthetic whiteboard images and real provider calls (including
unused prefires). It stops if a provider fails. Its results are a demonstration
of adaptation under an authored sequence, not a real-user accuracy measurement.

## Saved evidence from this implementation

- `docs/evaluation/demo-benchmark.md`: 16 live trials / 8 matched pairs.
- `frontend/public/demo-evidence/results.json`: raw live-provider benchmark
  loaded by **Load recorded CORD benchmark (Indonesia)** in the UI.
- `docs/evaluation/demo-amount-checks.md`: amount correctness against local
  reference annotations for the same receipts (separate from latency).
- `docs/evaluation/demo-adaptation.md`: controlled four-whiteboard run with a
  changed prefire choice and a consumed summary prefire on the fourth image.

Recorded results are historical, dated evidence, not metrics for the currently
open browser session. The UI does not automatically load them or mix them with
live counters. Review the measured extra calls and wrong-action cases as well
as the waiting reduction before selecting any pitch claim.
