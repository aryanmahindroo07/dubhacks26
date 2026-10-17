
function scorePredictions(predictions, config = {}) {
  const {
    latencyMs = 1200,
    requestCost = 0.001,
    readinessProbability = 1,
    lambda = 100000
  } = config;

  return predictions.map(pred => {
    const p = pred.probability;

    const expectedBenefit =
      p * readinessProbability * latencyMs;

    const expectedExtraCost =
      (1 - p) * requestCost;

    const expectedValue =
      expectedBenefit - lambda * expectedExtraCost;

    return {
      ...pred,
      expectedBenefit,
      expectedExtraCost,
      expectedValue,
      shouldPrefetch: expectedValue > 0
    };
  }).sort((a, b) => b.expectedValue - a.expectedValue);
}

module.exports = { scorePredictions };
