import assert from "node:assert/strict";
import { test } from "node:test";
import { toInvestmentMarkers, calculateAverageAcquisitionPrice, calculatePriceDifference, calculatePriceDeviationRate, calculatePortfolioSummary } from "../src/lib/investment.ts";
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

test("average acquisition uses invested points divided by virtual quantity", () => {
  const records = Object.freeze([
    Object.freeze({ ...record("first", "2026-10-01", 400, 61000), investedPoints: 60000, virtualAmount: 1 }),
    Object.freeze({ ...record("second", "2026-10-02", 300, 91000), investedPoints: 90000, virtualAmount: 2 }),
  ]);
  assert.equal(calculateAverageAcquisitionPrice(records), 50000);
  assert.equal(calculateAverageAcquisitionPrice([records[0]]), 60000);
});

test("empty records, zero quantity and invalid totals have no average", () => {
  assert.equal(calculateAverageAcquisitionPrice([]), null);
  const base = record("zero", "2026-10-03", 390, 100);
  for (const virtualAmount of [0, -1, NaN, Infinity]) {
    assert.equal(calculateAverageAcquisitionPrice([{ ...base, virtualAmount }]), null);
  }
  for (const investedPoints of [0, -1, NaN, Infinity]) {
    assert.equal(calculateAverageAcquisitionPrice([{ ...base, investedPoints }]), null);
  }
  assert.equal(calculateAverageAcquisitionPrice([{ ...base, investedPoints: Number.MAX_VALUE, virtualAmount: Number.MIN_VALUE }]), null);
});

test("price difference and deviation handle above, below and equal prices", () => {
  for (const [current, difference, rate] of [[55000, 5000, 10], [45000, -5000, -10], [50000, 0, 0]]) {
    assert.equal(calculatePriceDifference(current, 50000), difference);
    assert.equal(calculatePriceDeviationRate(current, 50000), rate);
  }
});

test("price comparisons safely handle unavailable averages and invalid prices", () => {
  for (const average of [null, 0, -1, NaN, Infinity]) {
    assert.equal(calculatePriceDifference(50000, average), null);
    assert.equal(calculatePriceDeviationRate(50000, average), null);
  }
  for (const current of [0, -1, NaN, Infinity]) {
    assert.equal(calculatePriceDifference(current, 50000), null);
    assert.equal(calculatePriceDeviationRate(current, 50000), null);
  }
  assert.equal(calculatePriceDeviationRate(Number.MAX_VALUE, Number.MIN_VALUE), null);
});

test("dashboard comparison uses the same converted unit as the acquisition price", () => {
  const records = [record("first", "2026-10-01", 400, 60000)];
  const summary = calculatePortfolioSummary(records, 410, 150);
  const average = calculateAverageAcquisitionPrice(records);
  assert.equal(average, 60000);
  assert.equal(calculatePriceDifference(summary.currentApproximatePrice, average), 1500);
  assert.equal(calculatePriceDeviationRate(summary.currentApproximatePrice, average), 2.5);
  assert.equal(summary.currentValue, 61500);
  assert.equal(summary.profit, 1500);
  assert.equal(summary.profitRate, 2.5);
});
