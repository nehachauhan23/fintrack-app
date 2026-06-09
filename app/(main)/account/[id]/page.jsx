import { Suspense } from "react";
import { getAccountWithTransactions } from "@/actions/account";
import { TransactionTable } from "../_components/transaction-table";
import { notFound } from "next/navigation";
import { AccountChart } from "../_components/account-chart";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

function StatChip({ icon: Icon, label, value, color }) {
  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">${parseFloat(value).toFixed(2)}</p>
      </div>
    </div>
  );
}

export default async function AccountPage({ params }) {
  const resolvedParams = await params;
  const accountData = await getAccountWithTransactions(resolvedParams.id);

  if (!accountData) notFound();

  const { transactions, ...account } = accountData;

  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-8 px-4 md:px-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400 font-medium uppercase tracking-wide mb-1">
            {account.type.charAt(0) + account.type.slice(1).toLowerCase()} Account
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 capitalize leading-tight">
            {account.name}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-1">{account._count.transactions} total transactions</p>
          <p className="text-3xl font-bold text-blue-600">
            ${parseFloat(account.balance).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatChip icon={ArrowUpRight} label="Total Income" value={totalIncome} color="bg-emerald-500" />
        <StatChip icon={ArrowDownRight} label="Total Expenses" value={totalExpense} color="bg-red-400" />
        <StatChip
          icon={Activity}
          label="Net Balance"
          value={Math.abs(totalIncome - totalExpense)}
          color={totalIncome - totalExpense >= 0 ? "bg-blue-500" : "bg-orange-500"}
        />
      </div>

      {/* Chart */}
      <Suspense fallback={<div className="h-72 rounded-2xl skeleton" />}>
        <AccountChart transactions={transactions} />
      </Suspense>

      {/* Table */}
      <Suspense fallback={<div className="h-64 rounded-2xl skeleton" />}>
        <TransactionTable transactions={transactions} />
      </Suspense>
    </div>
  );
}
