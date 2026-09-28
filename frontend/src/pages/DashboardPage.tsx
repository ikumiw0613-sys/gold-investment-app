import { useEffect, useState } from "react";
import { GoldChart } from "../components/GoldChart";
import type { MarketHistoryPoint } from "../types/market";
import type { MarketData } from "../types/market";
import { fetchMarketData, fetchGldHistory } from "../lib/market";
import { InvestmentForm } from "../components/InvestmentForm";
import type { InvestmentRecord } from "../types/investment";
import { fetchInvestmentRecords, saveInvestmentRecord } from "../lib/investmentApi";

function DashboardPage() {
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
    void fetchGldHistory().then(
      (history) => { if (active) setGldHistory(history); },
      () => { if (active) setChartError("GLDの価格履歴を取得できませんでした。"); },
    );

    return () => {
      active = false;
    };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!marketData) return <p>読み込み中...</p>;

  return (

    <main>
      <h1>ダッシュボード</h1>
      <section aria-label="GLD価格履歴">
        <h2>GLD価格履歴（USD）</h2>
        {chartError ? <p role="alert">{chartError}</p> : gldHistory === null ? (
          <p role="status">価格履歴を読み込み中...</p>
        ) : <GoldChart data={gldHistory} />}
      </section>

      <InvestmentForm
        marketData={marketData}
        onSubmitRecord={async (record) => {
          try {
            await saveInvestmentRecord(record);

            setRecords((prev) => [...prev, record]);
          } catch (error) {
            console.error(error);
            alert("履歴の保存に失敗しました");
          }
        }}
      />
      <ul>
        {records.map((record) => (
          <li key={record.id}>
            {record.date} - {record.addedPoints}pt
          </li>
        ))}
      </ul>
      <p>GLD: {marketData.gldPrice}</p>
      <p>USD/JPY: {marketData.usdJpy}</p>
      <p>XAU/USD: {marketData.xauUsdPrice}</p>
      <p>登録件数: {records.length}</p>
    </main>
  );
}

export default DashboardPage;

