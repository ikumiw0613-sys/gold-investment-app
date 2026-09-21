import { useEffect, useState } from "react";
import type { MarketData } from "./types/market";
import { fetchMarketData, fetchMarketHistory } from "./lib/market";

function App() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMarketData() {
      try {
        const data = await fetchMarketData();
        const history = await fetchMarketHistory();

        console.log(data);
        console.log(history);

        if (active) {
          setMarketData(data);
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
      <p>GLD: {marketData.gldPrice}</p>
      <p>USD/JPY: {marketData.usdJpy}</p>
      <p>XAU/USD: {marketData.xauUsdPrice}</p>
    </>
  );
}

export default App;