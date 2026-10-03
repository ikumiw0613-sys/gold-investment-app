import type { PortfolioSummary } from "../types/investment";
import { formatNumber as number, formatSignedNumber as signed, changeClassName } from "../lib/format";

export function PortfolioOverview({ summary }: { summary: PortfolioSummary }) {
  const valuation = number(summary.currentValue, 2);
  return (
      <section className="portfolio" aria-label="運用サマリー">
        <div className="valuation"><p className="metric-label">推定評価額</p><p className="valuation-number"><span className="valuation-amount" style={{ fontSize: `min(56px, ${125 / valuation.length}cqi)` }}>{valuation}</span><span className="valuation-unit">pt</span></p><p className="muted">GLD価格とドル円から算出</p></div>
        <dl className="summary-details"><div><dt>累計投入ポイント</dt><dd>{number(summary.totalAddedPoints)} <small>pt</small></dd></div><div><dt>評価損益</dt><dd className={changeClassName(summary.profit)}>{signed(summary.profit)} <small>pt</small><span className="profit-rate">{signed(summary.profitRate)}%</span></dd></div><div><dt>累計手数料</dt><dd>{number(summary.totalFeePoints, 2)} <small>pt</small></dd></div></dl>
      </section>
  );
}
