"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Money, useMoney } from "@/components/money";

export interface CategoryDatum {
  name: string;
  amount: number;
  pct: number;
  color: string;
}

export function CategoryDonut({ data, total }: { data: CategoryDatum[]; total: number }) {
  const { fmt } = useMoney();
  if (data.length === 0) return <p className="py-10 text-center text-ink-3">No spending recorded for this period.</p>;
  const top = data.slice(0, 6);
  const rest = data.slice(6);
  const slices = rest.length ? [...top, { name: "Everything else", amount: rest.reduce((a, d) => a + d.amount, 0), pct: rest.reduce((a, d) => a + d.pct, 0), color: "#8c98a3" }] : top;
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <div className="relative mx-auto h-44 w-44" role="img" aria-label={slices.map((s) => `${s.name} ${s.pct.toFixed(0)}%`).join(", ")}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="amount" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={1.5} stroke="var(--surface)" strokeWidth={2}>
              {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13 }} formatter={(v) => fmt(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><p className="eyebrow">Spent</p><Money value={total} compact className="text-lg font-semibold" /></div>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2.5">
            <i aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="num text-ink-3">{s.pct.toFixed(0)}%</span>
            <Money value={s.amount} className="w-24 text-right" />
          </li>
        ))}
      </ul>
    </div>
  );
}
