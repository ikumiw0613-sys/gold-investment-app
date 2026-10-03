export type InvestmentRecord = {
  id: string;
  date: string;
  addedPoints: number;
  feePoints: number;
  investedPoints: number;
  gldPrice: number;
  usdJpy: number;
  approximatePrice: number;
  virtualAmount: number;
};

export type PortfolioSummary = {
  totalAddedPoints: number;
  totalFeePoints: number;
  totalVirtualAmount: number;
  currentApproximatePrice: number;
  currentValue: number;
  profit: number;
  profitRate: number;
};

export type InvestmentMarker = {
  id: string;
  date: string;
  price: number;
  addedPoints: number;
};
