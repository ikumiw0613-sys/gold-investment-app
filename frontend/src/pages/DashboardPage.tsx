import { useEffect, useState } from "react";
import { GoldChart } from "../components/GoldChart";
import type { MarketHistoryPoint } from "../types/market";
import type { MarketData } from "../types/market";
import { fetchMarketData, fetchGldHistory, fetchStoredMarketPrices, toGldHistory, mergeGldHistory, filterGldHistoryByPeriod } from "../lib/market";
import type { MarketPeriod } from "../lib/market";
import { InvestmentForm } from "../components/InvestmentForm";
import type { InvestmentRecord } from "../types/investment";
import { fetchInvestmentRecords, saveInvestmentRecord } from "../lib/investmentApi";

import { calculatePortfolioSummary, toInvestmentMarkers, calculateAverageAcquisitionPrice, calculatePriceDifference, calculatePriceDeviationRate } from "../lib/investment";
import { errorMessage } from "../lib/api";

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

  const investmentMarkers = filterGldHistoryByPeriod(toInvestmentMarkers(records), period);

  const [gldHistory, setGldHistory] = useState<MarketHistoryPoint[] | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [storedGldHistory, setStoredGldHistory] = useState<MarketHistoryPoint[] | null>(null);

  const chartHistory = storedGldHistory !== null && gldHistory !== null
    ? filterGldHistoryByPeriod(mergeGldHistory(storedGldHistory, gldHistory), period)
    : null;
  const latestChartPoint = chartError ? undefined : chartHistory?.at(-1);

  useEffect(() => {
    let active = true;

    void fetchStoredMarketPrices().then(
      (prices) => {
        if (active) {
          setStoredGldHistory(toGldHistory(prices));
        }
      },
      (error: unknown) => {
        if (active) {
          console.error("保存済み市場価格を取得できませんでした。", error);
          setStoredGldHistory([]);
        }
      },
    );

    return () => { active = false; };
  }, []);

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
      } catch (error) {
        if (active) {
          setError(errorMessage(error, "市場データまたは投資履歴を取得できませんでした。"));
        }
      }
    }

    void loadMarketData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void fetchGldHistory(period).then(
      (history) => {
        if (active) setGldHistory(history);
      },
      (error: unknown) => {
        if (active) {
          setChartError(errorMessage(error, "GLDの価格履歴を取得できませんでした。"));
        }
      },
    );

    return () => { active = false; };
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
  const averagePrice = calculateAverageAcquisitionPrice(records);
  const priceDifference = calculatePriceDifference(summary.currentApproximatePrice, averagePrice);
  const priceDeviation = calculatePriceDeviationRate(summary.currentApproximatePrice, averagePrice);

  return (
    <main className="dashboard">
      <header className="masthead"><a href="/" aria-label="金の運用帳 ホーム"><span className="brand-mark" aria-hidden="true" />金の運用帳</a><span>ポイント投資の記録</span></header>
      <div className="page-heading"><div><p className="eyebrow">運用状況</p><h1>金への積み立て</h1></div><p className="muted">{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}</p></div>
      <section className="portfolio" aria-label="運用サマリー">
        <div className="valuation"><p className="metric-label">推定評価額</p><p className="valuation-number"><span className="valuation-amount" style={{ fontSize: `min(56px, ${125 / valuation.length}cqi)` }}>{valuation}</span><span className="valuation-unit">pt</span></p><p className="muted">GLD価格とドル円から算出</p></div>
        <dl className="summary-details"><div><dt>累計投入ポイント</dt><dd>{number(summary.totalAddedPoints)} <small>pt</small></dd></div><div><dt>評価損益</dt><dd className={summary.profit < 0 ? "negative" : summary.profit > 0 ? "positive" : ""}>{signed(summary.profit)} <small>pt</small><span className="profit-rate">{signed(summary.profitRate)}%</span></dd></div><div><dt>累計手数料</dt><dd>{number(summary.totalFeePoints, 2)} <small>pt</small></dd></div></dl>
      </section>
      <section className="history-section" aria-label="平均取得価格との比較">
        <div className="section-heading"><h2>平均取得価格との比較</h2></div>
        <dl className="market-quotes acquisition-quotes">
          <div><dt>平均取得価格</dt><dd>{averagePrice === null ? "—" : number(averagePrice, 2)} <small>pt/口</small></dd></div>
          <div><dt>現在GLD価格</dt><dd>${number(marketData.gldPrice, 2)} <small>USD</small></dd></div>
          <div><dt>現在価格（円換算相当）</dt><dd>{number(summary.currentApproximatePrice, 2)} <small>pt/口</small></dd></div>
          <div><dt>平均取得価格との差</dt><dd className={priceDifference === null ? "" : priceDifference < 0 ? "negative" : priceDifference > 0 ? "positive" : ""}>{priceDifference === null ? "—" : signed(priceDifference)} <small>pt/口</small></dd></div>
          <div><dt>乖離率</dt><dd className={priceDeviation === null ? "" : priceDeviation < 0 ? "negative" : priceDeviation > 0 ? "positive" : ""}>{priceDeviation === null ? "—" : `${signed(priceDeviation)}%`}</dd></div>
        </dl>
        <p className="data-note">平均取得価格は累計運用ポイント ÷ 累計仮想保有量。現在GLD価格をドル円で換算して比較するため、乖離率には為替の変動も含まれます。</p>
      </section>
      <div className="workspace">
        <section className="chart-section" aria-label="GLD価格履歴">
          <div className="section-heading"><div><h2>価格の推移</h2><p className="muted">GLD · 米ドル建て</p></div><div className="periods" role="group" aria-label="表示期間">{periods.map(option => <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => { if (period === option.value) return; setGldHistory(null); setChartError(null); setPeriod(option.value); }}>{option.label}</button>)}</div></div>
          {chartError ? <p className="chart-status" role="alert">{chartError}</p> : chartHistory === null ? <p className="chart-status" role="status">価格履歴を読み込んでいます…</p> : <GoldChart data={chartHistory} markers={investmentMarkers} showSevenDays={period === "7d"} />}
          <dl className="market-quotes"><div><dt>GLD（期間内最新） <span>USD</span></dt><dd>{latestChartPoint ? number(latestChartPoint.price, 2) : "—"}{latestChartPoint && <small> {latestChartPoint.date}</small>}</dd></div><div><dt>ドル / 円 <span>JPY</span></dt><dd>{number(marketData.usdJpy, 2)}</dd></div><div><dt>金スポット <span>USD / oz</span></dt><dd>{number(marketData.xauUsdPrice, 2)}</dd></div></dl>
          <p className="data-note">価格は最大1時間ごとに更新されます。</p>
        </section>
        <aside className="entry-section"><p className="eyebrow">積み立ての記録</p><h2>ポイントを追加</h2><p className="form-intro">投資した日とポイントを記録します。</p><InvestmentForm marketData={marketData} onSubmitRecord={async record => { await saveInvestmentRecord(record); setRecords(prev => [...prev, record]); }} /></aside>
      </div>
      <footer className="page-footer"><span>金の運用帳</span><span>評価額は参考値です。実際の運用結果とは異なる場合があります。</span></footer>
    </main>
  );
}

export default DashboardPage;
