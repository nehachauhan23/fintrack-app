"use client";

import { Loader2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { ACCOUNT_TYPES } from "@/lib/labels";
import { useRun } from "@/lib/use-run";
import { createAccountAction, updateAccountAction } from "@/server/actions/finance";

type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];

export function CreateAccountDialog({ first, trigger }: { first?: boolean; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { run, pending, errors } = useRun();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("CURRENT");
  const [opening, setOpening] = useState("0");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus size={16} /> New account</Button>}</DialogTrigger>
      <DialogContent title={first ? "Create your first account" : "New account"} description="Anything that holds money: a bank account, wallet or card.">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createAccountAction({ name, type, openingBalance: opening }), { success: "Account created", onOk: () => { setOpen(false); setName(""); setOpening("0"); } });
          }}
        >
          <Field label="Name" htmlFor="acc-name" errors={errors.name}><Input id="acc-name" value={name} maxLength={60} placeholder="e.g. Everyday account" onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Type" htmlFor="acc-type"><Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>{ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
          <Field label="Balance today" htmlFor="acc-open" errors={errors.openingBalance} hint="What the account holds right now. Use a minus sign if you owe money, e.g. -250.00 on a credit card.">
            <Input id="acc-open" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} className="num" />
          </Field>
          <div className="flex justify-end"><Button type="submit" disabled={pending || !name.trim()}>{pending && <Loader2 className="animate-spin" size={16} />} Create account</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditAccountDialog({ id, name: initialName, type: initialType }: { id: string; name: string; type: AccountType }) {
  const [open, setOpen] = useState(false);
  const { run, pending, errors } = useRun();
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<AccountType>(initialType);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary" size="sm"><Pencil size={14} /> Edit</Button></DialogTrigger>
      <DialogContent title="Edit account">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => updateAccountAction({ id, name, type }), { success: "Account updated", onOk: () => setOpen(false) }); }}>
          <Field label="Name" htmlFor="ea-name" errors={errors.name}><Input id="ea-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Type" htmlFor="ea-type"><Select id="ea-type" value={type} onChange={(e) => setType(e.target.value as AccountType)}>{ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
          <div className="flex justify-end"><Button type="submit" disabled={pending || !name.trim()}>{pending && <Loader2 className="animate-spin" size={16} />} Save</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
