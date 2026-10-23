import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { GoalsView, NewGoalDialog } from "@/features/goals/goals-view";
import { requireUser } from "@/server/auth/dal";
import { listGoals } from "@/server/services/goals";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const goals = await listGoals(user.id);
  return (
    <>
      <PageHeader title="Goals" description="Savings targets with a date, and what it takes to hit them." action={goals.length > 0 ? <NewGoalDialog /> : undefined} />
      <GoalsView goals={goals} />
    </>
  );
}
