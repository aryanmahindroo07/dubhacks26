// Imports (once)
const { MarkovPredictor } = require("./markov");
const { scorePredictions } = require("./scoring");
const { trainingJourneys } = require("./trainingData");

const CANDIDATES = ["ORDERS", "SUPPORT", "ANALYTICS"];

const model = new MarkovPredictor(CANDIDATES);
model.train(trainingJourneys);

// Existing function
function predictNext(history, config = {}) {
  const predictions = model.predict(history, CANDIDATES);
  return scorePredictions(predictions, config);
}

// NEW: Session histories
const sessions = new Map();

function recordTransition(sessionId, stateId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }

  const history = sessions.get(sessionId);
  history.push(stateId);

  model.recordTransition(history);
  return history;
}

function getHistory(sessionId) {
  return sessions.get(sessionId) || [];
}

// Export everything once
module.exports = {
  predictNext,
  recordTransition,
  getHistory
};