"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DATE_RANGES = {
  "7D":  { label: "Last 7 Days", days: 7 },
  "1M":  { label: "Last Month", days: 30 },
  "3M":  { label: "Last 3 Months", days: 90 },
  "6M":  { label: "Last 6 Months", days: 180 },
  "ALL": { label: "All Time", days: null },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">${p.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export function AccountChart({ transactions }) {
  const [dateRange, setDateRange] = useState("1M");

  const filteredData = useMemo(() => {
    const range = DATE_RANGES[dateRange];
    const now = new Date();
    const startDate = range.days ? startOfDay(subDays(now, range.days)) : startOfDay(new Date(0));

    const filtered = transactions.filter(
      (t) => new Date(t.date) >= startDate && new Date(t.date) <= endOfDay(now)
    );

    const grouped = filtered.reduce((acc, t) => {
      const date = format(new Date(t.date), dateRange === "7D" ? "MMM dd" : dateRange === "ALL" ? "MMM yy" : "MMM dd");
      if (!acc[date]) acc[date] = { date, income: 0, expense: 0 };
      if (t.type === "INCOME") acc[date].income += t.amount;
      else acc[date].expense += t.amount;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [transactions, dateRange]);

  const totals = useMemo(
    () => filteredData.reduce((acc, d) => ({ income: acc.income + d.income, expense: acc.expense + d.expense }), { income: 0, expense: 0 }),
    [filteredData]
  );

  return (
    <Card className="rounded-2xl border-gray-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-6 pt-5">
        <div>
          <CardTitle className="text-base font-semibold text-gray-900">Transaction Overview</CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">Income vs expenses over time</p>
        </div>
        <Select defaultValue={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[130px] h-8 text-xs border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DATE_RANGES).map(([key, { label }]) => (
              <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pb-6">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Income", value: totals.income, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Expenses", value: totals.expense, color: "text-red-500", bg: "bg-red-50" },
            { label: "Net", value: totals.income - totals.expense, color: totals.income - totals.expense >= 0 ? "text-blue-600" : "text-orange-500", bg: totals.income - totals.expense >= 0 ? "bg-blue-50" : "bg-orange-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
              <p className={`font-bold text-sm ${s.color}`}>
                {s.value < 0 ? "-" : ""}${Math.abs(s.value).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        <div className="h-[280px]">
          {filteredData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              No transaction data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8" }} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} tick={{ fill: "#94a3b8" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: "#6b7280" }}>{v}</span>} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
