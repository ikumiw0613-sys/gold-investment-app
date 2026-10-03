import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getJson, errorMessage } from "../src/lib/api.ts";
import { fetchMarketData, fetchGldHistory } from "../src/lib/market.ts";
import { fetchInvestmentRecords } from "../src/lib/investmentApi.ts";

afterEach(() => mock.restoreAll());

test("overlapping dashboard loads share each GET, including StrictMode effect replay", async () => {
  const requests = [];
  mock.method(globalThis, "fetch", url => new Promise(resolve => requests.push({ url, resolve })));
  const load = () => Promise.all([fetchMarketData(), fetchInvestmentRecords(), fetchGldHistory()]);
  const first = load();
  const replay = load();
  assert.equal(requests.length, 3);
  for (const request of requests) request.resolve(Response.json(request.url.endsWith("/market") ? { gldPrice: 100 } : []));
  assert.deepEqual(await first, await replay);
});

test("period requests stay separate and repeated in-flight periods are shared", async () => {
  const requests = [];
  mock.method(globalThis, "fetch", url => new Promise(resolve => requests.push({ url, resolve })));
  const week = fetchGldHistory("7d");
  const year = fetchGldHistory("1y");
  const weekAgain = fetchGldHistory("7d");
  assert.equal(requests.length, 2);
  requests[1].resolve(Response.json([{ date: "2025-09-29", price: 100 }]));
  requests[0].resolve(Response.json([{ date: "2026-09-29", price: 200 }]));
  assert.deepEqual(await week, await weekAgain);
  assert.notDeepEqual(await week, await year);
});

test("completed GETs are released so subsequent loads can obtain fresh records", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => Response.json([]));
  await fetchInvestmentRecords();
  await fetchInvestmentRecords();
  assert.equal(fetch.mock.callCount(), 2);
});

test("API limit message reaches the UI formatter and failures allow a later retry", async () => {
  const message = "市場データの取得上限に達しました。時間をおいて再度お試しください。";
  const fetch = mock.method(globalThis, "fetch", async () => Response.json({ detail: message }, { status: 503 }));
  await assert.rejects(fetchMarketData(), error => errorMessage(error, "fallback") === message);
  await assert.rejects(fetchMarketData(), { message });
  assert.equal(fetch.mock.callCount(), 2);
});

test("network errors show a connection message without leaking technical details", async () => {
  mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(fetchGldHistory(), /サーバーに接続できませんでした/);
});

test("non-JSON errors and malformed successful responses have readable fallbacks", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => new Response("Bad gateway", { status: 502 }));
  await assert.rejects(getJson("/market"), /HTTP 502/);
  fetch.mock.mockImplementation(async () => new Response("not JSON"));
  await assert.rejects(getJson("/market"), /正しいデータを受け取れませんでした/);
});
