
const { MarkovPredictor } = require("./markov");
const { scorePredictions } = require("./scoring");
const { trainingJourneys } = require("./trainingData");

// Possible next actions from a customer profile
const CANDIDATES = ["ORDERS", "SUPPORT", "ANALYTICS"];

// Initialize and train the model
const model = new MarkovPredictor(CANDIDATES);
model.train(trainingJourneys);

/**
 * Predict upcoming API requests and rank by expected value.
 *
 * @param {string[]} history - User's navigation history
 * @param {object} config - Latency and cost assumptions
 * @returns {Array} Ranked predictions
 */
function predictNext(history, config = {}) {
  const predictions = model.predict(history, CANDIDATES);

  return scorePredictions(predictions, config);
}

module.exports = {
  predictNext
};
