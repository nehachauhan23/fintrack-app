"use client";

import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Money, useMoney } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, Notice, Progress } from "@/components/ui/misc";
import { EXPENSE_CATEGORIES, OVERALL_BUDGET, categoryName } from "@/domain/categories";
import { useRun } from "@/lib/use-run";
import { suggestBudgetsAction } from "@/server/actions/ai";
import { removeBudgetAction, setBudgetAction } from "@/server/actions/finance";
import type { BudgetSuggestion } from "@/server/ai/budget-suggest";
import type { BudgetStatus } from "@/server/services/budgets";

export function BudgetsView({ budgets, aiReady }: { budgets: BudgetStatus[]; aiReady: boolean }) {
  return (
    <div className="space-y-12">
      {budgets.length === 0 ? <p className="text-ink-2">No budgets yet. Add one below, or ask for suggestions based on what you actually spend.</p> : (
        <ul className="divide-y divide-rule border-y border-rule">{budgets.map((b) => <BudgetRow key={b.id} b={b} />)}</ul>
      )}
      <div className="grid gap-12 lg:grid-cols-2"><AddBudget existing={budgets.map((b) => b.category)} /><Suggestions aiReady={aiReady} existing={budgets} /></div>
    </div>
  );
}

function BudgetRow({ b }: { b: BudgetStatus }) {
  const { fmt } = useMoney();
  const { run, pending, errors } = useRun();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(b.limit.toFixed(2));
  const tone = b.level === 100 ? "loss" : b.level === 80 ? "warn" : "accent";

  return (
    <li className="py-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2"><h3 className="display text-2xl">{b.name}</h3>{b.level === 100 && <Badge tone="loss">Over budget</Badge>}{b.level === 80 && <Badge tone="warn">Nearly there</Badge>}</div>
        <p className="num text-ink-2"><span className="font-semibold text-ink">{fmt(b.spent)}</span> of {fmt(b.limit)}</p>
      </div>
      <Progress value={b.pct} tone={tone} label={`${b.name} budget used`} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={b.remaining < 0 ? "text-loss" : "text-ink-3"}>{b.remaining >= 0 ? `${fmt(b.remaining)} left` : `${fmt(-b.remaining)} over`} · {Math.round(b.pct)}% used</span>
        {editing ? (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); run(() => setBudgetAction({ category: b.category, amount }), { success: "Budget updated", onOk: () => setEditing(false) }); }}>
            <Input aria-label="New limit" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="num h-8 w-28" aria-invalid={!!errors.amount} />
            <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="animate-spin" size={13} />} Save</Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        ) : (
          <span className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Change limit</Button><Button variant="ghost" size="icon" aria-label={`Remove ${b.name} budget`} disabled={pending} onClick={() => { if (confirm(`Remove the ${b.name} budget?`)) run(() => removeBudgetAction({ category: b.category }), { success: "Budget removed" }); }}><Trash2 size={14} /></Button></span>
        )}
      </div>
    </li>
  );
}

function AddBudget({ existing }: { existing: string[] }) {
  const { run, pending, errors } = useRun();
  const options = [{ id: OVERALL_BUDGET, name: "Overall (all spending)" }, ...EXPENSE_CATEGORIES.map((c) => ({ id: c.id, name: c.name }))].filter((o) => !existing.includes(o.id));
  const [category, setCategory] = useState(options[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  if (options.length === 0) return null;
  return (
    <section className="border-t border-rule pt-5">
      <h2 className="display mb-4 text-[1.65rem] leading-none">Add a budget</h2>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => setBudgetAction({ category: category || options[0]!.id, amount }), { success: "Budget set", onOk: () => setAmount("") }); }}>
        <Field label="For" htmlFor="b-cat" errors={errors.category}><Select id="b-cat" value={category} onChange={(e) => setCategory(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
        <Field label="Monthly limit" htmlFor="b-amt" errors={errors.amount} hint="You'll get an email at 80% and again at 100%, once each per month."><Input id="b-amt" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="num" /></Field>
        <Button type="submit" disabled={pending || !amount}>{pending && <Loader2 className="animate-spin" size={16} />} Set budget</Button>
      </form>
    </section>
  );
}

function Suggestions({ aiReady, existing }: { aiReady: boolean; existing: BudgetStatus[] }) {
  const { fmt } = useMoney();
  const ask = useRun();
  const apply = useRun();
  const [data, setData] = useState<{ items: BudgetSuggestion[]; source: "ai" | "rules"; aiError?: string } | null>(null);
  const current = new Map(existing.map((b) => [b.category, b.limit]));
  const pendingItems = data?.items.filter((i) => current.get(i.category) !== i.suggested) ?? [];

  return (
    <section className="border-t border-rule pt-5">
      <h2 className="display mb-1 text-[1.65rem] leading-none">Suggested from your history</h2>
      <p className="mb-4 text-ink-2">Limits are worked out from your last three full months of spending. {aiReady ? "AI only writes the explanations, never the numbers." : ""}</p>
      <Button variant="secondary" disabled={ask.pending} onClick={() => ask.run(() => suggestBudgetsAction({ useAi: aiReady }), { refresh: false, onOk: setData })}>
        {ask.pending ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} {data ? "Recalculate" : "Suggest budgets"}
      </Button>
      {data && data.items.length === 0 && <div className="mt-4"><Notice>Not enough history yet. Suggestions need at least two months with spending in a category.</Notice></div>}
      {data?.aiError && <div className="mt-4"><Notice tone="warn">{data.aiError} Showing plain explanations instead.</Notice></div>}
      {data && data.items.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between"><Badge tone={data.source === "ai" ? "accent" : "neutral"}>{data.source === "ai" ? "AI explanations" : "From your numbers"}</Badge>{pendingItems.length > 1 && <Button size="sm" disabled={apply.pending} onClick={() => apply.run(async () => { for (const i of pendingItems) { const r = await setBudgetAction({ category: i.category, amount: i.suggested.toFixed(2) }); if (!r.ok) return r; } return { ok: true as const, data: null }; }, { success: "All suggestions applied" })}>Apply all</Button>}</div>
          <ul className="divide-y divide-rule border-y border-rule">
            {data.items.map((i) => (
              <li key={i.category} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0"><p className="font-medium">{categoryName(i.category)}</p><p className="text-sm text-ink-2">{i.reason}</p></div>
                <div className="flex shrink-0 flex-col items-end gap-1.5"><p className="num font-semibold"><Money value={i.suggested} />{i.current !== null && <span className="ml-1 text-xs font-normal text-ink-3">now {fmt(i.current)}</span>}</p>
                  {current.get(i.category) === i.suggested ? <Badge tone="gain">Applied</Badge> : <Button size="sm" variant="secondary" disabled={apply.pending} onClick={() => apply.run(() => setBudgetAction({ category: i.category, amount: i.suggested.toFixed(2) }), { success: `${categoryName(i.category)} budget set` })}>Apply</Button>}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
