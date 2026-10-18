// /api/inbox routes: list items, run an AI action (simulated delay), predict.

const { ACTIONS, ITEM_TYPES } = require("./actions");
const { items, getItem, getActionResult } = require("./items");
const { predictNextAction, recordAction } = require("./engine");

// Scale the simulated AI latency for quick local testing (e.g. 0.1).
const DELAY_SCALE = Number(process.env.INBOX_DELAY_SCALE ?? 1);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const summary = (item) => ({
  id: item.id,
  type: item.type,
  typeLabel: ITEM_TYPES[item.type],
  title: item.title,
  imageHint: item.imageHint,
});

function registerInboxRoutes(app) {
  app.get("/api/inbox", (req, res) => {
    res.json(items.map(summary));
  });

  app.get("/api/inbox/actions", (req, res) => {
    res.json(ACTIONS);
  });

  app.get("/api/inbox/:id", (req, res) => {
    const item = getItem(req.params.id);
    if (!item) return res.status(404).json({ error: `Item ${req.params.id} not found` });
    res.json({ ...summary(item), actions: Object.keys(ACTIONS) });
  });

  // One AI action on one item. Mock result after the action's simulated delay.
  app.get("/api/inbox/:id/actions/:action", async (req, res) => {
    const item = getItem(req.params.id);
    const action = ACTIONS[req.params.action];
    if (!item) return res.status(404).json({ error: `Item ${req.params.id} not found` });
    if (!action) return res.status(404).json({ error: `Unknown action ${req.params.action}` });
    await sleep(action.latencyMs * DELAY_SCALE);
    res.json({
      itemId: item.id,
      action: req.params.action,
      label: action.label,
      model: action.model,
      simulated: true,
      result: getActionResult(item, req.params.action),
    });
  });

  // Body: { sessionId, itemId, action? }. With `action`, records it first
  // (live learning); without, predicts the first action on a newly opened item.
  app.post("/api/inbox/predict", (req, res) => {
    const { sessionId, itemId, action } = req.body || {};
    const item = getItem(itemId);
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    if (!item) return res.status(400).json({ error: "itemId must be a known item" });
    if (action != null && !ACTIONS[action]) {
      return res.status(400).json({ error: `Unknown action ${action}` });
    }
    const history = action != null ? recordAction(sessionId, item.id, item.type, action) : [];
    res.json({ itemId: item.id, type: item.type, history, predictions: predictNextAction(item.type, history) });
  });
}

module.exports = { registerInboxRoutes };
