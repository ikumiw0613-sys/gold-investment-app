import type { MarketData, MarketHistoryPoint } from "../types/market";
import { getJson } from "./api.ts";

export function fetchMarketData(): Promise<MarketData> {
  return getJson("/market");
}

export function fetchMarketHistory(): Promise<MarketHistoryPoint[]> {
  return getJson("/market/xau-usd/history");
}

export type MarketPeriod = "7d" | "1m" | "3m" | "1y";

export function fetchGldHistory(period: MarketPeriod = "7d"): Promise<MarketHistoryPoint[]> {
  return getJson(`/market/gld/history?period=${period}`);
}
