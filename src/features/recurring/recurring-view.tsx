"use client";

import { Loader2, Pause, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, EmptyState, Notice } from "@/components/ui/misc";
import { categoryName } from "@/domain/categories";
import { formatDate } from "@/lib/format";
import { INTERVAL_LABEL } from "@/lib/labels";
import { localToday, useRun } from "@/lib/use-run";
import { createRuleAction, deleteRuleAction, updateRuleAction } from "@/server/actions/finance";
import type { RecurringView, SubscriptionSuggestion } from "@/server/services/recurring";
import type { AccountOption } from "@/features/transactions/add-transaction";
import { CategorySelect } from "@/features/transactions/category-select";

export function NewRuleDialog({ accounts, first }: { accounts: AccountOption[]; first?: boolean }) {
  const [open, setOpen] = useState(false);
  const { run, pending, errors } = useRun();
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("housing");
  const [description, setDescription] = useState("");
  const [interval, setIntervalValue] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">("MONTHLY");
  const [startDate, setStartDate] = useState(localToday());
  const [endDate, setEndDate] = useState("");
  const [accountId, setAccountId] = useState((accounts.find((a) => a.isDefault) ?? accounts[0])?.id ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button disabled={accounts.length === 0}><Plus size={16} /> {first ? "Create a rule" : "New rule"}</Button></DialogTrigger>
      <DialogContent title="New recurring entry" description="Rent, salary, subscriptions: posted automatically on schedule. Dates in the past are filled in right away." wide>
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); run(() => createRuleAction({ accountId, type, amount, category, description: description || undefined, interval, startDate, endDate: endDate || null }), { success: "Recurring rule created", onOk: () => { setOpen(false); setAmount(""); setDescription(""); } }); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="r-type"><Select id="r-type" value={type} onChange={(e) => { const t = e.target.value as "INCOME" | "EXPENSE"; setType(t); setCategory(t === "INCOME" ? "salary" : "housing"); }}><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></Select></Field>
            <Field label="Amount" htmlFor="r-amt" errors={errors.amount}><Input id="r-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="num" /></Field>
            <Field label="Description" htmlFor="r-desc" errors={errors.description} className="sm:col-span-2"><Input id="r-desc" value={description} maxLength={120} placeholder="e.g. Rent, Netflix" onChange={(e) => setDescription(e.target.value)} /></Field>
            <Field label="Category" htmlFor="r-cat" errors={errors.category}><CategorySelect id="r-cat" type={type} value={category} onChange={setCategory} /></Field>
            <Field label="Account" htmlFor="r-acc"><Select id="r-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            <Field label="Repeats" htmlFor="r-int"><Select id="r-int" value={interval} onChange={(e) => setIntervalValue(e.target.value as typeof interval)}>{Object.entries(INTERVAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
            <Field label="Starts" htmlFor="r-start" errors={errors.startDate}><Input id="r-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Ends (optional)" htmlFor="r-end" errors={errors.endDate}><Input id="r-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          </div>
          <div className="flex justify-end"><Button type="submit" disabled={pending || !amount || !accountId}>{pending && <Loader2 className="animate-spin" size={16} />} Create rule</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecurringView({ rules, suggestions, accounts }: { rules: RecurringView[]; suggestions: SubscriptionSuggestion[]; accounts: AccountOption[] }) {
  const { run, pending } = useRun();
  return (
    <div className="space-y-12">
      {suggestions.length > 0 && (
        <section>
          <h2 className="display mb-1 text-[1.65rem] leading-none">Spotted in your history</h2>
          <p className="mb-4 text-ink-2">These charges repeat at a steady rhythm. Track them to see them coming. (Detected from your own data, no AI involved.)</p>
          <ul className="divide-y divide-rule border-y border-rule">
            {suggestions.map((s) => (
              <li key={`${s.merchantKey}-${s.amount}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="font-medium">{s.label}</p><p className="text-sm text-ink-3">{INTERVAL_LABEL[s.interval]} · seen {s.occurrences} times · next around {formatDate(s.nextExpected, "long")}</p></div>
                <div className="flex items-center gap-3"><Money value={s.amount} className="font-medium" />
                  <Button size="sm" variant="secondary" disabled={pending || !s.accountId} onClick={() => run(() => createRuleAction({ accountId: s.accountId, type: "EXPENSE", amount: s.amount.toFixed(2), category: s.category, description: s.label, interval: s.interval, startDate: s.nextExpected }), { success: `Tracking ${s.label}` })}>Track this</Button></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rules.length === 0 ? (
        <EmptyState icon={<Repeat size={26} />} title="Nothing recurring yet" body="Add rent, salary or a subscription once and it will post itself every period, and show up in “Coming up”." action={<NewRuleDialog accounts={accounts} first />} />
      ) : (
        <section>
          <ul className="divide-y divide-rule border-y border-rule">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">{r.description || categoryName(r.category)} {!r.isActive && <Badge tone="warn">{r.endDate && r.nextRunOn > r.endDate ? "Ended" : "Paused"}</Badge>}</p>
                  <p className="text-sm text-ink-3">{INTERVAL_LABEL[r.interval]} · {categoryName(r.category)} · {r.accountName}{r.isActive && <> · next {formatDate(r.nextRunOn, "long")}</>}{r.endDate && <> · until {formatDate(r.endDate)}</>}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`num mr-2 text-lg font-semibold ${r.type === "INCOME" ? "text-gain" : ""}`}>{r.type === "INCOME" ? "+" : "−"}<Money value={r.amount} /></span>
                  <Button variant="ghost" size="icon" aria-label={r.isActive ? "Pause" : "Resume"} disabled={pending} onClick={() => run(() => updateRuleAction({ id: r.id, isActive: !r.isActive }), { success: r.isActive ? "Paused" : "Resumed" })}>{r.isActive ? <Pause size={15} /> : <Play size={15} />}</Button>
                  <Button variant="ghost" size="icon" aria-label="Delete" disabled={pending} onClick={() => { if (confirm("Delete this rule? Entries it already posted stay in your ledger.")) run(() => deleteRuleAction({ id: r.id }), { success: "Rule deleted" }); }}><Trash2 size={15} /></Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4"><Notice>Rules run every night. If the server was offline, missed entries are caught up the next time, and never posted twice.</Notice></div>
        </section>
      )}
    </div>
  );
}
