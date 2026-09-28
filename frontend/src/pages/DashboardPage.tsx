import { useEffect, useState } from "react";
import { GoldChart } from "../components/GoldChart";
import type { MarketHistoryPoint } from "../types/market";
import type { MarketData } from "../types/market";
import { fetchMarketData, fetchGldHistory } from "../lib/market";
import type { MarketPeriod } from "../lib/market";
import { InvestmentForm } from "../components/InvestmentForm";
import type { InvestmentRecord } from "../types/investment";
import { fetchInvestmentRecords, saveInvestmentRecord } from "../lib/investmentApi";

import { calculatePortfolioSummary } from "../lib/investment";

const periods: { value: MarketPeriod; label: string }[] = [
  { value: "7d", label: "7日" },
  { value: "1m", label: "1か月" },
  { value: "3m", label: "3か月" },
  { value: "1y", label: "1年" },
];

function DashboardPage() {
  const [period, setPeriod] = useState<MarketPeriod>("7d");
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<InvestmentRecord[]>([]);

  const [gldHistory, setGldHistory] = useState<MarketHistoryPoint[] | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMarketData() {
      try {
        const [data, history] = await Promise.all([
          fetchMarketData(), fetchInvestmentRecords(),
        ]);

        if (active) {
          setMarketData(data);
          setRecords(history);
        }
      } catch {
        if (active) {
          setError("市場データまたは投資履歴を取得できませんでした。");
        }
      }
    }

    void loadMarketData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void fetchGldHistory(period, controller.signal).then(
      (history) => {
        if (!controller.signal.aborted) setGldHistory(history);
      },
      () => {
        if (!controller.signal.aborted) {
          setChartError("GLDの価格履歴を取得できませんでした。");
        }
      },
    );

    return () => controller.abort();
  }, [period]);

  if (error) return <main className="dashboard"><header className="masthead">金の運用帳</header><div className="status-message" role="alert">{error}<p>時間をおいてページを再読み込みしてください。</p></div></main>;
  if (!marketData) return <main className="dashboard"><header className="masthead">金の運用帳</header><p className="status-message" role="status">運用データを読み込んでいます…</p></main>;

  const summary = calculatePortfolioSummary(
    records,
    marketData.gldPrice,
    marketData.usdJpy,
  );

  const number = (value: number, digits = 0) => value.toLocaleString("ja-JP", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const signed = (value: number) => `${value > 0 ? "+" : ""}${number(value, 2)}`;
  const valuation = number(summary.currentValue, 2);

  return (
    <main className="dashboard">
      <header className="masthead"><a href="/" aria-label="金の運用帳 ホーム"><span className="brand-mark" aria-hidden="true" />金の運用帳</a><span>ポイント投資の記録</span></header>
      <div className="page-heading"><div><p className="eyebrow">運用状況</p><h1>金への積み立て</h1></div><p className="muted">{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</p></div>
      <section className="portfolio" aria-label="運用サマリー">
        <div className="valuation"><p className="metric-label">推定評価額</p><p className="valuation-number"><span className="valuation-amount" style={{ fontSize: `min(56px, ${125 / valuation.length}cqi)` }}>{valuation}</span><span className="valuation-unit">pt</span></p><p className="muted">GLD価格とドル円から算出</p></div>
        <dl className="summary-details"><div><dt>累計投入ポイント</dt><dd>{number(summary.totalAddedPoints)} <small>pt</small></dd></div><div><dt>評価損益</dt><dd className={summary.profit < 0 ? "negative" : summary.profit > 0 ? "positive" : ""}>{signed(summary.profit)} <small>pt</small><span className="profit-rate">{signed(summary.profitRate)}%</span></dd></div><div><dt>累計手数料</dt><dd>{number(summary.totalFeePoints, 2)} <small>pt</small></dd></div></dl>
      </section>
      <div className="workspace">
        <section className="chart-section" aria-label="GLD価格履歴">
          <div className="section-heading"><div><h2>価格の推移</h2><p className="muted">GLD · 米ドル建て</p></div><div className="periods" role="group" aria-label="表示期間">{periods.map(option => <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => { if (period === option.value) return; setGldHistory(null); setChartError(null); setPeriod(option.value); }}>{option.label}</button>)}</div></div>
          {chartError ? <p className="chart-status" role="alert">{chartError}</p> : gldHistory === null ? <p className="chart-status" role="status">価格履歴を読み込んでいます…</p> : <GoldChart data={gldHistory} showSevenDays={period === "7d"} />}
          <dl className="market-quotes"><div><dt>GLD <span>USD</span></dt><dd>{number(marketData.gldPrice, 2)}</dd></div><div><dt>ドル / 円 <span>JPY</span></dt><dd>{number(marketData.usdJpy, 2)}</dd></div><div><dt>金スポット <span>USD / oz</span></dt><dd>{number(marketData.xauUsdPrice, 2)}</dd></div></dl>
          <p className="data-note">価格は最大1時間ごとに更新されます。</p>
        </section>
        <aside className="entry-section"><p className="eyebrow">積み立ての記録</p><h2>ポイントを追加</h2><p className="form-intro">投資した日とポイントを記録します。</p><InvestmentForm marketData={marketData} onSubmitRecord={async record => { await saveInvestmentRecord(record); setRecords(prev => [...prev, record]); }} /></aside>
      </div>
      <section className="history-section"><div className="section-heading"><h2>積み立て履歴</h2><span className="muted">{records.length}件</span></div>{records.length === 0 ? <div className="empty-state"><p>まだ記録がありません</p><span>ポイントを追加すると、ここに積み立て履歴が表示されます。</span></div> : <div className="table-scroll"><table><thead><tr><th scope="col">追加日</th><th scope="col">追加ポイント</th><th scope="col">手数料</th><th scope="col">運用ポイント</th></tr></thead><tbody>{[...records].sort((a, b) => b.date.localeCompare(a.date)).map(record => <tr key={record.id}><td>{record.date.replaceAll("-", "/")}</td><td>{number(record.addedPoints)} <small>pt</small></td><td>{number(record.feePoints, 2)} <small>pt</small></td><td>{number(record.investedPoints, 2)} <small>pt</small></td></tr>)}</tbody></table></div>}</section>
      <footer className="page-footer"><span>金の運用帳</span><span>評価額は参考値です。実際の運用結果とは異なる場合があります。</span></footer>
    </main>
  );
}

export default DashboardPage;
