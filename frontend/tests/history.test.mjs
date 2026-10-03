import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const source = await readFile(new URL("../src/pages/HistoryPage.tsx", import.meta.url), "utf8");
let { outputText } = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
});
for (const dependency of ["react", "react/jsx-runtime"]) {
  outputText = outputText.replaceAll(`"${dependency}"`, JSON.stringify(import.meta.resolve(dependency)));
}
for (const [specifier, path] of [["../lib/investmentApi", "../src/lib/investmentApi.ts"], ["../lib/api", "../src/lib/api.ts"]]) {
  outputText = outputText.replaceAll(`"${specifier}"`, JSON.stringify(new URL(path, import.meta.url).href));
}
const { InvestmentHistoryList, default: HistoryPage } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

function record(id, date, addedPoints) {
  return { id, date, addedPoints, feePoints: 5, investedPoints: addedPoints - 5,
    gldPrice: 380.25, usdJpy: 147.2, approximatePrice: 55972.8, virtualAmount: 0.01 };
}

test("history list shows empty state and link to registration", () => {
  const html = renderToStaticMarkup(createElement(InvestmentHistoryList, { records: [] }));
  assert.match(html, /まだ投資履歴がありません/);
  assert.match(html, /href="#\/"/);
  assert.doesNotMatch(html, /<table|history-card/);
});

test("desktop and mobile history retain same-day records in descending date order", () => {
  const records = Object.freeze([
    Object.freeze(record("old", "2026-09-28", 100)),
    Object.freeze(record("new-first", "2026-10-03", 500)),
    Object.freeze(record("new-second", "2026-10-03", 600)),
  ]);
  const before = structuredClone(records);
  const html = renderToStaticMarkup(createElement(InvestmentHistoryList, { records }));
  const table = html.match(/<tbody>(.*?)<\/tbody>/s)[1];
  const cards = html.match(/<ul.*?<\/ul>/s)[0];
  for (const section of [table, cards]) {
    const dates = [...section.matchAll(/dateTime="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(dates, ["2026-10-03", "2026-10-03", "2026-09-28"]);
    assert.ok(section.indexOf("500 pt") < section.indexOf("600 pt"));
    assert.match(section, /495\.00 pt/);
    assert.match(section, /595\.00 pt/);
  }
  assert.deepEqual(records, before);
});

test("history shows all required columns with currency and point formatting", () => {
  const html = renderToStaticMarkup(createElement(InvestmentHistoryList, { records: [record("one", "2026-10-03", 500)] }));
  for (const label of ["追加日", "追加ポイント", "手数料", "実質運用額", "追加時GLD価格", "追加時USD/JPY", "追加時近似価格"]) {
    assert.ok(html.includes(label));
  }
  for (const value of ["500 pt", "5.00 pt", "495.00 pt", "$380.25", "147.20 円/USD", "55,972.80 pt/口"]) {
    assert.ok(html.includes(value));
  }
});

test("history page distinguishes loading from empty records", () => {
  const html = renderToStaticMarkup(createElement(HistoryPage));
  assert.match(html, /投資履歴を読み込んでいます/);
  assert.doesNotMatch(html, /まだ投資履歴がありません/);
});
