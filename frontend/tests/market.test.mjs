import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeGldHistory, filterGldHistoryByPeriod } from "../src/lib/market.ts";

test("merges dates in ascending order and prefers DB prices", () => {
  const api = [
    { date: "2026-10-02", price: 391 },
    { date: "2026-10-01", price: 390 },
  ];
  const db = [
    { date: "2026-10-03", price: 394 },
    { date: "2026-10-02", price: 392 },
  ];
  assert.deepEqual(mergeGldHistory(db, api), [
    { date: "2026-10-01", price: 390 },
    { date: "2026-10-02", price: 392 },
    { date: "2026-10-03", price: 394 },
  ]);
});

test("deduplicates within each source, using its last entry", () => {
  assert.deepEqual(mergeGldHistory([
    { date: "2026-10-02", price: 392 },
    { date: "2026-10-02", price: 393 },
  ], [
    { date: "2026-10-01", price: 389 },
    { date: "2026-10-01", price: 390 },
    { date: "2026-10-02", price: 391 },
  ]), [
    { date: "2026-10-01", price: 390 },
    { date: "2026-10-02", price: 393 },
  ]);
});

test("handles both empty and either source empty", () => {
  const history = [
    { date: "2026-10-02", price: 392 },
    { date: "2026-10-01", price: 390 },
  ];
  const sorted = [...history].reverse();
  assert.deepEqual(mergeGldHistory([], []), []);
  assert.deepEqual(mergeGldHistory(history, []), sorted);
  assert.deepEqual(mergeGldHistory([], history), sorted);
});

test("does not mutate inputs or share output objects with them", () => {
  const db = Object.freeze([Object.freeze({ date: "2026-10-02", price: 392 })]);
  const api = Object.freeze([Object.freeze({ date: "2026-10-01", price: 390 })]);
  const before = structuredClone({ db, api });
  const result = mergeGldHistory(db, api);
  result[0].price = 0;
  result[1].price = 0;
  assert.deepEqual({ db, api }, before);
});

test("seven days includes today and both boundaries but excludes future dates", () => {
  const history = Object.freeze([
    { date: "2026-09-26", price: 1 },
    { date: "2026-09-27", price: 2 },
    { date: "2026-10-03", price: 3 },
    { date: "2026-10-04", price: 4 },
  ]);
  assert.deepEqual(filterGldHistoryByPeriod(history, "7d", new Date(2026, 9, 3, 23)),
    [history[1], history[2]]);
  assert.equal(history.length, 4);
});

test("calendar month clamps March 31 to February 28", () => {
  const history = [
    { date: "2026-02-27", price: 1 },
    { date: "2026-02-28", price: 2 },
    { date: "2026-03-31", price: 3 },
  ];
  assert.deepEqual(filterGldHistoryByPeriod(history, "1m", new Date(2026, 2, 31)), history.slice(1));
});

test("three calendar months cross the year boundary", () => {
  const history = [
    { date: "2025-10-30", price: 1 },
    { date: "2025-10-31", price: 2 },
    { date: "2026-01-31", price: 3 },
  ];
  assert.deepEqual(filterGldHistoryByPeriod(history, "3m", new Date(2026, 0, 31)), history.slice(1));
});

test("one year from leap day clamps to February 28", () => {
  const history = [
    { date: "2023-02-27", price: 1 },
    { date: "2023-02-28", price: 2 },
    { date: "2024-02-29", price: 3 },
  ];
  assert.deepEqual(filterGldHistoryByPeriod(history, "1y", new Date(2024, 1, 29)), history.slice(1));
});

test("merged and filtered history keeps API gaps and DB overrides in ascending order", () => {
  const db = [{ date: "2026-10-02", price: 392 }, { date: "2025-01-01", price: 300 }];
  const api = [{ date: "2026-10-03", price: 394 }, { date: "2026-10-02", price: 391 }, { date: "2026-10-01", price: 390 }];
  assert.deepEqual(filterGldHistoryByPeriod(mergeGldHistory(db, api), "7d", new Date(2026, 9, 3)), [
    { date: "2026-10-01", price: 390 },
    { date: "2026-10-02", price: 392 },
    { date: "2026-10-03", price: 394 },
  ]);
});

test("period filtering handles empty and single-point histories", () => {
  const today = new Date(2026, 9, 3);
  const single = [{ date: "2026-10-03", price: 394 }];
  assert.deepEqual(filterGldHistoryByPeriod([], "7d", today), []);
  assert.deepEqual(filterGldHistoryByPeriod(single, "7d", today), single);
  assert.deepEqual(filterGldHistoryByPeriod([{ date: "2025-01-01", price: 300 }], "7d", today), []);
});
