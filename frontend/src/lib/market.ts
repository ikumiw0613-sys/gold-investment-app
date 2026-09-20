import type { MarketData } from "../types/market";

export async function fetchMarketData(): Promise<MarketData> {
  const response = await fetch("http://127.0.0.1:8000/market");

  if (!response.ok) {
    throw new Error("Failed to fetch market data");
  }

  const data: MarketData = await response.json();

  return data;
}