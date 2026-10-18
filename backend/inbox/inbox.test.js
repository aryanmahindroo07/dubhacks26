const test = require("node:test");
const assert = require("node:assert/strict");
const { ACTIONS, ITEM_TYPES } = require("./actions");
const { items } = require("./items");
const { TRANSITIONS, TYPE_MIX, generateJourneys } = require("./journeys");
const { predictNextAction, openItem, recordAction, resetInboxModel } = require("./engine");
const { evaluate } = require("./evaluate");

test("every probability table sums to 1 and names real actions", () => {
  assert.ok(Math.abs(Object.values(TYPE_MIX).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  for (const [type, rows] of Object.entries(TRANSITIONS)) {
    assert.ok(ITEM_TYPES[type], `${type} is a known item type`);
    for (const [step, next] of Object.entries(rows)) {
      const sum = Object.values(next).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${type}.${step} sums to ${sum}`);
      for (const action of Object.keys(next)) assert.ok(action === "DONE" || ACTIONS[action], action);
    }
  }
});

test("dummy items use known types and actions", () => {
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  for (const item of items) {
    assert.ok(ITEM_TYPES[item.type]);
    for (const action of Object.keys(item.outputs)) assert.ok(ACTIONS[action], `${item.id}: ${action}`);
  }
});

test("journeys are deterministic for a seed", () => {
  assert.deepEqual(generateJourneys(20, 5), generateJourneys(20, 5));
  assert.notDeepEqual(generateJourneys(20, 5), generateJourneys(20, 6));
});

test("model learns different habits per item type", () => {
  const top = (type, history) => predictNextAction(type, history)[0];
  assert.equal(top("RECEIPT", ["READ_TEXT"]).action, "EXTRACT_FIELDS");
  assert.equal(top("WHITEBOARD", ["READ_TEXT"]).action, "MAKE_TASKS");
  assert.equal(top("PRODUCT_PHOTO", []).action, "CAPTION");
  assert.ok(top("RECEIPT", ["READ_TEXT"]).shouldPrefetch);
  // Most people stop after extracting a receipt's fields: nothing worth prefetching.
  assert.equal(predictNextAction("RECEIPT", ["READ_TEXT", "EXTRACT_FIELDS"]).some((p) => p.shouldPrefetch), false);
  // But after a form's fields, the reply draft is likely.
  assert.equal(top("FORM", ["READ_TEXT", "EXTRACT_FIELDS"]).action, "DRAFT_REPLY");
});

test("live learning records actions per session and item", () => {
  resetInboxModel();
  assert.deepEqual(recordAction("s1", "r1", "RECEIPT", "READ_TEXT"), ["READ_TEXT"]);
  assert.deepEqual(recordAction("s1", "r1", "RECEIPT", "EXTRACT_FIELDS"), ["READ_TEXT", "EXTRACT_FIELDS"]);
  // Re-running an action is not a new step
  assert.deepEqual(recordAction("s1", "r1", "RECEIPT", "READ_TEXT"), ["READ_TEXT", "EXTRACT_FIELDS"]);
  assert.deepEqual(openItem("s1", "r1", "RECEIPT"), ["READ_TEXT", "EXTRACT_FIELDS"]);
  assert.deepEqual(recordAction("s1", "w1", "WHITEBOARD", "READ_TEXT"), ["READ_TEXT"]);
  resetInboxModel();
});

test("live learning also learns when people stop", () => {
  resetInboxModel();
  const extract = () => predictNextAction("RECEIPT", ["READ_TEXT"]).find((p) => p.action === "EXTRACT_FIELDS").probability;
  const before = extract();
  // 30 users read a receipt's text, then move on to another item.
  for (let i = 0; i < 30; i++) {
    recordAction(`u${i}`, "r1", "RECEIPT", "READ_TEXT");
    openItem(`u${i}`, "w1", "WHITEBOARD");
  }
  assert.ok(extract() < before - 0.05, `${before} -> ${extract()}`);
  resetInboxModel();
});

test("never predicts an action already run on the item", () => {
  const history = ["CAPTION", "FIND_OBJECTS"];
  const actions = predictNextAction("PRODUCT_PHOTO", history).map((p) => p.action);
  assert.ok(actions.length > 0);
  for (const action of history) assert.ok(!actions.includes(action), action);
  for (const journey of generateJourneys(500)) {
    const steps = journey.slice(1, -1);
    assert.equal(new Set(steps).size, steps.length, journey.join(" > "));
  }
});

test("on unseen journeys the model beats simple prefetch strategies", () => {
  const r = evaluate();
  const byName = Object.fromEntries(r.rows.map((row) => [row.name, row]));
  const ours = byName["Mise (Markov + 35% threshold)"];
  assert.ok(r.top1Accuracy > 0.7, `accuracy ${r.top1Accuracy}`);
  assert.ok(ours.savedShare > 0.6, `saved ${ours.savedShare}`);
  assert.ok(ours.savedMs > byName["Always prefetch the most common action"].savedMs);
  assert.ok(ours.wastedMs < byName["Prefetch every possible action"].wastedMs / 5);
});
