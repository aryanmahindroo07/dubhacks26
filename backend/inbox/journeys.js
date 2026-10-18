// Synthetic user journeys for the AI inbox.
//
// These probabilities are DESIGNED, not measured: they describe plausible
// habits per item type (after reading a receipt people usually extract its
// fields; after reading a whiteboard they usually turn it into tasks). The
// generator samples journeys from them so the Markov model has something to
// learn. Replace with real click logs once the app has users.
//
// A journey for the model is a list of typed states:
//   ["RECEIPT:OPEN", "RECEIPT:READ_TEXT", "RECEIPT:EXTRACT_FIELDS"]
// Typing each state with the item type lets one model learn different habits
// per type. "DONE" ends a journey and is never prefetched.

const TRANSITIONS = {
  RECEIPT: {
    OPEN: { READ_TEXT: 0.8, EXTRACT_FIELDS: 0.15, SUMMARIZE: 0.05 },
    READ_TEXT: { EXTRACT_FIELDS: 0.75, SUMMARIZE: 0.1, DONE: 0.15 },
    EXTRACT_FIELDS: { DONE: 0.7, DRAFT_REPLY: 0.2, SUMMARIZE: 0.1 },
    SUMMARIZE: { DONE: 0.8, EXTRACT_FIELDS: 0.2 },
    DRAFT_REPLY: { DONE: 1 },
  },
  WHITEBOARD: {
    OPEN: { READ_TEXT: 0.7, CAPTION: 0.2, SUMMARIZE: 0.1 },
    READ_TEXT: { MAKE_TASKS: 0.6, SUMMARIZE: 0.3, DONE: 0.1 },
    CAPTION: { READ_TEXT: 0.6, SUMMARIZE: 0.3, DONE: 0.1 },
    SUMMARIZE: { MAKE_TASKS: 0.5, DRAFT_REPLY: 0.3, DONE: 0.2 },
    MAKE_TASKS: { DRAFT_REPLY: 0.5, DONE: 0.5 },
    DRAFT_REPLY: { DONE: 1 },
  },
  PRODUCT_PHOTO: {
    OPEN: { CAPTION: 0.6, FIND_OBJECTS: 0.35, READ_TEXT: 0.05 },
    CAPTION: { DRAFT_REPLY: 0.55, FIND_OBJECTS: 0.2, DONE: 0.25 },
    FIND_OBJECTS: { CAPTION: 0.6, DONE: 0.4 },
    READ_TEXT: { CAPTION: 0.7, DONE: 0.3 },
    DRAFT_REPLY: { DONE: 1 },
  },
  FORM: {
    OPEN: { READ_TEXT: 0.85, EXTRACT_FIELDS: 0.15 },
    READ_TEXT: { EXTRACT_FIELDS: 0.85, SUMMARIZE: 0.05, DONE: 0.1 },
    EXTRACT_FIELDS: { DRAFT_REPLY: 0.55, DONE: 0.45 },
    SUMMARIZE: { EXTRACT_FIELDS: 0.6, DONE: 0.4 },
    DRAFT_REPLY: { DONE: 1 },
  },
};

// How often each item type shows up in an inbox.
const TYPE_MIX = { RECEIPT: 0.35, WHITEBOARD: 0.2, PRODUCT_PHOTO: 0.25, FORM: 0.2 };

const MAX_ACTIONS = 6;

const typed = (type, step) => `${type}:${step}`;
const untyped = (state) => state.slice(state.indexOf(":") + 1);
const typeOf = (state) => state.slice(0, state.indexOf(":"));

// Deterministic random numbers so every teammate gets the same data.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pick(weights, rand) {
  let r = rand();
  for (const [key, weight] of Object.entries(weights)) {
    r -= weight;
    if (r < 0) return key;
  }
  return Object.keys(weights).at(-1);
}

// One journey: open an item, run actions, and end with DONE. DONE is kept so
// the model learns how often people stop (it is never a prefetch candidate).
function generateJourney(rand, type = pick(TYPE_MIX, rand)) {
  const journey = [typed(type, "OPEN")];
  let step = "OPEN";
  for (let i = 0; i < MAX_ACTIONS; i++) {
    const next = pick(TRANSITIONS[type][step], rand);
    if (next === "DONE") break;
    journey.push(typed(type, next));
    step = next;
  }
  journey.push(typed(type, "DONE"));
  return journey;
}

function generateJourneys(count, seed = 42) {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => generateJourney(rand));
}

// The actions that can follow on an item of this type (prefetch candidates).
function candidatesFor(type) {
  const steps = new Set();
  for (const next of Object.values(TRANSITIONS[type])) {
    for (const step of Object.keys(next)) if (step !== "DONE") steps.add(step);
  }
  return [...steps].map((step) => typed(type, step));
}

module.exports = {
  TRANSITIONS,
  TYPE_MIX,
  typed,
  untyped,
  typeOf,
  seededRandom,
  generateJourney,
  generateJourneys,
  candidatesFor,
};
