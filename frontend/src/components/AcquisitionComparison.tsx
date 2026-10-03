import type { InvestmentRecord } from "../types/investment";
import { calculateAverageAcquisitionPrice, calculatePriceDifference, calculatePriceDeviationRate } from "../lib/investment";
import { formatNumber as number, formatSignedNumber as signed, changeClassName } from "../lib/format";

type Props = {
  records: InvestmentRecord[];
  currentGldPrice: number;
  currentApproximatePrice: number;
};

export function AcquisitionComparison({ records, currentGldPrice, currentApproximatePrice }: Props) {
  const averagePrice = calculateAverageAcquisitionPrice(records);
  const priceDifference = calculatePriceDifference(currentApproximatePrice, averagePrice);
  const priceDeviation = calculatePriceDeviationRate(currentApproximatePrice, averagePrice);
  return (
      <section className="history-section" aria-label="平均取得価格との比較">
        <div className="section-heading"><h2>平均取得価格との比較</h2></div>
        <dl className="market-quotes acquisition-quotes">
          <div><dt>平均取得価格</dt><dd>{averagePrice === null ? "—" : number(averagePrice, 2)} <small>pt/口</small></dd></div>
          <div><dt>現在GLD価格</dt><dd>${number(currentGldPrice, 2)} <small>USD</small></dd></div>
          <div><dt>現在価格（円換算相当）</dt><dd>{number(currentApproximatePrice, 2)} <small>pt/口</small></dd></div>
          <div><dt>平均取得価格との差</dt><dd className={changeClassName(priceDifference)}>{priceDifference === null ? "—" : signed(priceDifference)} <small>pt/口</small></dd></div>
          <div><dt>乖離率</dt><dd className={changeClassName(priceDeviation)}>{priceDeviation === null ? "—" : `${signed(priceDeviation)}%`}</dd></div>
        </dl>
        <p className="data-note">平均取得価格は累計運用ポイント ÷ 累計仮想保有量。現在GLD価格をドル円で換算して比較するため、乖離率には為替の変動も含まれます。</p>
      </section>
  );
}
