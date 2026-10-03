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
      <div aria-live="polite" className="chart-caption">
        <p>期間騰落率 <strong className={changePercent !== null && changePercent < 0 ? "negative" : "positive"}>{changeText}</strong></p>
        <p style={{ fontSize: "0.85em" }}>
          {first.date} ～ {last.date}
        </p>
      </div>
    <div style={{ width: "100%", minWidth: 0, height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 16, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e4e4db" />
          <XAxis
            dataKey="date"
            interval={showSevenDays ? 0 : "preserveEnd"}
            tickFormatter={(date: string) => date.slice(5).replace("-", "/")}
            axisLine={false} tickLine={false} tickMargin={12}
            tick={{ fontSize: 10, fill: "#72756a" }}
          />
          <YAxis domain={["auto", "auto"]} width={46} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#72756a" }} tickFormatter={(value: number) => value.toFixed(0)} />
          <Tooltip contentStyle={{ background: "#fbfbf8", border: "1px solid #dedfd5", borderRadius: 3, fontSize: 12 }} />
          <Line type="monotone" dataKey="price" name="GLD (USD)" stroke="#9b8145" strokeWidth={2} dot={sortedData.length === 1 ? { r: 4 } : false} activeDot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
    {showSevenDays && <p className="chart-note">本日を含む7日間。休場日は前後の終値を線で結んでいます。</p>}
    </>
  );
}
