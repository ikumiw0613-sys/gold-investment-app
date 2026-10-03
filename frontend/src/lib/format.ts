export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("ja-JP", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatSignedNumber(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value, 2)}`;
}

export function changeClassName(value: number | null): string {
  if (value === null || value === 0) return "";
  return value < 0 ? "negative" : "positive";
}
