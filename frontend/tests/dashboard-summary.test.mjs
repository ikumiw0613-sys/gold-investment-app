import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculatePortfolioSummary } from "../src/lib/investment.ts";

async function loadComponent(name) {
  const source = await readFile(new URL(`../src/components/${name}.tsx`, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  });
  outputText = outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
  for (const dependency of ["investment", "format"]) {
    outputText = outputText.replaceAll(`"../lib/${dependency}"`, JSON.stringify(new URL(`../src/lib/${dependency}.ts`, import.meta.url).href));
  }
  return (await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`))[name];
}

const PortfolioOverview = await loadComponent("PortfolioOverview");
const AcquisitionComparison = await loadComponent("AcquisitionComparison");
const records = [{ id: "one", date: "2026-10-03", addedPoints: 60600, feePoints: 600,
  investedPoints: 60000, gldPrice: 400, usdJpy: 150, approximatePrice: 60000, virtualAmount: 1 }];

test("extracted portfolio overview retains valuation, fees and signed profit", () => {
  const summary = calculatePortfolioSummary(records, 410, 150);
  const html = renderToStaticMarkup(createElement(PortfolioOverview, { summary }));
  for (const value of ["61,500.00", "60,600", "600.00", "+900.00", "+1.49%", 'class="positive"']) {
    assert.ok(html.includes(value), value);
  }
});

test("extracted acquisition comparison keeps converted units and signed differences", () => {
  for (const [currentPrice, difference, deviation, className] of [
    [61500, "+1,500.00", "+2.50%", "positive"],
    [58500, "-1,500.00", "-2.50%", "negative"],
  ]) {
    const html = renderToStaticMarkup(createElement(AcquisitionComparison, {
      records, currentGldPrice: currentPrice / 150, currentApproximatePrice: currentPrice,
    }));
    for (const value of ["60,000.00", "pt/口", difference, deviation, `class="${className}"`]) {
      assert.ok(html.includes(value), value);
    }
  }
});

test("empty portfolio renders zero totals and unavailable acquisition comparisons", () => {
  const overview = renderToStaticMarkup(createElement(PortfolioOverview, {
    summary: calculatePortfolioSummary([], 410, 150),
  }));
  const comparison = renderToStaticMarkup(createElement(AcquisitionComparison, {
    records: [], currentGldPrice: 410, currentApproximatePrice: 61500,
  }));
  assert.match(overview, /0\.00/);
  assert.equal((comparison.match(/—/g) ?? []).length, 3);
  assert.doesNotMatch(overview + comparison, /NaN|Infinity/);
});
