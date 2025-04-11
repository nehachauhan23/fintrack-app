import { Suspense } from "react";
import { getAccountWithTransactions } from "@/actions/account";
import { BarLoader } from "react-spinners";
import { TransactionTable } from "../_components/transaction-table";
import { notFound } from "next/navigation";
import { AccountChart } from "../_components/account-chart";

export default async function AccountPage({ params }) {
  const accountData = await getAccountWithTransactions(params.id);

  if (!accountData) {
    notFound();
  }

  const { transactions, ...account } = accountData;

  return (
    <div className="space-y-8 px-4 sm:px-8 md:px-12 lg:px-16">
      {/* Header Section */}
      <div className="flex gap-4 items-center justify-between">
        <div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 tracking-tight gradient-title capitalize">
            {account.name}
          </h1>
          <p className="text-lg sm:text-xl text-gray-600">
            {account.type.charAt(0) + account.type.slice(1).toLowerCase()}{" "}
            Account
          </p>
        </div>

        {/* Account Balance */}
        <div className="text-right pb-2">
          <div className="text-3xl sm:text-4xl font-bold text-blue-600">
            ${parseFloat(account.balance).toFixed(2)}
          </div>
          <p className="text-sm text-gray-500">
            {account._count.transactions} Transactions
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <Suspense
        fallback={
          <div className="flex justify-center items-center mt-8">
            <BarLoader className="mt-4" width={"100%"} color="#9333ea" />
          </div>
        }
      >
        <AccountChart transactions={transactions} />
      </Suspense>

      {/* Transactions Table */}
      <Suspense
        fallback={
          <div className="flex justify-center items-center mt-8">
            <BarLoader className="mt-4" width={"100%"} color="#9333ea" />
          </div>
        }
      >
        <TransactionTable transactions={transactions} />
      </Suspense>

      {/* Add some spacing for better design */}
      <div className="pt-8 pb-16">
        {/* You can add more sections or features here if needed */}
      </div>
    </div>
  );
}
