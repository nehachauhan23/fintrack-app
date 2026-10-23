import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { NewRuleDialog, RecurringView } from "@/features/recurring/recurring-view";
import { requireUser } from "@/server/auth/dal";
import { listAccounts } from "@/server/services/accounts";
import { listRules, suggestSubscriptions } from "@/server/services/recurring";

export const metadata: Metadata = { title: "Recurring" };

export default async function RecurringPage() {
  const user = await requireUser();
  const [rules, suggestions, accounts] = await Promise.all([listRules(user.id), suggestSubscriptions(user.id), listAccounts(user.id)]);
  return (
    <>
      <PageHeader title="Recurring" description="Salary, rent and subscriptions that post themselves." action={rules.length > 0 ? <NewRuleDialog accounts={accounts} /> : undefined} />
      <RecurringView rules={rules} suggestions={suggestions} accounts={accounts} />
    </>
  );
}
