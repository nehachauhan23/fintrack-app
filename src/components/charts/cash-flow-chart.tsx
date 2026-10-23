"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMoney } from "@/components/money";

export interface CashFlowDatum {
  label: string;
  income: number;
  expense: number;
}

export function CashFlowChart({ data, height = 240 }: { data: CashFlowDatum[]; height?: number }) {
  const { fmt } = useMoney();
  const summary = data.map((d) => `${d.label}: income ${fmt(d.income)}, spending ${fmt(d.expense)}`).join("; ");
  return (
    <figure className="m-0" aria-label="Income and spending by month">
      <div role="img" aria-label={summary} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={3}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => fmt(v, { compact: true })} />
            <Tooltip
              cursor={{ fill: "var(--accent-soft)", opacity: 0.5 }}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13 }}
              formatter={(v, name) => [fmt(Number(v)), name === "income" ? "Income" : "Spending"]}
            />
            <Bar dataKey="income" fill="var(--gain)" radius={[3, 3, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expense" fill="var(--loss)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex gap-4 text-xs text-ink-3">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm bg-gain" /> Income</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-sm bg-loss" /> Spending</span>
      </figcaption>
    </figure>
  );
}
