
class MarkovPredictor {
  constructor(states, alpha = 1, minObservations = 3) {
    this.states = states;
    this.alpha = alpha;
    this.minObservations = minObservations;
    this.first = new Map();
    this.second = new Map();
  }

  addCount(map, key, next) {
    if (!map.has(key)) map.set(key, new Map());
    const counts = map.get(key);
    counts.set(next, (counts.get(next) || 0) + 1);
  }

  train(journeys) {
    this.first.clear();
    this.second.clear();

    for (const journey of journeys) {
      for (let i = 1; i < journey.length; i++) {
        this.addCount(this.first, journey[i - 1], journey[i]);

        if (i >= 2) {
          const key = JSON.stringify([
            journey[i - 2],
            journey[i - 1]
          ]);
          this.addCount(this.second, key, journey[i]);
        }
      }
    }
  }

  recordTransition(history) {
  const n = history.length;
  if (n < 2) return;

  const current = history[n - 1];
  const previous = history[n - 2];

  // Update first-order transition
  this.addCount(this.first, previous, current);

  // Update second-order transition
  if (n >= 3) {
    const previousPrevious = history[n - 3];

    this.addCount(
      this.second,
      JSON.stringify([previousPrevious, previous]),
      current
    );
  }
  }

  predict(history, candidates = this.states) {
    const current = history.at(-1);
    const previous = history.at(-2);
    const key = JSON.stringify([previous, current]);

    const secondCounts = this.second.get(key);
    const firstCounts = this.first.get(current);

    const total = (counts) =>
      [...(counts?.values() || [])].reduce((a, b) => a + b, 0);

    let counts = secondCounts;
    let order = 2;

    if (total(counts) < this.minObservations) {
      counts = firstCounts;
      order = 1;
    }

    if (!counts || total(counts) === 0) return [];

    const eligible = [...new Set(candidates)];
    const denominator = total(counts) +
      this.alpha * eligible.length;

    return eligible.map(endpoint => ({
      endpoint,
      probability:
        ((counts.get(endpoint) || 0) + this.alpha) /
        denominator,
      contextOrder: order,
      observations: total(counts)
    })).sort((a, b) => b.probability - a.probability);
  }
}

module.exports = { MarkovPredictor };
