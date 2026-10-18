# Public real-receipt evaluation inputs

`cord-test/` contains consecutive test rows 0–5 of NAVER CLOVA's CORD-v2; `cord-check/` contains rows 6–8 selected for a post-fix check. Images are downloaded as served by the dataset viewer; JSON annotations are the dataset reference answers. The application/provider receives images only, never the annotations. Local scripts do not use these documents to train the predictor. Provider pretraining overlap is unknown.

Source: https://huggingface.co/datasets/naver-clova-ix/cord-v2
Original project: https://github.com/clovaai/cord
License: Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/
Attribution: NAVER CLOVA; Seunghyun Park et al., *CORD: A Consolidated Receipt Dataset for Post-OCR Parsing*, Document Intelligence Workshop at NeurIPS 2019.

Manifests include the pinned source revision, image SHA256 hashes and selection rules. Dataset annotations include blurred/redacted areas; ground truth is a reference, not a promise of perfect visual readability. We retained the images/annotation data and reformatted annotation JSON; no receipt values were changed. Monetary punctuation varies; the scorer treats Indonesian thousands separators and decimal notation as documented by its tests. Strict field aliases can undercount correctly named fields outside that mapping; inspect quality details rather than calling the score full OCR accuracy.

Download/reproduce from the repository root:

```sh
python3 scripts/fetch_cord_samples.py
python3 scripts/fetch_cord_samples.py --offset 6 --count 3 --out datasets/cord-check
```

Use **Choose File** in `/ai` to select a JPEG here for an actual photographed-receipt demo. Existing demo buttons still load synthetic examples. No dashboard layout changes are needed.

Wikispeedia raw paths are kept only in ignored/untracked local `work/`; they are not redistributed here. The navigation report cites its original authors and links to Stanford's public archive. Do not interpret the SNAP software BSD license as a separate verified license for those path records.
