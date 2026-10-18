# Receipt inbox: learning, read-ahead and duplicates

The `/ai` page is now a receipt inbox for bookkeepers and small teams. Three
features show what RequestFlow does that a fixed rule ("always extract after
reading a receipt") cannot.

## It learns each user's habits

Predictions start from the shared model (500 generated journeys) and blend in a
small model of the current user's own choices:

    p = (n × personal + k × shared) / (n + k),  k = 4

`n` is how often this user was in the same situation. Two consistent choices
change what gets prefetched. The "What RequestFlow has learned about you" panel
shows each item type's next-action likelihoods, starting model vs now, and when
the prefetch choice changes.

Demo (prefetch ON): add three demo whiteboards. On the first two, Read text
then Summarize. The panel switches from "Turn into tasks" to "Summarize"
(Summarize 23% → 48%), and on the third whiteboard Summarize is ready before
you click it. The first two whiteboards each leave an unused "Turn into tasks"
prefetch: that is the cost of learning, and it shows in the run's totals.

Learning is per run: Fresh run resets it. Nothing is stored across sessions.

## Read-ahead (off by default)

With **Read ahead** on, the next unread image in the inbox is sent to
Perceptron in the background while you work, so it opens instantly. It uses the
model as a gate (only when Read text is the likely first action for that kind
of image) and the same per-image call budget as prefetch. Because it sends an
image before the user opens it, it has its own consent switch, separate from
prefetch. Background calls are labelled `read-ahead` in the event log.

## Duplicate receipts

A receipt is flagged as a possible duplicate when the same image was uploaded
earlier, or when its extracted total and date (both supported by OCR evidence)
match an earlier receipt. It is a warning only; nothing is blocked or removed.

## When OCR fails

The backend decides what to do from the kind of error (`recoveryFor` in
`backend/ai/service.js`). Typing the text by hand is offered for every kind.

| Kind | Examples | Automatic retries | The page offers |
|---|---|---|---|
| Temporary | network error, server error (5xx), garbled reply | up to 2 (1 s, then 2 s) | Retry, or type the text |
| Timeout | no answer within `AI_TIMEOUT_MS` | none (it already waited the full limit) | Retry, or type the text |
| Image problem | no readable text, reply cut off | none | a sharper or cropped photo, or type the text |
| Rate limit | 429 | none | wait a minute and retry, or type the text |
| Setup problem | wrong key, no access, wrong model (401/403/404), key missing | none | fix `backend/.env`; type the text meanwhile |

- A background call (prefetch or read-ahead) gets the same single round of
  attempts and is not tried again for that image; only a click starts a new
  round. Retries show in the event log.
- Provider calls give up after 15 s by default (`AI_TIMEOUT_MS` in
  `backend/.env`). That is also the longest a user waits before Retry and
  typed text are offered. Measured calls take about 0.3–1.6 s, so 15 s only
  cuts off calls that have stalled.
- Typed text counts as the text for that image: Gemini actions work on it, it
  is labelled "Typed text", and no provider call is made.

## Receipt-check fixes

- An amount after the word ITEMS is no longer discarded (`TOTAL 3 ITEMS 13.20`);
  whole-number item counts are still ignored.
- A total whose amount is on the next OCR line (`TOTAL` / `13.20`) is
  recognized, so extraction is no longer flagged and prefetch is no longer
  switched off for those receipts.
- Re-checking the 12 saved CORD receipt results gives identical outcomes.

## Not built: highlighting the total on the image

Perceptron can return object locations, but its coordinate format is not
documented anywhere we could reach. Drawing boxes by guesswork could highlight
the wrong place, so this waits for the format from Perceptron's docs or mentors.

## Tests

`backend/ai/service.test.js` covers the habit switch, read-ahead consent and
reuse, and both kinds of duplicate; `backend/ai/receiptValidation.test.js`
covers the two fixes.
