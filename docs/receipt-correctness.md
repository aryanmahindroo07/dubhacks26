# Local OCR and receipt amount correctness changes

This follow-up is included in PR #19 alongside the earlier real-data evaluation. Saved final quality outputs are in docs/evaluation/receipt-v4-results.json. Earlier evaluation outputs remain historical baselines, not results for this version.

## Changes

- Perceptron transcription explicitly scans the full width, associates labels and right-column amounts, copies every digit/separator without rescaling or removing zeros, and skips blank/redacted regions. Uses explicit `reasoning_effort: none`, 4096 output-token budget. Controlled checks did not require higher effort; high effort generated filler in one control. No image is altered and no annotations/answer values are included in prompts.
- Gemini fields include nullable values and an exact OCR-line quotation. It must not infer an amount from a coupon, quantity or tax percentage.
- `receiptValidation.js` checks that quoted evidence exists in OCR, the amount is on that evidence line, the label identifies the amount, and tax rates/item counts are not monetary values. Conflicts and unsupported values become null, with an issue and (where available) a retained proposed value for audit. Unstated optional tax/subtotal is distinguished from an unreadable stated amount. No missing value is calculated or filled from references.
- The UI shows evidence beside each field and review messages. “Supported by OCR” is not “verified correct against the image.” An OCR error repeated in the extraction can still pass evidence checks.
- If a receipt total is not readable in OCR, the live AI service does not automatically prefire extraction. The manual action remains available. Its result still goes through validation. Other item categories and customer dashboard behavior are preserved.
- Prompt/cache identity is v4. Restart the backend to load these local changes. Fresh run avoids earlier session/cache/model state.

## Checks performed

Development cases: CORD test rows 0–8 from the previous evaluation. Additional check inputs: consecutive rows 9–11, downloaded before provider testing. Initial full-width transcription improved the faint receipt but another receipt still had dropped zeros. A stronger digit-preservation instruction was then tested on the problematic cases and frozen before the final full-set run. These are iterative development checks, not a pristine held-out benchmark or an estimate of production accuracy.

Final sequential run: 12 images, one OCR and one extraction each, no retries. All 24 annotated total/subtotal/tax values matched under the existing fixed-alias/amount-normalization scorer. This covers those reference values only, not every receipt field, full OCR, or future inputs. Three receipts still had additional unsupported fields flagged for review. No provider errors occurred in this final run. Earlier failed/intermediate cases remain in local work/ocr-correctness logs; they are not overwritten by the final results.

Automated checks cover invented quotes/numbers, percentages, coupon/quantity substitution, subtotal/total with equal values, conflicting totals, unstated optional fields, and skipping speculative extraction for unreadable receipt totals. Validation checks do not guarantee image authenticity, semantic correctness, or numeric OCR fidelity. Human review remains appropriate.

The browser rendering check used the built-in synthetic image and actual provider responses, confirming evidence display. Public real images were exercised through the API because the Chrome extension's file upload permission was unavailable; no extension permissions were changed.

## Reproduce without guessing references

Fetch the additional public images:

```sh
python3 scripts/fetch_cord_samples.py --offset 9 --count 3 --out work/ocr-correctness/new-inputs
```

This quality command makes real provider calls (two per document), separately from latency benchmarking:

```sh
node scripts/check_receipt_quality.cjs \
  --manifest datasets/cord-test/manifest.json \
  --manifest datasets/cord-check/manifest.json \
  --manifest work/ocr-correctness/new-inputs/manifest.json \
  --gap-ms 8000 --out work/ocr-correctness/final-run
```

Reference answers stay in the local runner for scoring; provider calls receive only the image or its OCR text and category. Keep provider access and project quotas in mind. No automatic retries or silent extra verification calls are added to the application.

Perceptron's official OCR guide recommends preserving printed strings, explicit reading/association instructions and validating extracted results: https://docs.perceptron.inc/perceptron-mk1.5/capabilities/ocr . Dataset attribution and license: datasets/README.md.

## Final live cache regression

The previously difficult receipt (CORD 007) completed a fresh OFF/ON pair on v4 with a five-second review interval. Total backend action waiting was 1.31 s OFF / 0.66 s ON, two provider calls in each. ON consumed one completed prefire; the three annotated amounts matched in both modes. This is a single regression check, not an updated general performance benchmark. Earlier v1/v2 latency results should retain their prompt version labels.
