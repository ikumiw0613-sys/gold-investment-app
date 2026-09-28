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

export function GoldChart({ data }: { data: MarketHistoryPoint[] }) {
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));

  if (sortedData.length === 0) return <p>価格履歴がありません。</p>;

  return (
    <div style={{ width: "100%", minWidth: 0, height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sortedData} margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="price" name="GLD (USD)" stroke="#b8860b" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
