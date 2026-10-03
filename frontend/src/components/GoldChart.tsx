import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MarketHistoryPoint } from "../types/market";

import type { InvestmentMarker } from "../types/investment";

export function GoldChart({ data, markers = [], showSevenDays = false }: {
  data: MarketHistoryPoint[];
  markers?: InvestmentMarker[];
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

  // Include investment-only dates without adding market prices to the line.
  const rowsByDate = new Map<string, { date: string; price: number | null }>(
    chartData.map(point => [point.date, point]),
  );
  const markersByDate = new Map<string, InvestmentMarker[]>();
  for (const marker of markers) {
    if (!rowsByDate.has(marker.date)) rowsByDate.set(marker.date, { date: marker.date, price: null });
    const group = markersByDate.get(marker.date) ?? [];
    group.push(marker);
    markersByDate.set(marker.date, group);
  }
  const displayData = [...rowsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  if (sortedData.length === 0 && markers.length === 0) return <p>価格履歴がありません。</p>;

  const first = sortedData[0];
  const last = sortedData[sortedData.length - 1];
  const changePercent = first && last && sortedData.length >= 2 && first.price > 0
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
          {first && last ? `${first.date} ～ ${last.date}` : "価格データ不足"}
        </p>
      </div>
    <div style={{ width: "100%", minWidth: 0, height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData} margin={{ top: 16, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e4e4db" />
          <XAxis
            dataKey="date"
            interval={showSevenDays ? 0 : "preserveEnd"}
            tickFormatter={(date: string) => date.slice(5).replace("-", "/")}
            axisLine={false} tickLine={false} tickMargin={12}
            tick={{ fontSize: 10, fill: "#72756a" }}
          />
          <YAxis domain={["auto", "auto"]} width={46} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#72756a" }} tickFormatter={(value: number) => value.toFixed(0)} />
          <Tooltip content={({ active, label }) => {
            if (!active || label == null) return null;
            const date = String(label);
            const price = pricesByDate.get(date);
            const investments = markersByDate.get(date) ?? [];
            return <div style={{ background: "#fbfbf8", border: "1px solid #dedfd5", padding: 12, fontSize: 12 }}>
              <p>{date}</p>
              {price !== undefined && <p>GLD: {price.toLocaleString("ja-JP")} USD</p>}
              {investments.map(marker => <p key={marker.id}>
                投資日: {marker.date}<br />
                追加ポイント: {marker.addedPoints.toLocaleString("ja-JP")} pt<br />
                投資時GLD: {marker.price.toLocaleString("ja-JP")} USD
              </p>)}
            </div>;
          }} />
          {[...markersByDate].flatMap(([date, investments]) => {
            // Identical coordinates share one visible dot; the tooltip retains every record.
            const prices = [...new Set(investments.map(marker => marker.price))];
            const description = investments.map(marker =>
              `投資日: ${marker.date} / 追加ポイント: ${marker.addedPoints} pt / 投資時GLD: ${marker.price} USD`,
            ).join("\n");
            return prices.map((price, index) => <ReferenceDot
              key={`${date}-${price}`} x={date} y={price} ifOverflow="extendDomain"
              shape={({ cx, cy }) => <g tabIndex={0} role="img" aria-label={description}>
                <title>{description}</title>
                <circle cx={cx} cy={cy} r={6} fill="#346b55" stroke="#fff" strokeWidth={2} />
                {index === 0 && investments.length > 1 && <text x={cx} y={(cy ?? 0) - 10} textAnchor="middle" fill="#346b55" fontSize={11}>{investments.length}件</text>}
              </g>}
            />);
          })}
          <Line type="monotone" dataKey="price" name="GLD (USD)" stroke="#9b8145" strokeWidth={2} dot={sortedData.length === 1 ? { r: 4 } : false} activeDot={{ r: 4 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
    {markers.length > 0 && <p className="chart-note">緑の点は投資記録です。ホバーで同日の全記録を確認できます。</p>}
    {showSevenDays && <p className="chart-note">本日を含む7日間。休場日は前後の終値を線で結んでいます。</p>}
    </>
  );
}
