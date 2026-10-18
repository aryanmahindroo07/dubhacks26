> Historical evaluation before the v4 correctness follow-up. See [receipt correctness](../receipt-correctness.md) and the receipt-v4 results for current checks; these older outcomes are retained for transparency.

# What the real-data tests found

The first demo was an integration proof, not enough evidence to call the product broadly validated. These follow-up tests use public real inputs and real human behavior in separate experiments.

## Real receipt photos and live providers

Used the first six CORD-v2 test images, not images chosen for successful outputs. Ran 20 journeys: six extraction OFF/ON pairs, two wrong-action pairs, two stop pairs. Cold cache/model per trial, ordinary caching in both modes, alternating order, matched review intervals of 0/1.5/5 seconds, and 15-second gaps between trials. All provider calls succeeded, but not all outputs were correct.

Across all scenarios, backend waiting was 14.19 s OFF / 10.27 s ON (27.6% lower), with 18 / 22 provider calls. ON used six prefires and left four unused. P95 action waiting was worse ON (1.69 s versus 1.25 s). Across only extraction pairs, total waiting was 10.18 s OFF / 6.48 s ON; one pair per image is insufficient to characterize production performance. Differences also include provider/network variation. Deliberate review time and browser transport/rendering are not counted in backend action waiting.

A fixed “always prefire extraction after receipt OCR” rule made the same decisions as the seeded Markov policy on these cases. There is no demonstrated advantage of Markov over that fixed rule here. Wrong/stop frequencies were chosen by us, not observed from real customers.

Strict amount-field scoring matched 9/13 references in each mode. Some misses were naming aliases (TOTAL SALES/SUBTTL), some were omissions, and one response returned wrapper metadata rather than fields. This is not a full OCR accuracy score. The source JSON and quality details preserve misses.

## Fix and independent additional inputs

Changed the extraction prompt to supply raw OCR as document data, keep category metadata outside it, and request canonical names for explicit total/subtotal/tax. No reference answers are sent to providers. Prompt cache identity is v2. Three additional CORD test images (6–8), selected before that prompt edit, were checked in six more OFF/ON journeys. Four of seven reference amounts matched in each mode; two of three receipts had all scored amounts correct. On the third, Perceptron omitted the right-hand amounts, so downstream Gemini outputs were incorrect. Different images mean these scores cannot be used as a causal before/after comparison. The pipeline is still assisted extraction requiring human review, not reliable unattended accounting. No dashboard layout changes were made.

## Actual human navigation, offline

Used Wikispeedia public historical game paths: 62,215 training paths and 13,978 held-out paths, grouped by anonymized IP identifier to keep identifiers out of both sets. Tested the existing Markov class on 86,446 decision points, including back/cached visits and stops. No AI requests, no test-time learning, no target feature, no threshold tuning on the held-out set.

- Global-popularity top-1 precision: 6.83%.
- First-order always-predict precision: 14.80%.
- First/second-order always-predict precision: 15.19%.
- First-order gated precision: 49.43%, predicting at 3.06% of decisions.
- First/second-order gated precision: 52.44%, predicting at 3.55% of decisions.

The 52.44% is precision when predicting, not overall accuracy: the gated policy correctly predicted the next page at 1.86% of all decision points. Second-order context adds a modest gain here. This is real human behavior in a different domain, not validation of receipt-app users. There are no per-click API timings in this dataset, so no measured runtime savings are claimed for it.

A real historical example: after Whale → Fish, the model predicted Whale shark and the next click matched. A counterexample: after Ice → Climate, it predicted Global warming but the person chose Weather. These short examples illustrate outcomes; they are selected after aggregate evaluation and are not representative accuracy samples.

## What to do next

1. Use a real CORD image through Choose File in /ai for the demo. Label synthetic training and scripted timing trials. Keep incorrect extraction visible or explain that output needs review.
2. Address OCR loss/amount validation before claiming reliable receipt processing. Current prompt fix does not solve faint-column OCR.
3. If the pitch claims real-user predictive accuracy in the app, collect actual app journeys and compare against always-extract and most-frequent-next-action baselines. Public navigation data supports a narrower, separate claim only.
4. Preserve scope: two demos are sufficient; more applications are not a substitute for trustworthy evaluation. Present the tradeoff of useful latency hiding versus extra calls, not universal accuracy or faster AI computation.

Sources: CORD-v2, NAVER CLOVA, CC BY 4.0 (https://huggingface.co/datasets/naver-clova-ix/cord-v2); Wikispeedia (https://snap.stanford.edu/data/wikispeedia.html), West & Leskovec WWW 2012; West, Pineau & Precup IJCAI 2009. Reproduction and caveats are in docs/real-data-evaluation.md.
