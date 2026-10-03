import assert from "node:assert/strict";
import { test } from "node:test";
import { toInvestmentMarkers } from "../src/lib/investment.ts";
import { filterGldHistoryByPeriod } from "../src/lib/market.ts";

function record(id, date, gldPrice, addedPoints) {
  return {
    id, date, gldPrice, addedPoints,
    feePoints: 0,
    investedPoints: addedPoints,
    usdJpy: 150,
    approximatePrice: gldPrice * 150,
    virtualAmount: addedPoints / (gldPrice * 150),
  };
}

test("maps investment GLD prices and points in ascending date order", () => {
  assert.deepEqual(toInvestmentMarkers([
    record("later", "2026-10-03", 394, 200),
    record("earlier", "2026-10-01", 390, 100),
  ]), [
    { id: "earlier", date: "2026-10-01", price: 390, addedPoints: 100 },
    { id: "later", date: "2026-10-03", price: 394, addedPoints: 200 },
  ]);
});

test("retains separate investments on the same date in their original order", () => {
  const markers = toInvestmentMarkers([
    record("first", "2026-10-02", 391, 100),
    record("second", "2026-10-02", 392, 200),
  ]);
  assert.deepEqual(markers, [
    { id: "first", date: "2026-10-02", price: 391, addedPoints: 100 },
    { id: "second", date: "2026-10-02", price: 392, addedPoints: 200 },
  ]);
});

test("handles empty records", () => {
  assert.deepEqual(toInvestmentMarkers([]), []);
});

test("does not mutate records or share marker objects with them", () => {
  const records = Object.freeze([
    Object.freeze(record("later", "2026-10-03", 394, 200)),
    Object.freeze(record("earlier", "2026-10-01", 390, 100)),
  ]);
  const before = structuredClone(records);
  const markers = toInvestmentMarkers(records);
  markers[0].addedPoints = 999;
  markers[0].date = "2000-01-01";
  assert.deepEqual(records, before);
});

test("marker period filtering preserves IDs, prices, points and same-day records", () => {
  const markers = toInvestmentMarkers([
    record("outside", "2026-09-26", 389, 50),
    record("boundary", "2026-09-27", 390, 100),
    record("first", "2026-10-03", 394, 200),
    record("second", "2026-10-03", 394, 300),
    record("future", "2026-10-04", 395, 400),
  ]);
  const original = structuredClone(markers);
  assert.deepEqual(filterGldHistoryByPeriod(markers, "7d", new Date(2026, 9, 3)), [
    { id: "boundary", date: "2026-09-27", price: 390, addedPoints: 100 },
    { id: "first", date: "2026-10-03", price: 394, addedPoints: 200 },
    { id: "second", date: "2026-10-03", price: 394, addedPoints: 300 },
  ]);
  assert.deepEqual(markers, original);
});

test("switching periods selects the corresponding markers", () => {
  const markers = toInvestmentMarkers([
    record("year", "2025-10-03", 350, 100),
    record("quarter", "2026-07-03", 360, 100),
    record("month", "2026-09-03", 380, 100),
    record("week", "2026-10-03", 394, 100),
  ]);
  const today = new Date(2026, 9, 3);
  for (const [period, ids] of [
    ["7d", ["week"]],
    ["1m", ["month", "week"]],
    ["3m", ["quarter", "month", "week"]],
    ["1y", ["year", "quarter", "month", "week"]],
  ]) {
    assert.deepEqual(filterGldHistoryByPeriod(markers, period, today).map(marker => marker.id), ids);
  }
  assert.deepEqual(filterGldHistoryByPeriod([], "7d", today), []);
});
