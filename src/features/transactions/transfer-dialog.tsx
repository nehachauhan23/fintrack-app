"use client";

import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { localToday, useRun } from "@/lib/use-run";
import { createTransferAction } from "@/server/actions/finance";
import type { AccountOption } from "./add-transaction";

export function TransferDialog({ accounts }: { accounts: AccountOption[] }) {
  const [open, setOpen] = useState(false);
  const { run, pending, errors } = useRun();
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(localToday());
  const [note, setNote] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" disabled={accounts.length < 2} title={accounts.length < 2 ? "You need two accounts to transfer between" : undefined}>
          <ArrowLeftRight size={16} /> Transfer
        </Button>
      </DialogTrigger>
      <DialogContent title="Move money" description="Transfers don't count as income or spending.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createTransferAction({ fromAccountId: from, toAccountId: to, amount, date, note: note || undefined }), { success: "Transfer recorded", onOk: () => { setOpen(false); setAmount(""); setNote(""); } });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" htmlFor="tf-from"><Select id="tf-from" value={from} onChange={(e) => setFrom(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            <Field label="To" htmlFor="tf-to" errors={errors.toAccountId}><Select id="tf-to" value={to} onChange={(e) => setTo(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
            <Field label="Amount" htmlFor="tf-amount" errors={errors.amount}><Input id="tf-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="num" /></Field>
            <Field label="Date" htmlFor="tf-date" errors={errors.date}><Input id="tf-date" type="date" value={date} max={localToday()} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <Field label="Note (optional)" htmlFor="tf-note"><Input id="tf-note" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="flex justify-end"><Button type="submit" disabled={pending || !amount || from === to}>{pending && <Loader2 className="animate-spin" size={16} />} Move money</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
