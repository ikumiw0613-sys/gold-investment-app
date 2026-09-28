import type { MarketData , MarketHistoryPoint } from "../types/market";

export async function fetchMarketData(): Promise<MarketData> {
  const response = await fetch("http://127.0.0.1:8000/market");

  if (!response.ok) {
    throw new Error("Failed to fetch market data");
  }

  const data: MarketData = await response.json();

  return data;
}

export async function fetchMarketHistory(): Promise<MarketHistoryPoint[]> {
  const response = await fetch(
    "http://127.0.0.1:8000/market/xau-usd/history"
  );

  if (!response.ok) {
    throw new Error("Failed to fetch market history");
  }

  return await response.json();
}

export type MarketPeriod = "7d" | "1m" | "3m" | "1y";

export async function fetchGldHistory(
  period: MarketPeriod = "7d",
  signal?: AbortSignal,
): Promise<MarketHistoryPoint[]> {
  const response = await fetch(
    `http://127.0.0.1:8000/market/gld/history?period=${period}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch GLD history");
  }

  return await response.json();
}
