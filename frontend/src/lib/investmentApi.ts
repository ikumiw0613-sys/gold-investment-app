import type { InvestmentRecord } from "../types/investment";

type InvestmentRecordResponse = {
  id: string;
  date: string;
  added_points: number;
  fee_points: number;
  invested_points: number;
  gld_price: number;
  usd_jpy: number;
  approximate_price: number;
  virtual_amount: number;
};

export async function fetchInvestmentRecords(): Promise<InvestmentRecord[]> {
  const response = await fetch("http://127.0.0.1:8000/investments");

  if (!response.ok) {
    throw new Error("Failed to fetch investment records");
  }

  const data: InvestmentRecordResponse[] = await response.json();

  return data.map((record) => ({
    id: record.id,
    date: record.date,
    addedPoints: record.added_points,
    feePoints: record.fee_points,
    investedPoints: record.invested_points,
    gldPrice: record.gld_price,
    usdJpy: record.usd_jpy,
    approximatePrice: record.approximate_price,
    virtualAmount: record.virtual_amount,
  }));
}

export async function saveInvestmentRecord(record: InvestmentRecord) {
  const response = await fetch("http://127.0.0.1:8000/investments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: record.id,
      date: record.date,
      added_points: record.addedPoints,
      fee_points: record.feePoints,
      invested_points: record.investedPoints,
      gld_price: record.gldPrice,
      usd_jpy: record.usdJpy,
      approximate_price: record.approximatePrice,
      virtual_amount: record.virtualAmount,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save investment record");
  }
}