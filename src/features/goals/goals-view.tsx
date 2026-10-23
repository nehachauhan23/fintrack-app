"use client";

import { Archive, CheckCircle2, Loader2, Plus, Target } from "lucide-react";
import { useState } from "react";
import { useMoney } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Badge, EmptyState, Progress } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { localToday, useRun } from "@/lib/use-run";
import { archiveGoalAction, contributeToGoalAction, createGoalAction } from "@/server/actions/finance";
import type { GoalView } from "@/server/services/goals";

export function NewGoalDialog({ first }: { first?: boolean }) {
  const [open, setOpen] = useState(false);
  const { run, pending, errors } = useRun();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus size={16} /> {first ? "Create a goal" : "New goal"}</Button></DialogTrigger>
      <DialogContent title="New savings goal" description="Goals are earmarks: they track progress without moving money between accounts.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => createGoalAction({ name, targetAmount: target, deadline: deadline || null }), { success: "Goal created", onOk: () => { setOpen(false); setName(""); setTarget(""); setDeadline(""); } }); }}>
          <Field label="What are you saving for?" htmlFor="g-name" errors={errors.name}><Input id="g-name" value={name} maxLength={80} placeholder="e.g. Emergency fund" onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Target amount" htmlFor="g-target" errors={errors.targetAmount}><Input id="g-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="num" /></Field>
          <Field label="Deadline (optional)" htmlFor="g-deadline" errors={errors.deadline}><Input id="g-deadline" type="date" value={deadline} min={localToday()} onChange={(e) => setDeadline(e.target.value)} /></Field>
          <div className="flex justify-end"><Button type="submit" disabled={pending || !name.trim() || !target}>{pending && <Loader2 className="animate-spin" size={16} />} Create goal</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContributeDialog({ goal }: { goal: GoalView }) {
  const [open, setOpen] = useState(false);
  const { run, pending, errors } = useRun();
  const [kind, setKind] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary" size="sm">Add or withdraw</Button></DialogTrigger>
      <DialogContent title={goal.name}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => contributeToGoalAction({ id: goal.id, kind, amount, note: note || undefined, date: localToday() }), { success: kind === "deposit" ? "Added to goal" : "Withdrawn", onOk: () => { setOpen(false); setAmount(""); setNote(""); } }); }}>
          <div role="radiogroup" aria-label="Action" className="inline-flex rounded-[5px] border border-rule p-0.5">
            {(["deposit", "withdraw"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded px-4 py-1.5 text-sm font-medium ${kind === k ? "bg-accent text-accent-ink" : "text-ink-2"}`}>{k === "deposit" ? "Add money" : "Withdraw"}</button>)}
          </div>
          <Field label="Amount" htmlFor="gc-amt" errors={errors.amount}><Input id="gc-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="num" autoFocus /></Field>
          <Field label="Note (optional)" htmlFor="gc-note"><Input id="gc-note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="flex justify-end"><Button type="submit" disabled={pending || !amount}>{pending && <Loader2 className="animate-spin" size={16} />} {kind === "deposit" ? "Add" : "Withdraw"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GoalsView({ goals }: { goals: GoalView[] }) {
  const { fmt } = useMoney();
  const { run, pending } = useRun();
  if (goals.length === 0) return <EmptyState icon={<Target size={26} />} title="No goals yet" body="A goal turns “I should save more” into a number and a date. Start with something specific." action={<NewGoalDialog first />} />;
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {goals.map((g) => (
        <li key={g.id} className="py-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2"><h3 className="display text-2xl">{g.name}</h3>{g.completed && <Badge tone="gain"><CheckCircle2 size={11} /> Reached</Badge>}</div>
            <p className="num text-ink-2"><span className="text-xl font-semibold text-ink">{fmt(g.saved)}</span> of {fmt(g.target)}</p>
          </div>
          <Progress value={g.pct} tone={g.completed ? "gain" : "accent"} label={`${g.name} progress`} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink-3">{g.completed ? "Nicely done." : `${fmt(g.remaining)} to go`}{g.deadline && !g.completed ? ` · by ${formatDate(g.deadline, "long")}` : ""}{g.monthlyNeeded !== null && ` · about ${fmt(g.monthlyNeeded, { hideCents: true })} a month`}</span>
            <span className="flex gap-1"><ContributeDialog goal={g} /><Button variant="ghost" size="icon" aria-label={`Archive ${g.name}`} disabled={pending} onClick={() => { if (confirm(`Archive “${g.name}”?`)) run(() => archiveGoalAction({ id: g.id }), { success: "Goal archived" }); }}><Archive size={14} /></Button></span>
          </div>
        </li>
      ))}
    </ul>
  );
}
