// Prediction engine for the AI inbox, built on the existing Markov model and
// scoring. Predicts which AI action a user will run next on an item and
// whether it is worth running early.

const { MarkovPredictor } = require("../prediction/markov");
const { scorePredictions } = require("../prediction/scoring");
const { ACTIONS } = require("./actions");
const { generateJourneys, candidatesFor, typed, untyped } = require("./journeys");

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
// prefetching at a lower likelihood than a fast one.
function predictNextAction(type, actions, config = {}, predictor = model) {
  const predictions = predictor.predict(toHistory(type, actions), candidatesFor(type));
  return predictions
    .map((prediction) => {
      const action = untyped(prediction.endpoint);
      const [scored] = scorePredictions([prediction], { ...config, latencyMs: ACTIONS[action].latencyMs });
      return { ...scored, action, label: ACTIONS[action].label, model: ACTIONS[action].model, latencyMs: ACTIONS[action].latencyMs };
    })
    .sort((a, b) => b.expectedValue - a.expectedValue);
}

// Live learning: record what a user actually did, per session and item.
const sessions = new Map();

function recordAction(sessionId, itemId, type, action) {
  const key = `${sessionId}:${itemId}`;
  if (!sessions.has(key)) sessions.set(key, [typed(type, "OPEN")]);
  const history = sessions.get(key);
  history.push(typed(type, action));
  model.recordTransition(history);
  return history.slice(1).map(untyped);
}

function getModel() {
  return model;
}

module.exports = {
  createInboxModel,
  resetInboxModel,
  predictNextAction,
  recordAction,
  getModel,
  toHistory,
  TRAINING_JOURNEYS,
  TRAINING_SEED,
};
