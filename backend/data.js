// Mock data for the SaaS customer dashboard.
// Generated deterministically so every teammate sees the same data.

const NAMES = [
  "Acme Corp", "Globex", "Initech", "Umbrella Labs", "Stark Industries",
  "Wayne Enterprises", "Hooli", "Pied Piper", "Vandelay Imports", "Soylent Co",
];
const PLANS = ["Starter", "Pro", "Enterprise"];
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

const customers = NAMES.map((name, i) => {
  const id = String(i + 1);
  const rand = seeded(i + 1);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const orders = Array.from({ length: 3 + Math.floor(rand() * 5) }, (_, j) => ({
    id: `ord_${id}_${j + 1}`,
    product: pick(PRODUCTS),
    amount: Math.round(100 + rand() * 4900),
    date: new Date(2026, Math.floor(rand() * 10), 1 + Math.floor(rand() * 27)).toISOString().slice(0, 10),
  }));

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

  return {
    id,
    name,
    plan: pick(PLANS),
    email: `admin@${name.toLowerCase().replace(/[^a-z]/g, "")}.com`,
    mrr: Math.round(200 + rand() * 9800),
    orders,
    tickets,
    analytics: {
      monthlyUsage,
      healthScore: Math.round(40 + rand() * 60),
      churnRisk: pick(["low", "medium", "high"]),
    },
  };
});

module.exports = { customers };
