"use client";

import { Loader2, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { SUPPORTED_CURRENCIES } from "@/domain/money";
import { formatDate } from "@/lib/format";
import { useRun } from "@/lib/use-run";
import { changePasswordAction, deleteAccountAction, revokeSessionAction, signOutOthersAction, updateProfileAction } from "@/server/actions/auth";
import type { SessionView } from "@/server/services/auth";

export function ProfileForm({ name: n0, currency: c0 }: { name: string; currency: string }) {
  const { run, pending, errors } = useRun();
  const [name, setName] = useState(n0);
  const [currency, setCurrency] = useState(c0);
  return (
    <form className="grid max-w-xl gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => updateProfileAction({ name, currency: currency as (typeof SUPPORTED_CURRENCIES)[number] }), { success: "Saved" }); }}>
      <Field label="Name" htmlFor="p-name" errors={errors.name}><Input id="p-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Currency" htmlFor="p-cur" hint="Used for display. Amounts aren't converted."><Select id="p-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>{SUPPORTED_CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending || !name.trim() || (name === n0 && currency === c0)}>{pending && <Loader2 className="animate-spin" size={16} />} Save profile</Button></div>
    </form>
  );
}

export function PreferenceToggles({ emailAlerts, aiEnabled }: { emailAlerts: boolean; aiEnabled: boolean }) {
  const { run, pending } = useRun();
  const row = (id: string, label: string, hint: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-6 py-4">
      <span><span className="block font-medium">{label}</span><span className="block text-sm text-ink-2">{hint}</span></span>
      <input id={id} role="switch" type="checkbox" checked={checked} disabled={pending} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-rule transition checked:bg-accent [&::after]:block [&::after]:h-5 [&::after]:w-5 [&::after]:rounded-full [&::after]:border [&::after]:border-rule [&::after]:bg-surface [&::after]:transition checked:[&::after]:translate-x-4" />
    </label>
  );
  return (
    <div className="max-w-xl divide-y divide-rule border-y border-rule">
      {row("t-email", "Email alerts", "Budget warnings at 80% and 100%, and a summary on the 1st of each month.", emailAlerts, (v) => run(() => updateProfileAction({ emailAlerts: v }), { success: v ? "Email alerts on" : "Email alerts off" }))}
      {row("t-ai", "AI features", "Receipt scanning, “describe it” entry, smart categories, the assistant and AI reviews.", aiEnabled, (v) => run(() => updateProfileAction({ aiEnabled: v }), { success: v ? "AI features on" : "AI features off" }))}
    </div>
  );
}

export function PasswordForm() {
  const { run, pending, errors } = useRun();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  return (
    <form className="grid max-w-xl gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => changePasswordAction({ currentPassword: current, newPassword: next }), { success: "Password changed. Other devices were signed out.", onOk: () => { setCurrent(""); setNext(""); } }); }}>
      <Field label="Current password" htmlFor="pw-cur" errors={errors.currentPassword}><Input id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
      <Field label="New password" htmlFor="pw-new" errors={errors.newPassword} hint="At least 10 characters."><Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending || !current || !next}>{pending && <Loader2 className="animate-spin" size={16} />} Change password</Button></div>
    </form>
  );
}

export function SessionsList({ sessions }: { sessions: SessionView[] }) {
  const { run, pending } = useRun();
  const label = (ua: string | null) => (ua ? ua.replace(/\s*\(.*?\)\s*/g, " ").slice(0, 60) : "Unknown device");
  return (
    <div className="max-w-2xl">
      <ul className="divide-y divide-rule border-y border-rule">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0"><p className="flex items-center gap-2 truncate font-medium">{label(s.userAgent)} {s.current && <Badge tone="accent">This device</Badge>}</p><p className="text-[13px] text-ink-3">Signed in {formatDate(s.createdAt)} · last active {formatDate(s.lastUsedAt)}{s.ip && s.ip !== "unknown" ? ` · ${s.ip}` : ""}</p></div>
            {!s.current && <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(() => revokeSessionAction({ sessionId: s.id }), { success: "Signed out" })}>Sign out</Button>}
          </li>
        ))}
      </ul>
      {sessions.length > 1 && <Button className="mt-3" variant="secondary" size="sm" disabled={pending} onClick={() => run(() => signOutOthersAction({}), { success: "Other devices signed out" })}><LogOut size={14} /> Sign out everywhere else</Button>}
    </div>
  );
}

export function DangerZone() {
  const router = useRouter();
  const { run, pending, errors } = useRun();
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="danger"><Trash2 size={15} /> Delete my account</Button></DialogTrigger>
      <DialogContent title="Delete your account?" description="This permanently removes your accounts, transactions, budgets, goals and everything else. It can't be undone. Download your data first if you want a copy.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => deleteAccountAction({ password }), { refresh: false, onOk: () => { router.replace("/"); router.refresh(); } }); }}>
          <Field label="Confirm with your password" htmlFor="del-pw" errors={errors.password}><Input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Keep my account</Button><Button type="submit" variant="danger" disabled={pending || !password}>{pending && <Loader2 className="animate-spin" size={16} />} Delete everything</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
