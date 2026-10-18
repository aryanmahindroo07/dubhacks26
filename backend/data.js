// Mock data for the SaaS customer dashboard.
// Generated deterministically so every teammate sees the same data.

const NAMES = [
  "Acme Corp", "Globex", "Initech", "Umbrella Labs", "Stark Industries",
  "Wayne Enterprises", "Hooli", "Pied Piper", "Vandelay Imports", "Soylent Co",
];
const PRODUCTS = ["Seats", "Storage add-on", "API credits", "Premium support", "SSO module"];
const TICKET_SUBJECTS = [
  "Login issues", "Billing question", "Export failing", "Feature request",
  "Slow dashboard", "Webhook not firing",
];
const STATUSES = ["open", "pending", "resolved"];

// Simple seeded random so data is stable across restarts
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Plan follows revenue and churn risk follows health, so records stay consistent.
const planFor = (mrr) => (mrr < 2000 ? "Starter" : mrr < 6000 ? "Pro" : "Enterprise");
const churnFor = (health) => (health >= 75 ? "low" : health >= 55 ? "medium" : "high");

const customers = NAMES.map((name, i) => {
  const id = String(i + 1);
  const rand = seeded(i + 1);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // Orders fall between Jan and Sep 2026 (all in the past), newest first.
  // Dates are built as strings to avoid time-zone shifts from toISOString().
  const orders = Array.from({ length: 3 + Math.floor(rand() * 5) }, () => ({
    product: pick(PRODUCTS),
    amount: Math.round(100 + rand() * 4900),
    date: `2026-${String(1 + Math.floor(rand() * 9)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`,
  }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((order, j) => ({ id: `ord_${id}_${j + 1}`, ...order }));

  const tickets = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, j) => ({
    id: `tkt_${id}_${j + 1}`,
    subject: pick(TICKET_SUBJECTS),
    status: pick(STATUSES),
    priority: pick(["low", "medium", "high"]),
  }));

  const monthlyUsage = Array.from({ length: 6 }, (_, m) => ({
    month: `2026-${String(m + 5).padStart(2, "0")}`,
    activeUsers: Math.round(20 + rand() * 480),
    apiCalls: Math.round(1000 + rand() * 99000),
  }));

  const mrr = Math.round(200 + rand() * 9800);
  const healthScore = Math.round(40 + rand() * 60);

  return {
    id,
    name,
    plan: planFor(mrr),
    email: `admin@${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
    mrr,
    orders,
    tickets,
    analytics: {
      monthlyUsage,
      healthScore,
      churnRisk: churnFor(healthScore),
    },
  };
});

module.exports = { customers };
