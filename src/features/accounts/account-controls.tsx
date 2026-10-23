"use client";

import { Archive, ArchiveRestore, CheckCircle2, Loader2, ShieldCheck, Star, Trash2, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { useMoney } from "@/components/money";
import { useRun } from "@/lib/use-run";
import { archiveAccountAction, deleteAccountPermanentlyAction, reconcileAccountAction, restoreAccountAction, setDefaultAccountAction } from "@/server/actions/finance";

export function AccountControls({ id, isDefault, archived, hasTransactions }: { id: string; isDefault: boolean; archived: boolean; hasTransactions: boolean }) {
  const { run, pending } = useRun();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {!isDefault && !archived && <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => setDefaultAccountAction({ id }), { success: "Default account updated" })}><Star size={14} /> Make default</Button>}
      {archived ? (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => restoreAccountAction({ id }), { success: "Account restored" })}><ArchiveRestore size={14} /> Restore</Button>
      ) : (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => { if (confirm("Archive this account? Its history is kept, and recurring rules on it will pause.")) run(() => archiveAccountAction({ id }), { success: "Account archived", onOk: () => router.push("/accounts") }); }}><Archive size={14} /> Archive</Button>
      )}
      {!hasTransactions && <Button variant="danger" size="sm" disabled={pending} onClick={() => { if (confirm("Delete this empty account permanently?")) run(() => deleteAccountPermanentlyAction({ id }), { success: "Account deleted", onOk: () => router.push("/accounts") }); }}><Trash2 size={14} /> Delete</Button>}
    </div>
  );
}

export function ReconcilePanel({ id }: { id: string }) {
  const { fmt } = useMoney();
  const check = useRun();
  const fix = useRun();
  const [report, setReport] = useState<{ stored: number; expected: number; drift: number; fixed: boolean } | null>(null);

  return (
    <div>
      <p className="max-w-xl text-ink-2">Every balance should equal the opening balance plus all of its entries. This check recomputes it from the ledger and tells you if the stored figure has drifted.</p>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={check.pending} onClick={() => check.run(() => reconcileAccountAction({ id, fix: false }), { refresh: false, onOk: setReport })}>
          {check.pending ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Verify balance
        </Button>
      </div>
      {report && (report.drift === 0 ? (
        <div className="mt-3"><Notice tone="accent"><span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-accent" /> Balance verified: {fmt(report.stored)} matches the ledger exactly.</span></Notice></div>
      ) : (
        <div className="mt-3 space-y-3"><Notice tone="warn">Stored balance is {fmt(report.stored)} but the ledger says {fmt(report.expected)} (difference {fmt(report.drift, { signed: true })}).</Notice>
          <Button size="sm" disabled={fix.pending} onClick={() => fix.run(() => reconcileAccountAction({ id, fix: true }), { success: "Balance repaired", onOk: () => setReport(null) })}>{fix.pending ? <Loader2 className="animate-spin" size={14} /> : <Wrench size={14} />} Repair to {fmt(report.expected)}</Button></div>
      ))}
    </div>
  );
}
