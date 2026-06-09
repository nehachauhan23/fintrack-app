import { Suspense } from "react";
import { getUserAccounts } from "@/actions/dashboard";
import { getDashboardData } from "@/actions/dashboard";
import { getCurrentBudget } from "@/actions/budget";
import { AccountCard } from "./_components/account-card";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { BudgetProgress } from "./_components/budget-progress";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, LayoutDashboard } from "lucide-react";
import { DashboardOverview } from "./_components/transaction-overview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const [accounts, transactions] = await Promise.all([
    getUserAccounts(),
    getDashboardData(),
  ]);

  const defaultAccount = accounts?.find((account) => account.isDefault);

  let budgetData = null;
  if (defaultAccount) {
    budgetData = await getCurrentBudget(defaultAccount.id);
  }

  return (
    <div className="space-y-8 px-4 md:px-6 pb-16">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
          <LayoutDashboard size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400">Your financial overview at a glance</p>
        </div>
      </div>

      {/* Budget Progress */}
      <BudgetProgress
        initialBudget={budgetData?.budget}
        currentExpenses={budgetData?.currentExpenses || 0}
      />

      {/* Transaction Overview (charts) */}
      <DashboardOverview accounts={accounts} transactions={transactions || []} />

      {/* Accounts grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Accounts</h2>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CreateAccountDrawer>
            <Card className="card-lift hover:shadow-lg cursor-pointer border-dashed border-2 border-gray-200 rounded-2xl bg-white/60 hover:border-blue-300 hover:bg-blue-50/40 transition-all duration-200">
              <CardContent className="flex flex-col items-center justify-center h-[140px] gap-2">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">Add New Account</p>
              </CardContent>
            </Card>
          </CreateAccountDrawer>

          <Suspense>
            {accounts.length > 0 ? (
              accounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))
            ) : (
              <p className="text-center text-gray-400 col-span-full py-8">
                No accounts yet — create your first one!
              </p>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
