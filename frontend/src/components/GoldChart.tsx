import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MarketHistoryPoint } from "../types/market";

export function GoldChart({ data, showSevenDays = false }: {
  data: MarketHistoryPoint[];
  showSevenDays?: boolean;
}) {
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const pricesByDate = new Map(data.map((point) => [point.date, point.price]));
  const today = new Date();
  const chartData = showSevenDays
    ? Array.from({ length: 7 }, (_, index) => {
        const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
        const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        return { date, price: pricesByDate.get(date) ?? null };
      })
    : sortedData;

  if (sortedData.length === 0) return <p>価格履歴がありません。</p>;

  const first = sortedData[0];
  const last = sortedData[sortedData.length - 1];
  const changePercent = sortedData.length >= 2 && first.price > 0
    && Number.isFinite(first.price) && Number.isFinite(last.price)
    ? ((last.price - first.price) / first.price) * 100
    : null;
  const changeText = changePercent !== null && Number.isFinite(changePercent)
    ? `${new Intl.NumberFormat("ja-JP", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: "exceptZero",
      }).format(changePercent)}%`
    : "算出できません（価格データ不足）";

  return (
    <>
      <div aria-live="polite" style={{ marginBottom: 16 }}>
        <p>選択期間の騰落率: <strong>{changeText}</strong></p>
        <p style={{ fontSize: "0.85em" }}>
          {first.date} ～ {last.date}（期間内の最初と最後の終値を比較）
        </p>
      </div>
    <div style={{ width: "100%", minWidth: 0, height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            interval={showSevenDays ? 0 : "preserveEnd"}
            tickFormatter={showSevenDays ? (date: string) => date.slice(5).replace("-", "/") : undefined}
            tick={{ fontSize: 12 }}
          />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="price" name="GLD (USD)" stroke="#b8860b" strokeWidth={2} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
    {showSevenDays && <p style={{ fontSize: "0.85em" }}>本日を含む7日間を表示。休場日など価格のない日は前後の終値を線で結んでいます。</p>}
    </>
  );
}
