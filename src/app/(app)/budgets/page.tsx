import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { BudgetsView } from "@/features/budgets/budgets-view";
import { periodKeyOf, utcToday } from "@/domain/periods";
import { formatDate } from "@/lib/format";
import { aiConfigured } from "@/server/ai/openrouter";
import { requireUser } from "@/server/auth/dal";
import { budgetStatuses } from "@/server/services/budgets";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const user = await requireUser();
  const period = periodKeyOf(utcToday());
  const budgets = await budgetStatuses(user.id, period);
  return (
    <>
      <PageHeader title="Budgets" description={`How ${formatDate(`${period}-01`, "month")} is going against the limits you set.`} />
      <BudgetsView budgets={budgets} aiReady={user.aiEnabled && aiConfigured()} />
    </>
  );
}
