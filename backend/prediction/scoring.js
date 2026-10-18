
function scorePredictions(predictions, config = {}) {
  const {
    latencyMs = 1200,
    requestCost = 0.001,
    readinessProbability = 1,
    lambda = 100000,
    // Below this likelihood a prefetch is more likely wasted than used.
    // With these costs, expected value alone turns positive at ~8%, which
    // made near-uniform guesses (e.g. 17% each after Orders) prefetch.
    minProbability = 0.35
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
      shouldPrefetch: expectedValue > 0 && p >= minProbability
    };
  }).sort((a, b) => b.expectedValue - a.expectedValue);
}

module.exports = { scorePredictions };
