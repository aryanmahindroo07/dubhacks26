const test = require("node:test");
const assert = require("node:assert/strict");
const { MarkovPredictor } = require("./markov");
const { scorePredictions } = require("./scoring");
const { trainingJourneys } = require("./trainingData");

const CANDIDATES = ["ORDERS", "SUPPORT", "ANALYTICS"];

function prefetched(history) {
  const model = new MarkovPredictor(CANDIDATES);
  model.train(trainingJourneys);
  return scorePredictions(model.predict(history, CANDIDATES))
    .filter(p => p.shouldPrefetch)
    .map(p => p.endpoint);
}

test("prefetches only the clear favourite after opening a customer", () => {
  assert.deepEqual(prefetched(["CUSTOMERS", "CUSTOMER"]), ["ORDERS"]);
  assert.deepEqual(prefetched(["ANALYTICS", "CUSTOMER"]), ["SUPPORT"]);
});

test("does not prefetch when every candidate is an equal low guess", () => {
  // After Orders the usual next step is back to the profile, which is not a
  // prefetch candidate, so each candidate sits at ~17%.
  assert.deepEqual(prefetched(["CUSTOMERS", "CUSTOMER", "ORDERS"]), []);
  assert.deepEqual(prefetched(["CUSTOMERS"]), []);
});

test("threshold is configurable", () => {
  const preds = [{ endpoint: "ORDERS", probability: 0.2 }];
  assert.equal(scorePredictions(preds)[0].shouldPrefetch, false);
  assert.equal(scorePredictions(preds, { minProbability: 0.1 })[0].shouldPrefetch, true);
});
