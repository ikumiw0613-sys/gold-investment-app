import type { MarketData, MarketHistoryPoint } from "../types/market";
import { getJson } from "./api.ts";
import type { StoredMarketPrice } from "../types/market";

export function fetchStoredMarketPrices(): Promise<StoredMarketPrice[]> {
  return getJson("/market-prices");
}

export function toGldHistory(prices: StoredMarketPrice[]): MarketHistoryPoint[] {
  return prices
    .map(({ date, gld_price }) => ({ date, price: gld_price }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function fetchMarketData(): Promise<MarketData> {
  return getJson("/market");
}

export function mergeGldHistory(
  dbHistory: readonly MarketHistoryPoint[],
  apiHistory: readonly MarketHistoryPoint[],
): MarketHistoryPoint[] {
  const byDate = new Map<string, MarketHistoryPoint>();
  for (const point of [...apiHistory, ...dbHistory]) {
    byDate.set(point.date, { ...point });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function fetchMarketHistory(): Promise<MarketHistoryPoint[]> {
  return getJson("/market/xau-usd/history");
}

export type MarketPeriod = "7d" | "1m" | "3m" | "1y";

export function filterGldHistoryByPeriod<T extends { date: string }>(
  history: readonly T[],
  period: MarketPeriod,
  today = new Date(),
): T[] {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let start: Date;
  if (period === "7d") {
    start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  } else {
    const months = { "1m": 1, "3m": 3, "1y": 12 }[period];
    start = new Date(end.getFullYear(), end.getMonth() - months, 1);
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    start.setDate(Math.min(end.getDate(), lastDay));
  }
  const dateKey = (day: Date) =>
    `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  return history.filter(({ date }) => startKey <= date && date <= endKey);
}

export function fetchGldHistory(period: MarketPeriod = "7d"): Promise<MarketHistoryPoint[]> {
  return getJson(`/market/gld/history?period=${period}`);
}
