import { useEffect, useState } from "react";
import type { InvestmentRecord } from "../types/investment";
import { fetchInvestmentRecords } from "../lib/investmentApi";
import { errorMessage } from "../lib/api";

const number = (value: number, digits = 0) => value.toLocaleString("ja-JP", {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const columns: { key: keyof InvestmentRecord; label: string; format: (record: InvestmentRecord) => string }[] = [
  { key: "addedPoints", label: "追加ポイント", format: record => `${number(record.addedPoints)} pt` },
  { key: "feePoints", label: "手数料", format: record => `${number(record.feePoints, 2)} pt` },
  { key: "investedPoints", label: "実質運用額", format: record => `${number(record.investedPoints, 2)} pt` },
  { key: "gldPrice", label: "追加時GLD価格", format: record => `$${number(record.gldPrice, 2)}` },
  { key: "usdJpy", label: "追加時USD/JPY", format: record => `${number(record.usdJpy, 2)} 円/USD` },
  { key: "approximatePrice", label: "追加時近似価格", format: record => `${number(record.approximatePrice, 2)} pt/口` },
];

export function InvestmentHistoryList({ records }: { records: readonly InvestmentRecord[] }) {
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date));
  if (sortedRecords.length === 0) return <div className="empty-state">
    <p>まだ投資履歴がありません</p>
    <span>ダッシュボードでポイントを追加すると、ここに記録が表示されます。</span>
    <p><a href="#/">ダッシュボードでポイントを追加</a></p>
  </div>;
  return <>
    <div className="table-scroll history-desktop" tabIndex={0} role="region" aria-label="投資履歴一覧（横スクロール可能）">
      <table>
        <caption className="history-caption">投資履歴 {records.length}件・新しい日付順</caption>
        <thead><tr><th scope="col">追加日</th>{columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>{sortedRecords.map(record => <tr key={record.id}>
          <td><time dateTime={record.date}>{record.date.replaceAll("-", "/")}</time></td>
          {columns.map(column => <td key={column.key}>{column.format(record)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    <ul className="history-cards" aria-label="投資履歴一覧">
      {sortedRecords.map(record => <li className="history-card" key={record.id}>
        <h2><time dateTime={record.date}>{record.date.replaceAll("-", "/")}</time></h2>
        <dl>{columns.map(column => <div key={column.key}><dt>{column.label}</dt><dd>{column.format(record)}</dd></div>)}</dl>
      </li>)}
    </ul>
  </>;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<InvestmentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchInvestmentRecords().then(
      data => { if (active) setRecords(data); },
      error => { if (active) setError(errorMessage(error, "投資履歴を取得できませんでした。")); },
    );
    return () => { active = false; };
  }, [retry]);
  return <main className="dashboard">
    <header className="masthead"><a href="#/" aria-label="金の運用帳 ホーム"><span className="brand-mark" aria-hidden="true" />金の運用帳</a><span>ポイント投資の記録</span></header>
    <div className="page-heading"><div><p className="eyebrow">積み立ての記録</p><h1>投資履歴</h1></div>{records !== null && <p className="muted">{records.length}件 · 新しい日付順</p>}</div>
    <section className="history-section" aria-label="保存済みの投資履歴">
      {error ? <div className="status-message" role="alert"><p>{error}</p><button type="button" className="history-retry" onClick={() => { setError(null); setRecords(null); setRetry(value => value + 1); }}>再読み込み</button></div>
        : records === null ? <p className="status-message" role="status">投資履歴を読み込んでいます…</p>
        : <InvestmentHistoryList records={records} />}
    </section>
    <footer className="page-footer"><span>金の運用帳</span><span>近似価格は追加時のGLD価格とドル円から算出した参考値です。</span></footer>
  </main>;
}
