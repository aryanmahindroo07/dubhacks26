import assert from "node:assert/strict";
import test from "node:test";
import {
  createDemoRequests,
  filterRequests,
  sampleRequests,
} from "./overviewData.js";

test("request search matches paths and descriptions without case sensitivity", () => {
  assert.equal(filterRequests(sampleRequests, "  LINEN  ", "all").length, 2);
  assert.equal(
    filterRequests(sampleRequests, "product catalog", "all")[0].id,
    "search",
  );
  assert.equal(
    filterRequests(sampleRequests, "  ", "all").length,
    sampleRequests.length,
  );
});

test("app and search filters work together and support an empty result", () => {
  assert.equal(
    filterRequests(sampleRequests, "", "Atlas Projects")[0].id,
    "project",
  );
  assert.equal(
    filterRequests(sampleRequests, "linen", "Atlas Projects").length,
    0,
  );
  assert.equal(
    filterRequests(sampleRequests, "/api/collections", "Northstar Storefront")
      .length,
    1,
  );
});

test("an enabled demo journey adds a received search and a predicted next request", () => {
  const requests = createDemoRequests(1, false, "11:00:00");
  assert.deepEqual(
    requests.map(({ result }) => result),
    ["Received", "Predicted next"],
  );
  assert.ok(requests.every(({ time }) => time === "11:00:00"));
  assert.notEqual(
    requests[0].id,
    createDemoRequests(2, false, "11:00:01")[0].id,
  );
});

test("a paused demo does not predict requests or mutate the starting sample", () => {
  const before = structuredClone(sampleRequests);
  const requests = createDemoRequests(1, true, "11:00:00");
  assert.ok(requests.every(({ result }) => result === "Received"));
  assert.deepEqual(sampleRequests, before);
});
