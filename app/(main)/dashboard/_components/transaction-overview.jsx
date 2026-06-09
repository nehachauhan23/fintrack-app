"use client";

import { useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { categoryColors } from "@/data/categories";

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
];

export function DashboardOverview({ accounts, transactions }) {
  const [selectedAccountId, setSelectedAccountId] = useState(
    accounts.find((a) => a.isDefault)?.id || accounts[0]?.id
  );

  const accountTransactions = useMemo(
    () => transactions.filter((t) => t.accountId === selectedAccountId),
    [transactions, selectedAccountId]
  );

  const recentTransactions = useMemo(
    () => [...accountTransactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5),
    [accountTransactions]
  );

  const pieChartData = useMemo(() => {
    const now = new Date();
    const expenses = accountTransactions.filter((t) => {
      const d = new Date(t.date);
      return (
        t.type === "EXPENSE" &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    });

    const byCategory = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [accountTransactions]);

  const monthlyTotals = useMemo(() => {
    const now = new Date();
    return accountTransactions
      .filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc, t) => {
        if (t.type === "INCOME") acc.income += t.amount;
        else acc.expense += t.amount;
        return acc;
      }, { income: 0, expense: 0 });
  }, [accountTransactions]);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Recent Transactions */}
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4 pt-5">
          <div>
            <CardTitle className="text-base font-semibold text-gray-900">Recent Transactions</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Last 5 activity</p>
          </div>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[130px] h-8 text-xs border-gray-200">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>

        <CardContent className="pb-5">
          {/* Monthly summary chips */}
          <div className="flex gap-3 mb-5">
            <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Income</p>
              <p className="font-bold text-emerald-600 text-sm">${monthlyTotals.income.toFixed(2)}</p>
            </div>
            <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-0.5">Expenses</p>
              <p className="font-bold text-red-500 text-sm">${monthlyTotals.expense.toFixed(2)}</p>
            </div>
            <div className={cn(
              "flex-1 rounded-xl p-3 text-center",
              monthlyTotals.income - monthlyTotals.expense >= 0 ? "bg-blue-50" : "bg-orange-50"
            )}>
              <p className="text-xs text-gray-400 mb-0.5">Net</p>
              <p className={cn(
                "font-bold text-sm",
                monthlyTotals.income - monthlyTotals.expense >= 0 ? "text-blue-600" : "text-orange-600"
              )}>
                ${(monthlyTotals.income - monthlyTotals.expense).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {recentTransactions.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">No transactions yet</p>
            ) : (
              recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      t.type === "EXPENSE" ? "bg-red-50" : "bg-emerald-50"
                    )}>
                      {t.type === "EXPENSE"
                        ? <ArrowDownRight size={14} className="text-red-500" />
                        : <ArrowUpRight size={14} className="text-emerald-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 leading-tight">
                        {t.description || "Untitled"}
                      </p>
                      <p className="text-xs text-gray-400">{format(new Date(t.date), "MMM d")}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-sm font-semibold",
                    t.type === "EXPENSE" ? "text-red-500" : "text-emerald-600"
                  )}>
                    {t.type === "EXPENSE" ? "-" : "+"}${t.amount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expense Breakdown */}
      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader className="pb-2 pt-5">
          <CardTitle className="text-base font-semibold text-gray-900">Expense Breakdown</CardTitle>
          <p className="text-xs text-gray-400">Current month by category</p>
        </CardHeader>
        <CardContent className="pb-5">
          {pieChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[260px] text-gray-300">
              <TrendingUp size={40} className="mb-3 opacity-40" />
              <p className="text-sm text-gray-400">No expenses this month</p>
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`$${value.toFixed(2)}`, undefined]}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ fontSize: "11px", color: "#6b7280" }}>
                        {value.charAt(0).toUpperCase() + value.slice(1)}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
