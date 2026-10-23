"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/domain/categories";
import type { AccountOption } from "./add-transaction";

const KEYS = ["q", "type", "category", "accountId", "from", "to"] as const;

export function FiltersBar({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = KEYS.some((k) => params.get(k));
  const val = (k: string) => params.get(k) ?? "";

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input aria-label="Search transactions" placeholder="Search description or merchant" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <Select aria-label="Type" value={val("type")} onChange={(e) => update({ type: e.target.value || null })}>
        <option value="">All types</option><option value="EXPENSE">Expenses</option><option value="INCOME">Income</option><option value="TRANSFER">Transfers</option>
      </Select>
      <Select aria-label="Category" value={val("category")} onChange={(e) => update({ category: e.target.value || null })}>
        <option value="">All categories</option>
        <optgroup label="Expenses">{EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
        <optgroup label="Income">{INCOME_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
      </Select>
      <Select aria-label="Account" value={val("accountId")} onChange={(e) => update({ accountId: e.target.value || null })}>
        <option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>
      <label className="flex items-center gap-2 text-[13px] text-ink-3">From <Input type="date" aria-label="From date" value={val("from")} onChange={(e) => update({ from: e.target.value || null })} /></label>
      <label className="flex items-center gap-2 text-[13px] text-ink-3">To <Input type="date" aria-label="To date" value={val("to")} onChange={(e) => update({ to: e.target.value || null })} /></label>
      {active && <div className="flex items-center"><Button variant="ghost" size="sm" onClick={() => { setQ(""); start(() => router.replace(pathname, { scroll: false })); }}><X size={14} /> Clear filters</Button></div>}
    </div>
  );
}
