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
cache/prefetch metrics. The original search and `/overview` remain separate;
the overview's pause control affects only its sample simulation.

Data is generated locally (customer IDs `"1"` through `"10"`), training journeys
are synthetic, and data routes default to 1,200 ms artificial delay. Waiting
saved is estimated against that fixed baseline, not a measured OFF/ON result.

Run regression checks from the repository root:

```sh
node --test frontend/src/services/prefetch.test.js frontend/src/pages/Overview/overviewData.test.js
npm run build --prefix frontend
```

Frontend API requests use the Vite `/api` proxy in development. For deployment,
provide a same-origin `/api` reverse proxy or set `VITE_API_BASE` for the workspace
service at build time; the existing search still requires a same-origin API.
