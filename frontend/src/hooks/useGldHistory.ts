import { useEffect, useState } from "react";
import type { MarketHistoryPoint } from "../types/market";
import {
  fetchGldHistory, fetchStoredMarketPrices, toGldHistory,
  mergeGldHistory, filterGldHistoryByPeriod,
} from "../lib/market";
import type { MarketPeriod } from "../lib/market";
import { errorMessage } from "../lib/api";

export function useGldHistory() {
  const [period, setPeriod] = useState<MarketPeriod>("7d");
  const [apiHistory, setApiHistory] = useState<MarketHistoryPoint[] | null>(null);
  const [dbHistory, setDbHistory] = useState<MarketHistoryPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchStoredMarketPrices().then(
      prices => { if (active) setDbHistory(toGldHistory(prices)); },
      (error: unknown) => {
        if (active) {
          console.error("保存済み市場価格を取得できませんでした。", error);
          setDbHistory([]);
        }
      },
    );
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchGldHistory(period).then(
      history => { if (active) setApiHistory(history); },
      (error: unknown) => {
        if (active) setError(errorMessage(error, "GLDの価格履歴を取得できませんでした。"));
      },
    );
    return () => { active = false; };
  }, [period]);

  function selectPeriod(nextPeriod: MarketPeriod) {
    if (nextPeriod === period) return;
    setApiHistory(null);
    setError(null);
    setPeriod(nextPeriod);
  }

  const history = dbHistory !== null && apiHistory !== null
    ? filterGldHistoryByPeriod(mergeGldHistory(dbHistory, apiHistory), period)
    : null;

  return { period, selectPeriod, history, error };
}
