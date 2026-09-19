import {
  calculateFee,
  calculateInvestedPoints,
  calculateApproximatePrice,
  calculateVirtualAmount,
  calculatePortfolioSummary,
} from "./lib/investment";

const addedPoints = 500;
const gldPrice = 410;
const usdJpy = 155;
const fee = calculateFee(addedPoints);
const investedPoints = calculateInvestedPoints(addedPoints);
const approximatePrice = calculateApproximatePrice(gldPrice, usdJpy);
const virtualAmount = calculateVirtualAmount(
  investedPoints,
  approximatePrice,
);
const records = [{
    id: "1",
    date: "2026-09-01",
    addedPoints: 500,
    feePoints: 5,
    investedPoints: 495,
    gldPrice: 410,
    usdJpy: 155,
    approximatePrice: 410*155,
    virtualAmount: 495/(410*155),
  },
  {
    id: "2",
    date: "2026-09-10",
    addedPoints: 1000,
    feePoints: 10,
    investedPoints: 990,
    gldPrice: 420,
    usdJpy: 156,
    approximatePrice:  420*156,
    virtualAmount: 990/(420*156),
  },];
const summary = calculatePortfolioSummary(
  records,
  430, // 現在のGLD
  157, // 現在のUSD/JPY
);
console.log("fee:", fee);
console.log("investedPoints:", investedPoints);
console.log("approximatePrice:", approximatePrice);
console.log("virtualAmount:", virtualAmount);
console.log(summary);

console.log(calculateFee(50));   // 0
console.log(calculateFee(99));   // 0
console.log(calculateFee(100));  // 1
console.log(calculateFee(500));  // 5