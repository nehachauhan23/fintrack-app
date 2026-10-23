import { formatDate, formatMoney } from "@/lib/format";
import type { PeriodStats } from "@/server/services/analytics";

export interface InsightItem {
  title: string;
  detail: string;
  tone: "good" | "watch" | "neutral";
}
export interface InsightPayload {
  headline: string;
  insights: InsightItem[];
  tips: string[];
}

/**
 * Deterministic insights from the same aggregates the AI sees. Used when AI is off, unavailable, or not yet requested,
 * so the dashboard always has something honest to show and never blocks on a model.
 */
export function ruleBasedInsights(stats: PeriodStats, currency: string): InsightPayload {
  const m = (n: number) => formatMoney(n, currency, { hideCents: Math.abs(n) >= 1000 });
  const month = formatDate(`${stats.period}-01`, "month");
  const out: InsightItem[] = [];
  const tips: string[] = [];

  if (stats.income === 0 && stats.expense === 0) {
    return { headline: `No transactions recorded for ${month} yet.`, insights: [{ title: "Nothing to analyse", detail: "Add a few transactions and your insights will appear here.", tone: "neutral" }], tips: [] };
  }

  const headline =
    stats.savingsRate === null
      ? `You spent ${m(stats.expense)} in ${month}.`
      : stats.net >= 0
        ? `You kept ${stats.savingsRate.toFixed(0)}% of your income in ${month}.`
        : `You spent ${m(-stats.net)} more than you earned in ${month}.`;

  out.push({
    title: stats.net >= 0 ? "Cash flow is positive" : "Spending exceeded income",
    detail: `Income ${m(stats.income)}, expenses ${m(stats.expense)}, net ${stats.net < 0 ? "-" : ""}${m(Math.abs(stats.net))}.`,
    tone: stats.net >= 0 ? "good" : "watch",
  });

  const top = stats.categories[0];
  if (top) {
    out.push({ title: `${top.name} is your biggest category`, detail: `${m(top.amount)}, which is ${top.pctOfExpense.toFixed(0)}% of everything you spent.`, tone: top.pctOfExpense > 40 ? "watch" : "neutral" });
  }

  if (stats.previous && stats.previous.expense > 0) {
    const change = ((stats.expense - stats.previous.expense) / stats.previous.expense) * 100;
    out.push({
      title: change > 5 ? "Spending is up" : change < -5 ? "Spending is down" : "Spending is steady",
      detail: `${Math.abs(change).toFixed(0)}% ${change >= 0 ? "more" : "less"} than the previous month (${m(stats.previous.expense)}).`,
      tone: change > 15 ? "watch" : change < -5 ? "good" : "neutral",
    });
  }

  const jump = stats.categories.filter((c) => c.changeVsPrevious !== null && c.changeVsPrevious >= 30 && c.amount >= stats.expense * 0.05).sort((a, b) => (b.changeVsPrevious ?? 0) - (a.changeVsPrevious ?? 0))[0];
  if (jump) {
    out.push({ title: `${jump.name} jumped ${(jump.changeVsPrevious ?? 0).toFixed(0)}%`, detail: `It reached ${m(jump.amount)} this month.`, tone: "watch" });
    tips.push(`Review your ${jump.name.toLowerCase()} spending: it grew the most compared with last month.`);
  }

  if (stats.savingsRate !== null) {
    if (stats.savingsRate < 10) tips.push("Aim to keep at least 10-20% of income. Trimming your largest flexible category is the quickest lever.");
    else if (stats.savingsRate >= 20) tips.push("You're saving well. Consider assigning the surplus to a savings goal so it has a job.");
  }
  return { headline, insights: out.slice(0, 5), tips: tips.slice(0, 3) };
}
