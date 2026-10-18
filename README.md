# Mise

**AI that’s ready before you ask.**

Mise takes its name from *mise en place*, a culinary term meaning **“everything in its place.”** Just as a chef prepares ingredients before cooking, Mise predicts your next step and prepares likely API or AI results while you review the current one. The response can be ready before you click.

Built for DubHacks '26.

## What this project does

Mise predicts which registered API action a user is likely to request next and starts an eligible read-only request while the user reviews the current result. First- and second-order Markov models estimate next-action probabilities; a confidence and expected-value policy decides whether to speculate. A matching click reuses the completed response or joins the running request. Incorrect predictions can consume extra provider calls, so waiting, reuse, failures and unused prefires are measured alongside benefits.

The core machine-learning task is **sequential categorical next-action prediction**. Its outputs are action probabilities and a prefetch decision. Latency is an evaluation metric, not a continuous target learned by a regression model.

Two applications demonstrate the same scheduler:

- **Customer workspace:** customer, orders, support and analytics API navigation. Customer records and initial training journeys are synthetic, and the customer API uses a disclosed artificial delay.
- **Visual AI workspace:** Perceptron transcribes an image; Gemini transforms the OCR text into fields, summaries or tasks. These are OCR and generative structured-extraction tasks. Provider-backed runs use actual model responses and latency; public real-receipt evaluations are documented separately from synthetic examples.

## Intended use and scope

This is a local hackathon prototype for reducing waiting in API and AI workflows. Its automatic decision selects which read-only request to run early. It does not make lending, creditworthiness, employment, healthcare, benefits or other eligibility decisions; execute payments or physical actions; or automatically approve extracted receipt data. It is not a robotics system or a project that trains an image-classification/object-detection model.

AI output remains subject to human review. Receipt evidence checks establish consistency with OCR text, not guaranteed correctness against the image. Seeded app journeys are synthetic; the separate held-out human-navigation evaluation uses Wikispeedia and does not establish prediction accuracy for actual users of this app. The implementation uses React/Vite with an Express backend; frontend service modules are client API wrappers, not Next.js routes.

See the [real-data evaluation protocol](docs/real-data-evaluation.md), [receipt correctness checks](docs/receipt-correctness.md), and [AI setup guide](docs/ai-inbox-setup.md) for evidence and limitations. These descriptions document intended behavior; they are not a compliance certification or a determination of legal applicability.

See the [audit scope and evidence map](docs/audit-scope.md) for the decision boundary, existing safeguards, and limitations relevant to repository audits.

## Frontend starter

The barebones React + CSS starter lives in [`frontend/`](frontend/).

With Node.js 24 LTS installed:

```sh
cd frontend
npm install
npm run dev
```

Open the URL printed in the terminal, then edit `frontend/src/App.jsx` to start building.

Read the [frontend guide](frontend/README.md) for the folder structure and available commands.

## Backend API

```
cd backend
npm install
npm start
```

Runs on http://localhost:4000. Endpoints:
`/api/customers`, `/api/customers/:id`, `/api/customers/:id/orders`,
`/api/customers/:id/support`, `/api/customers/:id/analytics`

## Customer prefetch demo

On `/`, use **Load customers** in the customer workspace, open a customer,
wait for **Prefetch completed** to increase, then open **Orders**. Profile,
Orders, Support, and Analytics use `requestEndpoint`; the workspace shows live
cache/prefetch metrics. `/overview` is the live overview: its metrics, wait
chart and request log come from the same prefetch service, and **Pause
prefetch** switches the real service off (no prediction calls, no speculative
requests) until resumed. The customer search on `/` is separate.

Data is generated locally (customer IDs `"1"` through `"10"`), training journeys
are synthetic, and data routes default to 1,200 ms artificial delay. Waiting
saved on the workspace card is estimated against that fixed baseline; measured
OFF/ON results come from `scripts/benchmark_prefetch.py` (see
[docs/benchmark-results.md](docs/benchmark-results.md)).

Run regression checks from the repository root:

```sh
node --test frontend/src/services/prefetch.test.js frontend/src/pages/Overview/overviewData.test.js backend/prediction/policy.test.js
npm run build --prefix frontend
```

Browser check (needs both servers running and Playwright installed):
`python scripts/verify_prefetch.py`. It opens a customer, waits for the
prefetch, opens Orders and expects a cache hit; repeats with an immediate
click and expects the running prefetch to be reused; and fails on any
duplicate data request.

Prefetch policy: the backend only marks a prediction for prefetch when its
likelihood is at least 35% (`minProbability` in
`backend/prediction/scoring.js`), so near-uniform guesses don't cost requests.
The workspace reports cache hits, reused running requests and misses
separately; "served without a new request" counts both hits and reuse.

Frontend API requests use the Vite `/api` proxy in development. For deployment,
provide a same-origin `/api` reverse proxy or set `VITE_API_BASE` for the workspace
service at build time; the existing search still requires a same-origin API.

OFF/ON benchmark (fresh backend, both servers running, Playwright installed):
`python scripts/benchmark_prefetch.py --think-ms 1500 --out results`. It runs
the same 10 customer journeys with prefetch paused, then on, and reports
waiting time, useful and unused prefetches, and extra API calls.

## AI inbox (dummy data)

The next version of Mise predicts which AI action a user will run next
on an inbox item (read text, extract fields, turn into tasks, caption…) and
runs it early. Everything lives in `backend/inbox/`:

- `actions.js` – the Perceptron and Gemini actions, with placeholder latencies
- `items.js` – 12 dummy items (receipts, whiteboards, product photos, forms)
  with mock results; all names and emails are invented
- `journeys.js` – designed per-type habits and a seeded journey generator
- `engine.js` – the existing Markov model and scoring, trained on 500 journeys
- `routes.js` – `GET /api/inbox`, `GET /api/inbox/:id/actions/:action`
  (simulated delay; `INBOX_DELAY_SCALE=0.1` speeds it up),
  `POST /api/inbox/predict` with `{ sessionId, itemId, action? }`

`npm run inbox:eval` (in `backend/`) tests the model on unseen journeys; results
are in [docs/inbox-model-results.md](docs/inbox-model-results.md).


## Live Gemini + Perceptron AI inbox

The separate `/ai` workspace supports image OCR through Perceptron and text transformations through Gemini, with optional Markov-driven speculative calls. It requires backend API keys and has no simulated AI fallback. See [setup, demo and actual-provider benchmarks](docs/ai-inbox-setup.md) before enabling potentially billable prefetches. Existing customer and overview screens remain available.

## Real-data validation

See [the evaluation protocol](docs/real-data-evaluation.md) for real CORD receipt inputs, real provider timings and a separate held-out human-navigation evaluation. These experiments are separate from synthetic dashboard data and are not a claim of real-user AI-workflow accuracy. [Dataset attribution and upload instructions](datasets/README.md).

## Receipt inbox features

Per-user habit learning, consent-gated read-ahead of the next receipt, duplicate flags and receipt-check fixes: see [docs/receipt-inbox.md](docs/receipt-inbox.md).

### Demo evidence

See [the real-input demo and measurement protocol](docs/demo-evidence.md) for public receipt inputs, visible prefire progress, matched OFF/ON measurements, and a controlled personal-learning demonstration.
