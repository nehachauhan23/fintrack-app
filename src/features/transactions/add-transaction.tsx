"use client";

import { Camera, Loader2, Plus, Sparkles, Trash2, Type, PenLine } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, Notice } from "@/components/ui/misc";
import { categoriesFor, categoryName } from "@/domain/categories";
import { cn } from "@/lib/utils";
import { localToday, useRun } from "@/lib/use-run";
import { createTransactionAction } from "@/server/actions/finance";
import { parseEntryAction, scanReceiptAction } from "@/server/actions/ai";
import type { EntryDraft } from "@/server/ai/nl-entry";
import { CategorySelect } from "./category-select";
import { prepareReceiptImage } from "./image-prep";
import { useMoney } from "@/components/money";

export interface AccountOption {
  id: string;
  name: string;
  isDefault?: boolean;
}

type Tab = "manual" | "receipt" | "describe";
interface FormState {
  type: "INCOME" | "EXPENSE";
  amount: string;
  accountId: string;
  date: string;
  category: string;
  description: string;
  merchant: string;
  source: "MANUAL" | "RECEIPT_SCAN" | "AI_ENTRY";
  aiCategorized: boolean;
}

const blank = (accounts: AccountOption[]): FormState => ({
  type: "EXPENSE",
  amount: "",
  accountId: (accounts.find((a) => a.isDefault) ?? accounts[0])?.id ?? "",
  date: localToday(),
  category: "",
  description: "",
  merchant: "",
  source: "MANUAL",
  aiCategorized: false,
});

export function AddTransaction({ accounts, aiReady, trigger }: { accounts: AccountOption[]; aiReady: boolean; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("manual");
  const [form, setForm] = useState<FormState>(() => blank(accounts));
  const [note, setNote] = useState<string | null>(null);
  const { run, pending, errors } = useRun();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const reset = () => {
    setForm(blank(accounts));
    setTab("manual");
    setNote(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(
      () =>
        createTransactionAction({
          accountId: form.accountId,
          type: form.type,
          amount: form.amount,
          date: form.date,
          category: form.category || undefined,
          description: form.description || undefined,
          merchant: form.merchant || undefined,
          source: form.source,
          aiCategorized: form.aiCategorized,
        }),
      { success: "Transaction added", onOk: () => { setOpen(false); reset(); } },
    );
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; ai?: boolean }[] = [
    { id: "manual", label: "Manual", icon: <PenLine size={15} /> },
    { id: "receipt", label: "Scan receipt", icon: <Camera size={15} />, ai: true },
    { id: "describe", label: "Describe it", icon: <Type size={15} />, ai: true },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button disabled={accounts.length === 0} title={accounts.length === 0 ? "Create an account first" : undefined}>
            <Plus size={16} /> Add transaction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title="Add a transaction" description="Type it, snap the receipt, or just say what you spent." wide>
        <div role="tablist" aria-label="How to add" className="mb-5 flex gap-1 border-b border-rule">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              disabled={t.ai && !aiReady}
              title={t.ai && !aiReady ? "AI is off or not configured" : undefined}
              onClick={() => setTab(t.id)}
              className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40", tab === t.id ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink")}
            >
              {t.icon}
              {t.label}
              {t.ai && <Sparkles size={12} className="text-accent" aria-hidden />}
            </button>
          ))}
        </div>

        {tab === "receipt" && (
          <ReceiptTab
            onDraft={(d) => {
              setForm((f) => ({ ...f, type: "EXPENSE", amount: d.amount, merchant: d.merchant ?? "", description: d.description, category: d.category, date: d.date ?? f.date, source: "RECEIPT_SCAN", aiCategorized: true }));
              setNote("Read from your receipt. Check the details, then save.");
              setTab("manual");
            }}
          />
        )}

        {tab === "describe" && <DescribeTab accounts={accounts} onSaved={() => { setOpen(false); reset(); }} />}

        {tab === "manual" && (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {note && <Notice tone="accent">{note}</Notice>}
            <div role="radiogroup" aria-label="Type" className="inline-flex rounded-[5px] border border-rule p-0.5">
              {(["EXPENSE", "INCOME"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={form.type === t} onClick={() => setForm((f) => ({ ...f, type: t, category: "" }))} className={cn("rounded px-4 py-1.5 text-sm font-medium transition", form.type === t ? (t === "EXPENSE" ? "bg-loss text-white" : "bg-gain text-white") : "text-ink-2 hover:text-ink")}>
                  {t === "EXPENSE" ? "Expense" : "Income"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount" htmlFor="tx-amount" errors={errors.amount}>
                <Input id="tx-amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={form.amount} onChange={(e) => set("amount", e.target.value)} aria-invalid={!!errors.amount} className="num" autoFocus />
              </Field>
              <Field label="Date" htmlFor="tx-date" errors={errors.date}>
                <Input id="tx-date" type="date" value={form.date} max={localToday()} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="Account" htmlFor="tx-account" errors={errors.accountId}>
                <Select id="tx-account" value={form.accountId} onChange={(e) => set("accountId", e.target.value)}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Category" htmlFor="tx-category" errors={errors.category} hint="Leave on “Pick for me” and we'll use your past choices.">
                <CategorySelect id="tx-category" type={form.type} value={form.category} allowAuto onChange={(v) => setForm((f) => ({ ...f, category: v, aiCategorized: false }))} />
              </Field>
              <Field label="Description" htmlFor="tx-desc" errors={errors.description} className="sm:col-span-2">
                <Input id="tx-desc" maxLength={200} placeholder="e.g. Weekly groceries" value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Merchant (optional)" htmlFor="tx-merchant" errors={errors.merchant} className="sm:col-span-2">
                <Input id="tx-merchant" maxLength={80} value={form.merchant} onChange={(e) => set("merchant", e.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="submit" disabled={pending || !form.amount || !form.accountId}>
                {pending && <Loader2 className="animate-spin" size={16} />} Save transaction
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReceiptTab({ onDraft }: { onDraft: (d: { amount: string; merchant: string | null; description: string; category: string; date: string | null }) => void }) {
  const { run, pending } = useRun();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const imageBase64 = await prepareReceiptImage(file);
      run(() => scanReceiptAction({ imageBase64, today: localToday() }), { refresh: false, onOk: onDraft });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that image.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const working = busy || pending;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        Take or upload a photo. It is shrunk on your device, read once by the AI, and <strong className="font-semibold text-ink">not stored</strong>. You review everything before it is saved.
      </p>
      <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-rule px-6 py-12 text-center transition hover:border-accent hover:bg-accent-soft/40", working && "pointer-events-none opacity-60")}>
        {working ? <Loader2 className="animate-spin text-accent" size={28} /> : <Camera className="text-accent" size={28} />}
        <span className="font-medium">{working ? "Reading your receipt…" : "Choose a photo"}</span>
        <span className="text-[13px] text-ink-3">JPEG, PNG or WebP. Flat and well-lit works best.</span>
        <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
    </div>
  );
}

function DescribeTab({ accounts, onSaved }: { accounts: AccountOption[]; onSaved: () => void }) {
  const { fmt } = useMoney();
  const parse = useRun();
  const save = useRun();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<EntryDraft[]>([]);

  const saveAll = () =>
    save.run(
      async () => {
        for (const d of drafts) {
          const r = await createTransactionAction({ accountId: d.accountId, type: d.type, amount: d.amount, date: d.date, category: d.category, description: d.description, merchant: d.merchant ?? undefined, source: "AI_ENTRY", aiCategorized: true });
          if (!r.ok) return r;
        }
        return { ok: true as const, data: drafts.length };
      },
      { success: `Added ${drafts.length} transaction${drafts.length === 1 ? "" : "s"}`, onOk: onSaved },
    );

  return (
    <div className="space-y-4">
      <Field label="What did you spend or earn?" htmlFor="nl-text" errors={parse.errors.text} hint="Try: “lunch 450 yesterday, cab 200 from cash” or “salary 52000 on the 1st”.">
        <textarea id="nl-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={3} className="w-full rounded-[5px] border border-rule bg-surface px-3 py-2 text-sm placeholder:text-ink-3 focus:border-accent" />
      </Field>
      <div className="flex justify-end">
        <Button
          disabled={parse.pending || text.trim().length < 2}
          onClick={() => parse.run(() => parseEntryAction({ text, today: localToday() }), { refresh: false, onOk: (d) => setDrafts(d.entries) })}
        >
          {parse.pending ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Read it
        </Button>
      </div>
      {drafts.length > 0 && (
        <div className="space-y-3">
          <p className="eyebrow">Review</p>
          <ul className="divide-y divide-rule border-y border-rule">
            {drafts.map((d, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.description}</p>
                  <p className="text-[13px] text-ink-3">{d.date} · {accounts.find((a) => a.id === d.accountId)?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("num font-semibold", d.type === "INCOME" ? "text-gain" : "text-loss")}>{d.type === "INCOME" ? "+" : "−"}{fmt(Number(d.amount))}</span>
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setDrafts((all) => all.filter((_, j) => j !== i))}><Trash2 size={15} /></Button>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Select aria-label="Category" className="h-8 max-w-52 text-[13px]" value={d.category} onChange={(e) => setDrafts((all) => all.map((x, j) => (j === i ? { ...x, category: e.target.value, categoryName: categoryName(e.target.value) } : x)))}>
                    {[...new Set([d.category])].map((c) => <option key={c} value={c}>{categoryName(c)}</option>)}
                    <CategoryOptions type={d.type} except={d.category} />
                  </Select>
                  <Badge tone="accent"><Sparkles size={10} /> AI draft</Badge>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button onClick={saveAll} disabled={save.pending}>{save.pending && <Loader2 className="animate-spin" size={16} />} Save {drafts.length}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryOptions({ type, except }: { type: "INCOME" | "EXPENSE"; except: string }) {
  return <>{categoriesFor(type).filter((c) => c.id !== except).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</>;
}
