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

export type StoredMarketPrice = {
  id: number;
  date: string;
  gld_price: number;
  usd_jpy: number;
  xau_usd_price: number;
};
