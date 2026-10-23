import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { LinkButton } from "@/components/ui/button";
import { PageHeader, Section, Stat } from "@/components/ui/misc";
import { categoryColor } from "@/domain/categories";
import { addMonths, formatDateOnly, monthBounds, parsePeriodKey, periodKeyOf, utcToday, addDays } from "@/domain/periods";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { requireUser } from "@/server/auth/dal";
import { cashFlow, categoryBreakdown, monthSummary, topMerchants } from "@/server/services/analytics";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireUser();
  const { period: raw } = await searchParams;
  const current = periodKeyOf(utcToday());
  const period = raw && parsePeriodKey(raw) && raw <= current ? raw : current;
  const { start, endExclusive } = monthBounds(period);
  const range = { from: start, toExclusive: endExclusive };
  const m = (n: number, o?: Parameters<typeof formatMoney>[2]) => formatMoney(n, user.currency, o);

  const [summary, prev, expenseCats, incomeCats, merchants, flow] = await Promise.all([
    monthSummary(user.id, period),
    monthSummary(user.id, addMonths(period, -1)),
    categoryBreakdown(user.id, range, "EXPENSE"),
    categoryBreakdown(user.id, range, "INCOME"),
    topMerchants(user.id, range, 6),
    cashFlow(user.id, period, 12),
  ]);
  const last = formatDateOnly(addDays(endExclusive, -1));
  const first = formatDateOnly(start);
  const delta = (cur: number, before: number) => (before > 0 ? `${cur >= before ? "▲" : "▼"} ${formatPercent(Math.abs(((cur - before) / before) * 100))} vs previous month` : undefined);

  return (
    <>
      <PageHeader title="Reports" description={formatDate(start, "month")} action={
        <>
          <nav aria-label="Month" className="flex items-center gap-1">
            <Link aria-label="Previous month" href={`/reports?period=${addMonths(period, -1)}`} className="grid h-9 w-9 place-items-center rounded-[5px] border border-rule hover:bg-accent-soft"><ChevronLeft size={16} /></Link>
            {period < current ? <Link aria-label="Next month" href={`/reports?period=${addMonths(period, 1)}`} className="grid h-9 w-9 place-items-center rounded-[5px] border border-rule hover:bg-accent-soft"><ChevronRight size={16} /></Link> : <span aria-hidden className="grid h-9 w-9 place-items-center rounded-[5px] border border-rule text-ink-3 opacity-40"><ChevronRight size={16} /></span>}
          </nav>
          <LinkButton variant="secondary" href={`/api/export/transactions?from=${first}&to=${last}`}><Download size={16} /> Export month</LinkButton>
        </>
      } />

      <div className="rise grid max-w-3xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        <Stat label="Income" value={m(summary.income)} tone={summary.income > 0 ? "gain" : undefined} hint={delta(summary.income, prev.income)} />
        <Stat label="Spending" value={m(summary.expense)} hint={delta(summary.expense, prev.expense)} />
        <Stat label="Net" value={m(summary.net, { signed: true })} tone={summary.net > 0 ? "gain" : summary.net < 0 ? "loss" : undefined} />
        <Stat label="Savings rate" value={summary.savingsRate === null ? "n/a" : formatPercent(summary.savingsRate)} hint={summary.savingsRate === null ? "No income recorded" : undefined} />
      </div>

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <Section title="Spending by category"><CategoryDonut total={summary.expense} data={expenseCats.map((c) => ({ name: c.name, amount: c.amount, pct: c.pct, color: categoryColor(c.category) }))} /></Section>
        <Section title="Top merchants">
          {merchants.length === 0 ? <p className="text-ink-2">Nothing to rank for this month.</p> : (
            <ul className="divide-y divide-rule">{merchants.map((x) => <li key={x.name} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate font-medium">{x.name}</p><p className="text-[13px] text-ink-3">{x.count} transaction{x.count === 1 ? "" : "s"}</p></div><span className="num font-medium">{m(x.amount)}</span></li>)}</ul>
          )}
        </Section>
      </div>

      <Section title="Twelve months" eyebrow="Income and spending" className="mt-10">
        <CashFlowChart height={260} data={flow.map((f) => ({ label: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${f.period}-01T00:00:00Z`)), income: f.income, expense: f.expense }))} />
      </Section>

      {(expenseCats.length > 0 || incomeCats.length > 0) && (
        <Section title="Every category" className="mt-10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead><tr className="eyebrow border-b border-rule text-left"><th className="py-2 pr-3 font-semibold">Category</th><th className="py-2 pr-3 text-right font-semibold">Entries</th><th className="py-2 pr-3 text-right font-semibold">Share</th><th className="py-2 text-right font-semibold">Amount</th></tr></thead>
              <tbody>
                {[...incomeCats.map((c) => ({ ...c, kind: "in" as const })), ...expenseCats.map((c) => ({ ...c, kind: "out" as const }))].map((c) => (
                  <tr key={`${c.kind}-${c.category}`} className="border-b border-rule/70">
                    <td className="py-2.5 pr-3"><Link className="inline-flex items-center gap-2 hover:text-accent" href={`/transactions?category=${c.category}&from=${first}&to=${last}`}><i aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: categoryColor(c.category) }} />{c.name}</Link></td>
                    <td className="num py-2.5 pr-3 text-right text-ink-3">{c.count}</td>
                    <td className="num py-2.5 pr-3 text-right text-ink-3">{formatPercent(c.pct)}</td>
                    <td className={`num py-2.5 text-right font-medium ${c.kind === "in" ? "text-gain" : ""}`}>{c.kind === "in" ? "+" : "−"}{m(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}
