import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { AssistantChat } from "@/features/assistant/assistant-chat";
import { aiConfigured } from "@/server/ai/openrouter";
import { aiUsageToday } from "@/server/ai/quota";
import { requireUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Assistant" };

export default async function AssistantPage() {
  const user = await requireUser();
  const usage = await aiUsageToday(user.id);
  const reason = !user.aiEnabled ? "AI features are turned off. You can switch them on in Settings." : !aiConfigured() ? "The assistant needs an OpenRouter API key on the server (OPENROUTER_API_KEY). See the README." : undefined;
  return (
    <>
      <PageHeader title="Assistant" description="Ask about your spending, income and cash flow." />
      <AssistantChat used={usage.used} limit={usage.limit} aiReady={!reason} reason={reason} />
    </>
  );
}
