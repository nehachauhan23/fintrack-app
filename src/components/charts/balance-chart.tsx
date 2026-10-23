"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMoney } from "@/components/money";

export function BalanceChart({ data }: { data: { date: string; balance: number }[] }) {
  const { fmt } = useMoney();
  if (data.length < 2) return null;
  const first = data[0]!;
  const last = data[data.length - 1]!;
  const short = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  return (
    <div role="img" aria-label={`Balance from ${fmt(first.balance)} on ${short(first.date)} to ${fmt(last.balance)} on ${short(last.date)}`} className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="balfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} tickLine={false} axisLine={false} minTickGap={36} />
          <YAxis tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]} tickFormatter={(v: number) => fmt(v, { compact: true })} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 13 }} labelFormatter={(l) => short(String(l))} formatter={(v) => [fmt(Number(v)), "Balance"]} />
          <Area type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2} fill="url(#balfill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
