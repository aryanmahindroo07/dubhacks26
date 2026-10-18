const express = require("express");
const cors = require("cors");
const { customers } = require("./data");
const { predictNext } = require("./prediction/engine");

const app = express();
app.use(cors());
app.use(express.json());

// ---- Latency config -------------------------------------------------------
// Default delay for every endpoint, plus per-endpoint overrides.
// Change these to make the prefetching demo more or less dramatic.
const DEFAULT_DELAY_MS = 1200;
const DELAYS = {
  customers: DEFAULT_DELAY_MS,
  customer: DEFAULT_DELAY_MS,
  orders: DEFAULT_DELAY_MS,
  support: DEFAULT_DELAY_MS,
  analytics: DEFAULT_DELAY_MS,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wraps a handler so it waits before responding
function withDelay(key, handler) {
  return async (req, res) => {
    await sleep(DELAYS[key] ?? DEFAULT_DELAY_MS);
    handler(req, res);
  };
}

// ---- Request logging (also the hook point for prediction later) -----------
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start} ms)`);
  });
  // Later: record the navigation event and trigger prefetching here.
  next();
});

// ---- Helpers --------------------------------------------------------------
function findCustomer(req, res) {
  const customer = customers.find((c) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ error: `Customer ${req.params.id} not found` });
    return null;
  }
  return customer;
}

// ---- Endpoints ------------------------------------------------------------
// Search returns summary fields only; detailed data stays on customer endpoints.
app.get("/api/search", withDelay("customers", (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  const results = customers
    .filter((customer) => !query || customer.name.toLowerCase().includes(query))
    .map(({ id, name, plan, mrr }) => ({ id, name, plan, mrr }));
  res.json({ results });
}));

app.get("/api/customers", withDelay("customers", (req, res) => {
  res.json(customers.map(({ id, name, plan, mrr }) => ({ id, name, plan, mrr })));
}));

app.get("/api/customers/:id", withDelay("customer", (req, res) => {
  const c = findCustomer(req, res);
  if (!c) return;
  const { id, name, plan, email, mrr } = c;
  res.json({ id, name, plan, email, mrr });
}));

app.get("/api/customers/:id/orders", withDelay("orders", (req, res) => {
  const c = findCustomer(req, res);
  if (!c) return;
  res.json({ customerId: c.id, orders: c.orders });
}));

app.get("/api/customers/:id/support", withDelay("support", (req, res) => {
  const c = findCustomer(req, res);
  if (!c) return;
  res.json({ customerId: c.id, tickets: c.tickets });
}));

app.get("/api/customers/:id/analytics", withDelay("analytics", (req, res) => {
  const c = findCustomer(req, res);
  if (!c) return;
  res.json({ customerId: c.id, ...c.analytics });
}));

// ---- Dev-only: view or change delays at runtime ---------------------------
// GET  /api/config/delays            -> current delays
// POST /api/config/delays {"orders": 300}  -> update one or more
app.get("/api/config/delays", (req, res) => res.json(DELAYS));
app.post("/api/config/delays", (req, res) => {
  for (const [key, value] of Object.entries(req.body || {})) {
    if (key in DELAYS && Number.isFinite(value) && value >= 0) DELAYS[key] = value;
  }
  res.json(DELAYS);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

// ---- Prediction endpoint --------------------------------------------------
app.post("/api/predict", (req, res) => {
  const history = req.body?.history;

  if (!Array.isArray(history) ||
      !history.every(state => typeof state === "string")) {
    return res.status(400).json({
      error: "history must be an array of state strings"
    });
  }

  const predictions = predictNext(history);

  res.json(predictions);
});
