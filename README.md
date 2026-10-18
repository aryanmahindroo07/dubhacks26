# dubhacks26
Hackathon project for DubHacks '26

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
