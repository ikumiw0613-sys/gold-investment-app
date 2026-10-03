import { GoldChart } from "../components/GoldChart";
import { InvestmentForm } from "../components/InvestmentForm";
import { PortfolioOverview } from "../components/PortfolioOverview";
import { AcquisitionComparison } from "../components/AcquisitionComparison";
import { useDashboardData } from "../hooks/useDashboardData";
import { useGldHistory } from "../hooks/useGldHistory";
import { calculatePortfolioSummary, toInvestmentMarkers } from "../lib/investment";
import { filterGldHistoryByPeriod } from "../lib/market";
import type { MarketPeriod } from "../lib/market";
import { formatNumber as number } from "../lib/format";

const periods: { value: MarketPeriod; label: string }[] = [
  { value: "7d", label: "7日" },
  { value: "1m", label: "1か月" },
  { value: "3m", label: "3か月" },
  { value: "1y", label: "1年" },
];

function DashboardPage() {
  const { marketData, records, error, addRecord } = useDashboardData();
  const { period, selectPeriod, history: chartHistory, error: chartError } = useGldHistory();
  const investmentMarkers = filterGldHistoryByPeriod(toInvestmentMarkers(records), period);
  const latestChartPoint = chartError ? undefined : chartHistory?.at(-1);

  if (error) return <main className="dashboard"><header className="masthead">金の運用帳</header><div className="status-message" role="alert">{error}<p>時間をおいてページを再読み込みしてください。</p></div></main>;
  if (!marketData) return <main className="dashboard"><header className="masthead">金の運用帳</header><p className="status-message" role="status">運用データを読み込んでいます…</p></main>;

  const summary = calculatePortfolioSummary(
    records,
    marketData.gldPrice,
    marketData.usdJpy,
  );

  return (
    <main className="dashboard">
      <header className="masthead"><a href="/" aria-label="金の運用帳 ホーム"><span className="brand-mark" aria-hidden="true" />金の運用帳</a><span>ポイント投資の記録</span></header>
      <div className="page-heading"><div><p className="eyebrow">運用状況</p><h1>金への積み立て</h1></div><p className="muted">{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</p></div>
      <PortfolioOverview summary={summary} />
      <AcquisitionComparison records={records} currentGldPrice={marketData.gldPrice} currentApproximatePrice={summary.currentApproximatePrice} />
      <div className="workspace">
        <section className="chart-section" aria-label="GLD価格履歴">
          <div className="section-heading"><div><h2>価格の推移</h2><p className="muted">GLD · 米ドル建て</p></div><div className="periods" role="group" aria-label="表示期間">{periods.map(option => <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => selectPeriod(option.value)}>{option.label}</button>)}</div></div>
          {chartError ? <p className="chart-status" role="alert">{chartError}</p> : chartHistory === null ? <p className="chart-status" role="status">価格履歴を読み込んでいます…</p> : <GoldChart data={chartHistory} markers={investmentMarkers} showSevenDays={period === "7d"} />}
          <dl className="market-quotes"><div><dt>GLD（期間内最新） <span>USD</span></dt><dd>{latestChartPoint ? number(latestChartPoint.price, 2) : "—"}{latestChartPoint && <small> {latestChartPoint.date}</small>}</dd></div><div><dt>ドル / 円 <span>JPY</span></dt><dd>{number(marketData.usdJpy, 2)}</dd></div><div><dt>金スポット <span>USD / oz</span></dt><dd>{number(marketData.xauUsdPrice, 2)}</dd></div></dl>
          <p className="data-note">価格は最大1時間ごとに更新されます。</p>
        </section>
        <aside className="entry-section"><p className="eyebrow">積み立ての記録</p><h2>ポイントを追加</h2><p className="form-intro">投資した日とポイントを記録します。</p><InvestmentForm marketData={marketData} onSubmitRecord={addRecord} /></aside>
      </div>
      <footer className="page-footer"><span>金の運用帳</span><span>評価額は参考値です。実際の運用結果とは異なる場合があります。</span></footer>
    </main>
  );
}

export default DashboardPage;
