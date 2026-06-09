export const dynamic = "force-dynamic";

import { getUserAccounts } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import { AddTransactionForm } from "../_components/transaction-form";
import { getTransaction } from "@/actions/transaction";
import { PenSquare, Edit3 } from "lucide-react";

export default async function AddTransactionPage({ searchParams }) {
  const accounts = await getUserAccounts();
  const resolvedParams = await searchParams;
  const editId = resolvedParams?.edit;

  let initialData = null;
  if (editId) {
    initialData = await getTransaction(editId);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          {editId
            ? <Edit3 size={18} className="text-blue-600" />
            : <PenSquare size={18} className="text-blue-600" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {editId ? "Edit Transaction" : "Add Transaction"}
          </h1>
          <p className="text-sm text-gray-400">
            {editId ? "Update the transaction details below" : "Record a new income or expense"}
          </p>
        </div>
      </div>
      <AddTransactionForm
        accounts={accounts}
        categories={defaultCategories}
        editMode={!!editId}
        initialData={initialData}
      />
    </div>
  );
}
