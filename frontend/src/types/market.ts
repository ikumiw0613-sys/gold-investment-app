export type MarketData = {
  gldPrice: number;
  usdJpy: number;
  xauUsdPrice: number;
  xauUsdPreviousClose: number;
  xauUsdChange: number;
  xauUsdChangePercent: number;
};

export type MarketHistoryPoint = {
  date: string;
  price: number;
};