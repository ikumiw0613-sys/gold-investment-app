import { useState } from "react";
import {
  calculateFee,
  calculateInvestedPoints,
  calculateApproximatePrice,
  calculateVirtualAmount,
} from "../lib/investment";


import type { MarketData } from "../types/market";
import type { InvestmentRecord } from "../types/investment";

type Props = {
  marketData: MarketData;
  onSubmitRecord: (record: InvestmentRecord) => void | Promise<void>;
};

function getToday() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


export function InvestmentForm({ marketData, onSubmitRecord }: Props) {
  const [date, setDate] = useState(getToday());
  const [addedPoints, setAddedPoints] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const points = Number(addedPoints);


    if (!date) {
      alert("追加日を入力してください");
      return;
    }

    if (!addedPoints || points <= 0) {
      alert("追加ポイントは1以上を入力してください");
      return;
    }

    const fee = calculateFee(points);
    const investedPoints = calculateInvestedPoints(points);
    const approximatePrice = calculateApproximatePrice(
      marketData.gldPrice,
      marketData.usdJpy,
    );
    const virtualAmount = calculateVirtualAmount(
      investedPoints,
      approximatePrice,
    );
    const record = {
      id: crypto.randomUUID(),
      date,
      addedPoints: points,
      feePoints: fee,
      investedPoints,
      gldPrice: marketData.gldPrice,
      usdJpy: marketData.usdJpy,
      approximatePrice,
      virtualAmount,
    };

    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmitRecord(record);
      setDate(getToday());
      setAddedPoints("");
    } catch {
      setError("保存できませんでした。入力内容を残しています。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }


  return (

    <form className="investment-form" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="date">追加日</label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="points">追加ポイント</label>
        <input
          id="points"
          type="number"
          min="1"
          placeholder="例：1000"
          value={addedPoints}
          onChange={(event) => setAddedPoints(event.target.value)}
          required
        />
      </div>

      <p className="form-fee">手数料の目安 <strong>{calculateFee(Math.max(0, Number(addedPoints) || 0)).toLocaleString("ja-JP")} pt</strong></p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="submit-button" type="submit" disabled={saving}>{saving ? "保存中…" : "記録する"}</button>
    </form>
  );
}
