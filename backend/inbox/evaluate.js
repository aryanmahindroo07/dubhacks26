// Shows the inbox model works: train on one set of dummy journeys, test on a
// fresh set it has never seen, and compare prefetch strategies.
//
//   node backend/inbox/evaluate.js            prints a markdown report
//   node backend/inbox/evaluate.js --write    also saves docs/inbox-model-results.md
//
// Assumption: a prefetch that guesses right saves the action's whole latency,
// i.e. the user spends at least that long on the previous result. Results use
// the placeholder latencies in actions.js.

const fs = require("fs");
const path = require("path");
const { ACTIONS } = require("./actions");
const { generateJourneys, candidatesFor, untyped, typeOf } = require("./journeys");
const { createInboxModel, predictNextAction } = require("./engine");

// Each decision point: what the user had done, and what they did next.
function decisionPoints(journeys) {
  const points = [];
  for (const journey of journeys) {
    const type = typeOf(journey[0]);
    const steps = journey.slice(1).map(untyped);
    for (let i = 0; i < steps.length; i++) {
      points.push({ type, history: steps.slice(0, i), next: steps.at(i) });
    }
  }
  return points;
}

function evaluate({ trainCount = 500, testCount = 200, trainSeed = 42, testSeed = 7 } = {}) {
  const model = createInboxModel(generateJourneys(trainCount, trainSeed));
  const points = decisionPoints(generateJourneys(testCount, testSeed));
  const actionsRun = points.filter((p) => p.next !== "DONE");
  const totalWaitMs = actionsRun.reduce((sum, p) => sum + ACTIONS[p.next].latencyMs, 0);

  // Most common action overall in training, ignoring context.
  const counts = {};
  for (const p of decisionPoints(generateJourneys(trainCount, trainSeed))) {
    if (p.next !== "DONE") counts[p.next] = (counts[p.next] || 0) + 1;
  }
  const globalTop = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const strategies = {
    "No prefetch": () => [],
    "Always prefetch the most common action": () => [globalTop],
    "Prefetch every possible action": (p) => candidatesFor(p.type).map(untyped),
    "RequestFlow (Markov + 35% threshold)": (p) =>
      predictNextAction(p.type, p.history, {}, model)
        .filter((x) => x.shouldPrefetch)
        .slice(0, 1)
        .map((x) => x.action),
  };

  let correct = 0;
  for (const p of actionsRun) {
    const [top] = predictNextAction(p.type, p.history, {}, model);
    if (top && top.action === p.next) correct++;
  }

  const rows = Object.entries(strategies).map(([name, choose]) => {
    let hits = 0, wasted = 0, savedMs = 0, wastedMs = 0, calls = 0;
    for (const p of points) {
      for (const action of choose(p)) {
        calls++;
        if (action === p.next) {
          hits++;
          savedMs += ACTIONS[action].latencyMs;
        } else {
          wasted++;
          wastedMs += ACTIONS[action].latencyMs;
        }
      }
    }
    return { name, calls, hits, wasted, savedMs, wastedMs, savedShare: savedMs / totalWaitMs };
  });

  return {
    trainCount, testCount,
    decisionPoints: points.length,
    actionsRun: actionsRun.length,
    totalWaitMs,
    top1Accuracy: correct / actionsRun.length,
    globalTop,
    rows,
  };
}

function report(r) {
  const s = (ms) => `${(ms / 1000).toFixed(1)} s`;
  const lines = [
    "# Inbox model results (dummy data)",
    "",
    `Trained on ${r.trainCount} synthetic journeys, tested on ${r.testCount} new ones (${r.actionsRun} AI actions, ${s(r.totalWaitMs)} of AI waiting without prefetch).`,
    "",
    `Next-action accuracy: the model's top guess was right ${(r.top1Accuracy * 100).toFixed(0)}% of the time.`,
    "",
    "| Strategy | Prefetch calls | Used | Wasted | AI waiting saved | Wasted AI time |",
    "|---|---:|---:|---:|---:|---:|",
    ...r.rows.map((row) =>
      `| ${row.name} | ${row.calls} | ${row.hits} | ${row.wasted} | ${s(row.savedMs)} (${(row.savedShare * 100).toFixed(0)}%) | ${s(row.wastedMs)} |`),
    "",
    "Synthetic journeys from designed probabilities (backend/inbox/journeys.js) and placeholder latencies (backend/inbox/actions.js). Assumes a correct prefetch saves the action's full latency.",
  ];
  return lines.join("\n");
}

if (require.main === module) {
  const text = report(evaluate());
  console.log(text);
  if (process.argv.includes("--write")) {
    const out = path.join(__dirname, "..", "..", "docs", "inbox-model-results.md");
    fs.writeFileSync(out, text + "\n");
    console.log(`\nSaved ${path.relative(process.cwd(), out)}`);
  }
}

module.exports = { evaluate, report, decisionPoints };
