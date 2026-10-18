// Prediction engine for the AI inbox, built on the existing Markov model and
// scoring. Predicts which AI action a user will run next on an item and
// whether it is worth running early.

const { MarkovPredictor } = require("../prediction/markov");
const { scorePredictions } = require("../prediction/scoring");
const { ACTIONS } = require("./actions");
const { generateJourneys, candidatesFor, typed, untyped, typeOf } = require("./journeys");

const TRAINING_JOURNEYS = 500;
const TRAINING_SEED = 42;

function createInboxModel(journeys = generateJourneys(TRAINING_JOURNEYS, TRAINING_SEED)) {
  const all = [...new Set(journeys.flat())];
  const model = new MarkovPredictor(all);
  model.train(journeys);
  return model;
}

let model = createInboxModel();

// Rebuild the model from scratch (tests, or a fresh demo).
function resetInboxModel(journeys) {
  model = createInboxModel(journeys);
  sessions.clear();
}

// history for the model: typed states, starting with TYPE:OPEN
function toHistory(type, actions) {
  return [typed(type, "OPEN"), ...actions.map((action) => typed(type, action))];
}

// Score each candidate with that action's own latency: a slow action is worth
// prefetching at a lower likelihood than a fast one. Actions already run on
// this item are skipped: their results are on screen already.
function predictNextAction(type, actions, config = {}, predictor = model) {
  const candidates = candidatesFor(type).filter((state) => !actions.includes(untyped(state)));
  const predictions = predictor.predict(toHistory(type, actions), candidates);
  return predictions
    .map((prediction) => {
      const action = untyped(prediction.endpoint);
      const [scored] = scorePredictions([prediction], { ...config, latencyMs: ACTIONS[action].latencyMs });
      return { ...scored, action, label: ACTIONS[action].label, model: ACTIONS[action].model, latencyMs: ACTIONS[action].latencyMs };
    })
    .sort((a, b) => b.expectedValue - a.expectedValue);
}

// Live learning: record what a user actually did, per session and item.
// sessionId -> { itemId, history } for the item the user is working on.
const sessions = new Map();

// Moving to another item means the user stopped working on the current one:
// record DONE so the model learns how often people stop, not only how often
// they carry on.
function focusItem(sessionId, itemId, type) {
  const current = sessions.get(sessionId);
  if (current && current.itemId === itemId) return current.history;
  if (current) {
    current.history.push(typed(typeOf(current.history[0]), "DONE"));
    model.recordTransition(current.history);
  }
  const history = [typed(type, "OPEN")];
  sessions.set(sessionId, { itemId, history });
  return history;
}

// The user opened an item (no action yet).
function openItem(sessionId, itemId, type) {
  return focusItem(sessionId, itemId, type).slice(1).map(untyped);
}

function recordAction(sessionId, itemId, type, action) {
  const history = focusItem(sessionId, itemId, type);
  // Running an action again just shows the earlier result; nothing to learn.
  if (!history.includes(typed(type, action))) {
    history.push(typed(type, action));
    model.recordTransition(history);
  }
  return history.slice(1).map(untyped);
}

function getModel() {
  return model;
}

module.exports = {
  createInboxModel,
  resetInboxModel,
  predictNextAction,
  openItem,
  recordAction,
  getModel,
  toHistory,
  TRAINING_JOURNEYS,
  TRAINING_SEED,
};
