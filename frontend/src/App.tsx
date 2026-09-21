import { useEffect, useState } from "react";
import type { MarketData } from "./types/market";
import { fetchMarketData, fetchMarketHistory } from "./lib/market";
import { InvestmentForm } from "./components/InvestmentForm";
import type { InvestmentRecord } from "./types/investment";
import {fetchInvestmentRecords,saveInvestmentRecord } from "./lib/investmentApi";


function App() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<InvestmentRecord[]>([]);

  useEffect(() => {
    let active = true;

    async function loadMarketData() {
      try {
        const data = await fetchMarketData();
        const history = await fetchInvestmentRecords();

        console.log(data);
        console.log(history);

        if (active) {
          setMarketData(data);
          setRecords(history);
        }
      } catch {
        if (active) {
          setError("市場データを取得できませんでした。");
        }
      }
    }

    void loadMarketData();

    return () => {
      active = false;
    };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!marketData) return <p>読み込み中...</p>;

  return (

    <>

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
    </>
  );
}

export default App;