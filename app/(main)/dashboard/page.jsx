import { Suspense } from "react";
import { getUserAccounts } from "@/actions/dashboard";
import { getDashboardData } from "@/actions/dashboard";
import { getCurrentBudget } from "@/actions/budget";
import { AccountCard } from "./_components/account-card";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { BudgetProgress } from "./_components/budget-progress";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { DashboardOverview } from "./_components/transaction-overview";

export default async function DashboardPage() {
  const [accounts, transactions] = await Promise.all([
    getUserAccounts(),
    getDashboardData(),
  ]);

  const defaultAccount = accounts?.find((account) => account.isDefault);

  // Get budget for default account
  let budgetData = null;
  if (defaultAccount) {
    budgetData = await getCurrentBudget(defaultAccount.id);
  }

  return (
    <div className="space-y-8 px-4 md:px-8">
      {/* Budget Progress */}
      <BudgetProgress
        initialBudget={budgetData?.budget}
        currentExpenses={budgetData?.currentExpenses || 0}
      />

      {/* Dashboard Overview */}
      <DashboardOverview
        accounts={accounts}
        transactions={transactions || []}
      />

      {/* Accounts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <CreateAccountDrawer>
          <Card className="hover:shadow-xl transition-shadow cursor-pointer border-dashed border-2 border-gray-300 rounded-lg p-5 flex items-center justify-center text-center">
            <CardContent>
              <Plus className="h-12 w-12 mb-4 text-gray-600" />
              <p className="text-sm font-medium text-gray-600">Add New Account</p>
            </CardContent>
          </Card>
        </CreateAccountDrawer>

        {/* Add a Suspense fallback for accounts */}
        <Suspense>
          {accounts.length > 0 ? (
            accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))
          ) : (
            <p className="text-center text-gray-500 col-span-full">No accounts found</p>
          )}
        </Suspense>
      </div>
    </div>
  );
}
