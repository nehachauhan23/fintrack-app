import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Landmark, TrendingUp } from "lucide-react";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Progress, Section, Stat } from "@/components/ui/misc";
import { InsightCard } from "@/features/dashboard/insight-card";
import { categoryColor, categoryName } from "@/domain/categories";
import { addMonths, monthBounds, periodKeyOf, utcToday } from "@/domain/periods";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { getMonthlyInsight } from "@/server/ai/insights";
import { requireUser } from "@/server/auth/dal";
import { listAccounts, netWorth } from "@/server/services/accounts";
import { cashFlow, categoryBreakdown, detectAnomalies, monthSummary, outlook } from "@/server/services/analytics";
import { budgetStatuses } from "@/server/services/budgets";
import { upcomingRecurring } from "@/server/services/recurring";
import { recentTransactions } from "@/server/services/transactions";

export const metadata: Metadata = { title: "Overview" };

const change = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

export default async function Dashboard() {
  const user = await requireUser();
  const cur = user.currency;
  const m = (n: number, o?: Parameters<typeof formatMoney>[2]) => formatMoney(n, cur, o);
  const now = new Date();
  const period = periodKeyOf(utcToday(now));
  const bounds = monthBounds(period);

  const [accounts, worth, summary, prev, flow, cats, budgets, recent, upcoming, anomalies, insight] = await Promise.all([
    listAccounts(user.id),
    netWorth(user.id),
    monthSummary(user.id, period),
    monthSummary(user.id, addMonths(period, -1)),
    cashFlow(user.id, period, 6),
    categoryBreakdown(user.id, { from: bounds.start, toExclusive: bounds.endExclusive }),
    budgetStatuses(user.id, period),
    recentTransactions(user.id, 8),
    upcomingRecurring(user.id, 30, now),
    detectAnomalies(user.id, now),
    getMonthlyInsight(user, period),
  ]);

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Welcome" description="Let's set up your ledger. It starts with an account." />
        <EmptyState icon={<Landmark size={26} />} title="Add your first account" body="A bank account, a wallet, a credit card: anything that holds money. Opening balances can be zero or negative, and you can add the rest as you go." action={<LinkButton href="/accounts">Create an account <ArrowRight size={16} /></LinkButton>} />
      </>
    );
  }

  const o = outlook(summary, now);
  const spendChange = change(summary.expense, prev.expense);
  const alerts = anomalies.spikes.length + anomalies.outliers.length + anomalies.duplicates.length;
  const overall = budgets.find((b) => b.category === "all");

  return (
    <>
      <PageHeader title="Overview" description={`${formatDate(bounds.start, "month")}, so far`} />

      <div className="rise grid items-end gap-x-12 gap-y-6 lg:grid-cols-[auto_1fr]">
        <div>
          <p className="eyebrow">Net worth</p>
          <p className="display num text-[3.6rem] leading-none sm:text-[4.6rem]">{m(worth, { hideCents: Math.abs(worth) >= 100000 })}</p>
          <p className="mt-1 text-sm text-ink-3">across {accounts.length} account{accounts.length === 1 ? "" : "s"}</p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Stat label="Income" value={m(summary.income)} tone={summary.income > 0 ? "gain" : undefined} />
          <Stat label="Spending" value={m(summary.expense)} hint={spendChange === null ? undefined : `${spendChange >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(spendChange))} vs last month`} />
          <Stat label="Left over" value={m(summary.net, { signed: true })} tone={summary.net > 0 ? "gain" : summary.net < 0 ? "loss" : undefined} hint={summary.savingsRate === null ? undefined : `${formatPercent(summary.savingsRate)} of income`} />
        </div>
      </div>

      {o.projectedExpense > 0 && summary.expense > 0 && (
        <p className="rise rise-2 mt-5 flex items-center gap-2 text-sm text-ink-2">
          <TrendingUp size={15} className="text-accent" aria-hidden />
          At this pace you&apos;ll spend about <strong className="num font-semibold text-ink">{m(o.projectedExpense, { hideCents: true })}</strong> by month end.
          {overall && <span className="text-ink-3">Overall budget: {m(overall.limit, { hideCents: true })}.</span>}
        </p>
      )}

      {alerts > 0 && (
        <div className="rise rise-2 mt-8 rounded-md border border-warn/40 bg-warn-soft px-5 py-4">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} className="text-warn" aria-hidden /> Worth a look</p>
          <ul className="mt-2 space-y-1 text-sm">
            {anomalies.spikes.map((s) => <li key={s.category}><strong>{s.name}</strong> is already at {m(s.spent, { hideCents: true })}, about {s.ratio.toFixed(1)}× the {m(s.baseline, { hideCents: true })} you usually have spent by this point in the month.</li>)}
            {anomalies.outliers.slice(0, 3).map((t) => <li key={t.id}>An unusually large <strong>{categoryName(t.category)}</strong> charge: {t.label} for {m(t.amount)} on {formatDate(t.date)} (typical: {m(t.typical, { hideCents: true })}).</li>)}
            {anomalies.duplicates.map((d) => <li key={d.secondId}>Possible double charge: <strong>{d.label}</strong> for {m(d.amount)} appears twice within a few days (latest {formatDate(d.date)}).</li>)}
          </ul>
        </div>
      )}

      <div className="rise rise-3 mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <Section title="Cash flow" eyebrow="Last 6 months">
          <CashFlowChart data={flow.map((f) => ({ label: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${f.period}-01T00:00:00Z`)), income: f.income, expense: f.expense }))} />
        </Section>
        <Section title="Where it went" eyebrow="This month">
          <CategoryDonut total={summary.expense} data={cats.map((c) => ({ name: c.name, amount: c.amount, pct: c.pct, color: categoryColor(c.category) }))} />
        </Section>
      </div>

      <Section title="This month in words" className="rise rise-3 mt-10">
        <InsightCard initial={insight} period={period} />
      </Section>

      <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <Section title="Budgets" action={<Link href="/budgets" className="text-sm font-medium text-accent hover:underline">Manage</Link>}>
          {budgets.length === 0 ? (
            <p className="text-ink-2">No budgets yet. <Link href="/budgets" className="font-medium text-accent hover:underline">Set one</Link>, or let FinTrack suggest limits from your history.</p>
          ) : (
            <ul className="space-y-4">
              {budgets.slice(0, 4).map((b) => (
                <li key={b.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3"><span className="font-medium">{b.name}</span><span className="num text-sm text-ink-2">{m(b.spent, { hideCents: true })} of {m(b.limit, { hideCents: true })}</span></div>
                  <Progress value={b.pct} tone={b.level === 100 ? "loss" : b.level === 80 ? "warn" : "accent"} label={`${b.name} budget`} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Coming up" eyebrow="Next 30 days" action={<Link href="/recurring" className="text-sm font-medium text-accent hover:underline">All recurring</Link>}>
          {upcoming.length === 0 ? (
            <p className="text-ink-2">Nothing scheduled. Recurring rules for rent, salary or subscriptions will show up here.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {upcoming.slice(0, 6).map((u) => (
                <li key={`${u.ruleId}-${u.date}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><p className="truncate font-medium">{u.label}</p><p className="text-[13px] text-ink-3">{formatDate(u.date, "long")}</p></div>
                  <span className={`num font-medium ${u.type === "INCOME" ? "text-gain" : ""}`}>{u.type === "INCOME" ? "+" : "−"}{m(u.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Recent activity" className="mt-10" action={<Link href="/transactions" className="flex items-center gap-1 text-sm font-medium text-accent hover:underline">All transactions <ArrowRight size={14} /></Link>}>
        {recent.length === 0 ? (
          <p className="text-ink-2">No transactions yet. Use “Add transaction” above: type it, scan a receipt, or describe it in a sentence.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {recent.map((t) => (
              <li key={t.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                <span className="num text-sm text-ink-3">{formatDate(t.date)}</span>
                <div className="min-w-0"><p className="truncate">{t.merchant || t.description || categoryName(t.category)}</p><p className="flex items-center gap-1.5 text-[13px] text-ink-3">{categoryName(t.category)} · {t.accountName}{t.aiCategorized && <Badge tone="accent">AI</Badge>}</p></div>
                <span className={`num font-medium ${t.type === "INCOME" ? "text-gain" : t.isTransfer ? "text-ink-3" : ""}`}>{t.type === "INCOME" || t.type === "TRANSFER_IN" ? "+" : "−"}{m(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
