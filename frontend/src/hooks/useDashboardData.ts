import { useEffect, useState } from "react";
import type { MarketData } from "../types/market";
import type { InvestmentRecord } from "../types/investment";
import { fetchMarketData } from "../lib/market";
import { fetchInvestmentRecords, saveInvestmentRecord } from "../lib/investmentApi";
import { errorMessage } from "../lib/api";

export function useDashboardData() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [records, setRecords] = useState<InvestmentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchMarketData(), fetchInvestmentRecords()]).then(
      ([data, history]) => {
        if (active) {
          setMarketData(data);
          setRecords(history);
        }
      },
      (error: unknown) => {
        if (active) setError(errorMessage(error, "市場データまたは投資履歴を取得できませんでした。"));
      },
    );
    return () => { active = false; };
  }, []);

  async function addRecord(record: InvestmentRecord) {
    await saveInvestmentRecord(record);
    setRecords(previous => [...previous, record]);
  }

  return { marketData, records, error, addRecord };
}
