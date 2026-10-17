
const { trainingJourneys } = require("./trainingData");
const { MarkovPredictor } = require("./markov");
const { scorePredictions } = require("./scoring");

const model = new MarkovPredictor(
  ["ORDERS", "SUPPORT", "ANALYTICS"]
);

model.train(trainingJourneys);

const predictions = model.predict(
  ["CUSTOMERS", "CUSTOMER"],
  ["ORDERS", "SUPPORT", "ANALYTICS"]
);

console.table(scorePredictions(predictions));
