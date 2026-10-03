import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Compile the TSX component in memory for Node's existing test runner.
const source = await readFile(new URL("../src/components/GoldChart.tsx", import.meta.url), "utf8");
let { outputText } = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
});
for (const dependency of ["react/jsx-runtime", "recharts"]) {
  outputText = outputText.replaceAll(`"${dependency}"`, JSON.stringify(import.meta.resolve(dependency)));
}
const { GoldChart } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("chart renders safely with zero or one market point and zero markers", () => {
  assert.match(renderToStaticMarkup(createElement(GoldChart, { data: [] })), /価格履歴がありません/);
  const html = renderToStaticMarkup(createElement(GoldChart, {
    data: [{ date: "2026-10-03", price: 394 }], markers: [],
  }));
  assert.match(html, /価格データ不足/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("chart handles markers without market history and same-day duplicate coordinates", () => {
  const html = renderToStaticMarkup(createElement(GoldChart, {
    data: [],
    markers: [
      { id: "first", date: "2026-10-03", price: 394, addedPoints: 100 },
      { id: "second", date: "2026-10-03", price: 394, addedPoints: 200 },
    ],
  }));
  assert.match(html, /緑の点は投資記録/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
