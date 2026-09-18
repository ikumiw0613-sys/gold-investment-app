import type { InvestmentRecord, PortfolioSummary } from "../types/investment";

export const FEE_RATE = 0.01;

export function calculateFee(addedPoints: number): number {
  if (addedPoints < 0) {
    throw new Error("addedPoints must be 0 or greater");
  }

  return addedPoints * FEE_RATE;
}

export function calculateInvestedPoints(addedPoints: number): number {
  return addedPoints - calculateFee(addedPoints);
}

export function calculateApproximatePrice(
  gldPrice: number,
  usdJpy: number,
): number {
  if (gldPrice <= 0 || usdJpy <= 0) {
    throw new Error("gldPrice and usdJpy must be greater than 0");
  }

  return gldPrice * usdJpy;
}

export function calculateVirtualAmount(
  investedPoints: number,
  approximatePrice: number,
): number {
  if (investedPoints < 0) {
    throw new Error("investedPoints must be 0 or greater");
  }

  if (approximatePrice <= 0) {
    throw new Error("approximatePrice must be greater than 0");
  }

  return investedPoints / approximatePrice;
}

export function calculateTotalVirtualAmount(
  records: InvestmentRecord[],
): number {
  return records.reduce((total, record) => total + record.virtualAmount, 0);
}

export function calculateCurrentValue(
  totalVirtualAmount: number,
  currentApproximatePrice: number,
): number {
  if (totalVirtualAmount < 0) {
    throw new Error("totalVirtualAmount must be 0 or greater");
  }

  if (currentApproximatePrice <= 0) {
    throw new Error("currentApproximatePrice must be greater than 0");
  }

  return totalVirtualAmount * currentApproximatePrice;
}

export function calculateProfit(
  currentValue: number,
  totalAddedPoints: number,
): number {
  return currentValue - totalAddedPoints;
}

export function calculateProfitRate(
  profit: number,
  totalAddedPoints: number,
): number {
  if (totalAddedPoints <= 0) {
    return 0;
  }

  return (profit / totalAddedPoints) * 100;
}

export function calculatePortfolioSummary(
  records: InvestmentRecord[],
  currentGldPrice: number,
  currentUsdJpy: number,
): PortfolioSummary {
  const totalAddedPoints = records.reduce(
    (total, record) => total + record.addedPoints,
    0,
  );
  const totalFeePoints = records.reduce(
    (total, record) => total + record.feePoints,
    0,
  );
  const totalVirtualAmount = calculateTotalVirtualAmount(records);
  const currentApproximatePrice = calculateApproximatePrice(
    currentGldPrice,
    currentUsdJpy,
  );
  const currentValue = calculateCurrentValue(
    totalVirtualAmount,
    currentApproximatePrice,
  );
  const profit = calculateProfit(currentValue, totalAddedPoints);
  const profitRate = calculateProfitRate(profit, totalAddedPoints);

  return {
    totalAddedPoints,
    totalFeePoints,
    totalVirtualAmount,
    currentApproximatePrice,
    currentValue,
    profit,
    profitRate,
  };
}
