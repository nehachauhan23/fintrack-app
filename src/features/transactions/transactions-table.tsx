"use client";

import { Loader2, Pencil, Repeat, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { categoryName } from "@/domain/categories";
import { formatDate } from "@/lib/format";
import { localToday, useRun } from "@/lib/use-run";
import { bulkDeleteTransactionsAction, deleteTransactionAction, updateTransactionAction } from "@/server/actions/finance";
import type { TransactionView } from "@/server/services/transactions";
import type { AccountOption } from "./add-transaction";
import { CategorySelect } from "./category-select";

export function TransactionsTable({ items, accounts }: { items: TransactionView[]; accounts: AccountOption[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<TransactionView | null>(null);
  const { run, pending } = useRun();
  const allSelected = items.length > 0 && items.every((t) => selected.has(t.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      {selected.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="mb-3 flex items-center justify-between gap-3 rounded-md border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm">
          <span><strong>{selected.size}</strong> selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button variant="danger" size="sm" disabled={pending} onClick={() => { if (confirm(`Delete ${selected.size} transaction${selected.size === 1 ? "" : "s"}? Balances will be adjusted. Transfers are removed together with their other half.`)) run(() => bulkDeleteTransactionsAction({ ids: [...selected] }), { success: "Deleted", onOk: () => setSelected(new Set()) }); }}>
              {pending ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />} Delete
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="eyebrow border-b border-rule text-left">
              <th className="w-9 py-2 pr-2"><input type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((t) => t.id)))} className="accent-[var(--accent)]" /></th>
              <th className="py-2 pr-3 font-semibold">Date</th><th className="py-2 pr-3 font-semibold">Entry</th><th className="hidden py-2 pr-3 font-semibold md:table-cell">Account</th><th className="py-2 pr-3 text-right font-semibold">Amount</th><th className="w-20 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className={`border-b border-rule/70 transition hover:bg-accent-soft/30 ${selected.has(t.id) ? "bg-accent-soft/40" : ""}`}>
                <td className="py-2.5 pr-2"><input type="checkbox" aria-label={`Select ${t.description ?? categoryName(t.category)}`} checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="accent-[var(--accent)]" /></td>
                <td className="num whitespace-nowrap py-2.5 pr-3 text-ink-3">{formatDate(t.date)}</td>
                <td className="py-2.5 pr-3">
                  <p className="font-medium">{t.merchant || t.description || categoryName(t.category)}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
                    {t.merchant && t.description ? <span className="truncate">{t.description} ·</span> : null}
                    {t.isTransfer ? <Badge>Transfer</Badge> : <span>{categoryName(t.category)}</span>}
                    {t.aiCategorized && <Badge tone="accent"><Sparkles size={10} /> AI</Badge>}
                    {t.isRecurring && <span title="Created by a recurring rule" className="inline-flex items-center gap-0.5 text-accent"><Repeat size={12} aria-label="Recurring" /></span>}
                  </p>
                </td>
                <td className="hidden py-2.5 pr-3 text-ink-2 md:table-cell">{t.accountName}</td>
                <td className="py-2.5 pr-3 text-right font-medium"><Money value={t.type === "INCOME" || t.type === "TRANSFER_IN" ? t.amount : -t.amount} signed tone={t.isTransfer ? "none" : "auto"} className={t.isTransfer ? "text-ink-3" : ""} /></td>
                <td className="py-2.5">
                  <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(t)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" disabled={pending} onClick={() => { if (confirm(t.isTransfer ? "Delete this transfer? Both sides will be removed and balances restored." : "Delete this transaction?")) run(() => deleteTransactionAction({ id: t.id }), { success: "Deleted" }); }}><Trash2 size={14} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <EditDialog key={editing.id} tx={editing} accounts={accounts} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditDialog({ tx, accounts, onClose }: { tx: TransactionView; accounts: AccountOption[]; onClose: () => void }) {
  const { run, pending, errors } = useRun();
  const [type, setType] = useState<"INCOME" | "EXPENSE">(tx.type === "INCOME" ? "INCOME" : "EXPENSE");
  const [amount, setAmount] = useState(tx.amount.toFixed(2));
  const [date, setDate] = useState(tx.date);
  const [accountId, setAccountId] = useState(tx.accountId);
  const [category, setCategory] = useState(tx.category);
  const [description, setDescription] = useState(tx.description ?? "");
  const [merchant, setMerchant] = useState(tx.merchant ?? "");
  const locked = tx.isTransfer;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Edit transaction" description={locked ? "Transfers keep their amount and accounts. Delete and re-create to change those." : undefined} wide>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => locked
                ? updateTransactionAction({ id: tx.id, date, description })
                : updateTransactionAction({ id: tx.id, type, amount, date, accountId, category, description, merchant }),
              { success: "Saved", onOk: onClose },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {!locked && (
              <Field label="Type" htmlFor="e-type"><Select id="e-type" value={type} onChange={(e) => { const t = e.target.value as "INCOME" | "EXPENSE"; setType(t); setCategory(t === "INCOME" ? "other-income" : "other-expense"); }}><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></Select></Field>
            )}
            <Field label="Amount" htmlFor="e-amount" errors={errors.amount}><Input id="e-amount" inputMode="decimal" value={amount} disabled={locked} onChange={(e) => setAmount(e.target.value)} className="num" /></Field>
            <Field label="Date" htmlFor="e-date" errors={errors.date}><Input id="e-date" type="date" value={date} max={localToday()} onChange={(e) => setDate(e.target.value)} /></Field>
            {!locked && <Field label="Account" htmlFor="e-account"><Select id="e-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>}
            {!locked && <Field label="Category" htmlFor="e-cat" errors={errors.category}><CategorySelect id="e-cat" type={type} value={category} onChange={setCategory} /></Field>}
            <Field label="Description" htmlFor="e-desc" className={locked ? "sm:col-span-2" : ""} errors={errors.description}><Input id="e-desc" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            {!locked && <Field label="Merchant" htmlFor="e-merchant" errors={errors.merchant}><Input id="e-merchant" maxLength={80} value={merchant} onChange={(e) => setMerchant(e.target.value)} /></Field>}
          </div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" size={16} />} Save changes</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
