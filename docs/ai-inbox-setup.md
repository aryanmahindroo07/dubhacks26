# Live AI inbox: setup and demo

This extension adds `/ai` alongside Customers (`/`) and Live overview (`/overview`). It keeps the existing dashboard layouts. The original `/api/inbox` simulated endpoints remain separate from the new real-provider `/api/ai` endpoints.

## What the servers and data are

The frontend dev server serves React. The backend server stores demo sessions, runs the Markov predictor/cache, and calls providers using private keys. You need both servers running. Customer records can remain synthetic: they demonstrate API reuse, not the quality of a customer database. The customer demo's artificial delay must be disclosed. The AI demo uses real provider latency and real responses, with synthetic receipt/whiteboard images as inputs. There is no simulated AI fallback.

Perceptron transcribes the image after **Read text**. Gemini transforms that OCR text into fields, a summary, or tasks. The first/second-order Markov model predicts which registered action follows an actual click. It does not predict arbitrary freeform prompts. Its starting journeys are synthetic, so probabilities are not measured user accuracy.

## Get the keys

1. Create a Gemini API key at https://aistudio.google.com/apikey. Check project access, quota and billing there.
2. Ask the Perceptron hackathon mentor/workshop for API access and the model ID your key supports. Provider documentation: https://docs.perceptron.inc/perceptron-mk1.5/index .
3. Keep keys out of chat, frontend code, screenshots, Git and exported measurements.

## Configure and run

Use Node 24 LTS. From this repository's root:

```sh
cp -n backend/.env.example backend/.env
```

Open `backend/.env` in VS Code and fill in `GEMINI_API_KEY` and `PERCEPTRON_API_KEY`. The defaults are `gemini-2.5-flash` and `perceptron-mk1.5`; change them if your accounts require different available models. The backend loads this file automatically on startup. Restart it after edits.

Terminal 1, from the repository root:

```sh
npm install --prefix backend
npm start --prefix backend
```

Terminal 2, from the same root:

```sh
npm install --prefix frontend
npm run dev --prefix frontend
```

Open the frontend URL printed by Vite and add `/ai`. By default, the backend listens on port 4000 and Vite proxies `/api` to it. For a separate backend origin set `VITE_API_BASE` before starting Vite. Do not put provider keys in any `VITE_` variable.

## First live check

1. Leave prefetch OFF. Choose **Demo receipt**, then **Read text**. Confirm real OCR appears. Click **Extract fields** and check the actual receipt total.
2. Click **Fresh run** after all requests finish. Enable prefetch, load the same receipt, and click **Read text**. Wait while reading until the speculative request finishes, then choose **Extract fields**. Check cache reuse and provider call counts.
3. Repeat with **Demo whiteboard**, **Read text**, and **Turn into tasks**. Also choose a different action once to demonstrate an unused prediction.
4. A click before the prefire completes joins that request and waits for its remaining time. A wrong prediction does not supply a result for another action.

Enabling prefetch can incur up to three additional paid provider calls per image (configurable with `AI_PREFETCH_LIMIT_PER_ITEM`). One speculative call per session can run at once. Turning OFF prevents new speculation; current requests finish and existing cache remains. Use **Fresh run** for clean comparisons. Provider errors appear rather than fake results.

## Measure OFF versus ON

This command makes real, potentially billable provider requests. Configure both keys first and run the backend:

```sh
node scripts/benchmark_ai.mjs --repetitions 2 --dwell-ms 1500 --trial-gap-ms 15000 --out work/ai-benchmark
```

It runs identical receipt extraction, unexpected receipt summary and whiteboard task journeys with fresh sessions/cache/model per trial, alternates paired order, and includes the same review interval in both modes. Ordinary caching stays enabled in both modes. It drains trailing provider work to count unused calls. Output: `results.json` and `summary.md`. Trials are separated by 15 seconds by default to reduce request bursts; this is not a guarantee against project quotas. The benchmark JSON includes model outputs from the synthetic samples for correctness review; the UI measurement export still omits OCR text. Use `--report-only --out work/ai-benchmark` to regenerate a report without API calls. Provider failures are retained per trial and the benchmark continues. A failed action ends that journey without automatic retries. Interrupted/infrastructure failures mark the run incomplete. Latency comparisons use only pairs with no provider failures in either mode; a separate reliability table includes every trial and failed-action waiting. Two repetitions are a sanity check, not statistically strong evidence; repeat as time and budget allow.

Report measured action waiting (including failed clicks), p95, extra provider calls, used/unused prefires and provider token usage. Background failures alone do not count as user waiting; failed clicks joining background work do. Completed-action counts remain successful completions. Do not describe synthetic journey probabilities as real-user accuracy. Do not infer dollar ROI from the initial scoring constants: pricing and the value of saved time must be measured separately. The UI can export a session's measurements too.

## Implementation and limits

- `backend/ai/providers.js`: provider HTTP adapters, timeout, structured Gemini output validation.
- `backend/ai/service.js`: per-session model, immutable images, OCR dependency, cache/in-flight sharing, budgets and measurements.
- `backend/ai/routes.js`: API routes. `frontend/src/services/ai.js`: frontend transport.
- `frontend/src/pages/AIWorkspace/`: separate screen and isolated styles.
- `scripts/benchmark_ai.mjs`: actual-provider benchmark; no artificial delay.

This is a local hackathon demo, not a production multi-user service. Session IDs are capabilities, not account authentication. Images and OCR live in backend memory with session expiry (one hour, lazily cleaned); results expire after five minutes. Restart clears them. Model and cache state are isolated from the customer dashboard. Reopening a completed action does not retrain the live AI model; a new image records DONE for the previous image. Failed actions are not trained as successful workflow steps. Measurement exports omit images, OCR text and session IDs; they include operation/model/usage/timing metadata. The app displays suggestions only: it does not submit expenses or create external tasks.

Automated tests use injected providers to verify correctness without spending API credits. They do not establish real provider access, model availability, OCR quality or a speedup. Those require the live checks above. With insufficient review time or contention, speculation may provide little benefit or slow requests; keep that result in the benchmark.
