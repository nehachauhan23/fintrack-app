import { formatDate, formatMoney } from "@/lib/format";
import type { Metric } from "@/domain/query";

/** A plain-language sentence built from database numbers only, so the assistant can never invent a figure. */
export function describeAnswer(a: {
  metric: Metric;
  total: number;
  count: number;
  from: string;
  to: string;
  scope: string | null;
  currency: string;
  previousTotal?: number | null;
}): string {
  const money = formatMoney(Math.abs(a.total), a.currency);
  const period = a.from === a.to ? `on ${formatDate(a.from, "long")}` : `between ${formatDate(a.from, "long")} and ${formatDate(a.to, "long")}`;
  const scope = a.scope ? ` ${a.scope}` : "";
  let sentence: string;
  switch (a.metric) {
    case "expense":
      sentence = a.count === 0 ? `You had no spending${scope} ${period}.` : `You spent ${money}${scope} ${period} across ${a.count} transaction${a.count === 1 ? "" : "s"}.`;
      break;
    case "income":
      sentence = a.count === 0 ? `You had no income${scope} ${period}.` : `You earned ${money}${scope} ${period} across ${a.count} transaction${a.count === 1 ? "" : "s"}.`;
      break;
    case "net":
      sentence = `Your net cash flow${scope} ${period} was ${a.total < 0 ? "-" : ""}${money} (${a.count} transaction${a.count === 1 ? "" : "s"}).`;
      break;
    case "count":
      sentence = `You had ${a.count} transaction${a.count === 1 ? "" : "s"}${scope} ${period}.`;
      break;
  }
  if (a.previousTotal !== undefined && a.previousTotal !== null && a.metric !== "count") {
    if (a.previousTotal === 0) sentence += " There was nothing to compare with in the previous period.";
    else {
      const change = ((a.total - a.previousTotal) / Math.abs(a.previousTotal)) * 100;
      sentence += ` That's ${Math.abs(change).toFixed(0)}% ${change >= 0 ? "higher" : "lower"} than the previous period.`;
    }
  }
  return sentence;
}
