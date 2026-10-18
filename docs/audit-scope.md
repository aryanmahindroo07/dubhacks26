# Mise: audit scope and evidence map

This document clarifies the system boundary for reviewers and automated repository
analysis. It does not suppress findings or assert that Mise meets a legal standard.

## What the automatic decision controls

The first- and second-order Markov predictor selects a registered read-only API
operation to execute speculatively. It predicts a categorical next action; elapsed
latency is an evaluation metric, not a regression target. It does not decide
customer eligibility, approve expenses, make payments, or control physical devices.
Perceptron supplies OCR and Gemini supplies text transformations; Mise does not
train an image-classification model. The customer API demonstration uses synthetic
records and a disclosed simulated delay.

## Review surfaces and existing evidence

| Surface | Existing behavior and evidence | Limit to retain in the audit |
|---|---|---|
| Uploaded receipt text | `backend/ai/providers.js` treats document text as data and asks for evidence rather than invented amounts. | Prompt instructions alone do not prove prompt-injection resistance. |
| Extracted amounts | `backend/ai/receiptValidation.js` checks amount evidence; `backend/ai/receiptValidation.test.js` tests unsupported values. | Agreement with OCR does not guarantee agreement with the image; human review is still required. |
| Speculative calls | `backend/ai/service.js` starts sessions with prefetch/read-ahead off and bounds speculative work per item. | Wrong guesses can still spend quota and incur provider charges. |
| Input privacy | Images and OCR text are processed by external providers when their actions run. | Public sample receipts do not establish suitability for confidential customer documents or provider retention guarantees. |
| Measured benefit | `docs/evaluation/us-policy-benchmark.md` compares OFF, fixed extraction, and Markov. | Scripted workflows do not establish real-user accuracy or superiority over a fixed rule. |

## Record actual audit outcomes

After the VEYZL check completes, preserve its PR/check URL, the specific finding,
the change made in response, and the subsequent result. The earlier repository
analysis motivated this scope clarification; it is not evidence that a completed
PR audit passed. Report unresolved findings explicitly. Do not describe this
prototype as certified or production-ready on the basis of a passing check.
